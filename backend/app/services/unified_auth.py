"""
Unified Authentication Service
Switches between internal and external auth based on AUTH_MODE environment variable.

Usage:
- AUTH_MODE=external: Use RS256 external auth (proxy mode with backend/keys)
- AUTH_MODE=internal: Use HS256 internal auth (prod/dev mode with user database)
"""
import os
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging

logger = logging.getLogger(__name__)
security = HTTPBearer()


def get_auth_mode() -> str:
    """Get current authentication mode from environment."""
    return os.environ.get("AUTH_MODE", "internal")


def is_proxy_mode() -> bool:
    """Check if running in proxy mode (external auth)."""
    return get_auth_mode() == "external"


class AuthUser:
    """Wrapper class for authenticated user data to ensure attribute access works."""
    def __init__(self, **kwargs):
        self.id = kwargs.get("id", 0)
        self.username = kwargs.get("username", "")
        self.email = kwargs.get("email", "")
        self.full_name = kwargs.get("full_name", "")
        self.role = kwargs.get("role", "user")
        self.divisions = kwargs.get("divisions", [])
        self.is_active = kwargs.get("is_active", True)
        self.auth_mode = kwargs.get("auth_mode", "unknown")
        
        # Compatibility fields for User model
        from datetime import datetime
        self.created_at = kwargs.get("created_at", datetime.now())
        self.updated_at = kwargs.get("updated_at", datetime.now())
        self.password_hash = kwargs.get("password_hash", "")
        
        # Add any other attributes as needed
        for k, v in kwargs.items():
            if not hasattr(self, k):
                setattr(self, k, v)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Unified authentication dependency.
    - AUTH_MODE=external: Use RS256 external auth (proxy mode)
    - AUTH_MODE=internal: Use HS256 internal auth (prod/dev mode)
    
    For proxy mode (external), 401 errors include X-Redirect-To: /login header.
    """
    auth_mode = get_auth_mode()
    
    if auth_mode == "external":
        # Use external RS256 auth with backend/keys
        from app.services.external_auth_service import external_auth_service
        token = credentials.credentials
        claims = external_auth_service.get_token_claims(token)
        
        if claims is None:
            logger.error("unified_auth: external_token_validation_failed")
            # Proxy mode: Return redirect header to /login
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate external credentials (RS256)",
                headers={
                    "WWW-Authenticate": "Bearer",
                    "X-Redirect-To": "/login"  # Frontend should redirect to this path
                },
            )
        
        # List of all available divisions (same as in auth_service.py)
        ALL_DIVISIONS = ["PG1A", "PG1B", "PG2A", "PG2B", "DME", "ARA", "ARB1", "ARB2", "INFRA", "AREC", "IJL", "STF-OFFICE", "SECURITY", "INF", "Nursery", "Workshop"]
        
        # Check if user is admin - admin can access all divisions
        # Admin if role is ADMIN or division is ALL
        user_role = claims.get("role", "user") or "user"
        user_division = claims.get("division") or ""
        is_admin = (user_role.upper() == "ADMIN") or (user_division.upper() == "ALL")
        
        # Determine divisions based on role
        if is_admin:
            # Admin users can access all divisions
            user_divisions = ALL_DIVISIONS
            logger.info(f"unified_auth: admin_user_granted_all_divisions username={claims.get('username') or claims.get('sub')} reason={'role=ADMIN' if user_role.upper() == 'ADMIN' else 'divisi=ALL'}")
        else:
            # Regular users only get their locked division
            user_divisions = [claims.get("division")] if claims.get("division") else []
        
        # Return object compatible with internal User model
        return AuthUser(
            id=0, # External users don't have internal ID
            username=claims.get("username") or claims.get("sub"),
            division=claims.get("division"),  # Keep original division for backward compatibility
            role=user_role,
            divisions=user_divisions,
            is_admin=is_admin,
            auth_mode="external"
        )
    else:
        # Use internal HS256 auth with user database
        from app.services.auth_service import auth_service
        token = credentials.credentials
        user = auth_service.get_current_user(token)
        
        if user is None:
            logger.error("unified_auth: internal_token_validation_failed")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Return object wrapper
        return AuthUser(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            divisions=user.divisions,
            is_active=user.is_active,
            auth_mode="internal"
        )


# Alias for backward compatibility with existing endpoints
get_unified_user = get_current_user
