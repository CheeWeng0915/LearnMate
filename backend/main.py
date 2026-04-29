from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()
app = FastAPI(
    title="LearnMate API",
    description="AI-powered learning companion backed by Google Cloud Agent Builder",
    version="1.0.0",
)

# 允许 Next.js frontend 跨域请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # 本地开发
    allow_methods=["*"],
    allow_headers=["*"],
)

# 定义请求格式
class ChatRequest(BaseModel):
    topic: str

# 主要接口
@app.post("/chat")
async def chat(request: ChatRequest):
    # 之后这里接 Agent Builder
    return {
        "reply": f"你想学 {request.topic}，我来帮你规划！"
    }

# 健康检查（Cloud Run 需要）
@app.get("/")
async def root():
    return {"status": "ok"}