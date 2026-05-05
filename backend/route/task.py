from fastapi import APIRouter, Depends, HTTPException

from service.auth_service import get_current_user
from service.mongodb_service import complete_learning_task


router = APIRouter(
    prefix="/api/tasks",
    tags=["Tasks"]
)


@router.patch("/{task_id}/complete")
def complete_task(
    task_id: str,
    current_user=Depends(get_current_user)
):
    try:
        result = complete_learning_task(
            task_id=task_id,
            user_id=current_user["id"]
        )

        return {
            "success": True,
            "message": "Task completed successfully",
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
