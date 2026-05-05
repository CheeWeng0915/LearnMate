from typing import Optional

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254, example="you@example.com")
    password: str = Field(..., min_length=8, max_length=128, example="strong-password")
    name: Optional[str] = Field(default=None, max_length=100, example="Jane Doe")
    turnstile_token: str = Field(..., min_length=1, max_length=2048)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254, example="you@example.com")
    password: str = Field(..., min_length=1, max_length=128, example="strong-password")


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., min_length=32)


class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = Field(default=None, min_length=32)
