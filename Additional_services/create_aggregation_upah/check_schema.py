
import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(env_path)

from db_connection import get_extend_db_connection
import sys

try:
    conn = get_extend_db_connection()
    cursor = conn.cursor()
    
    print("Checking tables...")
    cursor.execute("SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%daftar_upah_aggregation%'")
    tables = cursor.fetchall()
    print(f"TABLES FOUND: {tables}")

    if tables:
        schema, table = tables[0]
        full_name = f"{schema}.{table}"
        print(f"Checking columns for {full_name}...")
        cursor.execute("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ?", (table,))
        columns = [row[0] for row in cursor.fetchall()]
        print(f"COLUMNS: {columns}")
    
    conn.close()
except Exception as e:
    print(f"ERROR: {e}")
