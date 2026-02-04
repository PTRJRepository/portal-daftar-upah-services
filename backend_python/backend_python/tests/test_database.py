import types
from database.services.database import Database

class FakeCursor:
    def __init__(self, rows):
        self._rows = rows
        self._idx = 0
    def execute(self, sql, *params):
        return None
    def fetchall(self):
        return self._rows
    def fetchone(self):
        return self._rows[0] if self._rows else None
    def close(self):
        return None

class FakeConn:
    def __init__(self, rows):
        self.autocommit = True
        self._rows = rows
    def cursor(self):
        return FakeCursor(self._rows)
    def commit(self):
        return None
    def rollback(self):
        return None
    def close(self):
        return None

def test_pool_and_query_all(monkeypatch):
    def fake_create(self):
        return FakeConn([("A1A",), ("A2A",)])
    monkeypatch.setattr(Database, "_create_conn", fake_create)
    db = Database.instance(pool_size=2)
    rows = db.query_all("SELECT ?", (1,))
    assert rows[0][0] == "A1A"

def test_transaction(monkeypatch):
    def fake_create(self):
        return FakeConn([])
    monkeypatch.setattr(Database, "_create_conn", fake_create)
    db = Database.instance(pool_size=1)
    with db.transaction() as cur:
        cur.execute("UPDATE X SET Y=?", 1)
        assert hasattr(cur, 'execute')
