"""
Database Settings - API Gateway Configuration
Legacy pyodbc connection settings have been replaced with API Gateway configuration.
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


def get_api_gateway_config():
    """Get API Gateway configuration from environment variables"""
    return {
        'api_url': os.getenv('DB_API_URL', 'http://localhost:8001'),
        'api_key': os.getenv('DB_API_KEY', ''),
        'db_alias': os.getenv('DB_ALIAS', 'LOCAL'),
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


# Legacy function stubs for backward compatibility
# These will log deprecation warnings if called

def get_db_config(profile: Optional[str] = None):
    """
    DEPRECATED: Direct database config is no longer used.
    Returns API Gateway configuration instead.
    """
    logger.warning("⚠️ get_db_config() is deprecated. Database connections now use API Gateway.")
    config = get_api_gateway_config()
    return {
        'server': config['api_url'],
        'database_name': config['db_alias'],
        'driver': 'API Gateway',
        'username': 'N/A',
        'password': 'N/A',
        'port': 8001,
        'trusted_connection': False,
        'encrypt': False,
    }


def connection_string(profile: Optional[str] = None):
    """
    DEPRECATED: Connection strings are no longer used.
    Returns API Gateway URL instead.
    """
    logger.warning("⚠️ connection_string() is deprecated. Use Database class from database.services.database")
    config = get_api_gateway_config()
    return f"API_GATEWAY={config['api_url']};DB_ALIAS={config['db_alias']}"
