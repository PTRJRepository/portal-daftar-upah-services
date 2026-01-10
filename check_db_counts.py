
import os
import pyodbc
from dotenv import load_dotenv
from pathlib import Path

# Load .env
env_path = Path(".env").resolve()
load_dotenv(env_path)

def get_connection():
    driver = os.getenv("DATABASE_PROFILES_EXTEND_DB_PTRJ_DRIVER", "ODBC Driver 17 for SQL Server")
    server = os.getenv("DATABASE_PROFILES_EXTEND_DB_PTRJ_SERVER", "10.0.0.110")
    port = os.getenv("DATABASE_PROFILES_EXTEND_DB_PTRJ_PORT", "1433")
    username = os.getenv("DATABASE_PROFILES_EXTEND_DB_PTRJ_USERNAME", "sa")
    password = os.getenv("DATABASE_PROFILES_EXTEND_DB_PTRJ_PASSWORD", "ptrj@123")
    database = os.getenv("DATABASE_PROFILES_EXTEND_DB_PTRJ_DATABASE_NAME", "extend_db_ptrj")
    conn_str = f"DRIVER={{{driver}}};SERVER={server},{port};DATABASE={database};UID={username};PWD={password}"
    return pyodbc.connect(conn_str, timeout=30)

def check_counts():
    conn = get_connection()
    cursor = conn.cursor()
    
    print("\n--- Division Counts for 12/2025 ---")
    query = """
    SELECT division_code, SUM(total_employees) as total 
    FROM dbo.daftar_upah_aggregation_history 
    WHERE period_month = 12 AND period_year = 2025 
    GROUP BY division_code
    """
    cursor.execute(query)
    for row in cursor.fetchall():
        print(f"Division: {row.division_code}, Total: {row.total}")
        
    print("\n--- Checking for potential duplicates (P2A vs PG2A) ---")
    cursor.execute("SELECT DISTINCT division_code FROM dbo.daftar_upah_aggregation_history WHERE period_month = 12 AND period_year = 2025")
    codes = [row[0] for row in cursor.fetchall()]
    print(f"Division Codes found: {codes}")
    
    conn.close()

if __name__ == "__main__":
    check_counts()
