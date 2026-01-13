
from db_connection import get_extend_db_connection

try:
    conn = get_extend_db_connection()
    cursor = conn.cursor()
    print("Executing SELECT TOP 1 *...")
    cursor.execute("SELECT TOP 1 * FROM dbo.daftar_upah_aggregation_history")
    
    columns = [column[0] for column in cursor.description]
    print(f"COLUMNS IN DB: {columns}")
    
    conn.close()
except Exception as e:
    print(f"ERROR: {e}")
