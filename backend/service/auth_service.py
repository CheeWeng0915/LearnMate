import hashlib
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import jwt
import requests
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash
from pymongo.errors import DuplicateKeyError

from schema.auth_schema import LoginRequest, RegisterRequest
from service.mongodb_service import db, serialize_mongo_doc, to_object_id
from service.quota_service import (
    assert_login_allowed,
    clear_failed_login_count,
    record_failed_login
)


BASE_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = BASE_DIR / ".env"

load_dotenv(dotenv_path=ENV_PATH, override=True)

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
TURNSTILE_SECRET_KEY = os.getenv("TURNSTILE_SECRET_KEY")
TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
TURNSTILE_SECRET_ERROR_CODES = {"invalid-input-secret", "missing-input-secret"}

if not JWT_SECRET_KEY:
    raise RuntimeError(f"JWT_SECRET_KEY is missing. Please check {ENV_PATH}")


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
password_hash = PasswordHash.recommended()
DUMMY_HASH = password_hash.hash("dummypassword")
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _utc_now():
    return datetime.now(timezone.utc)


def normalize_email(email: str) -> str:
    normalized = email.strip().lower()

    if not EMAIL_PATTERN.match(normalized):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid email address."
        )

    return normalized


def _password_to_hash(password: str) -> str:
    return password_hash.hash(password)


def _verify_password(password: str, stored_hash: str) -> bool:
    return password_hash.verify(password, stored_hash)


def _hash_refresh_token(refresh_token: str) -> str:
    return hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()


def _serialize_user(user_doc):
    user = serialize_mongo_doc(user_doc)
    return {
        "id": user.get("_id"),
        "email": user.get("email"),
        "name": user.get("name"),
        "created_at": user.get("created_at")
    }


def _create_access_token(user_doc):
    now = _utc_now()
    expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_doc["_id"]),
        "email": user_doc["email"],
        "iat": int(now.timestamp()),
        "exp": expire
    }

    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return token


def _create_refresh_session(user_doc, ip_address: Optional[str], user_agent: Optional[str]):
    now = _utc_now()
    expires_at = now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    refresh_token = secrets.token_urlsafe(48)

    db.refresh_sessions.insert_one({
        "user_id": user_doc["_id"],
        "token_hash": _hash_refresh_token(refresh_token),
        "created_at": now,
        "expires_at": expires_at,
        "revoked_at": None,
        "ip_address": ip_address,
        "user_agent": user_agent
    })

    return refresh_token


def _build_token_response(user_doc, ip_address: Optional[str], user_agent: Optional[str]):
    return {
        "user": _serialize_user(user_doc),
        "access_token": _create_access_token(user_doc),
        "refresh_token": _create_refresh_session(user_doc, ip_address, user_agent),
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }


def verify_turnstile_token(token: str, remote_ip: Optional[str]):
    if not TURNSTILE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="TURNSTILE_SECRET_KEY is not configured."
        )

    payload = {
        "secret": TURNSTILE_SECRET_KEY,
        "response": token
    }

    if remote_ip:
        payload["remoteip"] = remote_ip

    try:
        response = requests.post(
            TURNSTILE_VERIFY_URL,
            data=payload,
            timeout=10
        )
    except requests.RequestException:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to verify registration challenge."
        )

    try:
        result = response.json()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to verify registration challenge."
        )

    error_codes = set(result.get("error-codes") or [])

    if error_codes & TURNSTILE_SECRET_ERROR_CODES:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="TURNSTILE_SECRET_KEY is invalid."
        )

    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registration challenge verification failed."
        )

    return result


def register_user(
    request: RegisterRequest,
    ip_address: Optional[str],
    user_agent: Optional[str]
):
    email = normalize_email(request.email)
    verify_turnstile_token(request.turnstile_token, ip_address)

    now = _utc_now()
    user_doc = {
        "email": email,
        "name": request.name.strip() if request.name else None,
        "password_hash": _password_to_hash(request.password),
        "disabled": False,
        "created_at": now,
        "updated_at": now
    }

    try:
        result = db.users.insert_one(user_doc)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered."
        )

    user_doc["_id"] = result.inserted_id
    return _build_token_response(user_doc, ip_address, user_agent)


def login_user(
    request: LoginRequest,
    ip_address: Optional[str],
    user_agent: Optional[str]
):
    email = normalize_email(request.email)
    login_keys = [email]

    if ip_address:
        login_keys.append(ip_address)

    for login_key in login_keys:
        assert_login_allowed(login_key)

    user_doc = db.users.find_one({"email": email})

    if not user_doc:
        _verify_password(request.password, DUMMY_HASH)
        for login_key in login_keys:
            record_failed_login(login_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if user_doc.get("disabled"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled."
        )

    if not _verify_password(request.password, user_doc["password_hash"]):
        for login_key in login_keys:
            record_failed_login(login_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    for login_key in login_keys:
        clear_failed_login_count(login_key)

    return _build_token_response(user_doc, ip_address, user_agent)


def refresh_tokens(
    refresh_token: str,
    ip_address: Optional[str],
    user_agent: Optional[str]
):
    now = _utc_now()
    token_hash = _hash_refresh_token(refresh_token)

    session = db.refresh_sessions.find_one({
        "token_hash": token_hash,
        "revoked_at": None,
        "expires_at": {"$gt": now}
    })

    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user_doc = db.users.find_one({
        "_id": session["user_id"],
        "disabled": {"$ne": True}
    })

    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    db.refresh_sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {"revoked_at": now, "updated_at": now}}
    )

    return _build_token_response(user_doc, ip_address, user_agent)


def revoke_refresh_token(refresh_token: Optional[str]):
    if not refresh_token:
        return False

    now = _utc_now()
    result = db.refresh_sessions.update_one(
        {
            "token_hash": _hash_refresh_token(refresh_token),
            "revoked_at": None
        },
        {"$set": {"revoked_at": now, "updated_at": now}}
    )

    return result.modified_count > 0


def get_user_by_id(user_id: str):
    try:
        object_id = to_object_id(user_id)
    except ValueError:
        return None

    return db.users.find_one({
        "_id": object_id,
        "disabled": {"$ne": True}
    })


async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"}
    )

    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")

        if not user_id:
            raise credentials_exception
    except InvalidTokenError:
        raise credentials_exception

    user_doc = get_user_by_id(user_id)

    if not user_doc:
        raise credentials_exception

    return {
        "_id": user_doc["_id"],
        "id": str(user_doc["_id"]),
        "email": user_doc["email"],
        "name": user_doc.get("name")
    }
