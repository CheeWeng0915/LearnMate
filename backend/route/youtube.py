from fastapi import APIRouter, HTTPException

from schema.youtube_schema import YouTubeSearchRequest
from service.youtube_service import search_youtube_videos


router = APIRouter(
    prefix="/api/youtube",
    tags=["YouTube"]
)


@router.post("/search")
def search_videos(request: YouTubeSearchRequest):
    try:
        result = search_youtube_videos(
            query=request.query,
            max_results=request.max_results
        )

        return {
            "success": True,
            "message": "YouTube videos fetched successfully",
            "data": result
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )