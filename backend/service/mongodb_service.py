import os
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple

import certifi
from bson import ObjectId
from bson.errors import InvalidId
from dotenv import load_dotenv
from pymongo import MongoClient, ReturnDocument
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
        db.learning_day_notes.create_index(
            [("user_id", 1), ("plan_id", 1), ("day", 1)],
            unique=True
        )
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


def _is_completed(doc: Dict[str, Any]) -> bool:
    return doc.get("completed") is True or doc.get("status") == "completed"


def _plan_payload(plan: Dict[str, Any], days: List[Dict[str, Any]]):
    return {
        "goal": plan.get("goal"),
        "topic": plan.get("topic"),
        "duration_days": plan.get("duration_days") or len(days),
        "level": plan.get("level"),
        "daily_minutes": plan.get("daily_minutes"),
        "learning_outcome": plan.get("learning_outcome"),
        "days": days
    }


def _resources_by_day(resources: List[Dict[str, Any]]):
    grouped: Dict[str, List[Dict[str, Any]]] = {}

    for resource in resources:
        day = str(resource.get("day"))
        grouped.setdefault(day, []).append({
            "id": str(resource.get("_id")),
            "video_id": resource.get("video_id"),
            "title": resource.get("title"),
            "description": resource.get("description"),
            "channel_title": resource.get("channel_title"),
            "published_at": resource.get("published_at"),
            "thumbnail_url": resource.get("thumbnail_url"),
            "url": resource.get("url"),
            "completed": _is_completed(resource),
            "completed_at": (
                resource.get("completed_at").isoformat()
                if isinstance(resource.get("completed_at"), datetime)
                else resource.get("completed_at")
            )
        })

    return grouped


def _shape_saved_tasks(task_docs: List[Dict[str, Any]]):
    tasks = []

    for task in task_docs:
        task_id = str(task["_id"])

        if "description" in task:
            tasks.append({
                "id": task_id,
                "plan_id": str(task["plan_id"]),
                "day": task.get("day"),
                "description": task.get("description"),
                "completed": _is_completed(task),
                "completed_at": (
                    task.get("completed_at").isoformat()
                    if isinstance(task.get("completed_at"), datetime)
                    else task.get("completed_at")
                )
            })
            continue

        completed_indexes = set(task.get("completed_task_indexes", []))
        legacy_tasks = task.get("tasks", [])

        for index, description in enumerate(legacy_tasks):
            is_completed = _is_completed(task) or index in completed_indexes
            tasks.append({
                "id": f"{task_id}:{index}",
                "plan_id": str(task["plan_id"]),
                "day": task.get("day"),
                "description": description,
                "completed": is_completed,
                "completed_at": (
                    task.get("completed_at").isoformat()
                    if is_completed and isinstance(task.get("completed_at"), datetime)
                    else task.get("completed_at") if is_completed else None
                )
            })

    return tasks


def _days_from_tasks(task_docs: List[Dict[str, Any]]):
    days_by_number: Dict[int, Dict[str, Any]] = {}

    for task in task_docs:
        day_number = task.get("day")

        if day_number is None:
            continue

        day = days_by_number.setdefault(
            day_number,
            {
                "day": day_number,
                "title": task.get("title") or f"Day {day_number}",
                "tasks": [],
                "search_queries": task.get("search_queries", [])
            }
        )

        if not day.get("title") and task.get("title"):
            day["title"] = task.get("title")

        if not day.get("search_queries") and task.get("search_queries"):
            day["search_queries"] = task.get("search_queries")

        if "description" in task:
            day["tasks"].append(task.get("description"))
        else:
            day["tasks"].extend(task.get("tasks", []))

    return [days_by_number[key] for key in sorted(days_by_number)]


def _task_progress_counts(plan_id: ObjectId, user_id: str) -> Tuple[int, int]:
    task_docs = list(
        db.learning_tasks.find(
            {
                "plan_id": plan_id,
                "user_id": user_id
            }
        )
    )
    total_tasks = 0
    completed_tasks = 0

    for task in task_docs:
        if "description" in task:
            total_tasks += 1
            if _is_completed(task):
                completed_tasks += 1
            continue

        legacy_tasks = task.get("tasks", [])
        total_tasks += len(legacy_tasks)

        if _is_completed(task):
            completed_tasks += len(legacy_tasks)
        else:
            completed_indexes = {
                index
                for index in task.get("completed_task_indexes", [])
                if 0 <= index < len(legacy_tasks)
            }
            completed_tasks += len(completed_indexes)

    return total_tasks, completed_tasks


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
        "days": plan.get("days", []),
        "status": "active",
        "progress_percent": 0,
        "created_at": now,
        "updated_at": now
    }

    plan_result = db.learning_plans.insert_one(plan_doc)
    plan_id = plan_result.inserted_id

    task_docs = []

    for day in plan.get("days", []):
        for index, task in enumerate(day.get("tasks", [])):
            task_docs.append({
                "plan_id": plan_id,
                "user_id": user_id,
                "day": day.get("day"),
                "day_task_index": index,
                "title": day.get("title"),
                "description": task,
                "search_queries": day.get("search_queries", []),
                "status": "pending",
                "completed": False,
                "completed_at": None,
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
                    "published_at": resource.get("published_at"),
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

    saved_task_docs = []

    if task_ids:
        saved_task_docs = list(
            db.learning_tasks.find(
                {
                    "_id": {
                        "$in": task_ids
                    }
                }
            ).sort([("day", 1), ("day_task_index", 1)])
        )

    return {
        "id": str(plan_id),
        "user_id": user_id,
        "plan": _plan_payload(plan_doc, plan.get("days", [])),
        "resources_by_day": _resources_by_day(resource_docs) if resource_docs else {},
        "created_at": now.isoformat(),
        "last_studied_at": None,
        "is_active": True,
        "tasks": _shape_saved_tasks(saved_task_docs),
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
        ).sort([("day", 1), ("day_task_index", 1)])
    )

    resources = list(
        db.learning_resources.find(
            {
                "plan_id": plan_id,
                "user_id": user_id
            }
        ).sort("day", 1)
    )

    days = plan.get("days") or _days_from_tasks(tasks)

    return {
        "id": str(plan_id),
        "user_id": user_id,
        "plan": _plan_payload(plan, days),
        "resources_by_day": _resources_by_day(resources),
        "created_at": (
            plan.get("created_at").isoformat()
            if isinstance(plan.get("created_at"), datetime)
            else plan.get("created_at")
        ),
        "last_studied_at": (
            plan.get("last_studied_at").isoformat()
            if isinstance(plan.get("last_studied_at"), datetime)
            else plan.get("last_studied_at")
        ),
        "is_active": plan.get("status") == "active",
        "tasks": _shape_saved_tasks(tasks)
    }


def complete_learning_task(task_id: str, user_id: str):
    """
    Step 6:
    Mark task as completed and update learning progress.
    """
    client.admin.command("ping")

    legacy_task_index = None
    mongo_task_id = task_id

    if ":" in task_id:
        mongo_task_id, index = task_id.split(":", 1)

        try:
            legacy_task_index = int(index)
        except ValueError:
            raise ValueError("Invalid task id")

    task_object_id = to_object_id(mongo_task_id)

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

    if legacy_task_index is None:
        db.learning_tasks.update_one(
            {
                "_id": task_object_id,
                "user_id": user_id
            },
            {
                "$set": {
                    "status": "completed",
                    "completed": True,
                    "completed_at": now,
                    "updated_at": now
                }
            }
        )
    else:
        legacy_tasks = task.get("tasks", [])

        if legacy_task_index < 0 or legacy_task_index >= len(legacy_tasks):
            raise ValueError("Task not found")

        completed_indexes = set(task.get("completed_task_indexes", []))
        completed_indexes.add(legacy_task_index)
        update_fields = {
            "completed_task_indexes": sorted(completed_indexes),
            "updated_at": now
        }

        if len(completed_indexes) == len(legacy_tasks):
            update_fields["status"] = "completed"
            update_fields["completed_at"] = now

        db.learning_tasks.update_one(
            {
                "_id": task_object_id,
                "user_id": user_id
            },
            {
                "$set": update_fields
            }
        )

    total_tasks, completed_tasks = _task_progress_counts(plan_id, user_id)

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
                "last_studied_at": now,
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

    task_docs = list(
        db.learning_tasks.find(
            {
                "plan_id": plan_object_id,
                "user_id": user_id,
                "status": {
                    "$ne": "completed"
                }
            }
        ).sort([("day", 1), ("day_task_index", 1)])
    )
    next_task = None

    for task in task_docs:
        if "description" in task:
            next_task = {
                "id": str(task["_id"]),
                "plan_id": str(task["plan_id"]),
                "day": task.get("day"),
                "description": task.get("description"),
                "completed": False,
                "completed_at": None
            }
            break

        completed_indexes = set(task.get("completed_task_indexes", []))

        for index, description in enumerate(task.get("tasks", [])):
            if index not in completed_indexes:
                next_task = {
                    "id": f"{task['_id']}:{index}",
                    "plan_id": str(task["plan_id"]),
                    "day": task.get("day"),
                    "description": description,
                    "completed": False,
                    "completed_at": None
                }
                break

        if next_task:
            break

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
        "message": f"Continue with Day {day}: {next_task.get('description')}",
        "task": next_task,
        "resources": serialize_mongo_doc(resources)
    }


