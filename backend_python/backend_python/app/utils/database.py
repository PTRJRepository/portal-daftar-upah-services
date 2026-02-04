"""
Database utility module - API Gateway wrapper

This module provides backward-compatible functions using API Gateway.
No direct ODBC/SQL Auth connections are used.
"""
from database.services.database import Database


def load_db_config():
    """
    Returns API Gateway configuration info.
    This is a legacy stub for backward compatibility.
    """
    return {
        'driver': 'API Gateway',
        'server': 'localhost',
        'port': 8001,
        'database_name': 'db_ptrj',
        'username': 'N/A',
        'password': 'N/A'
    }


def get_connection():
    """
    Returns Database instance using API Gateway.
    This replaces the old pyodbc connection.
    """
    return Database.instance()
