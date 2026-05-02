from fastapi import APIRouter, HTTPException
from service.mongodb_service import test_mongodb_connection

router = APIRouter(
    prefix="/api/mongodb",
    tags=["MongoDB"]
)


@router.get("/test")
def test_connection():
    try:
        test_mongodb_connection()
        return {
            "success": True,
            "message": "MongoDB connection successful"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )