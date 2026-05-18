import json
import os
from pathlib import Path
from typing import Any, Dict, List

from dotenv import load_dotenv

from service.gemini_service import GEMINI_MODEL, client, clean_json_response
from service.mongodb_service import (
    get_learning_profile,
    get_learning_review_context,
    save_learning_review,
    serialize_mongo_doc
)


BASE_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = BASE_DIR / ".env"

load_dotenv(dotenv_path=ENV_PATH, override=True)

REVIEW_AGENT_MODEL = os.getenv("REVIEW_AGENT_MODEL", GEMINI_MODEL)


def _fallback_review(context: Dict[str, Any]):
    day = context.get("day") or {}
    title = day.get("title") or f"Day {day.get('day', '')}".strip()
    tasks = context.get("tasks") or []
    completed = [task for task in tasks if task.get("completed")]
    task_text = (
        completed[0].get("description")
        if completed
        else tasks[0].get("description") if tasks else title
    )

    return {
        "summary": f"Review the main ideas from {title}, especially: {task_text}.",
        "questions": [
            f"What was the main concept from {title}?",
            f"How would you explain this task in your own words: {task_text}?",
            "What is one example or use case you can recall without looking?"
        ],
        "answer_key": [
            "A concise explanation of the core idea covered in today's tasks.",
            "An answer that connects the task to the learner's goal and uses clear steps.",
            "A concrete example based on the notes, tasks, or watched resources."
        ],
        "recommended_review_action": "Spend 10 minutes rewriting your notes, then answer the questions without checking the resources."
    }


def _normalize_review_payload(payload: Any, context: Dict[str, Any]):
    fallback = _fallback_review(context)

    if not isinstance(payload, dict):
        return fallback

    questions = payload.get("questions")
    answer_key = payload.get("answer_key")

    if not isinstance(questions, list):
        questions = fallback["questions"]
    else:
        questions = [str(question).strip() for question in questions if str(question).strip()][:3]

    if not isinstance(answer_key, list):
        answer_key = fallback["answer_key"]
    else:
        answer_key = [str(answer).strip() for answer in answer_key if str(answer).strip()][:3]

    while len(questions) < 3:
        questions.append(fallback["questions"][len(questions)])

    while len(answer_key) < 3:
        answer_key.append(fallback["answer_key"][len(answer_key)])

    return {
        "summary": str(payload.get("summary") or fallback["summary"]),
        "questions": questions,
        "answer_key": answer_key,
        "recommended_review_action": str(
            payload.get("recommended_review_action") or
            fallback["recommended_review_action"]
        )
    }


def generate_day_review(user_id: str, plan_id: str, day: int):
    context = get_learning_review_context(
        plan_id=plan_id,
        day=day,
        user_id=user_id
    )
    profile = get_learning_profile(user_id=user_id)
    safe_context = serialize_mongo_doc(
        {
            "profile": profile,
            "learning_context": context
        }
    )

    prompt = f"""
You are LearnMate's Smart Review Agent.

Create a short review quiz from the learner's saved account profile and saved learning state.
Use only the supplied plan day, completed tasks, notes, and resources. Do not invent completed work.

Context:
{json.dumps(safe_context, ensure_ascii=False, indent=2)}

Return ONLY valid JSON with this shape:
{{
  "summary": "2 to 3 sentences summarizing what the learner should review.",
  "questions": ["Exactly 3 short review questions"],
  "answer_key": ["Exactly 3 concise expected answers in the same order"],
  "recommended_review_action": "One concrete next review action"
}}
"""

    try:
        response = client.models.generate_content(
            model=REVIEW_AGENT_MODEL,
            contents=prompt
        )
        raw_text = response.text or ""
        payload = json.loads(clean_json_response(raw_text))
    except Exception:
        payload = _fallback_review(safe_context["learning_context"])

    review = _normalize_review_payload(payload, safe_context["learning_context"])

    return save_learning_review(
        plan_id=plan_id,
        day=day,
        user_id=user_id,
        review=review
    )
