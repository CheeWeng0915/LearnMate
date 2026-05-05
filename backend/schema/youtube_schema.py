from typing import List, Optional
from pydantic import BaseModel, Field


class YouTubeSearchRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=200, example="SQL JOIN tutorial beginner")
    max_results: Optional[int] = Field(default=5, ge=1, le=10, example=5)


class YouTubeVideo(BaseModel):
    video_id: str
    title: str
    description: str
    channel_title: str
    published_at: str
    thumbnail_url: str
    url: str


class YouTubeSearchResponse(BaseModel):
    query: str
    videos: List[YouTubeVideo]
