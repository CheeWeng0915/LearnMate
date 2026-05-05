from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class LearningPlanGenerateRequest(BaseModel):
    goal: str = Field(
        ...,
        min_length=3,
        max_length=500,
        example="I want to learn SQL JOIN in 3 days"
    )
    level: str = Field(default="beginner", max_length=40, example="beginner")
    daily_minutes: int = Field(default=60, ge=5, le=480, example=60)
    language: str = Field(default="en", min_length=2, max_length=20, example="en")


class LearningDay(BaseModel):
    day: int
    title: str
    tasks: List[str]
    search_queries: List[str]


class LearningPlanData(BaseModel):
    goal: str
    topic: str
    duration_days: int
    level: str
    daily_minutes: int
    learning_outcome: str
    days: List[LearningDay]


class SaveLearningPlanRequest(BaseModel):
    plan: Dict[str, Any]
    resources_by_day: Optional[Dict[str, Any]] = None
