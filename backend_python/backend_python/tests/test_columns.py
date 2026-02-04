import os
import pytest
from fastapi.testclient import TestClient
from main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def mock_test_mode():
    original = os.environ.get("TEST_MODE")
    os.environ["TEST_MODE"] = "true"
    yield
    if original is not None:
        os.environ["TEST_MODE"] = original
    else:
        del os.environ["TEST_MODE"]


def _get_token(client):
    r = client.get("/auth/test-token")
    assert r.status_code == 200
    return r.json()["access_token"]


def test_columns_success(client, mock_test_mode):
    token = _get_token(client)
    res = client.get("/payroll/columns?month=5&year=2025&gang_code=C1H", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) > 0
    has_group = any(isinstance(x.get('children'), list) and len(x['children']) > 0 for x in data)
    all_leaves = all(not isinstance(x.get('children'), list) or len(x['children']) == 0 for x in data)
    assert has_group and not all_leaves


def test_columns_invalid_month(client, mock_test_mode):
    token = _get_token(client)
    res = client.get("/payroll/columns?month=13&year=2025&gang_code=C1H", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 400


def test_columns_invalid_year(client, mock_test_mode):
    token = _get_token(client)
    res = client.get("/payroll/columns?month=5&year=1899&gang_code=C1H", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 400


def test_columns_invalid_gang_pattern(client, mock_test_mode):
    token = _get_token(client)
    res = client.get("/payroll/columns?month=5&year=2025&gang_code=!!", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 400


def test_columns_not_found_gang(client, mock_test_mode):
    token = _get_token(client)
    res = client.get("/payroll/columns?month=5&year=2025&gang_code=ZZZ999", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code in [200, 404]
    if res.status_code == 200:
        data = res.json()
        assert isinstance(data, list)
        assert len(data) > 0


def test_columns_structure_consistency(client, mock_test_mode):
    token = _get_token(client)
    res = client.get("/payroll/columns?month=5&year=2025&gang_code=C1H", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    for c in data:
        ok_group = isinstance(c.get('children'), list) and isinstance(c.get('headerName'), str)
        ok_leaf = isinstance(c.get('field'), str) and isinstance(c.get('headerName'), str)
        assert ok_group or ok_leaf
