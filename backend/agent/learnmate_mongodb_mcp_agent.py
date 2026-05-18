"""
Google ADK agent definition for the LearnMate MongoDB MCP integration.

This file is intentionally separate from the FastAPI runtime so local
development still works without ADK, Node.js, or the MongoDB MCP server.
Deploy or run this module with Google ADK when you are ready to demonstrate
the Agent Builder / MCP path.
"""

import os

from google.adk.agents import LlmAgent
from google.adk.tools.mcp_tool import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from mcp import StdioServerParameters


MONGODB_URI = os.environ["MONGODB_URI"]
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "learnmate")
COACH_AGENT_MODEL = os.getenv("COACH_AGENT_MODEL", "gemini-2.0-flash")


root_agent = LlmAgent(
    model=COACH_AGENT_MODEL,
    name="learnmate_progress_coach",
    instruction=f"""
You are LearnMate's Learning Progress Coach Agent.

Use MongoDB MCP tools to inspect only the {MONGODB_DB_NAME} database.
Focus on learning_plans, learning_tasks, learning_resources,
learning_day_notes, and progress_logs.

When coaching a learner:
- summarize their current progress,
- identify the next pending task,
- consider recent notes,
- recommend one practical next study action,
- avoid exposing secrets, password hashes, or unrelated user data.
""",
    tools=[
        McpToolset(
            connection_params=StdioConnectionParams(
                server_params=StdioServerParameters(
                    command="npx",
                    args=[
                        "-y",
                        "mongodb-mcp-server"
                    ],
                    env={
                        "MDB_MCP_CONNECTION_STRING": MONGODB_URI,
                        "MDB_MCP_READ_ONLY": "true"
                    }
                ),
                timeout=30
            ),
            tool_filter=[
                "list-databases",
                "list-collections",
                "find",
                "aggregate",
                "count",
                "collection-schema"
            ]
        )
    ]
)
