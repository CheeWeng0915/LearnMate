from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from service.mongodb_service import db


DAILY_LEARNING_PLAN_LIMIT = 20
DAILY_YOUTUBE_SEARCH_LIMIT = 100
LOGIN_FAILURE_LIMIT = 10
LOGIN_FAILURE_WINDOW_SECONDS = 15 * 60
DAY_SECONDS = 24 * 60 * 60


def _utc_now():
    return datetime.now(timezone.utc)


def _window_start(now: datetime, window_seconds: int):
    timestamp = int(now.timestamp())
    return datetime.fromtimestamp(
        timestamp - (timestamp % window_seconds),
        tz=timezone.utc
    )


def _increment_usage(
    scope: str,
    key: str,
    action: str,
    limit: int,
    window_seconds: int
):
    now = _utc_now()
    window_start = _window_start(now, window_seconds)
    expires_at = window_start + timedelta(seconds=window_seconds * 2)
    query = {
        "scope": scope,
        "key": key,
        "action": action,
        "window_start": window_start
    }

    try:
        doc = db.api_usage.find_one_and_update(
            query,
            {
                "$inc": {"count": 1},
                "$setOnInsert": {
                    "scope": scope,
                    "key": key,
                    "action": action,
                    "window_start": window_start,
                    "expires_at": expires_at,
                    "created_at": now
                },
                "$set": {"updated_at": now}
            },
            upsert=True,
            return_document=ReturnDocument.AFTER
        )
    except DuplicateKeyError:
        doc = db.api_usage.find_one_and_update(
            query,
            {"$inc": {"count": 1}, "$set": {"updated_at": now}},
            return_document=ReturnDocument.AFTER
        )

    if doc and doc.get("count", 0) > limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please try again later."
        )

    return doc


def enforce_user_quota(
    user_id: str,
    action: str,
    limit: int,
    window_seconds: int = DAY_SECONDS
):
    return _increment_usage(
        scope="user",
        key=user_id,
        action=action,
        limit=limit,
        window_seconds=window_seconds
    )


def assert_login_allowed(key: str):
    now = _utc_now()
    window_start = _window_start(now, LOGIN_FAILURE_WINDOW_SECONDS)
    doc = db.api_usage.find_one({
        "scope": "login_failure",
        "key": key,
        "action": "login_failure",
        "window_start": window_start
    })

    if doc and doc.get("count", 0) >= LOGIN_FAILURE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again later."
        )


def record_failed_login(key: str):
    return _increment_usage(
        scope="login_failure",
        key=key,
        action="login_failure",
        limit=LOGIN_FAILURE_LIMIT,
        window_seconds=LOGIN_FAILURE_WINDOW_SECONDS
    )


def clear_failed_login_count(key: str):
    now = _utc_now()
    window_start = _window_start(now, LOGIN_FAILURE_WINDOW_SECONDS)
    db.api_usage.delete_one({
        "scope": "login_failure",
        "key": key,
        "action": "login_failure",
        "window_start": window_start
    })
