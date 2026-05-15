from fastapi import APIRouter, Depends, HTTPException

from service.auth_service import get_current_user
from service.mongodb_service import complete_learning_resource


router = APIRouter(
    prefix="/api/resources",
    tags=["Resources"]
)


@router.patch("/{resource_id}/complete")
def complete_resource(
    resource_id: str,
    current_user=Depends(get_current_user)
):
    try:
        result = complete_learning_resource(
            resource_id=resource_id,
            user_id=current_user["id"]
        )

        return {
            "success": True,
            "message": "Resource completed successfully",
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
