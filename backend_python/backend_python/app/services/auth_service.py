from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.models.user import User, TokenData, UserResponse, UserRole
from app.services.database_service import db_service
from app.core.config import JWT_SECRET, JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AuthService:
    def __init__(self):
        pass

    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None):
        """Create JWT access token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
        return encoded_jwt

    def verify_token(self, token: str) -> Optional[TokenData]:
        """Verify JWT token and return token data"""
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            username: str = payload.get("sub")
            if username is None:
                return None
            token_data = TokenData(username=username)
            return token_data
        except JWTError:
            return None

    def authenticate_user(self, username: str, password: str) -> Optional[User]:
        """Authenticate user with database"""
        return db_service.authenticate_user(username, password)

    def get_current_user(self, token: str) -> Optional[User]:
        """Get current user from token"""
        token_data = self.verify_token(token)
        if token_data is None:
            return None

        user = db_service.get_user_by_username(token_data.username)
        if user is None:
            return None

        return user

    def create_user_token(self, user: User) -> dict:
        """Create access token for user"""
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = self.create_access_token(
            data={"sub": user.username, "role": user.role, "divisions": user.divisions},
            expires_delta=access_token_expires
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": UserResponse(
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
        }

    def can_access_division(self, user: User, division: str) -> bool:
        """Check if user can access specific division"""
        # Admin can access all divisions
        if user.role == UserRole.ADMIN:
            return True

        # Check if division is in user's allowed divisions
        return division in user.divisions

    def get_user_accessible_divisions(self, user: User) -> list:
        """Get list of divisions user can access"""
        # Admin can access all divisions
        if user.role == UserRole.ADMIN:
            return ["PG1A", "PG1B", "PG2A", "PG2B", "DME", "ARA", "ARB1", "ARB2", "INFRA", "AREC", "IJL", "STF-OFFICE", "SECURITY"]

        return user.divisions

    def change_password(self, user_id: int, old_password: str, new_password: str) -> bool:
        """Change user password"""
        user = db_service.get_user_by_id(user_id)
        if not user:
            return False

        # Verify old password
        if not db_service.verify_password(old_password, user.password_hash):
            return False

        # Update password
        with sqlite3.connect(db_service.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE users
                SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (db_service.get_password_hash(new_password), user_id))

            # Log password change
            cursor.execute('''
                INSERT INTO audit_logs (user_id, action, details)
                VALUES (?, ?, ?)
            ''', (user_id, "PASSWORD_CHANGE", "User password changed"))

            conn.commit()
            return True

    def reset_password(self, user_id: int, new_password: str) -> bool:
        """Reset user password (admin only)"""
        with sqlite3.connect(db_service.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE users
                SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (db_service.get_password_hash(new_password), user_id))

            # Log password reset
            cursor.execute('''
                INSERT INTO audit_logs (user_id, action, details)
                VALUES (?, ?, ?)
            ''', (user_id, "PASSWORD_RESET", "Password reset by admin"))

            conn.commit()
            return True

# Global auth service instance
auth_service = AuthService()