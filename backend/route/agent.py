from fastapi import APIRouter, Depends, HTTPException

from schema.agent_schema import CoachAgentRequest
from service.auth_service import get_current_user
from service.coach_agent_service import generate_coach_response


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

