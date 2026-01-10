import json
from pathlib import Path
import pyodbc

def load_db_config():
    base = Path(__file__).resolve().parents[4]
    cfg = base / 'Explore_database' / 'config.json'
    with cfg.open('r') as f:
        return json.load(f)['database']

def get_connection():
    db = load_db_config()
    driver = db['driver']
    server = db['server']
    port = db['port']
    database = db['database_name']
    username = db['username']
    password = db['password']
    conn_str = f"DRIVER={{{{}}}};SERVER={server},{port};DATABASE={database};UID={username};PWD={password}".format(driver)
    return pyodbc.connect(conn_str)
