import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash
from pydantic import BaseModel
from pymongo import AsyncMongoClient
from pymongo.server_api import ServerApi


load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME", "fastapi_learning")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-key")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not MONGODB_URL:
        raise RuntimeError("MONGODB_URL is missing. Please check your .env file.")

    app.mongodb_client = AsyncMongoClient(
        MONGODB_URL,
        server_api=ServerApi("1")
    )

    app.database = app.mongodb_client[DATABASE_NAME]

    await app.mongodb_client.admin.command("ping")
    print("Connected to MongoDB Atlas")

    yield

    await app.mongodb_client.close()
    print("MongoDB Atlas connection closed")


app = FastAPI(lifespan=lifespan)


password_hash = PasswordHash.recommended()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


class UserRegister(BaseModel):
    username: str
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


def user_helper(user) -> dict:
    return {
        "id": str(user["_id"]),
        "username": user.get("username", ""),
        "email": user.get("email", "")
    }


def get_password_hash(password: str) -> str:
    return password_hash.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_hash.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)

    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(
        to_encode,
        JWT_SECRET_KEY,
        algorithm=ALGORITHM
    )

    return encoded_jwt


async def get_user_by_username(username: str):
    user = await app.database["users"].find_one({
        "username": username
    })

    return user


async def authenticate_user(username: str, password: str):
    user = await get_user_by_username(username)

    if not user:
        return False

    if not verify_password(password, user["hashed_password"]):
        return False

    return user


async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        username = payload.get("sub")

        if username is None:
            raise credentials_exception

    except InvalidTokenError:
        raise credentials_exception

    user = await get_user_by_username(username)

    if user is None:
        raise credentials_exception

    return user


@app.get("/")
async def home():
    return {
        "message": "FastAPI Authentication API"
    }


@app.post("/register")
async def register(user: UserRegister):
    existing_user = await app.database["users"].find_one({
        "username": user.username
    })

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Username already exists"
        )

    user_data = {
        "username": user.username,
        "email": user.email,
        "hashed_password": get_password_hash(user.password),
        "created_at": datetime.now(timezone.utc)
    }

    result = await app.database["users"].insert_one(user_data)

    new_user = await app.database["users"].find_one({
        "_id": result.inserted_id
    })

    return {
        "message": "User registered successfully",
        "data": user_helper(new_user)
    }


@app.post("/token", response_model=Token)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()]
):
    user = await authenticate_user(
        form_data.username,
        form_data.password
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    access_token = create_access_token(
        data={"sub": user["username"]},
        expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


@app.get("/users/me")
async def get_my_profile(
    current_user: Annotated[dict, Depends(get_current_user)]
):
    return {
        "message": "Current user profile",
        "data": user_helper(current_user)
    }