from fastapi import APIRouter, Depends, HTTPException, status, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from app.models.user import User, UserCreate, UserUpdate, UserResponse, UserLogin, UserRole, Token
from app.services.auth_service import auth_service
from app.services.database_service import db_service
from typing import List
from datetime import datetime
from app.core.config import is_test_mode, get_testing_token
import logging

security = HTTPBearer(auto_error=False)

router = APIRouter(tags=["authentication"])

from app.services.unified_auth import get_unified_user

# Helper dependency function
async def get_current_user_from_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # Use unified auth to support both internal and external tokens
    return await get_unified_user(credentials)

# TESTING ONLY
@router.get("/test-token")
async def get_test_token():
    if not is_test_mode():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not available in production")
    admin = db_service.get_user_by_username("admin")
    if not admin:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Admin user not initialized")
    out = auth_service.create_user_token(admin)
    logging.warning("test_mode_issue_permanent_token")
    return {"access_token": out["access_token"], "token_type": out.get("token_type", "bearer"), "expires": "never"}

# Pydantic models for API
class UserRegister(BaseModel):
    username: str
    email: str
    password: str
    full_name: str
    divisions: List[str] = []

class ChangePassword(BaseModel):
    old_password: str
    new_password: str

class ResetPassword(BaseModel):
    new_password: str

@router.post("/login", response_model=Token)
async def login(user_credentials: UserLogin):
    """Authenticate user and return access token"""
    start = datetime.now()
    user = auth_service.authenticate_user(user_credentials.username, user_credentials.password)
    if not user:
        logging.error(f"auth_login_failed username={user_credentials.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    out = auth_service.create_user_token(user)
    elapsed_ms = int((datetime.now() - start).total_seconds() * 1000)
    logging.info(f"auth_login_success username={user_credentials.username} elapsed_ms={elapsed_ms}")
    return out

@router.post("/register", response_model=UserResponse)
async def register(user_data: UserRegister):
    """Register new user"""
    try:
        # Create user with default role
        user_create = UserCreate(
            username=user_data.username,
            email=user_data.email,
            password=user_data.password,
            full_name=user_data.full_name,
            role=UserRole.USER,
            divisions=user_data.divisions
        )

        user = db_service.create_user(user_create)
        return UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            divisions=user.divisions,
            is_active=user.is_active,
            created_at=user.created_at,
            updated_at=user.updated_at
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user_from_token)):
    """Get current user information"""
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        divisions=current_user.divisions,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at
    )

@router.get("/accessible-divisions", response_model=List[str])
async def get_accessible_divisions(current_user: User = Depends(get_current_user_from_token)):
    """Get list of divisions current user can access"""
    return auth_service.get_user_accessible_divisions(current_user)

@router.post("/change-password")
async def change_password(
    password_data: ChangePassword,
    current_user: User = Depends(get_current_user_from_token)
):
    """Change current user password"""
    if auth_service.change_password(current_user.id, password_data.old_password, password_data.new_password):
        return {"message": "Password changed successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid old password"
        )

@router.post("/reset-password/{user_id}")
async def reset_password(
    user_id: int,
    password_data: ResetPassword,
    current_user: User = Depends(get_current_user_from_token)
):
    """Reset user password (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can reset passwords"
        )

    target_user = db_service.get_user_by_id(user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if auth_service.reset_password(user_id, password_data.new_password):
        return {"message": "Password reset successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset password"
        )
