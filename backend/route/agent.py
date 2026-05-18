from fastapi import APIRouter, Depends, HTTPException

from schema.agent_schema import CoachAgentRequest
from schema.review_schema import ReviewGenerateRequest
from service.auth_service import get_current_user
from service.coach_agent_service import generate_coach_response
from service.mongodb_service import get_learning_review
from service.review_service import generate_day_review


router = APIRouter(
    prefix="/api/agent",
    tags=["Agent"]
)


@router.post("/coach")
def coach_agent(
    request: CoachAgentRequest,
    current_user=Depends(get_current_user)
):
    try:
        result = generate_coach_response(
            user_id=current_user["id"],
            question=request.question
        )

        return {
            "success": True,
            "message": "Coach agent response generated successfully",
            "data": result
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.get("/review/{plan_id}/{day}")
def get_review(
    plan_id: str,
    day: int,
    current_user=Depends(get_current_user)
):
    try:
        result = get_learning_review(
            plan_id=plan_id,
            day=day,
            user_id=current_user["id"]
        )

        return {
            "success": True,
            "message": "Learning review fetched successfully",
            "data": result
        }

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/review")
def generate_review(
    request: ReviewGenerateRequest,
    current_user=Depends(get_current_user)
):
    try:
        result = generate_day_review(
            user_id=current_user["id"],
            plan_id=request.plan_id,
            day=request.day
        )

        return {
            "success": True,
            "message": "Learning review generated successfully",
            "data": result
        }

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
