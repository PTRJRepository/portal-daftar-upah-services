"""
Database Settings - API Gateway Configuration

All database connections use the SQL Gateway API.
No direct ODBC/SQL Auth connections are supported.
"""
import os
import json
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def _config_path():
    """Get path to config.json"""
    base = Path(__file__).resolve().parents[2]
    return base / 'config.json'


def get_server_profile(run_mode: str = None) -> str:
    """
    Get server profile based on run mode.
    
    - DEV mode: SERVER_PROFILE_1 (10.0.0.110:1433, Read/Write)
    - PROD mode: SERVER_PROFILE_2 (10.0.0.2:1888, Read-Only)
    """
    mode = run_mode or os.getenv('RUN_MODE', 'dev').lower()
    if mode == 'prod':
        return os.getenv('DB_SERVER_PROFILE', 'SERVER_PROFILE_2')
    return os.getenv('DB_SERVER_PROFILE', 'SERVER_PROFILE_1')


def get_api_gateway_config(run_mode: str = None):
    """Get API Gateway configuration from environment variables"""
    return {
        'api_url': os.getenv('DB_API_URL', 'http://localhost:8001'),
        'api_key': os.getenv('DB_API_KEY', ''),
        'server_profile': get_server_profile(run_mode),
        'database': os.getenv('DB_DATABASE', 'db_ptrj'),
        'timeout': int(os.getenv('DB_CONN_TIMEOUT', '60')),
        'query_timeout': int(os.getenv('DB_QUERY_TIMEOUT', '30')),
        'retries': int(os.getenv('DB_QUERY_RETRIES', '2')),
    }


def get_constants():
    """Get application constants from config.json"""
    try:
        cfg_path = _config_path()
        with cfg_path.open('r') as f:
            cfg = json.load(f)
        return cfg.get('constants', {})
    except Exception as e:
        logger.warning(f"Failed to load constants from config.json: {e}")
        return {}
