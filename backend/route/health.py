from fastapi import APIRouter

router = APIRouter(
    prefix="/api",
    tags=["Health"]
)


@router.get("/health")
def health_check():
    return {
        "success": True,
        "message": "LearnMate API is running",
        "status": "ok"
    }