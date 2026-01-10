"""
Tests for Division-Locked Payroll Endpoints
"""
import pytest
import os
from pathlib import Path
from fastapi.testclient import TestClient
from jose import jwt
from datetime import datetime, timedelta

# Add backend to path
import sys
backend_path = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend_path))

from main import app


def create_external_token(division: str = "PG1A") -> str:
    """Create a valid external JWT token for testing"""
    keys_dir = Path(__file__).resolve().parents[1] / "keys"
    private_key_path = keys_dir / "private.pem"
    
    with open(private_key_path, 'r') as f:
        private_key = f.read()
    
    payload = {
        "sub": "test_external_user",
        "division": division,
        "role": "user",
        "exp": datetime.utcnow() + timedelta(hours=1)
    }
    
    return jwt.encode(payload, private_key, algorithm="RS256")


@pytest.fixture
def client():
    """Create a test client for the FastAPI app"""
    return TestClient(app)


@pytest.fixture
def ext_token():
    """Create an external JWT token for testing"""
    return create_external_token("PG1A")


class TestLockedEndpoints:
    """Test division-locked payroll endpoints"""
    
    def test_locked_info_endpoint(self, client, ext_token):
        """Test the locked info endpoint"""
        response = client.get(
            "/payroll/locked/info?div=PG1A",
            headers={"Authorization": f"Bearer {ext_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["division"] == "PG1A"
        assert data["locked"] == True
    
    def test_locked_divisions_endpoint(self, client, ext_token):
        """Test that locked divisions endpoint returns only locked division"""
        response = client.get(
            "/payroll/locked/divisions?div=PG1A",
            headers={"Authorization": f"Bearer {ext_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["divisions"] == ["PG1A"]
        assert data["locked"] == True
    
    def test_locked_gangs_endpoint(self, client, ext_token):
        """Test getting gangs from locked division"""
        response = client.get(
            "/payroll/locked/gangs?div=PG1A",
            headers={"Authorization": f"Bearer {ext_token}"}
        )
        # Should return 200 or 404 depending on data
        assert response.status_code in [200, 404]
    
    def test_unauthorized_without_token(self, client):
        """Test that endpoints require authorization"""
        response = client.get("/payroll/locked/info?div=PG1A")
        assert response.status_code == 401
    
    def test_unauthorized_with_invalid_token(self, client):
        """Test that invalid tokens are rejected"""
        response = client.get(
            "/payroll/locked/info?div=PG1A",
            headers={"Authorization": "Bearer invalid_token"}
        )
        assert response.status_code == 401
    
    def test_locked_report_requires_div_param(self, client, ext_token):
        """Test that locked report requires div parameter"""
        response = client.get(
            "/payroll/locked/report",
            headers={"Authorization": f"Bearer {ext_token}"}
        )
        # Should return 422 (validation error) without div param
        assert response.status_code == 422
    
    def test_different_division_token(self, client):
        """Test with a token for a different division"""
        token = create_external_token("PG2A")
        response = client.get(
            "/payroll/locked/info?div=PG2A",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["division"] == "PG2A"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
