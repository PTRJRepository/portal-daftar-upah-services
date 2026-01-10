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
    httpx = None  # Will use ODBC in prod mode

# Use pyodbc for direct database connection in prod mode
try:
    import pyodbc
except ImportError:
    pyodbc = None  # Will use API Gateway in dev mode



class _DatabaseAPIClient:
    """Internal HTTP client for API Gateway communication
    
    Supports two URL formats:
    1. Direct Gateway: http://host:port (appends /v1/query, /v1/query/batch, /health)
    2. Proxy URL: http://host:port/query (uses as-is for queries, /batch for batch)
    """
    
    def __init__(self, base_url: str, api_key: str, default_database: str, timeout: int = 60):
        # Clean the URL - strip whitespace and trailing slash
        self._original_url = base_url.strip().rstrip('/')
        self._api_key = api_key
        self._default_database = default_database
        self._timeout = timeout
        self._logger = get_logger()
        
        # Build endpoint URLs from base URL
        # Always append /v1/query for queries, /health for health check
        # Base URL can be: 
        #   - http://localhost:8001 (direct gateway)
        #   - http://proxy:3001/query (proxy with /query base path)
        self._logger.info(f"📡 Configuring API client with URL: '{self._original_url}'")
        
        # Always append /v1/query to base URL
        self._query_url = self._original_url + '/v1/query'
        self._batch_url = self._original_url + '/v1/query/batch'
        self._health_url = self._original_url + '/health'
        self._databases_url = self._original_url + '/v1/databases'
        
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
    
    def close(self):
        """Close the HTTP client"""
        self._client.close()


