import threading
import time
import os
from typing import Any, Iterable, Optional, Tuple, List, Dict
from datetime import datetime
from pathlib import Path
from .logger import get_logger

# Load .env from project root
try:
    from dotenv import load_dotenv
    # Find .env file - check backend dir first, then parent (refactor_production root)
    backend_dir = Path(__file__).resolve().parents[2]  # backend/
    project_root = backend_dir.parent  # refactor_production/
    
    env_file = project_root / ".env"
    if env_file.exists():
        load_dotenv(env_file)
    elif (backend_dir / ".env").exists():
        load_dotenv(backend_dir / ".env")
except ImportError:
    pass  # dotenv not installed, rely on system environment

# Use httpx for HTTP client with connection pooling
try:
    import httpx
except ImportError:
    httpx = None
    raise ImportError("httpx is required for API Gateway connections. Install with: pip install httpx")


class _DatabaseAPIClient:
    """HTTP client for API Gateway communication
    
    All database queries are routed through the SQL Gateway API.
    No direct ODBC/SQL Auth connections are used.
    
    Server Profiles:
    - SERVER_PROFILE_1: 10.0.0.110:1433 (Read/Write) - used in DEV mode
    - SERVER_PROFILE_2: 10.0.0.2:1888 (Read-Only) - used in PROD mode
    """
    
    def __init__(self, base_url: str, api_key: str, default_database: str, 
                 server_profile: str = "SERVER_PROFILE_1", timeout: int = 60):
        # Clean the URL - strip whitespace and trailing slash
        self._original_url = base_url.strip().rstrip('/')
        self._api_key = api_key
        self._default_database = default_database
        self._server_profile = server_profile
        self._timeout = timeout
        self._logger = get_logger()
        
        # Build endpoint URLs
        self._logger.info(f"📡 Configuring API Gateway client with URL: '{self._original_url}'")
        self._logger.info(f"🎯 Server Profile: {self._server_profile}")
        
        self._query_url = self._original_url + '/v1/query'
        self._batch_url = self._original_url + '/v1/query/batch'
        self._health_url = self._original_url + '/health'
        self._servers_url = self._original_url + '/v1/servers'
        
        if httpx is None:
            raise ImportError("httpx is required for API Gateway. Install with: pip install httpx")
        
        self._client = httpx.Client(
            timeout=httpx.Timeout(timeout, connect=10),
            headers={
                'x-api-key': api_key,
                'Content-Type': 'application/json'
            }
        )
        self._logger.info(f"📡 Query URL: {self._query_url}")
        self._logger.info(f"📡 Health URL: {self._health_url}")
    
    def execute(self, sql: str, params: Optional[Dict[str, Any]] = None, database: Optional[str] = None) -> dict:
        """Execute single query via Gateway"""
        try:
            payload = {
                "sql": sql,
                "server": self._server_profile,
                "params": params or {}
            }
            # Add database field if specified or use default
            if database:
                payload["database"] = database
            elif self._default_database:
                payload["database"] = self._default_database
            
            response = self._client.post(self._query_url, json=payload)
            return response.json()
        except httpx.RequestError as e:
            self._logger.error(f"API Gateway request failed: {e}")
            return {"success": False, "error": str(e), "data": None}
    
    def execute_batch(self, queries: List[dict], database: Optional[str] = None) -> dict:
        """Execute batch transaction via Gateway"""
        try:
            payload = {
                "server": self._server_profile,
                "queries": queries
            }
            if database:
                payload["database"] = database
            elif self._default_database:
                payload["database"] = self._default_database
            
            response = self._client.post(self._batch_url, json=payload)
            return response.json()
        except httpx.RequestError as e:
            self._logger.error(f"API Gateway batch request failed: {e}")
            return {"success": False, "error": str(e), "data": None}
    
    def health_check(self) -> bool:
        """Check Gateway availability"""
        try:
            response = self._client.get(self._health_url)
            data = response.json()
            return data.get("status") == "ok"
        except Exception as e:
            self._logger.error(f"Health check failed: {e}")
            return False
    
    def list_servers(self) -> dict:
        """List available server profiles"""
        try:
            response = self._client.get(self._servers_url)
            return response.json()
        except Exception as e:
            self._logger.error(f"List servers failed: {e}")
            return {"success": False, "error": str(e)}
    
    def close(self):
        """Close the HTTP client"""
        self._client.close()


def _parse_iso_date(value: str) -> Optional[datetime]:
    """Try to parse ISO 8601 date string to datetime"""
    if not isinstance(value, str):
        return None
    if 'T' not in value:
        return None
    try:
        if value.endswith('Z'):
            return datetime.fromisoformat(value.replace('Z', '+00:00'))
        return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None


def _dict_to_tuple(row_dict: dict) -> tuple:
    """Convert dict row to tuple with proper date parsing"""
    values = []
    for v in row_dict.values():
        parsed_date = _parse_iso_date(v)
        if parsed_date is not None:
            values.append(parsed_date)
        else:
            values.append(v)
    return tuple(values)


def _recordset_to_tuples(recordset: Optional[List[dict]], logger=None) -> List[Tuple]:
    """Convert API recordset to List[Tuple] for backward compatibility"""
    if not recordset:
        return []
    
    # Debug: log first row structure if logger provided
    if logger and len(recordset) > 0:
        first_row = recordset[0]
        if isinstance(first_row, dict):
            logger.info(f"[DB] Recordset first row keys ({len(first_row)}): {list(first_row.keys())[:5]}...")
    
    return [_dict_to_tuple(row) for row in recordset]


def _convert_params_to_dict(sql: str, params: Optional[Iterable[Any]]) -> Tuple[str, Dict[str, Any]]:
    """Convert positional parameters (?, ?, ?) to named parameters (@p0, @p1, @p2)"""
    if not params:
        return sql, {}
    
    param_list = list(params) if not isinstance(params, (list, tuple)) else list(params)
    param_dict = {}
    modified_sql = sql
    
    for i, param_value in enumerate(param_list):
        param_name = f"p{i}"
        param_dict[param_name] = param_value
        modified_sql = modified_sql.replace('?', f'@{param_name}', 1)
    
    return modified_sql, param_dict


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


class Database:
    """Database class using API Gateway exclusively.
    
    All queries are routed through the SQL Gateway API (default: localhost:8001).
    No direct ODBC/SQL Auth connections are used.
    
    Environment Variables:
    - DB_API_URL: Gateway URL (default: http://localhost:8001)
    - DB_API_KEY: API key for authentication
    - RUN_MODE: 'dev' or 'prod' (determines server profile)
    - DB_SERVER_PROFILE: Override server profile selection
    """
    
    _instance = None
    _lock = threading.Lock()
    _database_instances: Dict[str, 'Database'] = {}

    def __init__(self, pool_size: int = None, database: str = None):
        self._logger = get_logger()
        
        # Determine server profile based on RUN_MODE
        self._run_mode = os.getenv('RUN_MODE', 'dev').lower()
        self._database = database or os.getenv('DB_DATABASE', 'db_ptrj')
        self._server_profile = get_server_profile(self._run_mode)
        
        # API Gateway configuration
        self._api_url = os.getenv('DB_API_URL', 'http://localhost:8001')
        self._api_key = os.getenv('DB_API_KEY', '')
        
        # Timeout and retry configuration
        try:
            self._connection_timeout = int(os.getenv('DB_CONN_TIMEOUT', '60'))
        except Exception:
            self._connection_timeout = 60
        try:
            self._query_timeout = int(os.getenv('DB_QUERY_TIMEOUT', '30'))
        except Exception:
            self._query_timeout = 30
        try:
            self._query_retries = int(os.getenv('DB_QUERY_RETRIES', '2'))
        except Exception:
            self._query_retries = 2
        
        # Initialize API Gateway client
        self._client = _DatabaseAPIClient(
            base_url=self._api_url,
            api_key=self._api_key,
            default_database=self._database,
            server_profile=self._server_profile,
            timeout=self._connection_timeout
        )
        self._connection_type = "API_GATEWAY"
        
        mode_label = "PROD" if self._run_mode == "prod" else "DEV"
        self._logger.info("=" * 60)
        self._logger.info(f"DATABASE API GATEWAY INITIALIZED ({mode_label} MODE)")
        self._logger.info("=" * 60)
        self._logger.info(f"📡 Gateway URL: {self._api_url}")
        self._logger.info(f"🎯 Server Profile: {self._server_profile}")
        self._logger.info(f"🗄️  Database: {self._database}")
        self._logger.info(f"🔑 API Key: {'***' + self._api_key[-8:] if len(self._api_key) > 8 else '(not set)'}")
        self._logger.info(f"⏱️  Timeout: {self._connection_timeout}s")
        self._logger.info("=" * 60)

    @classmethod
    def instance(cls, pool_size: int = None):
        """Get default Database instance (db_ptrj)"""
        with cls._lock:
            if cls._instance is None:
                cls._instance = Database(pool_size)
            return cls._instance
    
    @classmethod
    def for_database(cls, database: str) -> 'Database':
        """
        Get a Database instance for a specific database name.
        Use this for accessing other databases like 'extend_db_ptrj'.
        
        Args:
            database: The database name (e.g., 'extend_db_ptrj')
            
        Returns:
            Database instance configured for the specified database
        """
        with cls._lock:
            if database not in cls._database_instances:
                db = Database(database=database)
                cls._database_instances[database] = db
            return cls._database_instances[database]
    
    @classmethod
    def for_reports(cls, database: str) -> 'Database':
        """
        Get a Database instance for reports that ALWAYS uses DEV server profile (SERVER_PROFILE_1).
        
        This ensures reports access the dev server (10.0.0.110:1433) regardless
        of the backend RUN_MODE setting. This is used when running backend in PROD mode
        but wanting reports to still query the dev database.
        
        Args:
            database: The database name (e.g., 'extend_db_ptrj')
            
        Returns:
            Database instance configured with forced SERVER_PROFILE_1
        """
        with cls._lock:
            cache_key = f"{database}_reports"
            if cache_key not in cls._database_instances:
                # Create instance with database name
                db = Database(database=database)
                # Force SERVER_PROFILE_1 for reports (dev server)
                db._server_profile = 'SERVER_PROFILE_1'
                db._client._server_profile = 'SERVER_PROFILE_1'
                db._logger.info(f"📊 Reports Database: Forced SERVER_PROFILE_1 (dev server) for {database}")
                cls._database_instances[cache_key] = db
            return cls._database_instances[cache_key]

    def query_all(self, sql: str, params: Optional[Iterable[Any]] = None) -> List[Tuple]:
        """Execute query and return all rows"""
        attempt = 0
        delay = 0.5
        
        while attempt <= self._query_retries:
            try:
                modified_sql, param_dict = _convert_params_to_dict(sql, params)
                result = self._client.execute(modified_sql, param_dict)
                
                if not result.get('success'):
                    error_msg = result.get('error', 'Unknown API error')
                    self._logger.error(f"Query failed: {error_msg}")
                    raise Exception(error_msg)
                
                data = result.get('data') or {}
                recordset = data.get('recordset', [])
                
                # Debug: log recordset info for troubleshooting
                if recordset and len(recordset) > 0:
                    first_row = recordset[0]
                    if isinstance(first_row, dict):
                        self._logger.debug(f"[DB] Recordset has {len(recordset)} rows, first row has {len(first_row)} columns")
                
                return _recordset_to_tuples(recordset, self._logger)
                
            except Exception as e:
                self._logger.error(f"Query all error (attempt {attempt + 1}): {e}")
                if attempt >= self._query_retries:
                    raise
                time.sleep(delay)
                delay = min(delay * 2, 2.0)
                attempt += 1
        
        return []

    def execute_query(self, sql: str, params: Optional[Iterable[Any]] = None) -> List[Tuple]:
        """Execute query and return all rows - alias for backward compatibility"""
        return self.query_all(sql, params) or []

    def query_one(self, sql: str, params: Optional[Iterable[Any]] = None) -> Optional[Tuple]:
        """Execute query and return one row"""
        rows = self.query_all(sql, params)
        return rows[0] if rows else None

    class _Tx:
        """Transaction context manager with query batching"""
        
        def __init__(self, db: 'Database'):
            self._db = db
            self._queries: List[dict] = []
            self._committed = False
            self._cursor = Database._TxCursor(self)
        
        def _add_query(self, sql: str, params: Optional[Iterable[Any]] = None):
            modified_sql, param_dict = _convert_params_to_dict(sql, params)
            self._queries.append({"sql": modified_sql, "params": param_dict})
        
        def __enter__(self):
            return self._cursor
        
        def __exit__(self, exc_type, exc, tb):
            if exc_type is None and self._queries:
                result = self._db._client.execute_batch(self._queries)
                if not result.get('success'):
                    error_msg = result.get('error', 'Transaction failed')
                    self._db._logger.error(f"Transaction batch failed: {error_msg}")
                    raise Exception(f"Transaction failed: {error_msg}")
                
                data = result.get('data') or {}
                if not data.get('transactionCommitted', False):
                    self._db._logger.warning("Transaction may not have committed properly")
                
                self._committed = True
                self._db._logger.info(f"Transaction committed: {len(self._queries)} queries")
            elif exc_type is not None:
                self._db._logger.error(f"Transaction cancelled due to: {exc}")

    class _TxCursor:
        """Fake cursor for transaction that collects queries"""
        
        def __init__(self, tx: 'Database._Tx'):
            self._tx = tx
        
        def execute(self, sql: str, *params):
            self._tx._add_query(sql, params if params else None)
        
        def close(self):
            pass

    def transaction(self):
        return Database._Tx(self)

    def test_connection(self) -> bool:
        """Test API Gateway connectivity"""
        try:
            return self._client.health_check()
        except Exception as e:
            self._logger.error(f"Connection test failed: {e}")
            return False

    # Legacy methods for backward compatibility
    def acquire(self):
        return self
    
    def release(self, conn):
        pass
    
    def execute(self, sql: str, params: Optional[Iterable[Any]] = None):
        return self.query_all(sql, params)

    class _ConnectionContext:
        def __init__(self, db: 'Database'):
            self._db = db

        def __enter__(self):
            return self._db

        def __exit__(self, exc_type, exc, tb):
            pass

    def get_connection_context(self):
        return self._ConnectionContext(self)
    
    def cursor(self):
        return _APICursor(self)


class _APICursor:
    """Wrapper to provide cursor-like interface"""
    
    def __init__(self, db: 'Database'):
        self._db = db
        self._last_result: List[Tuple] = []
        self._row_idx = 0
    
    def execute(self, sql: str, *params):
        param_list = params[0] if params and isinstance(params[0], (list, tuple, dict)) else params
        self._last_result = self._db.query_all(sql, param_list if param_list else None)
        self._row_idx = 0
    
    def fetchall(self) -> List[Tuple]:
        return self._last_result
    
    def fetchone(self) -> Optional[Tuple]:
        if self._row_idx < len(self._last_result):
            row = self._last_result[self._row_idx]
            self._row_idx += 1
            return row
        return None
    
    def close(self):
        pass
