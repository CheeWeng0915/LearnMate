from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from route.health import router as health_router
from route.learning_plan import router as learning_plan_router
from route.youtube import router as youtube_router
from route.task import router as task_router
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(
    title="LearnMate API",
    description="AI Learning Agent API",
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://你的-frontend-url.run.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(health_router)
app.include_router(learning_plan_router)
app.include_router(youtube_router)
app.include_router(task_router)


@app.get("/")
def root():
    return {
        "success": True,
        "message": "Welcome to LearnMate API"
    }