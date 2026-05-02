from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class LearningPlanGenerateRequest(BaseModel):
    goal: str = Field(..., example="I want to learn SQL JOIN in 3 days")
    level: str = Field(default="beginner", example="beginner")
    daily_minutes: int = Field(default=60, example=60)
    language: str = Field(default="en", example="en")


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
    user_id: str = Field(default="demo_user", example="demo_user")
    plan: Dict[str, Any]
    resources_by_day: Optional[Dict[str, Any]] = None