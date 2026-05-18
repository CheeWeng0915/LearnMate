from typing import List, Optional

from pydantic import BaseModel, Field


class LearningProfileRequest(BaseModel):
    display_name: Optional[str] = Field(default="", max_length=120)
    learning_style: Optional[str] = Field(default="", max_length=120)
    preferred_language: Optional[str] = Field(default="", max_length=40)
    daily_minutes_default: Optional[int] = Field(default=None, ge=5, le=480)
    weekly_goal: Optional[str] = Field(default="", max_length=240)
    focus_areas: List[str] = Field(default_factory=list, max_length=12)
