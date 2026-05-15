from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from route.health import router as health_router
from route.auth import router as auth_router
from route.learning_plan import router as learning_plan_router
from route.youtube import router as youtube_router
from route.task import router as task_router
from route.resource import router as resource_router
from service.mongodb_service import ensure_database_indexes


app = FastAPI(
    title="LearnMate API",
    description="AI Learning Agent API",
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://learnmate-frontend-3eapvby57a-as.a.run.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(health_router)
app.include_router(auth_router)
app.include_router(learning_plan_router)
app.include_router(youtube_router)
app.include_router(task_router)
app.include_router(resource_router)


@app.on_event("startup")
def startup():
    ensure_database_indexes()


@app.get("/")
def root():
    return {
        "success": True,
        "message": "Welcome to LearnMate API"
    }
