from typing import Optional

from pydantic import BaseModel, Field


class CoachAgentRequest(BaseModel):
    question: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Optional learner question for the coach agent."
    )

