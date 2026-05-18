import os
import json
from pathlib import Path
from dotenv import load_dotenv
from google import genai


BASE_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = BASE_DIR / ".env"

load_dotenv(dotenv_path=ENV_PATH, override=True)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

if not GEMINI_API_KEY:
    raise RuntimeError(f"GEMINI_API_KEY is missing. Please check {ENV_PATH}")

client = genai.Client(api_key=GEMINI_API_KEY)


def clean_json_response(raw_text: str) -> str:
    """
    Gemini 有时会回 ```json ... ```
    这里把 markdown wrapper 移除掉。
    """
    text = raw_text.strip()

    if text.startswith("```json"):
        text = text.replace("```json", "", 1).strip()

    if text.startswith("```"):
        text = text.replace("```", "", 1).strip()

    if text.endswith("```"):
        text = text[:-3].strip()

    return text


def generate_learning_plan(
    goal: str,
    level: str,
    daily_minutes: int,
    language: str,
    learning_profile=None
):
    profile = learning_profile or {}
    profile_context = {
        "display_name": profile.get("display_name"),
        "learning_style": profile.get("learning_style"),
        "preferred_language": profile.get("preferred_language"),
        "weekly_goal": profile.get("weekly_goal"),
        "focus_areas": profile.get("focus_areas", [])
    }
    prompt = f"""
You are LearnMate, an AI learning agent.

Create a structured learning plan based on the user's goal.

User goal: {goal}
User level: {level}
Daily study time: {daily_minutes} minutes
Preferred language: {language}
Saved learning profile:
{json.dumps(profile_context, ensure_ascii=False, indent=2)}

Important rules:
- Return ONLY valid JSON.
- Do not include markdown.
- Do not include explanation outside JSON.
- Make the plan practical for a beginner.
- Adapt task wording, examples, pacing, and resource search queries to the saved learning profile when present.
- Each day must include search_queries for YouTube search.
- duration_days should be inferred from the user's goal. If not clear, use 3.

JSON format:
{{
  "goal": "{goal}",
  "topic": "SQL JOIN",
  "duration_days": 3,
  "level": "{level}",
  "daily_minutes": {daily_minutes},
  "learning_outcome": "Understand INNER JOIN, LEFT JOIN, RIGHT JOIN and complete basic SQL JOIN practice.",
  "days": [
    {{
      "day": 1,
      "title": "Understand SQL JOIN basics and INNER JOIN",
      "tasks": [
        "Learn why JOIN is used",
        "Understand table relationships",
        "Practice INNER JOIN with simple examples"
      ],
      "search_queries": [
        "SQL JOIN tutorial beginner",
        "SQL INNER JOIN explained beginner"
      ]
    }}
  ]
}}
"""

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt
    )

    raw_text = response.text
    cleaned_text = clean_json_response(raw_text)

    try:
        return json.loads(cleaned_text)
    except json.JSONDecodeError:
        raise ValueError(f"Gemini returned invalid JSON: {raw_text}")
