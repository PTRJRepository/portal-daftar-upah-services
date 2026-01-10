"""
Database connection for EXTEND_DB_PTRJ (write operations) and DB_PTRJ (read operations)
Uses environment variables for configuration
"""

import os
import pyodbc
from dotenv import load_dotenv
from pathlib import Path
from typing import Optional, Dict

# Load .env from refactor_production root
env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(env_path)


def get_extend_db_connection():
    """
    Create connection to EXTEND_DB_PTRJ (for WRITE operations)
    Reads from DATABASE_PROFILES_EXTEND_DB_PTRJ_* environment variables
    """
    driver = os.getenv("DATABASE_PROFILES_EXTEND_DB_PTRJ_DRIVER", "ODBC Driver 17 for SQL Server")
    server = os.getenv("DATABASE_PROFILES_EXTEND_DB_PTRJ_SERVER", "10.0.0.110")
    port = os.getenv("DATABASE_PROFILES_EXTEND_DB_PTRJ_PORT", "1433")
    username = os.getenv("DATABASE_PROFILES_EXTEND_DB_PTRJ_USERNAME", "sa")
    password = os.getenv("DATABASE_PROFILES_EXTEND_DB_PTRJ_PASSWORD", "ptrj@123")
    database = os.getenv("DATABASE_PROFILES_EXTEND_DB_PTRJ_DATABASE_NAME", "extend_db_ptrj")
    
    conn_str = f"DRIVER={{{driver}}};SERVER={server},{port};DATABASE={database};UID={username};PWD={password}"
    
    return pyodbc.connect(conn_str, timeout=30)


def get_db_ptrj_connection():
    """
    Create connection to DB_PTRJ (for READ operations only)
    Uses remote database at 10.0.0.110
    """
    driver = "ODBC Driver 17 for SQL Server"
    server = "10.0.0.110"
    port = "1433"
    username = "sa"
    password = "ptrj@123"
    database = "db_ptrj"
    
    conn_str = f"DRIVER={{{driver}}};SERVER={server},{port};DATABASE={database};UID={username};PWD={password}"
    
    return pyodbc.connect(conn_str, timeout=30)


def get_venushr14_connection():
    """
    Create connection to VenusHR14 (for READ operations - Mill PKS data)
    Uses remote database at 10.0.0.110
    """
    driver = "ODBC Driver 17 for SQL Server"
    server = "10.0.0.110"
    port = "1433"
    username = "sa"
    password = "ptrj@123"
    database = "VenusHR14"
    
    conn_str = f"DRIVER={{{driver}}};SERVER={server},{port};DATABASE={database};UID={username};PWD={password}"
    
    return pyodbc.connect(conn_str, timeout=30)


def get_mill_db_connection():
    """
    Create connection to db_ptrj_mill (for READ operations - WM_TICKET / FFB weight data)
    Uses remote database at 10.0.0.110
    """
    driver = "ODBC Driver 17 for SQL Server"
    server = "10.0.0.110"
    port = "1433"
    username = "sa"
    password = "ptrj@123"
    database = "db_ptrj_mill"
    
    conn_str = f"DRIVER={{{driver}}};SERVER={server},{port};DATABASE={database};UID={username};PWD={password}"
    
    return pyodbc.connect(conn_str, timeout=30)



def get_gang_description(gang_code: str) -> str:
    """
    Get gang description from HR_GANG table in db_ptrj (READ only)
    Returns empty string if not found
    """
    try:
        conn = get_db_ptrj_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT Description FROM dbo.HR_GANG 
            WHERE GangCode = ?
        """, (gang_code,))
        row = cursor.fetchone()
        conn.close()
        
        if row and row[0]:
            return str(row[0]).strip()
        return ""
    except Exception as e:
        print(f"  [WARN] Could not get description for {gang_code}: {e}")
        return ""


def get_all_gang_descriptions() -> Dict[str, str]:
    """
    Get all gang descriptions from HR_GANG table (for batch processing)
    Returns dict mapping gang_code -> description
    """
    try:
        conn = get_db_ptrj_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT GangCode, Description FROM dbo.HR_GANG 
            WHERE GangCode IS NOT NULL
        """)
        rows = cursor.fetchall()
        conn.close()
        
        return {str(r[0]).strip(): str(r[1]).strip() if r[1] else "" for r in rows}
    except Exception as e:
        print(f"  [WARN] Could not get gang descriptions: {e}")
        return {}


def test_connection():
    """Test the database connection"""
    try:
        conn = get_extend_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
        conn.close()
        return True, "Connection successful"
    except Exception as e:
        return False, str(e)


if __name__ == "__main__":
    success, message = test_connection()
    print(f"EXTEND_DB_PTRJ: {'OK' if success else 'FAILED'} - {message}")
    
    # Test db_ptrj connection
    try:
        conn = get_db_ptrj_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT TOP 1 GangCode, Description FROM HR_GANG")
        row = cursor.fetchone()
        conn.close()
        print(f"DB_PTRJ: OK - Sample: {row}")
    except Exception as e:
        print(f"DB_PTRJ: FAILED - {e}")