def complete_learning_resource(resource_id: str, user_id: str):
    client.admin.command("ping")

    resource_object_id = to_object_id(resource_id)
    now = datetime.now(timezone.utc)

    resource = db.learning_resources.find_one_and_update(
        {
            "_id": resource_object_id,
            "user_id": user_id
        },
        {
            "$set": {
                "status": "completed",
                "completed": True,
                "completed_at": now,
                "updated_at": now
            }
        },
        return_document=ReturnDocument.AFTER
    )

    if not resource:
        raise ValueError("Resource not found")

    db.learning_plans.update_one(
        {
            "_id": resource["plan_id"],
            "user_id": user_id
        },
        {
            "$set": {
                "last_studied_at": now,
                "updated_at": now
            }
        }
    )

    return {
        "id": str(resource["_id"]),
        "plan_id": str(resource["plan_id"]),
        "day": resource.get("day"),
        "completed": True,
        "completed_at": now.isoformat()
    }


def get_learning_day_note(plan_id: str, day: int, user_id: str):
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

    note = db.learning_day_notes.find_one(
        {
            "plan_id": plan_object_id,
            "user_id": user_id,
            "day": day
        }
    )

    if not note:
        return {
            "plan_id": plan_id,
            "day": day,
            "note": "",
            "updated_at": None
        }

    return {
        "id": str(note["_id"]),
        "plan_id": str(note["plan_id"]),
        "day": note.get("day"),
        "note": note.get("note", ""),
        "updated_at": (
            note.get("updated_at").isoformat()
            if isinstance(note.get("updated_at"), datetime)
            else note.get("updated_at")
        )
    }


def save_learning_day_note(plan_id: str, day: int, note: str, user_id: str):
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

    now = datetime.now(timezone.utc)
    saved_note = db.learning_day_notes.find_one_and_update(
        {
            "plan_id": plan_object_id,
            "user_id": user_id,
            "day": day
        },
        {
            "$set": {
                "note": note,
                "updated_at": now
            },
            "$setOnInsert": {
                "plan_id": plan_object_id,
                "user_id": user_id,
                "day": day,
                "created_at": now
            }
        },
        upsert=True,
        return_document=ReturnDocument.AFTER
    )

    db.learning_plans.update_one(
        {
            "_id": plan_object_id,
            "user_id": user_id
        },
        {
            "$set": {
                "last_studied_at": now,
                "updated_at": now
            }
        }
    )

    return {
        "id": str(saved_note["_id"]),
        "plan_id": str(saved_note["plan_id"]),
        "day": saved_note.get("day"),
        "note": saved_note.get("note", ""),
        "updated_at": now.isoformat()
    }


def complete_learning_day(plan_id: str, day: int, user_id: str):
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

    tasks = list(
        db.learning_tasks.find(
            {
                "plan_id": plan_object_id,
                "user_id": user_id,
                "day": day
            }
        )
    )

    total_tasks = len(tasks)
    completed_tasks = len([task for task in tasks if _is_completed(task)])

    if total_tasks == 0:
        raise ValueError("Learning day not found")

    if completed_tasks < total_tasks:
        raise ValueError("Complete all tasks before finishing the day")

    now = datetime.now(timezone.utc)
    total_plan_tasks, completed_plan_tasks = _task_progress_counts(plan_object_id, user_id)
    progress_percent = (
        round((completed_plan_tasks / total_plan_tasks) * 100)
        if total_plan_tasks > 0
        else 0
    )

    update_fields = {
        "last_studied_at": now,
        "progress_percent": progress_percent,
        "updated_at": now
    }

    db.learning_plans.update_one(
        {
            "_id": plan_object_id,
            "user_id": user_id
        },
        {
            "$set": update_fields
        }
    )

    db.progress_logs.insert_one({
        "plan_id": plan_object_id,
        "user_id": user_id,
        "day": day,
        "action": "day_completed",
        "progress_percent": progress_percent,
        "created_at": now
    })

    return {
        "plan_id": plan_id,
        "day": day,
        "completed": True,
        "completed_at": now.isoformat(),
        "progress_percent": progress_percent,
        "is_plan_completed": progress_percent == 100
    }
