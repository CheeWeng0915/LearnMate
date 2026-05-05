import os
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional

import certifi
from bson import ObjectId
from bson.errors import InvalidId
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import PyMongoError


BASE_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = BASE_DIR / ".env"
logger = logging.getLogger(__name__)

load_dotenv(dotenv_path=ENV_PATH, override=True)

MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB_NAME = (
    os.getenv("MONGODB_DB_NAME") or
    os.getenv("DATABASE_NAME") or
    "learnmate"
)
MONGODB_SERVER_SELECTION_TIMEOUT_MS = int(
    os.getenv("MONGODB_SERVER_SELECTION_TIMEOUT_MS", "5000")
)

if not MONGODB_URI:
    raise RuntimeError(f"MONGODB_URI is missing. Please check {ENV_PATH}")


_client = None
_database = None


def get_client():
    global _client

    if _client is None:
        mongo_client = MongoClient(
            MONGODB_URI,
            tls=True,
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=MONGODB_SERVER_SELECTION_TIMEOUT_MS
        )
        _client = mongo_client

    return _client


def get_database():
    global _database

    if _database is None:
        _database = get_client()[MONGODB_DB_NAME]

    return _database


class LazyMongoClient:
    def __getattr__(self, name):
        return getattr(get_client(), name)

    def __getitem__(self, name):
        return get_client()[name]


class LazyDatabase:
    def __getattr__(self, name):
        return getattr(get_database(), name)

    def __getitem__(self, name):
        return get_database()[name]


client = LazyMongoClient()
db = LazyDatabase()


def ensure_database_indexes():
    try:
        db.users.create_index("email", unique=True)
        db.refresh_sessions.create_index("token_hash", unique=True)
        db.refresh_sessions.create_index([("user_id", 1), ("expires_at", 1)])
        db.api_usage.create_index(
            [
                ("scope", 1),
                ("key", 1),
                ("action", 1),
                ("window_start", 1)
            ],
            unique=True
        )
        db.api_usage.create_index("expires_at", expireAfterSeconds=0)
        db.learning_plans.create_index([("user_id", 1), ("status", 1), ("created_at", -1)])
        db.learning_tasks.create_index([("user_id", 1), ("plan_id", 1), ("day", 1)])
        db.learning_resources.create_index([("user_id", 1), ("plan_id", 1), ("day", 1)])
    except PyMongoError as exc:
        logger.warning("MongoDB index setup skipped: %s", exc)


def test_mongodb_connection():
    client.admin.command("ping")
    return True


def serialize_mongo_doc(doc):
    """
    Convert MongoDB ObjectId / datetime into JSON serializable values.
    """
    if doc is None:
        return None

    if isinstance(doc, list):
        return [serialize_mongo_doc(item) for item in doc]

    if isinstance(doc, dict):
        result = {}

        for key, value in doc.items():
            if isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, datetime):
                result[key] = value.isoformat()
            elif isinstance(value, dict):
                result[key] = serialize_mongo_doc(value)
            elif isinstance(value, list):
                result[key] = serialize_mongo_doc(value)
            else:
                result[key] = value

        return result

    return doc


def to_object_id(value: str):
    try:
        return ObjectId(value)
    except InvalidId:
        raise ValueError("Invalid ObjectId format")


def save_learning_plan(
    user_id: str,
    plan: Dict[str, Any],
    resources_by_day: Optional[Dict[str, Any]] = None
):
    """
    Step 4:
    Save generated learning plan, tasks, optional YouTube resources,
    and create progress log.
    """
    client.admin.command("ping")

    now = datetime.now(timezone.utc)

    plan_doc = {
        "user_id": user_id,
        "goal": plan.get("goal"),
        "topic": plan.get("topic"),
        "duration_days": plan.get("duration_days"),
        "level": plan.get("level"),
        "daily_minutes": plan.get("daily_minutes"),
        "learning_outcome": plan.get("learning_outcome"),
        "status": "active",
        "progress_percent": 0,
        "created_at": now,
        "updated_at": now
    }

    plan_result = db.learning_plans.insert_one(plan_doc)
    plan_id = plan_result.inserted_id

    task_docs = []

    for day in plan.get("days", []):
        task_docs.append({
            "plan_id": plan_id,
            "user_id": user_id,
            "day": day.get("day"),
            "title": day.get("title"),
            "tasks": day.get("tasks", []),
            "search_queries": day.get("search_queries", []),
            "status": "pending",
            "created_at": now,
            "updated_at": now
        })

    task_ids = []

    if task_docs:
        task_result = db.learning_tasks.insert_many(task_docs)
        task_ids = task_result.inserted_ids

    resource_docs = []

    if resources_by_day:
        for day, resources in resources_by_day.items():
            for resource in resources:
                resource_docs.append({
                    "plan_id": plan_id,
                    "user_id": user_id,
                    "day": int(day),
                    "type": "youtube",
                    "video_id": resource.get("video_id"),
                    "title": resource.get("title"),
                    "description": resource.get("description"),
                    "channel_title": resource.get("channel_title"),
                    "thumbnail_url": resource.get("thumbnail_url"),
                    "url": resource.get("url"),
                    "created_at": now
                })

    resource_ids = []

    if resource_docs:
        resource_result = db.learning_resources.insert_many(resource_docs)
        resource_ids = resource_result.inserted_ids

    db.progress_logs.insert_one({
        "plan_id": plan_id,
        "user_id": user_id,
        "action": "plan_created",
        "progress_percent": 0,
        "created_at": now
    })

    return {
        "plan_id": str(plan_id),
        "task_ids": [str(task_id) for task_id in task_ids],
        "resource_ids": [str(resource_id) for resource_id in resource_ids]
    }


