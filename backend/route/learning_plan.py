from fastapi import APIRouter, HTTPException, Query

from schema.learning_plan_schema import (
    LearningPlanGenerateRequest,
    SaveLearningPlanRequest
)

from service.gemini_service import generate_learning_plan
from service.mongodb_service import (
    save_learning_plan,
    get_active_learning_plan,
    get_next_learning_task
)


router = APIRouter(
    prefix="/api/learning-plans",
    tags=["Learning Plans"]
)


@router.post("/generate")
def generate_plan(request: LearningPlanGenerateRequest):
    try:
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

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.post("/save")
def save_plan(request: SaveLearningPlanRequest):
    try:
        result = save_learning_plan(
            user_id=request.user_id,
            plan=request.plan,
            resources_by_day=request.resources_by_day
        )

        return {
            "success": True,
            "message": "Learning plan saved successfully",
            "data": result
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.get("/active")
def get_active_plan(
    user_id: str = Query(default="demo_user")
):
    try:
        result = get_active_learning_plan(user_id=user_id)

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

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.get("/{plan_id}/next")
def get_next_task(
    plan_id: str,
    user_id: str = Query(default="demo_user")
):
    try:
        result = get_next_learning_task(
            plan_id=plan_id,
            user_id=user_id
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

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )