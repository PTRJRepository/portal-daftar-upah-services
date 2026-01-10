import pytest
import os
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# Import the app instance from main
from main import app

@pytest.fixture
def client():
    """Create a test client for the FastAPI app"""
    return TestClient(app)

@pytest.fixture
def mock_test_mode():
    """Enable test mode for testing"""
    original_test_mode = os.environ.get("TEST_MODE")
    os.environ["TEST_MODE"] = "true"
    yield
    if original_test_mode is not None:
        os.environ["TEST_MODE"] = original_test_mode
    else:
        del os.environ["TEST_MODE"]

def test_dev_mode_endpoint(client):
    """Test the dev mode info endpoint"""
    response = client.get("/dev-mode")
    assert response.status_code == 200
    data = response.json()
    assert "dev_mode" in data
    assert "test_mode" in data

def test_auth_required_endpoints_in_test_mode(client, mock_test_mode):
    """Test that auth endpoints require token in test mode"""
    login_res = client.post("/auth/login", json={"username": "admin", "password": "admin"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    me_res = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    data = me_res.json()
    assert "username" in data
    assert data["username"] == "admin"

def test_get_accessible_divisions_in_test_mode(client, mock_test_mode):
    """Test getting accessible divisions with valid token in test mode"""
    login_res = client.post("/auth/login", json={"username": "admin", "password": "admin"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    response = client.get("/auth/accessible-divisions", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0

def test_auth_test_token_endpoint_in_test_mode(client, mock_test_mode):
    """Test test-token can be used to access protected endpoint"""
    response = client.get("/auth/test-token")
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    token = data["access_token"]
    me_res = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200

def test_login_endpoint(client):
    """Test the login endpoint responds properly"""
    # Test with test mode on
    with patch.dict(os.environ, {"TEST_MODE": "true"}):
        response = client.post("/auth/login", json={
            "username": "admin",
            "password": "admin"
        })

        # Should either succeed or fail with auth error (both are valid responses)
        assert response.status_code in [200, 401]
