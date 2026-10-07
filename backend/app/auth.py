import os
import re
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from pydantic import BaseModel, ConfigDict
from pwdlib import PasswordHash
from sqlalchemy import func
from sqlalchemy.orm import Session

from .database import get_db
from .models import User

# Router
router = APIRouter(prefix="/auth", tags=["Authentication"])

# Password hashing configuration (Argon2 recommended via pwdlib)
password_hash_helper = PasswordHash.recommended()

# JWT configuration
DEV_FALLBACK_JWT_SECRET = (
    "dev-insecure-secret-key-cloudrtl-local-development-only-change-in-production"
)
JWT_SECRET = os.getenv("CLOUDRTL_JWT_SECRET", DEV_FALLBACK_JWT_SECRET)
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("CLOUDRTL_ACCESS_TOKEN_EXPIRE_MINUTES", "60")
)

# HTTP Bearer scheme
bearer_scheme = HTTPBearer(auto_error=False)

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ==================== SCHEMAS ====================

class RegisterRequest(BaseModel):
    username: str
    password: str
    email: str | None = None


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    username: str
    email: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==================== HELPERS ====================

def hash_password(password: str) -> str:
    """Securely hash a plaintext password using Argon2."""
    return password_hash_helper.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a stored hash."""
    return password_hash_helper.verify(plain_password, hashed_password)


def create_access_token(
    user_id: int,
    username: str,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a signed JWT access token containing user identity and expiration."""
    now = datetime.now(timezone.utc)
    if expires_delta is not None:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {
        "sub": str(user_id),
        "username": username,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# ==================== DEPENDENCIES ====================

def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """Reusable FastAPI dependency to authenticate requests using JWT Bearer token."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token payload.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = int(user_id_str)
    except ValueError:
        user_id = None

    user = None
    if user_id is not None:
        user = db.get(User, user_id)

    if user is None:
        username = payload.get("username")
        if username:
            user = (
                db.query(User)
                .filter(func.lower(User.username) == username.lower())
                .first()
            )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


# ==================== ENDPOINTS ====================

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(request: RegisterRequest, db: Annotated[Session, Depends(get_db)]):
    """Register a new user account."""
    username = request.username.strip() if request.username else ""
    password = request.password if request.password else ""
    raw_email = request.email.strip() if request.email else None
    email = raw_email if raw_email else None

    # Validate username
    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username cannot be empty.",
        )
    if len(username) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be at least 3 characters long.",
        )
    if len(username) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must not exceed 100 characters.",
        )

    # Validate password
    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password cannot be empty.",
        )
    if len(password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long.",
        )
    if len(password) > 255:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must not exceed 255 characters.",
        )

    # Check if username is already registered
    existing_user = (
        db.query(User)
        .filter(func.lower(User.username) == username.lower())
        .first()
    )
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is already registered.",
        )

    # Validate email if supplied
    if email is not None:
        if len(email) > 255:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email must not exceed 255 characters.",
            )
        if not EMAIL_REGEX.match(email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid email address format.",
            )

        # Check if email is already registered
        existing_email_user = (
            db.query(User)
            .filter(func.lower(User.email) == email.lower())
            .first()
        )
        if existing_email_user is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already registered.",
            )

    # Hash password securely
    hashed_password = hash_password(password)

    # Create and persist new user
    new_user = User(
        username=username,
        email=email,
        password_hash=hashed_password,
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(exc)}",
        )

    return new_user


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Annotated[Session, Depends(get_db)]):
    """Authenticate user with username and password, returning a JWT access token."""
    username = request.username.strip() if request.username else ""
    password = request.password if request.password else ""

    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = (
        db.query(User)
        .filter(func.lower(User.username) == username.lower())
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(user_id=user.id, username=user.username)
    return TokenResponse(access_token=token, token_type="bearer")


@router.get("/me", response_model=UserResponse)
def get_me(current_user: Annotated[User, Depends(get_current_user)]):
    """Return authenticated user profile details (safe information only)."""
    return current_user
