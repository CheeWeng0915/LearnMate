from fastapi import APIRouter, Depends, Request

from schema.auth_schema import (
    LoginRequest,
    LogoutRequest,
    RefreshTokenRequest,
    RegisterRequest
)
from service.auth_service import (
    get_current_user,
    login_user,
    refresh_tokens,
    register_user,
    revoke_refresh_token
)


router = APIRouter(
    prefix="/api/auth",
    tags=["Auth"]
)


def _client_ip(request: Request):
    forwarded_for = request.headers.get("x-forwarded-for")

    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    if request.client:
        return request.client.host

    return None


def _user_agent(request: Request):
    return request.headers.get("user-agent")


@router.post("/register")
def register(request_body: RegisterRequest, request: Request):
    tokens = register_user(
        request=request_body,
        ip_address=_client_ip(request),
        user_agent=_user_agent(request)
    )

    return {
        "success": True,
        "message": "User registered successfully",
        "data": tokens
    }


@router.post("/login")
def login(request_body: LoginRequest, request: Request):
    tokens = login_user(
        request=request_body,
        ip_address=_client_ip(request),
        user_agent=_user_agent(request)
    )

    return {
        "success": True,
        "message": "User logged in successfully",
        "data": tokens
    }


@router.post("/refresh")
def refresh(request_body: RefreshTokenRequest, request: Request):
    tokens = refresh_tokens(
        refresh_token=request_body.refresh_token,
        ip_address=_client_ip(request),
        user_agent=_user_agent(request)
    )

    return {
        "success": True,
        "message": "Session refreshed successfully",
        "data": tokens
    }


@router.post("/logout")
def logout(request_body: LogoutRequest):
    revoke_refresh_token(request_body.refresh_token)

    return {
        "success": True,
        "message": "User logged out successfully",
        "data": None
    }


@router.get("/me")
def me(current_user=Depends(get_current_user)):
    return {
        "success": True,
        "message": "Current user fetched successfully",
        "data": {
            "user": {
                "id": current_user["id"],
                "email": current_user["email"],
                "name": current_user.get("name")
            }
        }
    }
