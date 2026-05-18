import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

from service.gemini_service import GEMINI_MODEL, client, clean_json_response
from service.mongodb_service import (
    db,
    get_active_learning_plan,
    get_next_learning_task,
    serialize_mongo_doc,
    to_object_id
)


BASE_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = BASE_DIR / ".env"

load_dotenv(dotenv_path=ENV_PATH, override=True)

COACH_AGENT_MODEL = os.getenv("COACH_AGENT_MODEL", GEMINI_MODEL)


def _iso(value):
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _completion_counts(tasks: List[Dict[str, Any]]):
    total = len(tasks)
    completed = len([task for task in tasks if task.get("completed")])
    return {
        "total_tasks": total,
        "completed_tasks": completed,
        "remaining_tasks": max(total - completed, 0),
        "completion_percent": round((completed / total) * 100) if total else 0
    }


def _recent_notes(plan_id: str, user_id: str):
    try:
        plan_object_id = to_object_id(plan_id)
    except ValueError:
        return []

    notes = list(
        db.learning_day_notes.find(
            {
                "plan_id": plan_object_id,
                "user_id": user_id,
                "note": {
                    "$ne": ""
                }
            }
        ).sort([("updated_at", -1)]).limit(5)
    )

    return [
        {
            "day": note.get("day"),
            "note": note.get("note", ""),
            "updated_at": _iso(note.get("updated_at"))
        }
        for note in notes
    ]


def _resource_summary(resources_by_day: Dict[str, List[Dict[str, Any]]]):
    total = 0
    completed = 0
    sample = []

    for day, resources in resources_by_day.items():
        for resource in resources:
            total += 1
            if resource.get("completed"):
                completed += 1
            if len(sample) < 5:
                sample.append({
                    "day": day,
                    "title": resource.get("title"),
                    "channel_title": resource.get("channel_title"),
                    "completed": resource.get("completed", False)
                })

    return {
        "total_resources": total,
        "completed_resources": completed,
        "sample_resources": sample
    }


def get_learning_context_for_agent(user_id: str):
    active_plan = get_active_learning_plan(user_id=user_id)

    if not active_plan:
        return {
            "has_active_plan": False,
            "plan": None,
            "tasks": [],
            "next": None,
            "notes": [],
            "resources": {
                "total_resources": 0,
                "completed_resources": 0,
                "sample_resources": []
            },
            "progress": {
                "total_tasks": 0,
                "completed_tasks": 0,
                "remaining_tasks": 0,
                "completion_percent": 0
            }
        }

    next_task = get_next_learning_task(
        plan_id=active_plan["id"],
        user_id=user_id
    )
    tasks = active_plan.get("tasks") or []
    resources_by_day = active_plan.get("resources_by_day") or {}

    return {
        "has_active_plan": True,
        "plan": {
            "id": active_plan["id"],
            "goal": active_plan["plan"].get("goal"),
            "topic": active_plan["plan"].get("topic"),
            "level": active_plan["plan"].get("level"),
            "duration_days": active_plan["plan"].get("duration_days"),
            "daily_minutes": active_plan["plan"].get("daily_minutes"),
            "learning_outcome": active_plan["plan"].get("learning_outcome"),
            "created_at": active_plan.get("created_at"),
            "last_studied_at": active_plan.get("last_studied_at")
        },
        "progress": _completion_counts(tasks),
        "next": next_task,
        "tasks": tasks[:30],
        "notes": _recent_notes(active_plan["id"], user_id),
        "resources": _resource_summary(resources_by_day)
    }


def _fallback_coach_response(context: Dict[str, Any], question: Optional[str]):
    if not context.get("has_active_plan"):
        return {
            "summary": "You do not have an active learning plan yet.",
            "recommendation": "Create a learning plan first so I can coach you from your saved goals, tasks, notes, and resources.",
            "next_actions": [
                "Create a new learning plan",
                "Save the plan",
                "Come back to the dashboard for personalized coaching"
            ],
            "motivation": "A clear plan makes the next step much easier to start.",
            "question_answer": question or ""
        }

    next_task = (context.get("next") or {}).get("task") or {}
    description = next_task.get("description") or "review your next pending task"
    day = next_task.get("day")
    progress = context.get("progress") or {}

    return {
        "summary": (
            f"You have completed {progress.get('completed_tasks', 0)} of "
            f"{progress.get('total_tasks', 0)} tasks."
        ),
        "recommendation": (
            f"Focus on Day {day}: {description}."
            if day else
            "Your current plan looks complete. Consider generating a follow-up plan."
        ),
        "next_actions": [
            description,
            "Spend one focused study block on the task",
            "Write a short note about what you learned"
        ],
        "motivation": "Small daily progress is enough if you keep the feedback loop clear.",
        "question_answer": question or ""
    }


def _normalize_coach_payload(payload: Any, context: Dict[str, Any], question: Optional[str]):
    fallback = _fallback_coach_response(context, question)

    if not isinstance(payload, dict):
        return fallback

    next_actions = payload.get("next_actions")

    if not isinstance(next_actions, list):
        next_actions = fallback["next_actions"]
    else:
        next_actions = [
            str(action)
            for action in next_actions
            if str(action).strip()
        ][:4] or fallback["next_actions"]

    return {
        "summary": str(payload.get("summary") or fallback["summary"]),
        "recommendation": str(
            payload.get("recommendation") or fallback["recommendation"]
        ),
        "next_actions": next_actions,
        "motivation": str(payload.get("motivation") or fallback["motivation"]),
        "question_answer": str(
            payload.get("question_answer") or fallback["question_answer"]
        )
    }


def generate_coach_response(user_id: str, question: Optional[str] = None):
    context = get_learning_context_for_agent(user_id)
    safe_context = serialize_mongo_doc(context)
    prompt = f"""
You are LearnMate's Learning Progress Coach Agent.

Use the learner's saved MongoDB learning state to provide concise, practical coaching.
Do not invent completed work, notes, or resources.

Learner question:
{question or "What should I study next?"}

Learner context from MongoDB:
{json.dumps(safe_context, ensure_ascii=False, indent=2)}

Return ONLY valid JSON with this shape:
{{
  "summary": "One short paragraph about the learner's current state.",
  "recommendation": "One clear recommendation for what to do next.",
  "next_actions": ["2 to 4 concrete next actions"],
  "motivation": "One short, non-cheesy encouragement line.",
  "question_answer": "Answer the learner's question directly. If no question was provided, summarize why the recommendation fits."
}}
"""

    try:
        response = client.models.generate_content(
            model=COACH_AGENT_MODEL,
            contents=prompt
        )
        raw_text = response.text or ""
        payload = json.loads(clean_json_response(raw_text))
    except Exception:
        payload = _fallback_coach_response(safe_context, question)

    payload = _normalize_coach_payload(payload, safe_context, question)

    return {
        "agent": {
            "name": "Learning Progress Coach",
            "model": COACH_AGENT_MODEL,
            "google_adk_ready": True,
            "mongodb_mcp_enabled": False,
            "mongodb_mcp_entrypoint": "backend/agent/agent.py",
            "context_source": "learnmate_mongodb_service"
        },
        "context": safe_context,
        "coach": payload
    }
