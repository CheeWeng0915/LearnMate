from fastapi import APIRouter, Depends, HTTPException

from schema.youtube_schema import YouTubeSearchRequest
from service.auth_service import get_current_user
from service.quota_service import DAILY_YOUTUBE_SEARCH_LIMIT, enforce_user_quota
from service.youtube_service import search_youtube_videos


router = APIRouter(
    prefix="/api/youtube",
    tags=["YouTube"]
)


@router.post("/search")
def search_videos(
    request: YouTubeSearchRequest,
    current_user=Depends(get_current_user)
):
    try:
        enforce_user_quota(
            user_id=current_user["id"],
            action="youtube_search",
            limit=DAILY_YOUTUBE_SEARCH_LIMIT
        )
        result = search_youtube_videos(
            query=request.query,
            max_results=request.max_results
        )

        return {
            "success": True,
            "message": "YouTube videos fetched successfully",
            "data": result
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
