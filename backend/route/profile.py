from fastapi import APIRouter, Depends, HTTPException

from schema.profile_schema import LearningProfileRequest
from service.auth_service import get_current_user
from service.mongodb_service import get_learning_profile, save_learning_profile


router = APIRouter(
    prefix="/api/profile",
    tags=["Profile"]
)


@router.get("")
def get_profile(current_user=Depends(get_current_user)):
    try:
        return {
            "success": True,
            "message": "Learning profile fetched successfully",
            "data": get_learning_profile(user_id=current_user["id"])
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("")
def update_profile(
    request: LearningProfileRequest,
    current_user=Depends(get_current_user)
):
    try:
        return {
            "success": True,
            "message": "Learning profile saved successfully",
            "data": save_learning_profile(
                user_id=current_user["id"],
                profile=request.model_dump()
            )
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