class _DatabaseODBCClient:
    """Direct ODBC connection for production mode
    
    Reads configuration from DATABASE_PROFILES_{PROFILE}_* environment variables.
    Provides same interface as _DatabaseAPIClient for seamless switching.
    """
    
    def __init__(self, profile: str = "remote_2", default_database: str = None, timeout: int = 60):
        self._logger = get_logger()
        self._profile = profile.upper()
        self._timeout = timeout
        
        # Read from DATABASE_PROFILES_{PROFILE}_* env vars
        prefix = f"DATABASE_PROFILES_{self._profile}_"
        self._driver = os.getenv(f"{prefix}DRIVER", "ODBC Driver 17 for SQL Server")
        self._server = os.getenv(f"{prefix}SERVER", "localhost")
        self._port = os.getenv(f"{prefix}PORT", "1433")
        self._username = os.getenv(f"{prefix}USERNAME", "sa")
        self._password = os.getenv(f"{prefix}PASSWORD", "")
        self._default_database = default_database or os.getenv(f"{prefix}DATABASE_NAME", "db_ptrj")
        self._trusted_connection = os.getenv(f"{prefix}TRUSTED_CONNECTION", "false").lower() == "true"
        self._encrypt = os.getenv(f"{prefix}ENCRYPT", "false").lower() == "true"
        
        # Connection pool
        self._connection = None
        self._lock = threading.Lock()
        
        self._logger.info(f"🔌 Configuring ODBC client with profile: '{profile}'")
        self._logger.info(f"🔌 Server: {self._server}:{self._port}")
        self._logger.info(f"🔌 Database: {self._default_database}")
    
    def _get_connection_string(self, database: str = None) -> str:
        """Build ODBC connection string"""
        db = database or self._default_database
        conn_str = (
            f"DRIVER={{{self._driver}}};"
            f"SERVER={self._server},{self._port};"
            f"DATABASE={db};"
        )
        
        if self._trusted_connection:
            conn_str += "Trusted_Connection=yes;"
        else:
            conn_str += f"UID={self._username};PWD={self._password};"
        
        if not self._encrypt:
            conn_str += "Encrypt=no;TrustServerCertificate=yes;"
        
        return conn_str
    
    def _get_connection(self, database: str = None):
        """Get or create pyodbc connection"""
        if pyodbc is None:
            raise ImportError("pyodbc is required for ODBC connections. Install with: pip install pyodbc")
        
        conn_str = self._get_connection_string(database)
        return pyodbc.connect(conn_str, timeout=self._timeout)
    
    def execute(self, sql: str, params: Optional[Dict[str, Any]] = None, database: Optional[str] = None) -> dict:
        """Execute single query via ODBC"""
        try:
            # Convert named params (@p0, @p1) back to positional (?)
            modified_sql = sql
            param_values = []
            if params:
                # Sort params by name to maintain order
                for key in sorted(params.keys(), key=lambda x: int(x[1:]) if x[1:].isdigit() else 0):
                    modified_sql = modified_sql.replace(f"@{key}", "?", 1)
                    param_values.append(params[key])
            
            conn = self._get_connection(database)
            try:
                cursor = conn.cursor()
                if param_values:
                    cursor.execute(modified_sql, param_values)
                else:
                    cursor.execute(modified_sql)
                
                # Fetch results
                columns = [desc[0] for desc in cursor.description] if cursor.description else []
                rows = cursor.fetchall() if cursor.description else []
                
                # Convert to dict format matching API Gateway response
                recordset = []
                for row in rows:
                    row_dict = {}
                    for i, col in enumerate(columns):
                        value = row[i]
                        # Convert datetime to ISO string for consistency
                        if isinstance(value, datetime):
                            value = value.isoformat()
                        row_dict[col] = value
                    recordset.append(row_dict)
                
                cursor.close()
                return {
                    "success": True,
                    "data": {"recordset": recordset, "rowsAffected": len(recordset)}
                }
            finally:
                conn.close()
                
        except Exception as e:
            self._logger.error(f"ODBC query failed: {e}")
            return {"success": False, "error": str(e), "data": None}
    
    def execute_batch(self, queries: List[dict], database: Optional[str] = None) -> dict:
        """Execute batch transaction via ODBC"""
        try:
            conn = self._get_connection(database)
            try:
                cursor = conn.cursor()
                
                for query in queries:
                    sql = query.get("sql", "")
                    params = query.get("params", {})
                    
                    # Convert named params to positional
                    modified_sql = sql
                    param_values = []
                    if params:
                        for key in sorted(params.keys(), key=lambda x: int(x[1:]) if x[1:].isdigit() else 0):
                            modified_sql = modified_sql.replace(f"@{key}", "?", 1)
                            param_values.append(params[key])
                    
                    if param_values:
                        cursor.execute(modified_sql, param_values)
                    else:
                        cursor.execute(modified_sql)
                
                conn.commit()
                cursor.close()
                
                return {
                    "success": True,
                    "data": {"transactionCommitted": True, "queriesExecuted": len(queries)}
                }
            except Exception as e:
                conn.rollback()
                raise e
            finally:
                conn.close()
                
        except Exception as e:
            self._logger.error(f"ODBC batch failed: {e}")
            return {"success": False, "error": str(e), "data": None}
    
    def health_check(self) -> bool:
        """Test ODBC connectivity"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.close()
            conn.close()
            return True
        except Exception as e:
            self._logger.error(f"ODBC health check failed: {e}")
            return False
    
    def close(self):
        """Close any cached connections"""
        pass  # Connections are closed after each query


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


class Database:
    _instance = None
    _lock = threading.Lock()
    _database_instances: Dict[str, 'Database'] = {}

    def __init__(self, pool_size: int = None, database: str = None):
        self._logger = get_logger()
        
        # Determine connection mode based on RUN_MODE
        self._run_mode = os.getenv('RUN_MODE', 'dev').lower()
        self._database = database or os.getenv('DB_DATABASE', 'db_ptrj')
        
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
        
        # Initialize client based on run mode - both modes use ODBC
        if pyodbc is not None:
            # Use ODBC for both modes with different profiles
            if self._run_mode == "prod":
                profile = os.getenv('DB_PROFILE', 'remote_2')  # 10.0.0.2:1888
            else:
                profile = os.getenv('DB_PROFILE', 'remote')  # 10.0.0.110:1433
            
            self._client = _DatabaseODBCClient(
                profile=profile,
                default_database=self._database,
                timeout=self._connection_timeout
            )
            self._connection_type = "ODBC"
            
            mode_label = "PROD" if self._run_mode == "prod" else "DEV"
            self._logger.info("=" * 60)
            self._logger.info(f"DATABASE ODBC CLIENT INITIALIZED ({mode_label} MODE)")
            self._logger.info("=" * 60)
            self._logger.info(f"🔌 Profile: {profile}")
            self._logger.info(f"🗄️  Database: {self._database}")
            self._logger.info(f"⏱️  Timeout: {self._connection_timeout}s")
            self._logger.info("=" * 60)
        else:
            # Fallback: Use API Gateway when pyodbc is not available
            self._api_url = os.getenv('DB_API_URL', 'http://localhost:8001')
            self._api_key = os.getenv('DB_API_KEY', '')
            
            if httpx is None:
                raise ImportError("Neither pyodbc nor httpx is available. Install one of them.")
            
            self._client = _DatabaseAPIClient(
                self._api_url,
                self._api_key,
                self._database,
                self._connection_timeout
            )
            self._connection_type = "API_GATEWAY"
            
            self._logger.info("=" * 60)
            self._logger.info("DATABASE API GATEWAY CLIENT INITIALIZED (FALLBACK)")
            self._logger.info("=" * 60)
            self._logger.info(f"📡 Gateway URL: {self._api_url}")
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