def get_active_learning_plan(user_id: str):
    """
    Step 5:
    Get user's latest active learning plan with tasks and resources.
    """
    client.admin.command("ping")

    plan = db.learning_plans.find_one(
        {
            "user_id": user_id,
            "status": "active"
        },
        sort=[("created_at", -1)]
    )

    if not plan:
        return None

    plan_id = plan["_id"]

    tasks = list(
        db.learning_tasks.find(
            {
                "plan_id": plan_id,
                "user_id": user_id
            }
        ).sort("day", 1)
    )

    resources = list(
        db.learning_resources.find(
            {
                "plan_id": plan_id,
                "user_id": user_id
            }
        ).sort("day", 1)
    )

    return {
        "plan": serialize_mongo_doc(plan),
        "tasks": serialize_mongo_doc(tasks),
        "resources": serialize_mongo_doc(resources)
    }


def complete_learning_task(task_id: str, user_id: str):
    """
    Step 6:
    Mark task as completed and update learning progress.
    """
    client.admin.command("ping")

    task_object_id = to_object_id(task_id)

    task = db.learning_tasks.find_one(
        {
            "_id": task_object_id,
            "user_id": user_id
        }
    )

    if not task:
        raise ValueError("Task not found")

    plan_id = task["plan_id"]
    now = datetime.now(timezone.utc)

    db.learning_tasks.update_one(
        {
            "_id": task_object_id,
            "user_id": user_id
        },
        {
            "$set": {
                "status": "completed",
                "completed_at": now,
                "updated_at": now
            }
        }
    )

    total_tasks = db.learning_tasks.count_documents(
        {
            "plan_id": plan_id,
            "user_id": user_id
        }
    )

    completed_tasks = db.learning_tasks.count_documents(
        {
            "plan_id": plan_id,
            "user_id": user_id,
            "status": "completed"
        }
    )

    progress_percent = 0

    if total_tasks > 0:
        progress_percent = round((completed_tasks / total_tasks) * 100)

    db.learning_plans.update_one(
        {
            "_id": plan_id,
            "user_id": user_id
        },
        {
            "$set": {
                "progress_percent": progress_percent,
                "updated_at": now
            }
        }
    )

    db.progress_logs.insert_one({
        "plan_id": plan_id,
        "task_id": task_object_id,
        "user_id": user_id,
        "action": "task_completed",
        "progress_percent": progress_percent,
        "created_at": now
    })

    next_task_data = get_next_learning_task(
        plan_id=str(plan_id),
        user_id=user_id
    )

    return {
        "task_id": task_id,
        "plan_id": str(plan_id),
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "progress_percent": progress_percent,
        "next": next_task_data
    }


def get_next_learning_task(plan_id: str, user_id: str):
    """
    Step 7:
    Get next pending task in the learning plan.
    """
    client.admin.command("ping")

    plan_object_id = to_object_id(plan_id)

    plan = db.learning_plans.find_one(
        {
            "_id": plan_object_id,
            "user_id": user_id
        }
    )

    if not plan:
        raise ValueError("Learning plan not found")

    next_task = db.learning_tasks.find_one(
        {
            "plan_id": plan_object_id,
            "user_id": user_id,
            "status": {
                "$ne": "completed"
            }
        },
        sort=[("day", 1)]
    )

    if not next_task:
        return {
            "is_completed": True,
            "message": "All tasks completed. Great job!",
            "task": None,
            "resources": []
        }

    day = next_task.get("day")

    resources = list(
        db.learning_resources.find(
            {
                "plan_id": plan_object_id,
                "user_id": user_id,
                "day": day
            }
        )
    )

    return {
        "is_completed": False,
        "message": f"Continue with Day {day}: {next_task.get('title')}",
        "task": serialize_mongo_doc(next_task),
        "resources": serialize_mongo_doc(resources)
    }
