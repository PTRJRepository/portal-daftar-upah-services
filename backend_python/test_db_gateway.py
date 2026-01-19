"""
Quick test to verify the refactored Database class works with API Gateway
"""
import os
import sys

# Set environment variables for testing
os.environ['DB_API_URL'] = 'http://localhost:8001'
os.environ['DB_API_KEY'] = '2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6'
os.environ['DB_ALIAS'] = 'LOCAL'

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.services.database import Database

def test_connection():
    print("=" * 60)
    print("TEST 1: Connection Test")
    print("=" * 60)
    db = Database.instance()
    result = db.test_connection()
    print(f"Health check result: {result}")
    assert result == True, "Health check failed"
    print("✅ PASSED\n")

def test_query_all():
    print("=" * 60)
    print("TEST 2: query_all() - return List[Tuple]")
    print("=" * 60)
    db = Database.instance()
    rows = db.query_all("SELECT TOP 3 EmpCode, EmpName FROM HR_EMPLOYEE")
    
    print(f"Type: {type(rows)}")
    print(f"Count: {len(rows)}")
    for i, row in enumerate(rows):
        print(f"  Row {i}: type={type(row)}, values={row}")
        # Test tuple access (backward compatibility)
        print(f"    row[0] = {row[0]}")
        print(f"    row[1] = {row[1]}")
    
    assert isinstance(rows, list), "Should return list"
    assert len(rows) > 0, "Should have rows"
    assert isinstance(rows[0], tuple), "Rows should be tuples"
    print("✅ PASSED\n")

def test_query_with_params():
    print("=" * 60)
    print("TEST 3: query_all() with parameters")
    print("=" * 60)
    db = Database.instance()
    rows = db.query_all("SELECT EmpCode, EmpName FROM HR_EMPLOYEE WHERE Gender = ?", (1,))
    
    print(f"Count with Gender=1: {len(rows)}")
    if rows:
        print(f"  First row: {rows[0]}")
    print("✅ PASSED\n")

def test_query_one():
    print("=" * 60)
    print("TEST 4: query_one() - return single Tuple")
    print("=" * 60)
    db = Database.instance()
    row = db.query_one("SELECT COUNT(*) as cnt FROM HR_EMPLOYEE")
    
    print(f"Type: {type(row)}")
    print(f"Value: {row}")
    print(f"row[0] = {row[0]}")
    
    assert row is not None, "Should return a row"
    assert isinstance(row, tuple), "Should be tuple"
    print("✅ PASSED\n")

def test_execute_query():
    print("=" * 60)
    print("TEST 5: execute_query() - alias for query_all")
    print("=" * 60)
    db = Database.instance()
    rows = db.execute_query("SELECT TOP 2 EmpCode FROM HR_EMPLOYEE")
    
    print(f"Type: {type(rows)}")
    print(f"Count: {len(rows)}")
    
    assert isinstance(rows, list), "Should return list"
    print("✅ PASSED\n")

def test_date_parsing():
    print("=" * 60)
    print("TEST 6: Date parsing (ISO string -> datetime)")
    print("=" * 60)
    db = Database.instance()
    rows = db.query_all("SELECT TOP 1 ID, DocDate, CreatedDate FROM pr_taskreg")
    
    if rows:
        row = rows[0]
        print(f"Row: {row}")
        for i, val in enumerate(row):
            print(f"  [{i}] type={type(val).__name__}, value={val}")
    print("✅ PASSED\n")

if __name__ == "__main__":
    print("\n" + "🚀 TESTING REFACTORED DATABASE CLASS ".center(60, "="))
    print()
    
    try:
        test_connection()
        test_query_all()
        test_query_with_params()
        test_query_one()
        test_execute_query()
        test_date_parsing()
        
        print("=" * 60)
        print("✅ ALL TESTS PASSED!")
        print("=" * 60)
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
