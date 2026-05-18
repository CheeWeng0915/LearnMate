from pydantic import BaseModel, Field


class ReviewGenerateRequest(BaseModel):
    plan_id: str = Field(..., min_length=1)
    day: int = Field(..., ge=1)
