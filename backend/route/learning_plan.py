from fastapi import APIRouter, Depends, HTTPException

from schema.learning_plan_schema import (
    LearningPlanGenerateRequest,
    SaveLearningPlanRequest
)

from service.auth_service import get_current_user
from service.gemini_service import generate_learning_plan
from service.mongodb_service import (
    save_learning_plan,
    get_active_learning_plan,
    get_next_learning_task
)
from service.quota_service import DAILY_LEARNING_PLAN_LIMIT, enforce_user_quota


router = APIRouter(
    prefix="/api/learning-plans",
    tags=["Learning Plans"]
)


@router.post("/generate")
def generate_plan(
    request: LearningPlanGenerateRequest,
    current_user=Depends(get_current_user)
):
    try:
        enforce_user_quota(
            user_id=current_user["id"],
            action="learning_plan_generate",
            limit=DAILY_LEARNING_PLAN_LIMIT
        )
        plan = generate_learning_plan(
            goal=request.goal,
            level=request.level,
            daily_minutes=request.daily_minutes,
            language=request.language
        )

        return {
            "success": True,
            "message": "Learning plan generated successfully",
            "data": plan
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.post("/save")
def save_plan(
    request: SaveLearningPlanRequest,
    current_user=Depends(get_current_user)
):
    try:
        result = save_learning_plan(
            user_id=current_user["id"],
            plan=request.plan,
            resources_by_day=request.resources_by_day
        )

        return {
            "success": True,
            "message": "Learning plan saved successfully",
            "data": result
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.get("/active")
def get_active_plan(current_user=Depends(get_current_user)):
    try:
        result = get_active_learning_plan(user_id=current_user["id"])

        if not result:
            return {
                "success": True,
                "message": "No active learning plan found",
                "data": None
            }

        return {
            "success": True,
            "message": "Active learning plan fetched successfully",
            "data": result
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.get("/{plan_id}/next")
def get_next_task(
    plan_id: str,
    current_user=Depends(get_current_user)
):
    try:
        result = get_next_learning_task(
            plan_id=plan_id,
            user_id=current_user["id"]
        )

        return {
            "success": True,
            "message": "Next learning task fetched successfully",
            "data": result
        }

    except ValueError as e:
        raise HTTPException(
            status_code=404,
            detail=str(e)
        )

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
