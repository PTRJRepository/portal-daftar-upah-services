"""
External Authentication Service
Verifies JWT tokens from external systems using RS256 algorithm and public key.
"""
from datetime import datetime
from typing import Optional, Dict, Any
from jose import jwt, JWTError
from pathlib import Path
import logging
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)

# Path to the public key file for RS256 verification
KEYS_DIR = Path(__file__).resolve().parents[2] / "keys"
PUBLIC_KEY_PATH = KEYS_DIR / "public.pem"

# Algorithm for external JWT verification
EXTERNAL_JWT_ALGORITHM = "RS256"


class ExternalAuthService:
    """
    Service for verifying JWT tokens from external systems.
    Uses RS256 algorithm with public key from backend/keys/public.pem
    """
    
    def __init__(self):
        self._public_key: Optional[str] = None
        self._load_public_key()
    
    def _load_public_key(self) -> None:
        """Load the public key from file"""
        try:
            if PUBLIC_KEY_PATH.exists():
                with open(PUBLIC_KEY_PATH, 'r', encoding='utf-8') as f:
                    self._public_key = f.read()
                logger.info(f"Loaded public key from {PUBLIC_KEY_PATH}")
            else:
                logger.error(f"Public key file not found: {PUBLIC_KEY_PATH}")
        except Exception as e:
            logger.error(f"Failed to load public key: {e}")
    
    def verify_external_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Verify JWT token using RS256 algorithm and public key.
        
        Args:
            token: JWT token string
            
        Returns:
            Decoded payload dict if valid, None if invalid
        """
        if not self._public_key:
            logger.error("Public key not loaded, cannot verify token")
            return None
        
        try:
            # Decode and verify the token using RS256
            payload = jwt.decode(
                token,
                self._public_key,
                algorithms=[EXTERNAL_JWT_ALGORITHM]
            )
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("External token has expired")
            return None
        except JWTError as e:
            logger.warning(f"External token verification failed: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error verifying external token: {e}")
            return None
    
    def get_token_claims(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Get claims from a verified external token.
        
        Returns dict with:
        - sub: username/subject
        - division: locked division (if present)
        - role: user role (if present)
        - exp: expiration time
        """
        payload = self.verify_external_token(token)
        if not payload:
            return None
        
        return {
            "sub": payload.get("sub"),
            "username": payload.get("sub") or payload.get("username"),
            "division": payload.get("division") or payload.get("div"),
            "role": payload.get("role", "user"),
            "exp": payload.get("exp"),
            "raw": payload  # Include full payload for debugging
        }
    
    def is_token_valid(self, token: str) -> bool:
        """Check if token is valid without returning payload"""
        return self.verify_external_token(token) is not None
    
    def get_locked_division(self, token: str) -> Optional[str]:
        """
        Extract the locked division from token claims.
        This is used for division-locked endpoints.
        """
        claims = self.get_token_claims(token)
        if not claims:
            return None
        return claims.get("division")


# Global instance
external_auth_service = ExternalAuthService()


# FastAPI security scheme
from fastapi.security import HTTPBearer
security = HTTPBearer()


async def get_external_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Verify external JWT token using RS256 and public key.
    Returns token claims if valid.
    This is a FastAPI dependency function for protected endpoints.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    claims = external_auth_service.get_token_claims(token)

    if claims is None:
        logger.error("external_token_validation_failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate external credentials (RS256)",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return claims
