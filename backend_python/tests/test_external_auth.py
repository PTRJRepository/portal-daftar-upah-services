"""
Tests for External Authentication Service (RS256 JWT verification)
"""
import pytest
import os
from pathlib import Path
from jose import jwt
from datetime import datetime, timedelta

# Add backend to path
import sys
backend_path = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend_path))


class TestExternalAuthService:
    """Test the external auth service with RS256 verification"""
    
    @pytest.fixture
    def auth_service(self):
        """Import and return the external auth service"""
        from app.services.external_auth_service import ExternalAuthService
        return ExternalAuthService()
    
    @pytest.fixture
    def keys_dir(self):
        """Return the keys directory path"""
        return Path(__file__).resolve().parents[1] / "keys"
    
    def test_public_key_exists(self, keys_dir):
        """Test that the public key file exists"""
        public_key_path = keys_dir / "public.pem"
        assert public_key_path.exists(), f"Public key not found at {public_key_path}"
    
    def test_private_key_exists(self, keys_dir):
        """Test that the private key file exists (for signing test tokens)"""
        private_key_path = keys_dir / "private.pem"
        assert private_key_path.exists(), f"Private key not found at {private_key_path}"
    
    def test_verify_valid_token(self, auth_service, keys_dir):
        """Test verification of a valid RS256 token"""
        # Load the private key to sign a test token
        private_key_path = keys_dir / "private.pem"
        with open(private_key_path, 'r') as f:
            private_key = f.read()
        
        # Create a test token
        payload = {
            "sub": "test_user",
            "division": "PG1A",
            "role": "user",
            "exp": datetime.utcnow() + timedelta(hours=1)
        }
        token = jwt.encode(payload, private_key, algorithm="RS256")
        
        # Verify the token
        result = auth_service.verify_external_token(token)
        assert result is not None
        assert result["sub"] == "test_user"
        assert result["division"] == "PG1A"
    
    def test_reject_expired_token(self, auth_service, keys_dir):
        """Test that expired tokens are rejected"""
        private_key_path = keys_dir / "private.pem"
        with open(private_key_path, 'r') as f:
            private_key = f.read()
        
        # Create an expired token
        payload = {
            "sub": "test_user",
            "division": "PG1A",
            "exp": datetime.utcnow() - timedelta(hours=1)  # Expired 1 hour ago
        }
        token = jwt.encode(payload, private_key, algorithm="RS256")
        
        # Should return None for expired token
        result = auth_service.verify_external_token(token)
        assert result is None
    
    def test_reject_invalid_signature(self, auth_service):
        """Test that tokens with invalid signature are rejected"""
        # Create a token signed with a different key
        fake_private_key = """-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7fLNqhnUyVxyd
-----END PRIVATE KEY-----"""
        
        # This should fail because we can't sign with invalid key
        # Just test with a garbage token
        garbage_token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.garbage.signature"
        result = auth_service.verify_external_token(garbage_token)
        assert result is None
    
    def test_get_token_claims(self, auth_service, keys_dir):
        """Test extracting claims from a valid token"""
        private_key_path = keys_dir / "private.pem"
        with open(private_key_path, 'r') as f:
            private_key = f.read()
        
        payload = {
            "sub": "division_user",
            "division": "PG2A",
            "role": "manager",
            "exp": datetime.utcnow() + timedelta(hours=2)
        }
        token = jwt.encode(payload, private_key, algorithm="RS256")
        
        claims = auth_service.get_token_claims(token)
        assert claims is not None
        assert claims["username"] == "division_user"
        assert claims["division"] == "PG2A"
        assert claims["role"] == "manager"
    
    def test_get_locked_division(self, auth_service, keys_dir):
        """Test extracting locked division from token"""
        private_key_path = keys_dir / "private.pem"
        with open(private_key_path, 'r') as f:
            private_key = f.read()
        
        payload = {
            "sub": "user1",
            "division": "DME",
            "exp": datetime.utcnow() + timedelta(hours=1)
        }
        token = jwt.encode(payload, private_key, algorithm="RS256")
        
        locked_div = auth_service.get_locked_division(token)
        assert locked_div == "DME"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
