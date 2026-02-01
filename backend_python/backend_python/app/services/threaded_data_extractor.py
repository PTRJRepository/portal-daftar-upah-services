import threading
import concurrent.futures
import time
import calendar
import re
import json
import os
from typing import List, Dict, Any, Optional, Tuple
from database.services.database import Database
from database.services.queries import Queries
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ThreadedDataExtractor:
    """Optimized data extractor with threading and parallel query processing"""

    def __init__(self, max_workers: int = 12):
        self.max_workers = max_workers
        self.db = Database.instance(pool_size=20)
        self.queries = Queries()
        
        # Load configuration
        config_path = os.path.join(os.path.dirname(__file__), '..', '..', 'config.json')
        try:
            with open(config_path, 'r') as f:
                self.config = json.load(f)
        except Exception as e:
            logger.warning(f"Warning: Could not load config from {config_path}: {e}")
            self.config = {
                "constants": {
                    "potongan_bpjs": {"gaji_pokok_min": 3876600}
                }
            }
    
    DIVISION_PREFIX_MAP = {
        'PG1A': ['A'],
        'PG1B': ['B'],
        'PG2A': ['C'],
        'PG2B': ['D'],
        'DME': ['E'],
        'ARA': ['F'],
        'ARB1': ['G'],
        'ARB2': ['H'],
        'INFRA': ['I'],
        'AREC': ['J'],
        # NOTE: IJL removed - uses dynamic gang lookup from HR_GANG (L1H, L1M, L1T)
        'STF-OFFICE': ['STF'],
        'SECURITY': ['SEC']
    }
    
    # Cache for current month detection from database
    _current_month_cache = None
    _current_month_cache_time = None
    _CACHE_TTL_SECONDS = 300  # 5 minutes cache

    def _get_current_month_from_db(self) -> Tuple[int, int]:
        """
        Get the current month/year from PR_TASKREG table (non-ARC).
        This indicates the latest month being actively processed in the database.
        
        Returns:
            Tuple of (year, month) representing current active month in database
        """
        import time as time_module
        
        # Check cache first
        if (ThreadedDataExtractor._current_month_cache is not None and 
            ThreadedDataExtractor._current_month_cache_time is not None and
            (time_module.time() - ThreadedDataExtractor._current_month_cache_time) < self._CACHE_TTL_SECONDS):
            return ThreadedDataExtractor._current_month_cache
        
        try:
            sql = """
                SELECT TOP 1 YEAR(DocDate) as year, MONTH(DocDate) as month 
                FROM PR_TASKREG 
                WHERE DocDate IS NOT NULL
                ORDER BY DocDate DESC
            """
            result = self.db.query_one(sql, [])
            
            if result and result[0] and result[1]:
                db_year = int(result[0])
                db_month = int(result[1])
                
                # Update cache
                ThreadedDataExtractor._current_month_cache = (db_year, db_month)
                ThreadedDataExtractor._current_month_cache_time = time_module.time()
                
                logger.info(f"📅 Current month from DB (PR_TASKREG): {db_month}/{db_year}")
                return (db_year, db_month)
            else:
                from datetime import datetime
                now = datetime.now()
                logger.warning(f"⚠️ No data in PR_TASKREG, using system date: {now.month}/{now.year}")
                return (now.year, now.month)
                
        except Exception as e:
            logger.error(f"Error getting current month from DB: {e}")
            from datetime import datetime
            now = datetime.now()
            return (now.year, now.month)

    def _should_use_arc_tables(self, requested_month: int, requested_year: int) -> bool:
        """
        Determine whether to use ARC tables based on requested month vs current DB month.
        
        - Past months (before current DB month) → Use ARC tables (historical data, locked)
        - Current month (same as DB month) → Use BASE tables (current data, live)
        
        Returns:
            True if ARC tables should be used, False for BASE tables
        """
        db_year, db_month = self._get_current_month_from_db()
        
        # Past year - always use ARC
        if requested_year < db_year:
            logger.info(f"📦 Year {requested_year} < DB year {db_year} → Using ARC tables (past data)")
            return True
        
        # Same year but past month - use ARC
        if requested_year == db_year and requested_month < db_month:
            logger.info(f"📦 Month {requested_month} < DB month {db_month} → Using ARC tables (past data)")
            return True
        
        # Current or future month - use BASE tables (no _ARC suffix)
        logger.info(f"📋 Month {requested_month}/{requested_year} >= DB {db_month}/{db_year} → Using BASE tables (current data)")
        return False

    def _is_valid_dynamic_premi(self, doc_desc: str) -> bool:
        """
        Check if the document description is a valid dynamic premi.
        Per user requirement: All premi items ALWAYS start with the word 'Premi'.
        """
        if not doc_desc:
            return False
            
        doc_desc_upper = doc_desc.upper().strip()
        
        # Simple check: Valid premi items start with 'PREMI'
        return doc_desc_upper.startswith('PREMI')

    def _normalize_premi_field_name(self, doc_desc: str) -> str:
        """Normalize DocDesc to valid Python field name for dynamic premi fields"""
        if not doc_desc:
            return ""
        
        name = doc_desc.strip().upper()
        prefixes_to_remove = ['TUNJANGAN PREMI', 'TUNJANGAN', 'PREMI']
        original_name = name
        for prefix in prefixes_to_remove:
            if name.startswith(prefix):
                name = name[len(prefix):].strip()
                break
        
        if not name:
            if "TUNJANGAN PREMI" in original_name:
                name = "TUNJANGAN_PREMI"
            elif original_name == "PREMI":
                name = "PREMI"
            else:
                return ""
        
        # Normalize: Any 'PANEN' keyword should become 'INSENTIF_PANEN'
        if 'PANEN' in name and 'INSENTIF' not in name:
            name = 'INSENTIF_PANEN'
        
        name = name.lower().replace(' ', '_')
        name = re.sub(r'[^a-z0-9_]', '', name)
        name = re.sub(r'_+', '_', name)
        name = name.strip('_')
        
        if not name:
            return ""
            
        if not name.startswith('premi_'):
            name = f'premi_{name}'
            
        return name

    def extract_all_payroll_data_parallel(self, month: int, year: int, gang_code: str, division_code: str = None) -> Dict[str, Any]:
        """
        Extract all payroll data using parallel queries for maximum performance.
        
        SMART TABLE SELECTION:
        - Past months → Use ARC tables directly (historical data is locked/finalized)
        - Current month → Use BASE tables directly (data is still being processed)
        
        This eliminates fallback overhead and ensures correct data retrieval.
        """
        start_time = time.perf_counter()

        # Prepare query parameters
        start_date = f"{year}-{str(month).zfill(2)}-01"
        if month == 12:
            end_date = f"{year+1}-01-01"
        else:
            end_date = f"{year}-{str(month+1).zfill(2)}-01"

        # SMART TABLE DETECTION: Determine table mode upfront
        use_arc = self._should_use_arc_tables(month, year)
        table_mode = "ARC" if use_arc else "BASE"
        
        # Get queries (all queries use _ARC by default)
        time_sensitive_queries = {
            'attendance_data': self._get_attendance_query(gang_code, start_date, end_date, division_code),
            'premi_headers': self._get_dynamic_premi_headers_query(gang_code, start_date, end_date, division_code),
            'premi_amounts': self._get_premi_amounts_query(gang_code, start_date, end_date, division_code),
            'brondol_data': self._get_brondol_query(gang_code, start_date, end_date, division_code),
            'tunjangan_data': self._get_tunjangan_query(gang_code, start_date, end_date, division_code),
            'potongan_headers': self._get_dynamic_potongan_headers_query(gang_code, start_date, end_date, division_code),
            'potongan_data': self._get_potongan_query(gang_code, start_date, end_date, division_code),
            'cuti_data': self._get_cuti_query(gang_code, start_date, end_date, division_code),
            'lembur_data': self._get_lembur_data_query(gang_code, start_date, end_date, division_code)
        }
        
        # Master data queries (no ARC transformation needed)
        # NOTE: employee_data is now here because it no longer uses date filtering or ARC tables
        master_data_queries = {
            'employee_data': self._get_employees_query(gang_code, start_date, end_date, division_code),
            'upah_pokok_data': self._get_upah_pokok_query(gang_code, start_date, end_date, division_code),
            'beras_rate_data': self._get_individual_beras_rate_query(gang_code, start_date, end_date, division_code),
            'masa_kerja_data': self._get_masa_kerja_data_query(gang_code, division_code),
        }

        results = {}
        query_times = {}
        fallback_info = {}  # Track table mode for each query

        # Execute queries in parallel using ThreadPoolExecutor
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            
            # For time-sensitive queries: Apply table transformation based on mode
            ts_futures = {}
            for name, query_def in time_sensitive_queries.items():
                if not use_arc:
                    # Current month: Use BASE tables
                    # SPECIAL CASE: potongan_data needs a completely different query for BASE mode
                    # because PR_ADTRANS has Amount directly, not in a line table
                    if name == 'potongan_data':
                        base_query = self._get_potongan_query_base(gang_code, start_date, end_date, division_code)
                        ts_futures[executor.submit(self._execute_query_with_timing, name, base_query)] = name
                    else:
                        # Transform other queries by removing _ARC suffix
                        transformed_sql = self._remove_arc_suffix(query_def['sql'])
                        transformed_query = {'sql': transformed_sql, 'params': query_def['params']}
                        ts_futures[executor.submit(self._execute_query_with_timing, name, transformed_query)] = name
                    fallback_info[name] = True  # Indicates non-ARC mode was used
                else:
                    # Past month: Use ARC tables directly
                    ts_futures[executor.submit(self._execute_query_with_timing, name, query_def)] = name
                    fallback_info[name] = False  # ARC mode
            
            # Master data queries (no transformation)
            md_futures = {
                executor.submit(self._execute_query_with_timing, name, query_def): name
                for name, query_def in master_data_queries.items()
            }

            # Collect results from time-sensitive queries
            for future in concurrent.futures.as_completed(ts_futures):
                task_name = ts_futures[future]
                try:
                    result_data, execution_time = future.result(timeout=30)
                    results[task_name] = result_data
                    query_times[task_name] = execution_time
                    row_count = len(result_data) if result_data else 0
                    logger.info(f"✅ {task_name}: {row_count} rows in {execution_time:.2f}ms [{table_mode}]")
                except Exception as e:
                    logger.error(f"Query {task_name} failed: {e}")
                    raise RuntimeError(f"Database query failed for {task_name}: {e}") from e

            # Collect results from master data queries
            for future in concurrent.futures.as_completed(md_futures):
                task_name = md_futures[future]
                try:
                    result_data, execution_time = future.result(timeout=30)
                    results[task_name] = result_data
                    query_times[task_name] = execution_time
                    row_count = len(result_data) if result_data else 0
                    logger.info(f"✅ {task_name}: {row_count} rows in {execution_time:.2f}ms [master]")
                except Exception as e:
                    logger.error(f"Query {task_name} failed: {e}")
                    raise RuntimeError(f"Database query failed for {task_name}: {e}") from e

        # Process and merge results
        merged_data = self._process_parallel_results(results, gang_code, month, year, fallback_info)
        merged_data['query_performance'] = query_times
        merged_data['arc_fallback_used'] = fallback_info
        merged_data['table_mode'] = table_mode

        total_time = time.perf_counter() - start_time
        
        logger.info(f"🚀 Parallel extraction complete in {total_time:.2f}s | Mode: {table_mode} | {len(results)} queries")

        return merged_data

    def _remove_arc_suffix(self, sql: str) -> str:
        """
        Remove _ARC suffix from table names in SQL query.
        This is used for fallback when ARC tables have no data for current month.
        
        Examples:
            PR_EMP_ATTN_ARC -> PR_EMP_ATTN
            PR_ADTRANS_ARC -> PR_ADTRANS
            "PR_LOOSEFRUIT_ARC" -> "PR_LOOSEFRUIT"
        """
        # Handle both quoted and unquoted table names
        # Pattern matches: TABLE_ARC, "TABLE_ARC", 'TABLE_ARC'
        import re
        
        # Replace _ARC suffix before common SQL keywords, quotes, or whitespace
        # Pattern: _ARC followed by word boundary, quote, space, dot, or end of line
        patterns = [
            (r'_ARC"', '"'),           # "TABLE_ARC" -> "TABLE"
            (r"_ARC'", "'"),           # 'TABLE_ARC' -> 'TABLE'
            (r'_ARC\s', ' '),          # TABLE_ARC (space) -> TABLE (space)
            (r'_ARC\)', ')'),          # TABLE_ARC) -> TABLE)
            (r'_ARC\.', '.'),          # TABLE_ARC. -> TABLE.
            (r'_ARC,', ','),           # TABLE_ARC, -> TABLE,
            (r'_ARC$', ''),            # TABLE_ARC (end) -> TABLE
        ]
        
        result = sql
        for pattern, replacement in patterns:
            result = re.sub(pattern, replacement, result)
        
        return result

    def _execute_query_with_arc_fallback(self, task_name: str, query_def: Dict[str, Any]) -> Tuple[List[Tuple], float, bool]:
        """
        Execute a query with ARC table fallback logic.
        First tries with _ARC tables, if no data found, retries with non-ARC tables.
        
        Returns:
            Tuple of (result_data, execution_time_ms, used_fallback)
        """
        start_time = time.perf_counter()
        used_fallback = False
        
        try:
            if isinstance(query_def, str):
                sql = query_def
                params = []
            elif isinstance(query_def, dict):
                sql = query_def.get('sql', '')
                params = query_def.get('params', [])
            else:
                raise ValueError(f"Invalid query definition for {task_name}")
            
            # First attempt: Query with ARC tables
            result = self.db.query_all(sql, params)
            arc_row_count = len(result) if result else 0
            
            # Check if result is empty and SQL contains _ARC tables
            if not result and '_ARC' in sql:
                logger.info(f"🔄 FALLBACK TRIGGERED: {task_name} - ARC tables returned 0 rows, trying non-ARC tables...")
                
                # Remove _ARC suffix and retry
                sql_no_arc = self._remove_arc_suffix(sql)
                # Log the modified SQL for debugging
                logger.info(f"📝 Fallback SQL for {task_name} (first 300 chars): {sql_no_arc[:300].strip()}")
                result = self.db.query_all(sql_no_arc, params)
                used_fallback = True
                non_arc_row_count = len(result) if result else 0
                
                if result:
                    logger.info(f"✅ FALLBACK SUCCESS: {task_name} - found {non_arc_row_count} rows in non-ARC tables")
                else:
                    logger.warning(f"⚠️ FALLBACK FAILED: {task_name} - No data in both ARC (0 rows) and non-ARC ({non_arc_row_count} rows) tables")
            else:
                if arc_row_count > 0:
                    logger.info(f"📊 {task_name}: ARC tables returned {arc_row_count} rows (no fallback needed)")
            
            execution_time = (time.perf_counter() - start_time) * 1000
            return result, execution_time, used_fallback
            
        except Exception as e:
            execution_time = (time.perf_counter() - start_time) * 1000
            logger.error(f"Error executing query {task_name} in {execution_time:.2f}ms: {e}")
            raise

    def _execute_query_with_timing(self, task_name: str, query_def: Dict[str, Any]) -> Tuple[List[Tuple], float]:
        """Execute a single query with timing and error handling"""
        start_time = time.perf_counter()
        try:
            if isinstance(query_def, str):
                # Simple query string
                result = self.db.query_all(query_def)
            elif isinstance(query_def, dict):
                # Query with parameters
                sql = query_def.get('sql', '')
                params = query_def.get('params', [])
                result = self.db.query_all(sql, params)
            else:
                raise ValueError(f"Invalid query definition for {task_name}")

            execution_time = (time.perf_counter() - start_time) * 1000
            return result, execution_time
        except Exception as e:
            execution_time = (time.perf_counter() - start_time) * 1000
            logger.error(f"Error executing query {task_name} in {execution_time:.2f}ms: {e}")
            raise

    def _get_division_condition(self, division_code: str) -> Tuple[str, List[str]]:
        """
        Generate SQL condition for filtering by division.
        Supports both legacy division names (PG2B) and LocCode names (P2B).
        Uses HR_GANG table to get actual gang codes for the division.
        """
        if not division_code:
            return "1=0", []
        
        # First, try direct lookup in DIVISION_PREFIX_MAP (legacy names)
        if division_code in self.DIVISION_PREFIX_MAP:
            prefixes = self.DIVISION_PREFIX_MAP[division_code]
            conditions = []
            params = []
            for p in prefixes:
                conditions.append("RTRIM(LTRIM(g.GangCode)) LIKE ?")
                params.append(f"{p}%")
            
            sql = "(" + " OR ".join(conditions) + ")"
            return sql, params
        
        # If not found in legacy map, try to convert and use HR_GANG LocCode
        try:
            from app.services.gang_service import GangService
            gang_svc = GangService()
            
            # Convert legacy division name to LocCode if needed
            loc_code = gang_svc.convert_division_to_loccode(division_code)
            
            # Get actual gang codes from HR_GANG for this LocCode
            from app.services.summary_service import get_gangs_by_loc_code
            gangs = get_gangs_by_loc_code(loc_code)
            
            if gangs and len(gangs) > 0:
                conditions = []
                params = []
                for gang in gangs:
                    gang_code = gang.get('gang_code', '').strip()
                    if gang_code:
                        conditions.append("RTRIM(LTRIM(g.GangCode)) = ?")
                        params.append(gang_code)
                
                if conditions:
                    sql = "(" + " OR ".join(conditions) + ")"
                    logger.info(f"[_get_division_condition] Using HR_GANG gangs for {division_code} -> {loc_code}: {len(gangs)} gangs")
                    return sql, params
        except Exception as e:
            logger.warning(f"[_get_division_condition] Failed to get gangs from HR_GANG for {division_code}: {e}")
        
        # Fallback: Return 1=0 if nothing works (no data will match)
        logger.warning(f"[_get_division_condition] No mapping found for division: {division_code}")
        return "1=0", []

    def _get_gang_condition_sql(self, gang_code: str, division_code: str = None, alias: str = 'g') -> Tuple[str, List[str]]:
        """Generate the SQL condition for filtering by gang or division (without WHERE/AND)
        
        Priority:
        1. If gang_code is a specific gang (not 'ALL' or empty), filter by that gang only
        2. If gang_code is 'ALL' or empty, and division_code is provided, filter by all gangs in division
        3. Otherwise, use the gang_code parameter as-is
        """
        # If a specific gang is requested (not ALL), prioritize it
        if gang_code and gang_code.upper() != 'ALL':
            # Support LIKE queries if wildcard is present
            if '%' in gang_code:
                return f"RTRIM(LTRIM({alias}.GangCode)) LIKE ?", [gang_code]
            
            # Specific gang code - use direct match
            return f"RTRIM(LTRIM({alias}.GangCode)) = ?", [gang_code.strip()]
        
        # If gang_code is 'ALL' or empty, and division_code is provided, get all gangs in division
        if division_code:
            div_sql, div_params = self._get_division_condition(division_code)
            if alias != 'g':
                 div_sql = div_sql.replace('g.GangCode', f'{alias}.GangCode')
            return div_sql, div_params
        
        # Fallback: match all or specific based on parameter
        return f"(RTRIM(LTRIM({alias}.GangCode)) = ? OR ? = 'ALL')", [gang_code, gang_code.upper()]

    def _execute_query(self, task_name: str, query_def: Dict[str, Any]) -> List[Tuple]:
        """Execute a single query with error handling"""
        result, _ = self._execute_query_with_timing(task_name, query_def)
        return result

    def _get_employees_query(self, gang_code: str, start_date: str, end_date: str, division_code: str = None) -> Dict[str, Any]:
        """
        Get employees by gang code from HR_GANGLN.
        
        CHANGE: No longer requires PR_TASKREGLN records.
        This ensures new employees who are registered in a gang but haven't
        started working yet will still appear in the payroll list.
        """
        condition_sql, params = self._get_gang_condition_sql(gang_code, division_code)
        
        return {
            'sql': f"""
                SELECT DISTINCT
                    e.EmpCode as nik,
                    e.EmpName as nama,
                    e.Gender as jenis_kelamin,
                    '' as tanggal_join,
                    '' as departemen,
                    '' as jabatan,
                    RTRIM(LTRIM(g.GangCode)) as gang
                FROM HR_EMPLOYEE e
                JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                WHERE {condition_sql}
                ORDER BY e.EmpCode
            """,
            'params': params
        }

    def _get_attendance_query(self, gang_code: str, start_date: str, end_date: str, division_code: str = None) -> Dict[str, Any]:
        """
        Get HK (hari kerja) count from PR_TASKREGLN.
        Total HK = count of ALL records where OT=0 (excluding alfa where there's no data).
        
        Also fetches Total Amount (Upah Pokok) from DB.
        """
        condition_sql, condition_params = self._get_gang_condition_sql(gang_code, division_code)
        
        return {
            'sql': f"""
                SELECT
                    tr.EmpCode,
                    COUNT(*) as hk_count,
                    SUM(tr.Amount) as total_amount_rp
                FROM PR_TASKREGLN_ARC tr
                JOIN PR_TASKREG_ARC tm ON tr.MasterID = tm.ID
                JOIN HR_GANGLN g ON g.GangMember = tr.EmpCode
                WHERE tr.TrxDate >= ?
                  AND tr.TrxDate < ?
                  AND tr.OT = 0
                  AND {condition_sql}
                GROUP BY tr.EmpCode
                ORDER BY tr.EmpCode
            """,
            'params': [start_date, end_date] + condition_params
        }

    def _get_dynamic_premi_headers_query(self, gang_code: str, start_date: str, end_date: str, division_code: str = None) -> Dict[str, Any]:
        """Get dynamic premi headers - ONLY items starting with 'PREMI'
        
        Uses UNION between ARC and BASE tables to capture headers from both sources.
        """
        condition_sql, condition_params = self._get_gang_condition_sql(gang_code, division_code)
        # Duplicate params for UNION
        all_params = condition_params + [start_date, end_date] + condition_params + [start_date, end_date]
        return {
            'sql': f"""
                SELECT DISTINCT DocDesc FROM (
                    -- From ARC table
                    SELECT DISTINCT t.DocDesc
                    FROM PR_ADTRANS_ARC AS t
                    JOIN PR_ADTRANSLN_ARC AS ln ON t.ID = ln.MasterID
                    JOIN HR_GANGLN AS g ON g.GangMember = t.EmpCode
                    WHERE {condition_sql}
                        AND t.DocDate >= ?
                        AND t.DocDate < ?
                        AND COALESCE(ln.Amount,0) > 0
                        AND t.DocDesc IS NOT NULL
                        AND UPPER(t.DocDesc) LIKE 'PREMI%'
                    
                    UNION
                    
                    -- From BASE table (new employees)
                    SELECT DISTINCT t.DocDesc
                    FROM PR_ADTRANS AS t
                    JOIN PR_ADTRANSLN AS ln ON t.ID = ln.MasterID
                    JOIN HR_GANGLN AS g ON g.GangMember = t.EmpCode
                    WHERE {condition_sql}
                        AND t.DocDate >= ?
                        AND t.DocDate < ?
                        AND COALESCE(ln.Amount,0) > 0
                        AND t.DocDesc IS NOT NULL
                        AND UPPER(t.DocDesc) LIKE 'PREMI%'
                ) combined
                ORDER BY DocDesc
            """,
            'params': all_params
        }

    def _get_premi_amounts_query(self, gang_code: str, start_date: str, end_date: str, division_code: str = None) -> Dict[str, Any]:
        """Get premi amounts for all employees
        
        FIX: Uses IN subquery instead of JOIN to prevent double counting 
        when employees are registered in multiple gangs in HR_GANGLN.
        
        Uses UNION between ARC and BASE tables to capture both historical and new employee data.
        """
        condition_sql, condition_params = self._get_gang_condition_sql(gang_code, division_code)
        # Build the subquery condition for employee filtering
        gang_subquery_condition = condition_sql.replace('g.GangCode', 'gsub.GangCode')
        
        # Duplicate params for UNION
        all_params = condition_params + [start_date, end_date] + condition_params + [start_date, end_date]
        
        return {
            'sql': f"""
                SELECT EmpCode, DocDesc, SUM(TotalAmount) as TotalAmount
                FROM (
                    -- From ARC table
                    SELECT
                        t.EmpCode,
                        t.DocDesc,
                        SUM(COALESCE(ln.Amount,0)) as TotalAmount
                    FROM PR_ADTRANS_ARC AS t
                    JOIN PR_ADTRANSLN_ARC AS ln ON t.ID = ln.MasterID
                    WHERE t.EmpCode IN (
                        SELECT DISTINCT gsub.GangMember 
                        FROM HR_GANGLN AS gsub 
                        WHERE {gang_subquery_condition}
                    )
                        AND t.DocDate >= ?
                        AND t.DocDate < ?
                        AND COALESCE(ln.Amount,0) > 0
                    GROUP BY t.EmpCode, t.DocDesc
                    
                    UNION ALL
                    
                    -- From BASE table (new employees)
                    SELECT
                        t.EmpCode,
                        t.DocDesc,
                        SUM(COALESCE(ln.Amount,0)) as TotalAmount
                    FROM PR_ADTRANS AS t
                    JOIN PR_ADTRANSLN AS ln ON t.ID = ln.MasterID
                    WHERE t.EmpCode IN (
                        SELECT DISTINCT gsub.GangMember 
                        FROM HR_GANGLN AS gsub 
                        WHERE {gang_subquery_condition}
                    )
                        AND t.DocDate >= ?
                        AND t.DocDate < ?
                        AND COALESCE(ln.Amount,0) > 0
                        AND t.EmpCode NOT IN (
                            SELECT DISTINCT EmpCode FROM PR_ADTRANS_ARC
                            WHERE DocDate >= ? AND DocDate < ?
                        )
                    GROUP BY t.EmpCode, t.DocDesc
                ) combined
                GROUP BY EmpCode, DocDesc
            """,
            'params': all_params + [start_date, end_date]
        }

    def _get_brondol_query(self, gang_code: str, start_date: str, end_date: str, division_code: str = None) -> Dict[str, Any]:
        """Get brondol amounts from PR_LOOSEFRUIT_ARC using reference query
        
        FIX: Uses IN subquery instead of JOIN to prevent double counting.
        """
        condition_sql, condition_params = self._get_gang_condition_sql(gang_code, division_code)
        gang_subquery_condition = condition_sql.replace('g.GangCode', 'gsub.GangCode')
        
        return {
            'sql': f"""
                SELECT
                    LFLN.EmpCode,
                    SUM(LFLN.Amount) AS TotalAmount
                FROM "PR_LOOSEFRUIT_ARC" LF
                JOIN "PR_LOOSEFRUITLN_ARC" LFLN ON LF.ID = LFLN.MasterID
                WHERE LFLN.EmpCode IN (
                    SELECT DISTINCT gsub.GangMember 
                    FROM HR_GANGLN AS gsub 
                    WHERE {gang_subquery_condition}
                )
                  AND LF.DocDate >= ?
                  AND LF.DocDate < ?
                GROUP BY LFLN.EmpCode
            """,
            'params': condition_params + [start_date, end_date]
        }

    def _get_tunjangan_query(self, gang_code: str, start_date: str, end_date: str, division_code: str = None) -> Dict[str, Any]:
        """Get tunjangan data
        
        FIX: Uses IN subquery instead of JOIN to prevent double counting.
        """
        condition_sql, condition_params = self._get_gang_condition_sql(gang_code, division_code)
        gang_subquery_condition = condition_sql.replace('g.GangCode', 'gsub.GangCode')
        
        return {
            'sql': f"""
                SELECT
                    t.EmpCode,
                    t.DocDesc,
                    SUM(COALESCE(ln.Amount,0)) as TotalAmount
                FROM PR_ADTRANS_ARC AS t
                JOIN PR_ADTRANSLN_ARC AS ln ON t.ID = ln.MasterID
                WHERE t.EmpCode IN (
                    SELECT DISTINCT gsub.GangMember 
                    FROM HR_GANGLN AS gsub 
                    WHERE {gang_subquery_condition}
                )
                    AND t.DocDate >= ?
                    AND t.DocDate < ?
                    AND UPPER(t.DocDesc) LIKE '%TUNJANGAN%'
                GROUP BY t.EmpCode, t.DocDesc
            """,
            'params': condition_params + [start_date, end_date]
        }

    def _map_potongan_field(self, pot_name: str) -> str:
        """Map potongan description to field name - MUST MATCH HeaderService logic"""
        pot_lower = pot_name.lower()

        # Known deduction mappings
        if "pph21" in pot_lower or "pph 21" in pot_lower:
            return "pot_pph21"
        elif "spsi" in pot_lower:
            return "pot_spsi"
        elif "bpjs" in pot_lower and "kes" in pot_lower:
            return "pot_bpjs_kesehatan_pekerja"
        elif "bpjs" in pot_lower and "pek" in pot_lower:
            return "pot_bpjs_pek"
        elif "bpjs" in pot_lower and "maj" in pot_lower:
            return "pot_bpjs_maj"
        elif "pinjam" in pot_lower:
            return "pot_pinjam"
        elif "kl" in pot_lower:
            return "pot_kl"
        elif "thr" in pot_lower:
            return "pot_thr"
        elif "kontan" in pot_lower:
            return "pot_kontan"
        elif "potongan tiket" in pot_lower:
            return "pot_tiket"
        elif "alat" in pot_lower:
            return "pot_alat"

        # Return None for unknown deductions - will use dynamic field name
        return None

    def _get_dynamic_potongan_headers_query(self, gang_code: str, start_date: str, end_date: str, division_code: str = None) -> Dict[str, Any]:
        """Get dynamic POTONGAN headers using same logic as HeaderService"""
        condition_sql, condition_params = self._get_gang_condition_sql(gang_code, division_code)
        
        # Using potongan_pattern_headers logic from potongan.json
        # Match HeaderService query exactly to ensure consistent indexing
        return {
            'sql': f"""
                SELECT DISTINCT t.DocDesc 
                FROM PR_ADTRANS_ARC AS t 
                JOIN PR_ADTRANSLN_ARC AS ln ON t.ID = ln.MasterID 
                JOIN HR_GANGLN AS g ON g.GangMember = t.EmpCode 
                WHERE {condition_sql} 
                  AND t.DocDate >= ? 
                  AND t.DocDate < ? 
                  AND COALESCE(ln.Amount,0) > 0
                  AND t.DocDesc IS NOT NULL
                  AND UPPER(t.DocDesc) NOT LIKE '%ASTEK%'
                  AND UPPER(t.DocDesc) NOT LIKE '%PREMI%'
                  AND UPPER(t.DocDesc) NOT LIKE '%BPJS%'
                  AND UPPER(t.DocDesc) NOT LIKE '%KESEHATAN%'
                  AND UPPER(t.DocDesc) NOT LIKE '%PENSIUN%'
                  AND UPPER(t.DocDesc) NOT LIKE '%PPH%'
                  AND UPPER(t.DocDesc) NOT LIKE '%SPSI%'
                  AND (UPPER(t.DocDesc) LIKE 'KOREKSI%'
                       OR UPPER(t.DocDesc) LIKE 'POT%' 
                       OR UPPER(t.DocDesc) LIKE 'POTONGAN%'
                       OR UPPER(t.DocDesc) LIKE '%TIKET%'
                       OR UPPER(t.DocDesc) LIKE '%KONTAN%'
                       OR UPPER(t.DocDesc) LIKE '%THR%'
                       OR UPPER(t.DocDesc) LIKE '%PINJAM%'
                       OR UPPER(t.DocDesc) LIKE '%ALAT%') 
                ORDER BY t.DocDesc
            """,
            'params': condition_params + [start_date, end_date]
        }

    def _get_potongan_query(self, gang_code: str, start_date: str, end_date: str, division_code: str = None) -> Dict[str, Any]:
        """Get potongan data - Uses ARC table structure (JOIN to PR_ADTRANSLN_ARC)
        
        FIX: Uses IN subquery instead of JOIN to prevent double counting.
        NOTE: This query is for ARC mode. BASE mode uses _get_potongan_query_base instead.
        """
        condition_sql, condition_params = self._get_gang_condition_sql(gang_code, division_code)
        gang_subquery_condition = condition_sql.replace('g.GangCode', 'gsub.GangCode')
        
        return {
            'sql': f"""
                SELECT
                    t.EmpCode,
                    t.DocDesc,
                    SUM(COALESCE(ln.Amount,0)) as TotalAmount
                FROM PR_ADTRANS_ARC AS t
                JOIN PR_ADTRANSLN_ARC AS ln ON t.ID = ln.MasterID
                WHERE t.EmpCode IN (
                    SELECT DISTINCT gsub.GangMember 
                    FROM HR_GANGLN AS gsub 
                    WHERE {gang_subquery_condition}
                )
                    AND t.DocDate >= ?
                    AND t.DocDate < ?
                    AND (UPPER(t.DocDesc) LIKE '%POT%'
                         OR UPPER(t.DocDesc) LIKE '%PPH%'
                         OR UPPER(t.DocDesc) LIKE '%BPJS%'
                         OR UPPER(t.DocDesc) LIKE '%PINJAM%'
                         OR UPPER(t.DocDesc) LIKE '%KL%'
                         OR UPPER(t.DocDesc) LIKE '%SPSI%'
                         OR UPPER(t.DocDesc) LIKE '%KOREKSI%'
                         OR UPPER(t.DocDesc) LIKE '%TOTAL%'
                         OR UPPER(t.DocDesc) LIKE '%TIKET%'
                         OR UPPER(t.DocDesc) LIKE '%KONTAN%'
                         OR UPPER(t.DocDesc) LIKE '%ALAT%'
                         OR UPPER(t.DocDesc) LIKE '%THR%')
                GROUP BY t.EmpCode, t.DocDesc
            """,
            'params': condition_params + [start_date, end_date]
        }

    def _get_potongan_query_base(self, gang_code: str, start_date: str, end_date: str, division_code: str = None) -> Dict[str, Any]:
        """Get potongan data for BASE mode - Uses PR_ADTRANS with JOIN to PR_ADTRANSLN
        
        NOTE: Both ARC and BASE use the same structure with line table for Amount.
        The only difference is the table names (PR_ADTRANS vs PR_ADTRANS_ARC).
        """
        condition_sql, condition_params = self._get_gang_condition_sql(gang_code, division_code)
        gang_subquery_condition = condition_sql.replace('g.GangCode', 'gsub.GangCode')
        
        return {
            'sql': f"""
                SELECT
                    t.EmpCode,
                    t.DocDesc,
                    SUM(COALESCE(ln.Amount, 0)) as TotalAmount
                FROM PR_ADTRANS AS t
                JOIN PR_ADTRANSLN AS ln ON t.ID = ln.MasterID
                WHERE t.EmpCode IN (
                    SELECT DISTINCT gsub.GangMember 
                    FROM HR_GANGLN AS gsub 
                    WHERE {gang_subquery_condition}
                )
                    AND t.DocDate >= ?
                    AND t.DocDate < ?
                    AND (UPPER(t.DocDesc) LIKE '%POT%'
                         OR UPPER(t.DocDesc) LIKE '%PPH%'
                         OR UPPER(t.DocDesc) LIKE '%BPJS%'
                         OR UPPER(t.DocDesc) LIKE '%PINJAM%'
                         OR UPPER(t.DocDesc) LIKE '%KL%'
                         OR UPPER(t.DocDesc) LIKE '%SPSI%'
                         OR UPPER(t.DocDesc) LIKE '%KOREKSI%'
                         OR UPPER(t.DocDesc) LIKE '%TOTAL%'
                         OR UPPER(t.DocDesc) LIKE '%TIKET%'
                         OR UPPER(t.DocDesc) LIKE '%KONTAN%'
                         OR UPPER(t.DocDesc) LIKE '%ALAT%'
                         OR UPPER(t.DocDesc) LIKE '%THR%')
                GROUP BY t.EmpCode, t.DocDesc
            """,
            'params': condition_params + [start_date, end_date]
        }

    def _get_cuti_query(self, gang_code: str, start_date: str, end_date: str, division_code: str = None) -> Dict[str, Any]:
        """
        Get cuti data from PR_TASKREGLN:
        - cuti_tahunan: TaskCode LIKE 'GA9129%'
        - cuti_sakit: TaskCode LIKE 'GA9126%'  
        - cuti_minggu: Days where TrxDate is Sunday (DATEPART weekday = 1)
        - cuti_nasional: Days that match HR_GPH holiday table
        
        VALIDATION: JOIN to PR_TASKREG_ARC ensures only records with valid master are counted.
        """
        condition_sql, condition_params = self._get_gang_condition_sql(gang_code, division_code)
        
        # Params for task_data CTE: date range (2) + gang filter params
        task_data_params = [start_date, end_date] + condition_params
        # Params for cuti_minggu CTE: date range (2) + gang filter params
        cuti_minggu_params = [start_date, end_date] + condition_params
        # Params for cuti_nasional CTE: date range (2) + gang filter params
        cuti_nasional_params = [start_date, end_date] + condition_params
        # Params for final SELECT: gang filter params
        final_params = condition_params
        
        return {
            'sql': f"""
                WITH task_data AS (
                    SELECT
                        tr.EmpCode,
                        SUM(CASE WHEN tr.TaskCode LIKE 'GA9129%' THEN 1 ELSE 0 END) as cuti_tahunan_hari,
                        SUM(CASE WHEN tr.TaskCode LIKE 'GA9126%' THEN 1 ELSE 0 END) as cuti_sakit_haid_hari
                    FROM PR_TASKREGLN_ARC tr
                    JOIN PR_TASKREG_ARC tm ON tr.MasterID = tm.ID
                    JOIN HR_GANGLN g ON g.GangMember = tr.EmpCode
                    WHERE tr.TrxDate >= ? 
                      AND tr.TrxDate < ?
                      AND tr.OT = 0
                      AND (tr.TaskCode LIKE 'GA9129%' OR tr.TaskCode LIKE 'GA9126%')
                      AND {condition_sql}
                    GROUP BY tr.EmpCode
                ),
                cuti_minggu AS (
                    SELECT
                        tr.EmpCode,
                        COUNT(DISTINCT tr.TrxDate) as cuti_minggu_hari
                    FROM PR_TASKREGLN_ARC tr
                    JOIN PR_TASKREG_ARC tm ON tr.MasterID = tm.ID
                    JOIN HR_GANGLN g ON g.GangMember = tr.EmpCode
                    WHERE tr.TrxDate >= ?
                      AND tr.TrxDate < ?
                      AND tr.OT = 0
                      AND DATEPART(weekday, tr.TrxDate) = 1
                      AND {condition_sql}
                    GROUP BY tr.EmpCode
                ),
                cuti_nasional AS (
                    SELECT
                        tr.EmpCode,
                        COUNT(DISTINCT tr.TrxDate) as cuti_nasional_hari
                    FROM PR_TASKREGLN_ARC tr
                    JOIN PR_TASKREG_ARC tm ON tr.MasterID = tm.ID
                    JOIN HR_GANGLN g ON g.GangMember = tr.EmpCode
                    JOIN HR_GPH h ON h.HolidayDate = tr.TrxDate
                    WHERE tr.TrxDate >= ?
                      AND tr.TrxDate < ?
                      AND tr.OT = 0
                      AND {condition_sql}
                    GROUP BY tr.EmpCode
                )
                SELECT DISTINCT
                    e.EmpCode,
                    COALESCE(td.cuti_tahunan_hari, 0) as cuti_tahunan_hari,
                    COALESCE(td.cuti_sakit_haid_hari, 0) as cuti_sakit_haid_hari,
                    0 as cuti_haid_hari,
                    COALESCE(cm.cuti_minggu_hari, 0) as cuti_minggu_hari,
                    COALESCE(cn.cuti_nasional_hari, 0) as cuti_nasional_hari,
                    0 as cuti_izin_hari
                FROM HR_EMPLOYEE e
                JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                LEFT JOIN task_data td ON td.EmpCode = e.EmpCode
                LEFT JOIN cuti_minggu cm ON cm.EmpCode = e.EmpCode
                LEFT JOIN cuti_nasional cn ON cn.EmpCode = e.EmpCode
                WHERE {condition_sql}
                ORDER BY e.EmpCode
            """,
            'params': task_data_params + cuti_minggu_params + cuti_nasional_params + final_params
        }

    def _get_upah_pokok_query(self, gang_code: str, start_date: str, end_date: str, division_code: str = None) -> Dict[str, Any]:
        """Get upah pokok and upah dasar data from HR_CPTRX.NewRate (latest UpdateDate)"""
        condition_sql, condition_params = self._get_gang_condition_sql(gang_code, division_code)
        return {
            'sql': f"""
                WITH LatestCPTRX AS (
                    SELECT 
                        EmpCode,
                        NewRate,
                        ROW_NUMBER() OVER (PARTITION BY EmpCode ORDER BY UpdateDate DESC) as rn
                    FROM HR_CPTRX
                )
                SELECT DISTINCT
                    e.EmpCode,
                    COALESCE(lc.NewRate, 0) as upah_dasar,
                    COALESCE(lc.NewRate, 0) as upah_harian
                FROM HR_EMPLOYEE e
                LEFT JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                LEFT JOIN LatestCPTRX lc ON lc.EmpCode = e.EmpCode AND lc.rn = 1
                WHERE {condition_sql}
            """,
            'params': condition_params
        }

    

    def _get_individual_jabatan_query(self, gang_code: str, start_date: str, end_date: str, month: int, year: int, division_code: str = None) -> Dict[str, Any]:
        """Get TUNJANGAN JABATAN aggregated amounts per employee
        
        FIX: Uses IN subquery instead of JOIN to prevent double counting.
        """
        condition_sql, condition_params = self._get_gang_condition_sql(gang_code, division_code)
        gang_subquery_condition = condition_sql.replace('g.GangCode', 'gsub.GangCode')
        
        return {
            'sql': f"""
                SELECT DISTINCT
                    t.EmpCode,
                    SUM(COALESCE(ln.Amount,0)) AS jabatan_jumlah
                FROM PR_ADTRANS_ARC AS t
                JOIN PR_ADTRANSLN_ARC AS ln ON t.ID = ln.MasterID
                WHERE t.EmpCode IN (
                    SELECT DISTINCT gsub.GangMember 
                    FROM HR_GANGLN AS gsub 
                    WHERE {gang_subquery_condition}
                )
                  AND t.DocDate >= ?
                  AND t.DocDate < ?
                  AND UPPER(t.DocDesc) = 'TUNJANGAN JABATAN'
                GROUP BY t.EmpCode
            """,
            'params': condition_params + [start_date, end_date]
        }

    def _get_masa_kerja_data_query(self, gang_code: str, division_code: str = None) -> Dict[str, Any]:
        """Get AppJoinGrpDate per employee from HR_EMPLOYMENT for masa_kerja_tahun calculation"""
        condition_sql, condition_params = self._get_gang_condition_sql(gang_code, division_code)
        return {
            'sql': f"""
                SELECT DISTINCT
                    e.EmpCode,
                    em.AppJoinGrpDate
                FROM HR_EMPLOYEE e
                LEFT JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                LEFT JOIN HR_EMPLOYMENT em ON em.EmpCode = e.EmpCode
                WHERE {condition_sql}
            """,
            'params': condition_params
        }

    def _get_individual_masa_kerja_amount_query(self, gang_code: str, start_date: str, end_date: str, month: int, year: int, division_code: str = None) -> Dict[str, Any]:
        """Get TUNJANGAN MASA KERJA aggregated amounts per employee
        
        FIX: Uses IN subquery instead of JOIN to prevent double counting.
        """
        condition_sql, condition_params = self._get_gang_condition_sql(gang_code, division_code)
        gang_subquery_condition = condition_sql.replace('g.GangCode', 'gsub.GangCode')
        
        return {
            'sql': f"""
                SELECT DISTINCT
                    t.EmpCode,
                    SUM(COALESCE(ln.Amount,0)) AS masa_kerja_jumlah
                FROM PR_ADTRANS_ARC AS t
                JOIN PR_ADTRANSLN_ARC AS ln ON t.ID = ln.MasterID
                WHERE t.EmpCode IN (
                    SELECT DISTINCT gsub.GangMember 
                    FROM HR_GANGLN AS gsub 
                    WHERE {gang_subquery_condition}
                )
                  AND t.DocDate >= ?
                  AND t.DocDate < ?
                  AND UPPER(t.DocDesc) = 'TUNJANGAN MASA KERJA'
                GROUP BY t.EmpCode
            """,
            'params': condition_params + [start_date, end_date]
        }

    def _get_lembur_data_query(self, gang_code: str, start_date: str, end_date: str, division_code: str = None) -> Dict[str, Any]:
        """Get lembur hours and amounts from PR_TASKREG_ARC/PR_TASKREGLN_ARC
        
        FIX: Uses IN subquery instead of JOIN to prevent double counting.
        """
        condition_sql, condition_params = self._get_gang_condition_sql(gang_code, division_code)
        gang_subquery_condition = condition_sql.replace('g.GangCode', 'gsub.GangCode')
        
        return {
            'sql': f"""
                SELECT DISTINCT
                    trl.EmpCode,
                    SUM(COALESCE(trl.Hours,0)) as TotalHours,
                    SUM(COALESCE(trl.Amount,0)) as TotalAmount
                FROM PR_TASKREG_ARC tr
                JOIN PR_TASKREGLN_ARC trl ON tr.id = trl.masterId
                WHERE trl.EmpCode IN (
                    SELECT DISTINCT gsub.GangMember 
                    FROM HR_GANGLN AS gsub 
                    WHERE {gang_subquery_condition}
                )
                  AND tr.DocDate >= ?
                  AND tr.DocDate < ?
                  AND trl.OT = 1
                GROUP BY trl.EmpCode
            """,
            'params': condition_params + [start_date, end_date]
        }

    def _get_individual_beras_rate_query(self, gang_code: str, start_date: str, end_date: str, division_code: str = None) -> Dict[str, Any]:
        """Get beras rate from HR_PAYROLL using RiceRation field"""
        condition_sql, condition_params = self._get_gang_condition_sql(gang_code, division_code)
        return {
            'sql': f"""
                SELECT DISTINCT
                    e.EmpCode,
                    COALESCE(p.RiceRation, 0) as beras_rate
                FROM HR_EMPLOYEE e
                LEFT JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                LEFT JOIN HR_PAYROLL p ON p.EmpCode = e.EmpCode
                WHERE {condition_sql}
            """,
            'params': condition_params
        }

    def _process_parallel_results(self, results: Dict[str, List[Tuple]], gang_code: str, month: int, year: int, arc_fallback_used: Dict[str, bool] = None) -> Dict[str, Any]:
        """Process and merge results from parallel queries
        
        Args:
            arc_fallback_used: Dict tracking which queries used fallback to non-ARC tables.
                              When lembur_data uses fallback, formula-based amounts are used.
        """
        arc_fallback_used = arc_fallback_used or {}
        
        # DEBUG: Check what employee_data we received
        employee_data_raw = results.get('employee_data', [])
        logger.info(f"[DEBUG EMPLOYEE] employee_data received: {len(employee_data_raw)} rows")

        # Build dynamic header map
        raw_headers = [str(row[0]).strip() for row in (results.get('premi_headers') or []) if row and row[0]]
        logger.info(f"[PREMI DEBUG] raw_headers from query: {raw_headers}")
                
        # Filter to only include items starting with 'PREMI' (per user requirement)
        valid_headers = [header for header in raw_headers if header.upper().startswith('PREMI')]
        logger.info(f"[PREMI DEBUG] valid_headers after PREMI filter: {valid_headers}")

        # Build dynamic POTONGAN map using pre-fetched headers to ensure consistency with HeaderService
        raw_pot_headers = [str(row[0]).strip() for row in (results.get('potongan_headers') or []) if row and row[0]]
        dynamic_pot_global_map = {}
        
        # Deduplicate while preserving order
        seen_pot = set()
        unique_pot_headers = []
        
        # HeaderService logic: iterate through query results and apply filtering and mapping
        # Note: query already filters some, but HeaderService applies additional Python filtering
        # UPDATED: KOREKSI should be INCLUDED (for POTONGAN UPAH KOTOR display)
        # FIX: PPH and SPSI must ALWAYS be excluded as they are static columns (prevents double counting)
        excluded_pot_keywords = ['BERAS', 'PPH', 'SPSI', 'TUNJANGAN JABATAN', 'TUNJANGAN MASA KERJA', 'BPJS', 'ASTEK', 'SEHAT']
        
        for h in raw_pot_headers:
            header_upper = h.upper()
            should_exclude = False
            
            # ALWAYS check excluded keywords first (even for POTONGAN/KOREKSI prefixed items)
            # This prevents double counting of SPSI and PPH21 which have their own static columns
            for keyword in excluded_pot_keywords:
                if keyword in header_upper:
                    should_exclude = True
                    break
            
            # Only include items that match known deduction patterns
            if not should_exclude:
                is_valid_pattern = (
                    header_upper.startswith('POTONGAN') or 
                    header_upper.startswith('KOREKSI') or 
                    header_upper.startswith('POT') or
                    'TIKET' in header_upper or
                    'KONTAN' in header_upper or
                    'THR' in header_upper or
                    'PINJAM' in header_upper or
                    'ALAT' in header_upper or
                    'KL' in header_upper or
                    'PREMI' in header_upper  # Include POTONGAN PREMI
                )
                if not is_valid_pattern:
                    # Items that don't match known patterns should be skipped
                    should_exclude = True
            
            if not should_exclude:
                if h not in seen_pot:
                    unique_pot_headers.append(h)
                    seen_pot.add(h)

        # Map to fields using HeaderService logic
        # This ensures that pot_dynamic_X indices align perfectly with what HeaderService generates
        for idx, header_text in enumerate(unique_pot_headers):
            header_upper = header_text.upper()
            
            # Check if this header maps to a known field
            mapped_field = self._map_potongan_field(header_text)
            
            if mapped_field:
                # If mapped, use the mapped field name
                dynamic_pot_global_map[header_upper] = mapped_field
            else:
                # If not mapped, use pot_dynamic_X
                # Note: HeaderService uses index+1 based on the loop index
                dynamic_pot_global_map[header_upper] = f"pot_dynamic_{idx+1}"

        # Build employee base data with ALL required fields for PayrollRow
        employee_data = {}
        for i, emp_row in enumerate(results.get('employee_data') or []):
            try:
                # Ensure we have exactly 7 items
                if len(emp_row) != 7:
                    logger.warning(f"Skipping invalid employee row at index {i}: {emp_row}")
                    continue
                    
                nik, nama, jenis_kelamin, tanggal_join, departemen, jabatan, gang = emp_row
                # Strip whitespace from NIK to ensure matching
                nik = str(nik or '').strip()

                # Fix gender mapping: 1=L (Laki-laki), 2=P (Perempuan)
                if str(jenis_kelamin) == '1':
                    gender_mapped = 'L'
                elif str(jenis_kelamin) == '2':
                    gender_mapped = 'P'
                else:
                    # Default to 'L' for any other value
                    gender_mapped = 'L' if str(jenis_kelamin or '').upper() != 'P' else 'P'

                employee_data[nik] = {
                    'nik': nik,
                    'nama': str(nama or ''),
                    'jenis_kelamin': gender_mapped,
                    'phone': '-',  # Default phone
                    'tanggal_join': str(tanggal_join or ''),
                    'departemen': str(departemen or ''),
                    'jabatan': str(jabatan or ''),
                    'gang_code': str(gang or gang_code).strip(),
                    'no': 0,  # Will be set later
                    'upah_dasar': 0.0,
                    'hari_kerja': 0,
                    'upah_pokok': 0.0,
                    'jumlah_hk': 0,
                    'gaji_pokok': 0.0,
                    'cuti_tahunan_hari': 0,
                    'cuti_sakit_haid_hari': 0,
                    'cuti_haid_hari': 0,
                    'cuti_minggu_hari': 0,
                    'cuti_nasional_hari': 0,
                    'cuti_izin_hari': 0,
                    'total_ketidakhadiran': 0,
                    'beras_rate': 0.0,
                    'beras_jumlah': 0.0,
                    'jabatan_rate': 0.0,
                    'jabatan_jumlah': 0.0,
                    'masa_kerja_tahun': 0,
                    'masa_kerja_jumlah': 0.0,
                    'masa_kerja_amount': 0.0,
                    'lembur_jam': 0,
                    'lembur_jumlah': 0.0,
                    'total_tunjangan': 0.0,
                    'premi': {
                        'brondol': 0.0,
                        'koreksi': 0.0,
                        # Dynamic premi items will be added here
                    },
                    'total_premi': 0.0,
                    'premi_koreksi': 0.0,  # Flat field for backward compatibility
                    'jumlah_upah_kotor': 0.0,
                    'pot_pph21': 0.0,
                    'pot_kontan': 0.0,
                    'pot_thr': 0.0,
                    'pot_pinjam': 0.0,
                    'pot_tiket': 0.0,
                    'pot_alat': 0.0,
                    'pot_kl': 0.0,
                    'pot_bpjs_kes': 0.0,
                    'pot_bpjs_pek': 0.0,
                    'pot_bpjs_maj': 0.0,
                    # DB BPJS fields for storing DocDesc BPJS values (to be ADDED to formula)
                    'db_bpjs_kes': 0.0,  # BPJS Kesehatan from DocDesc - will be added to formula
                    'db_bpjs_pensiun': 0.0,  # BPJS Pensiun from DocDesc - will be added to formula
                    # Additional BPJS fields required by PayrollRow
                    'pot_bpjs_kesehatan_pekerja': 0.0,
                    'pot_bpjs_kesehatan_majikan': 0.0,
                    'pot_bpjs_pensiun_pekerja': 0.0,
                    'pot_bpjs_pensiun_majikan': 0.0,
                    'pot_bpjs_jumlah': 0.0,
                    'pot_bpjs_pekerja_total': 0.0,
                    'pot_bpjs_kesehatan_total': 0.0,
                    'pot_bpjs_pensiun_total': 0.0,
                    'pot_total_1': 0.0,
                    'pot_total_2': 0.0,
                    'pot_total_3': 0.0,
                    'pot_total_4': 0.0,
                    'total_potongan': 0.0,
                    'pot_spsi': 0.0,
                    'premi_koreksi': 0.0,
                    'pot_koreksi': 0.0,
                    # Nested structure for potongan breakdown
                    'potongan_upah_kotor': {
                        'koreksi': 0.0,
                        'dynamic': {},
                        'total': 0.0
                    },
                    'potongan_upah_bersih': {
                        'spsi': 0.0,
                        'pph21': 0.0,
                        'dynamic': {},  # All non-SPSI/PPH21 deductions go here
                        'total': 0.0
                    },
                    'upah_bersih': 0.0  # Ensure float type for Pydantic model
                }
            except Exception as e:
                logger.error(f"Error processing employee row {i}: {e}. Row data: {emp_row}")
                continue

        # DEBUG: How many employees were processed
        logger.info(f"[DEBUG EMPLOYEE] employee_data dict size after loop: {len(employee_data)}")

        # Merge upah pokok data
        for upah_row in (results.get('upah_pokok_data') or []):
            emp_code, upah_dasar, upah_harian = upah_row
            emp_code = str(emp_code).strip()
            if emp_code in employee_data:
                employee_data[emp_code].update({
                    'upah_dasar': upah_dasar or 0,
                    'gaji_pokok': upah_dasar or 0,  # Use upah_dasar as gaji_pokok
                    'upah_pokok': upah_harian or 0
                })

        # Merge beras rate data
        for beras_row in (results.get('beras_rate_data') or []):
            emp_code, beras_rate = beras_row 
            emp_code = str(emp_code).strip()
            if emp_code in employee_data:
                employee_data[emp_code].update({
                    'beras_rate': float(beras_rate or 0)
                })

        # Jabatan data (jumlah) is now merged in tunjangan_data to avoid duplication

        # Merge masa kerja data (calculate years)
        from datetime import datetime
        current_date = datetime.now()
        
        for mk_row in (results.get('masa_kerja_data') or []):
            emp_code, join_date_str = mk_row
            emp_code = str(emp_code).strip()
            if emp_code in employee_data and join_date_str:
                try:
                    # Parse join date (format might vary, assuming YYYY-MM-DD or similar)
                    # If it's already a datetime object from driver, use it directly
                    if isinstance(join_date_str, str):
                        # Try common formats
                        try:
                            join_date = datetime.strptime(join_date_str, '%Y-%m-%d')
                        except ValueError:
                            try:
                                join_date = datetime.strptime(join_date_str, '%Y-%m-%d %H:%M:%S')
                            except ValueError:
                                join_date = None
                    else:
                        join_date = join_date_str
                        
                    if join_date:
                        # Calculate years difference
                        years = current_date.year - join_date.year
                        # Adjust if anniversary hasn't passed yet this year
                        if (current_date.month, current_date.day) < (join_date.month, join_date.day):
                            years -= 1
                        
                        employee_data[emp_code]['masa_kerja_tahun'] = max(0, years)
                except Exception as e:
                    print(f"Error calculating masa kerja for {emp_code}: {e}")
                    employee_data[emp_code]['masa_kerja_tahun'] = 0

        # Masa kerja amount data is now merged in tunjangan_data to avoid duplication

        # Set HK for all employees from actual attendance data
        # Based on reference code: hk_count = COUNT(*) WHERE IsPresent = 'true'
        for att_row in (results.get('attendance_data') or []):
            emp_code, hk_count, total_amount_rp = att_row
            emp_code = str(emp_code).strip()
            if emp_code in employee_data:
                employee_data[emp_code].update({
                    'jumlah_hk': hk_count or 0,  # This is the actual HK count (days present)
                    'total_amount_rp': float(total_amount_rp or 0), # Store real amount from DB
                    # 'hari_kerja' will be calculated later after cuti data is merged
                })

        # NOTE: Previously we removed employees with 0 HK, but this caused new employees
        # (who haven't worked yet or whose attendance data isn't archived) to be excluded.
        # UPDATE 2026-01: User explicitly requested that employees with HK=0 should NOT be counted
        # or displayed in reports. Re-enabling the filter per user requirement.
        # "jika ditemukan saat agregasi total HK nya dari tiap karyawn itu nol, maka tidak usah dithiung"
        keys_to_remove = []
        for emp_code, data in employee_data.items():
            if int(data.get('jumlah_hk', 0) or 0) == 0:
                keys_to_remove.append(emp_code)
        for k in keys_to_remove:
            del employee_data[k]
        
        if keys_to_remove:
            logger.info(f"[HK FILTER] Removed {len(keys_to_remove)} employees with HK=0 from gang {gang_code}")

        # Merge cuti data
        for cuti_row in (results.get('cuti_data') or []):
            emp_code, tahunan, sakit_haid, haid, minggu, nasional, izin = cuti_row
            emp_code = str(emp_code).strip()
            if emp_code in employee_data:
                employee_data[emp_code].update({
                    'cuti_tahunan_hari': tahunan or 0,
                    'cuti_sakit_haid_hari': sakit_haid or 0,
                    'cuti_haid_hari': haid or 0,
                    'cuti_minggu_hari': minggu or 0,
                    'cuti_nasional_hari': nasional or 0,
                    'cuti_izin_hari': izin or 0
                })


        # Calculate hari kerja (HK - Total Cuti) for all employees
        # Based on reference code: hari_kerja = hk_count - (cuti_tahunan + cuti_sakit + hk_minggu + hk_nasional)
        for emp_code, emp_data in employee_data.items():
            hk_count = emp_data.get('jumlah_hk', 0)
            total_cuti = (
                (emp_data.get('cuti_tahunan_hari') or 0) +
                (emp_data.get('cuti_sakit_haid_hari') or 0) +
                (emp_data.get('cuti_minggu_hari') or 0) +
                (emp_data.get('cuti_nasional_hari') or 0)
            )
            calculated_hari_kerja = max(0, hk_count - total_cuti)

            # Override hari_kerja with calculated value to ensure accuracy
            # This ensures hari_kerja and jumlah_hk are never the same value
            emp_data['hari_kerja'] = calculated_hari_kerja

        # Calculate total ketidakhadiran for all employees
        for emp_code, emp_data in employee_data.items():
            total_ketidakhadiran = (
                (emp_data.get('cuti_tahunan_hari') or 0) +
                (emp_data.get('cuti_sakit_haid_hari') or 0) +
                (emp_data.get('cuti_minggu_hari') or 0) +
                (emp_data.get('cuti_nasional_hari') or 0) +
                (emp_data.get('cuti_izin_hari') or 0)
            )
            emp_data['total_ketidakhadiran'] = total_ketidakhadiran

        # Merge brondol amounts from PR_LOOSEFRUIT_ARC
        for brondol_row in results.get('brondol_data', []):
            emp_code, amount = brondol_row
            emp_code = str(emp_code).strip()
            if emp_code in employee_data:
                val = float(amount or 0)
                # Only store in nested premi dict - NO flat field to prevent double counting
                employee_data[emp_code]['premi']['brondol'] = val

        # Merge premi amounts (dynamic only)
        for premi_row in results.get('premi_amounts', []):
            emp_code, doc_desc, amount = premi_row
            emp_code = str(emp_code).strip()
            if emp_code in employee_data and doc_desc:
                doc_desc_clean = str(doc_desc).strip()
                doc_desc_upper = doc_desc_clean.upper()
                
                # Explicitly handle PREMI KOREKSI
                # User requested: "pastikan bahwa koreksi juga bisa dimunculkan nilainya"
                if 'KOREKSI' in doc_desc_upper:
                     val = float(amount or 0)
                     # Store in nested premi dict (will be excluded from total_premi calculation later)
                     current_koreksi = employee_data[emp_code]['premi'].get('koreksi', 0.0)
                     employee_data[emp_code]['premi']['koreksi'] = current_koreksi + val
                     continue

                # Handle PREMI BRONDOL from PR_ADTRANS - ADD to existing static brondol value
                # This prevents creating a new dynamic header for brondol
                # Amount from PR_ADTRANS is ADDED to value from PR_LOOSEFRUIT
                if 'BRONDOL' in doc_desc_upper:
                    val = float(amount or 0)
                    # Add to existing brondol value (from PR_LOOSEFRUIT)
                    current_brondol = employee_data[emp_code]['premi'].get('brondol', 0.0)
                    employee_data[emp_code]['premi']['brondol'] = current_brondol + val
                    continue

                # Check validity BEFORE processing other premiums
                # This filters out Tunjangan, Potongan, etc. that shouldn't be in premi dict
                if not self._is_valid_dynamic_premi(doc_desc_clean):
                    continue

                                
                # 2. Handle premi nested dict mapping ONLY - no flat field to prevent double counting
                normalized_name = self._normalize_premi_field_name(doc_desc_clean)
                if normalized_name:
                    amount_val = float(amount or 0)
                    
                    # Update nested dict ONLY - single source of truth
                    nested_key = normalized_name.replace('premi_', '') if normalized_name.startswith('premi_') else normalized_name
                    current_val = employee_data[emp_code]['premi'].get(nested_key, 0.0)
                    employee_data[emp_code]['premi'][nested_key] = current_val + amount_val

        # Merge tunjangan data
        tunj_rows = results.get('tunjangan_data', [])
        # logger.info(f"Processing {len(tunj_rows)} tunjangan rows. Employee count: {len(employee_data)}")
        
        for tunj_row in tunj_rows:
            emp_code, doc_desc, amount = tunj_row
            emp_code = str(emp_code).strip()
            if emp_code in employee_data and doc_desc:
                doc_desc_upper = doc_desc.upper()
                val = float(amount or 0)
                # BERAS tidak lagi diambil dari tunjangan_data - selalu dihitung dari formula: rate × jumlah_hk
                if 'JABAT' in doc_desc_upper:
                    employee_data[emp_code]['jabatan_jumlah'] = (employee_data[emp_code].get('jabatan_jumlah', 0.0) or 0.0) + val
                elif 'MASA' in doc_desc_upper:
                    employee_data[emp_code]['masa_kerja_jumlah'] = (employee_data[emp_code].get('masa_kerja_jumlah', 0.0) or 0.0) + val
                    employee_data[emp_code]['masa_kerja_amount'] = employee_data[emp_code]['masa_kerja_jumlah']
                # LEMBUR tidak diambil dari tunjangan_data - hanya dari lembur_data (PR_TASKREGLN)
                # untuk menghindari double counting. Skip processing LEMBUR di sini.
                # elif 'LEMBUR' in doc_desc_upper:
                #     employee_data[emp_code]['lembur_jumlah'] = ...
            # else:
            #      if doc_desc and ('JABATAN' in doc_desc.upper() or 'MASA KERJA' in doc_desc.upper() or 'LEMBUR' in doc_desc.upper()):
            #          logger.warning(f"Skipping tunjangan {doc_desc} for {emp_code}: In employee_data? {emp_code in employee_data}")

        # For BASE tables (current month), DB lembur amounts are incorrect - need formula calculation
        # For ARC tables (past month), DB amounts are correct - use directly
        use_formula_calculation = arc_fallback_used.get('lembur_data', False)  # True = using BASE tables
        lembur_formula_amounts = {}
        
        if use_formula_calculation:
            try:
                import sys
                import os
                import time as time_module
                lembur_engine_path = os.path.join(os.path.dirname(__file__), '..', '..', 'engine')
                if lembur_engine_path not in sys.path:
                    sys.path.insert(0, lembur_engine_path)

                from lembur_engine.lembur_calculator import LemburCalculator
                
                emp_codes = list(employee_data.keys())
                logger.info(f"🔄 BASE tables mode: Calculating formula-based lembur for {len(emp_codes)} employees (BATCH)")
                
                # BATCH PROCESSING: Single query for ALL employees + in-memory calculation
                batch_start = time_module.perf_counter()
                calc = LemburCalculator()
                lembur_formula_amounts = calc.calculate_batch_amounts(emp_codes, month, year)
                calc.close()
                batch_time = (time_module.perf_counter() - batch_start) * 1000
                
                formula_count = sum(1 for v in lembur_formula_amounts.values() if v > 0)
                logger.info(f"✅ Formula lembur calculated for {formula_count}/{len(emp_codes)} employees in {batch_time:.2f}ms (BATCH)")
                
            except Exception as e:
                logger.error(f"Failed to calculate batch lembur: {e}")
                import traceback
                logger.error(traceback.format_exc())

        # Merge lembur data (hours and amount from taskreg)
        for lembur_row in results.get('lembur_data', []):
            emp_code, hours, amount = lembur_row
            emp_code = str(emp_code).strip()
            if emp_code in employee_data:
                employee_data[emp_code]['lembur_jam'] = float(hours or 0)
                
                # Use formula amount if using BASE tables, otherwise use DB amount
                if use_formula_calculation and emp_code in lembur_formula_amounts:
                    amount_to_use = lembur_formula_amounts[emp_code]
                else:
                    amount_to_use = float(amount or 0)
                
                # Set lembur_jumlah langsung dari lembur_data saja (tidak ditambahkan dari tunjangan)
                # Ini menghindari double counting antara PR_ADTRANS dan PR_TASKREGLN
                employee_data[emp_code]['lembur_jumlah'] = amount_to_use

        # After HK and rates are known, compute derived allowance amounts
        for emp_code, emp_data in employee_data.items():
            hk = int(emp_data.get('jumlah_hk', 0) or 0)
            hrk = int(emp_data.get('hari_kerja', 0) or 0)
            br_rate = float(emp_data.get('beras_rate', 0) or 0)
            # SELALU hitung beras_jumlah dari formula: rate × jumlah_hk (tidak lagi fallback)
            emp_data['beras_jumlah'] = float(br_rate * hk) if br_rate > 0 and hk > 0 else 0.0
            jab_jml = float(emp_data.get('jabatan_jumlah', 0) or 0)
            if hrk > 0 and jab_jml > 0:
                emp_data['jabatan_rate'] = float(jab_jml / hrk)

        # Merge potongan data
        for pot_row in results.get('potongan_data', []):
            emp_code, doc_desc, amount = pot_row
            emp_code = str(emp_code).strip()
            if emp_code in employee_data and doc_desc:

                doc_desc_upper = doc_desc.upper()
                if 'PPH' in doc_desc_upper:
                    employee_data[emp_code]['pot_pph21'] = float(amount or 0)
                elif 'KONTAN' in doc_desc_upper:
                    employee_data[emp_code]['pot_kontan'] = float(amount or 0)
                elif 'THR' in doc_desc_upper:
                    employee_data[emp_code]['pot_thr'] = float(amount or 0)
                elif 'PINJAM' in doc_desc_upper:
                    employee_data[emp_code]['pot_pinjam'] = float(amount or 0)
                elif 'POTONGAN TIKET' in doc_desc_upper:
                    employee_data[emp_code]['pot_tiket'] = float(amount or 0)
                elif 'ALAT' in doc_desc_upper:
                    employee_data[emp_code]['pot_alat'] = float(amount or 0)
                elif 'BPJS KES' in doc_desc_upper or 'KESEHATAN' in doc_desc_upper:
                    employee_data[emp_code]['pot_bpjs_kes'] = float(amount or 0)
                elif 'BPJS PEK' in doc_desc_upper or 'KESEHATAN PEKERJA' in doc_desc_upper:
                    employee_data[emp_code]['pot_bpjs_pek'] = float(amount or 0)
                elif 'BPJS MAJ' in doc_desc_upper or 'KESEHATAN MAJIKAN' in doc_desc_upper:
                    employee_data[emp_code]['pot_bpjs_maj'] = float(amount or 0)
                elif 'SPSI' in doc_desc_upper:
                    employee_data[emp_code]['pot_spsi'] = float(amount or 0)
                elif 'KOREKSI' in doc_desc_upper:
                    val = float(amount or 0)
                    employee_data[emp_code]['pot_koreksi'] = val
                    # Also map to total fields for compatibility
                    employee_data[emp_code]['pot_total_1'] = val
                elif 'TOTAL' in doc_desc_upper:
                    # Map various TOTAL fields to total_* fields
                    val = float(amount or 0)
                    if '1' in doc_desc:
                        employee_data[emp_code]['pot_total_1'] = val
                    elif '2' in doc_desc:
                        employee_data[emp_code]['pot_total_2'] = val
                    elif '3' in doc_desc:
                        employee_data[emp_code]['pot_total_3'] = val
                    elif '4' in doc_desc:
                        employee_data[emp_code]['pot_total_4'] = val
                    else:
                        # Default to pot_total_1 for unspecified TOTAL
                        current_val = employee_data[emp_code].get('pot_total_1', 0.0)
                        employee_data[emp_code]['pot_total_1'] = current_val + val

        # Calculate derived values using correct formulas from reference code
        final_data = []
        
        # Constants for BPJS calculation (from config)
        GAJI_POKOK_MIN = self.config.get('constants', {}).get('potongan_bpjs', {}).get('gaji_pokok_min', 3876600.0)

        # Map to track dynamic deductions across all employees to ensure consistent column mapping
        # dynamic_pot_global_map is now pre-calculated above
        # dynamic_pot_counter = 1  # Not needed anymore
        
        
        # First pass: Process Potongan to identify dynamic items and populate employee data
        koreksi_count = 0  # DEBUG counter
        for pot_row in results.get('potongan_data', []):
            emp_code, doc_desc, amount = pot_row
            emp_code = str(emp_code).strip()
            if emp_code in employee_data and doc_desc:
                doc_desc_upper = doc_desc.upper()
                amount = float(amount or 0)

                # CRITICAL FIX: Handle KOREKSI FIRST, before any other processing
                # This ensures pot_koreksi is ALWAYS set for KOREKSI items
                # regardless of whether they exist in dynamic_pot_global_map
                if doc_desc_upper.startswith('KOREKSI') or 'KOREKSI' in doc_desc_upper:
                    koreksi_count += 1
                    logger.info(f"[KOREKSI DEBUG] Found KOREKSI item for {emp_code}: DocDesc='{doc_desc}', Amount={amount}")
                    # Set pot_koreksi and nested structure
                    employee_data[emp_code]['pot_koreksi'] = amount
                    employee_data[emp_code]['potongan_upah_kotor']['koreksi'] = amount
                    employee_data[emp_code]['pot_total_1'] = amount  # Legacy map
                    # Skip the rest of processing for KOREKSI items
                    continue

                # For non-KOREKSI items: attempt to map to dynamic_pot_X fields
                # This ensures headers that appear in the UI get their corresponding values
                if doc_desc_upper in dynamic_pot_global_map:
                    field_name = dynamic_pot_global_map[doc_desc_upper]
                    # Accumulate if multiple entries for the same dynamic field, although typically not expected for pot_dynamic_X
                    current_val = employee_data[emp_code].get(field_name, 0.0) or 0.0
                    employee_data[emp_code][field_name] = current_val + amount

                    # Also fill nested structure for proper breakdown
                    # NOTE: KOREKSI items are handled upfront with continue, so this block
                    # will NOT see KOREKSI items anymore
                    # CRITICAL: Exclude SPSI and PPH from dynamic dict - they are STATIC fields
                    # This prevents double counting since they are also added in the elif chain below
                    is_static_item = 'SPSI' in doc_desc_upper or 'PPH' in doc_desc_upper
                    if not is_static_item:
                        # All other potongan (THR, kontan, etc) go to potongan upah bersih
                        employee_data[emp_code]['potongan_upah_bersih']['dynamic'][doc_desc_upper] = amount
                else:
                    # If this is a potongan item but not in our dynamic map, it might be a new item
                    # Check if it follows potongan pattern and should be included
                    if ('POT' in doc_desc_upper or 'IURAN' in doc_desc_upper or
                        'THR' in doc_desc_upper or 'KONTAN' in doc_desc_upper or
                        'TIKET' in doc_desc_upper or 'ALAT' in doc_desc_upper or
                        'PINJAM' in doc_desc_upper or 'KL' in doc_desc_upper):
                        # NOTE: KOREKSI items are handled upfront with continue, so this block
                        # will NOT see KOREKSI items anymore
                        # CRITICAL: Exclude SPSI and PPH - they are STATIC fields
                        is_static_item = 'SPSI' in doc_desc_upper or 'PPH' in doc_desc_upper
                        if not is_static_item:
                            # Add to dynamic dict - total calculated separately at end
                            employee_data[emp_code]['potongan_upah_bersih']['dynamic'][doc_desc_upper] = amount
                
                # Handle PPH21 and SPSI specifically
                # These are STATIC fields - NOT added to dynamic dict to prevent double counting
                if doc_desc_upper == 'POTONGAN PPH 21' or 'PPH21' in doc_desc_upper or 'PPH 21' in doc_desc_upper:
                    employee_data[emp_code]['pot_pph21'] = amount
                    # PPH21 is a STATIC field in nested structure, NOT dynamic
                    employee_data[emp_code]['potongan_upah_bersih']['pph21'] = amount
                    # NOTE: Do NOT add to total here - will be calculated at the end
                elif doc_desc_upper == 'POTONGAN SPSI' or 'SPSI' in doc_desc_upper:
                    employee_data[emp_code]['pot_spsi'] = amount
                    # SPSI is a STATIC field in nested structure, NOT dynamic
                    employee_data[emp_code]['potongan_upah_bersih']['spsi'] = amount
                    # NOTE: Do NOT add to total here - will be calculated at the end

                # NOTE: PPH case is already handled above in POTONGAN PPH 21 check
                # All other standard deductions - only update top-level fields
                # and add to dynamic dict for display (since statics were removed)
                elif 'KONTAN' in doc_desc_upper:
                    employee_data[emp_code]['pot_kontan'] = amount
                    # Add to dynamic for display
                    employee_data[emp_code]['potongan_upah_bersih']['dynamic'][doc_desc_upper] = amount
                elif 'THR' in doc_desc_upper:
                    employee_data[emp_code]['pot_thr'] = amount
                    employee_data[emp_code]['potongan_upah_bersih']['dynamic'][doc_desc_upper] = amount
                elif 'PINJAM' in doc_desc_upper:
                    employee_data[emp_code]['pot_pinjam'] = amount
                    employee_data[emp_code]['potongan_upah_bersih']['dynamic'][doc_desc_upper] = amount
                elif 'POTONGAN TIKET' in doc_desc_upper or 'TIKET' in doc_desc_upper:
                    employee_data[emp_code]['pot_tiket'] = amount
                    employee_data[emp_code]['potongan_upah_bersih']['dynamic'][doc_desc_upper] = amount
                elif 'ALAT' in doc_desc_upper:
                    employee_data[emp_code]['pot_alat'] = amount
                    employee_data[emp_code]['potongan_upah_bersih']['dynamic'][doc_desc_upper] = amount
                elif 'BPJS' in doc_desc_upper:
                    # BPJS items - capture for ADDITION to calculated values
                    # (BPJS is displayed as static columns, not dynamic)
                    # NEW LOGIC: ALL BPJS DocDesc values are ADDED to KESEHATAN PEKERJA ONLY
                    # User requirement: BPJS from DocDesc only added to Kesehatan, not Pensiun
                    if 'MAJIKAN' in doc_desc_upper or 'MAJ' in doc_desc_upper:
                        pass  # BPJS Majikan - calculated via formula only, skip
                    else:
                        # ALL BPJS Pekerja values (Kesehatan OR Pensiun) go to db_bpjs_kes
                        # Will be added to BPJS Kesehatan Pekerja only
                        current_val = employee_data[emp_code].get('db_bpjs_kes', 0.0)
                        employee_data[emp_code]['db_bpjs_kes'] = current_val + amount
                    # Note: Do NOT add to dynamic dict - BPJS is static column
                elif 'TOTAL' in doc_desc_upper:
                     # Map various TOTAL fields to total_* fields
                    if '1' in doc_desc:
                        employee_data[emp_code]['pot_total_1'] = amount
                    elif '2' in doc_desc:
                        employee_data[emp_code]['pot_total_2'] = amount
                    elif '3' in doc_desc:
                        employee_data[emp_code]['pot_total_3'] = amount
                    elif '4' in doc_desc:
                        employee_data[emp_code]['pot_total_4'] = amount
                    else:
                        employee_data[emp_code]['pot_total_1'] = employee_data[emp_code].get('pot_total_1', 0.0) + amount
                elif 'KL' in doc_desc_upper:
                    employee_data[emp_code]['pot_kl'] = amount
                    employee_data[emp_code]['potongan_upah_bersih']['dynamic'][doc_desc_upper] = amount

        # DEBUG: Log summary of KOREKSI items found
        logger.info(f"[KOREKSI DEBUG] Total KOREKSI items found in potongan_data: {koreksi_count}")

        
        # Calculate days in month for ideal salary
        days_in_month = calendar.monthrange(year, month)[1]

        # Perform Calculations for each employee
        logger.info(f"[DEBUG] Starting calculations loop for {len(employee_data)} employees")
        for emp_code, data in employee_data.items():
            
            # --- 0. Calculate Gaji Pokok & Upah Pokok ---
            # Ensure these are available for subsequent calculations
            hk_count = int(data.get('jumlah_hk', 0) or 0)
            hari_kerja = int(data.get('hari_kerja', 0) or 0)
            payrate = float(data.get('upah_dasar', 0) or 0)
            
            # Use total_amount_rp from DB if available (Gaji Pokok Dibayarkan)
            db_amount = float(data.get('total_amount_rp', 0) or 0)
            
            gaji_pokok_calc = float(hk_count * payrate)
            upah_pokok_calc = float(hari_kerja * payrate)
            
            data['gaji_pokok'] = gaji_pokok_calc
            # Use DB amount if available (preferred), else calculated
            # This matches TypeScript backend behavior
            data['upah_pokok'] = db_amount if db_amount > 0 else upah_pokok_calc

            # NEW: Ideal Salary & Koreksi HK
            gaji_pokok_ideal = payrate * days_in_month
            gaji_pokok_dibayarkan = data['upah_pokok']
            koreksi_hk = gaji_pokok_ideal - gaji_pokok_dibayarkan
            
            data['gaji_pokok_ideal'] = gaji_pokok_ideal
            data['gaji_pokok_dibayarkan'] = gaji_pokok_dibayarkan
            data['koreksi_hk'] = koreksi_hk

            # --- 1. Calculate Total Tunjangan & Total Premi ---
            # Total Tunjangan = Beras + Jabatan + Masa Kerja + Lembur
            beras_jumlah = float(data.get('beras_jumlah', 0.0) or 0.0)
            jabatan_jumlah = float(data.get('jabatan_jumlah', 0.0) or 0.0)
            masa_kerja_amount = float(data.get('masa_kerja_amount', 0.0) or 0.0)
            lembur_jumlah = float(data.get('lembur_jumlah', 0.0) or 0.0)
            
            total_tunjangan = beras_jumlah + jabatan_jumlah + masa_kerja_amount + lembur_jumlah
            data['total_tunjangan'] = total_tunjangan
            
            # Total Premi = Sum of all items in 'premi' dict EXCEPT 'koreksi'
            # Koreksi is handled separately (not part of total_premi)
            premi_dict = data.get('premi', {})
            total_premi = 0.0
            for key, val in premi_dict.items():
                if key != 'koreksi':  # Exclude koreksi from total
                    total_premi += float(val or 0)
            data['total_premi'] = total_premi
            
            # Store premi_koreksi as flat field for backward compatibility with frontend
            data['premi_koreksi'] = float(premi_dict.get('koreksi', 0.0) or 0.0)

            # --- 2. BPJS / ASTEK Calculation Logic ---
            # Implemented based on user requirement:
            # 1. Base = Upah Minimum (upah_dasar × 30 hari) + Masa Kerja Amount
            # 2. ASTEK (Perkeso): Pekerja 2%, Majikan 4.54%
            # 3. BPJS Kesehatan: Pekerja 1%, Majikan 4%
            # 4. BPJS Pensiun: Pekerja 1%, Majikan 2%
            
            masa_kerja_jumlah_val = float(data.get('masa_kerja_jumlah', 0) or 0)
            
            # Base calculation: Upah Dasar × 30 hari + Masa Kerja Amount
            # payrate sudah didefinisikan di atas sebagai upah_dasar
            upah_minimum = payrate * 30  # upah_dasar × 30 hari
            data['upah_minimum'] = upah_minimum  # Store for display if needed
            caruman_base = upah_minimum + masa_kerja_jumlah_val
            
            # Helper for 2 decimal rounding
            def round2(val):
                return round(float(val), 2)
            
            # Caruman ASTEK (Perkeso)
            # Pekerja: (Upah minimum + amount dari masa kerja) × 2%
            # Majikan: (Upah minimum + amount masa kerja) × 0,0454
            caruman_pekerja = round2(caruman_base * 0.02)
            caruman_majikan = round2(caruman_base * 0.0454)
            caruman_jumlah = round2(caruman_pekerja + caruman_majikan)
            
            # Update Astek fields (Prioritize calculated values if not present or 0, OR overwrite if required)
            # Here we overwrite to ensure consistency with the formula
            # Renamed to pot_astek per user request to distinguish from BPJS
            data['pot_astek'] = caruman_pekerja
            data['pot_astek_maj'] = caruman_majikan
            data['pot_astek_jumlah'] = caruman_jumlah
            
            # Legacy/Fallback compatibility (optional, but good for safety if old keys referenced)
            data['pot_bpjs_pek'] = caruman_pekerja
            data['pot_bpjs_maj'] = caruman_majikan
            data['pot_bpjs_jumlah'] = caruman_jumlah
            
            # BPJS Components (Kesehatan & Pensiun)
            # Kesehatan: 1% Pekerja, 4% Majikan
            # Pensiun: 1% Pekerja, 2% Majikan
            
            # CHECK FOR BPJS VALUES FROM DocDesc FOR ADDITION
            # If employee has BPJS values from transaction data (DocDesc contains BPJS),
            # ADD those values to the calculated formula values
            # Note: This ONLY affects BPJS Kesehatan Pekerja (not Pensiun)
            # CARUMAN ASTEK remains formula-based only (already set above)
            
            # Get DocDesc BPJS values (saved during potongan_data processing)
            # ALL BPJS DocDesc values are stored in 'db_bpjs_kes' field only
            db_bpjs_kes = float(data.get('db_bpjs_kes', 0) or 0)  # BPJS from DocDesc - added to Kesehatan only
            
            # Calculate formula-based values first
            calc_bpjs_kesehatan_pekerja = round2(caruman_base * 0.01)
            calc_bpjs_kesehatan_majikan = round2(caruman_base * 0.04)
            calc_bpjs_pensiun_pekerja = round2(caruman_base * 0.01)
            calc_bpjs_pensiun_majikan = round2(caruman_base * 0.02)
            
            # ADD DocDesc values to KESEHATAN PEKERJA ONLY
            # User requirement: BPJS from DocDesc only added to Kesehatan, not Pensiun
            pot_bpjs_kesehatan_pekerja = round2(calc_bpjs_kesehatan_pekerja + db_bpjs_kes)
            pot_bpjs_kesehatan_majikan = calc_bpjs_kesehatan_majikan  # Majikan always formula only
            pot_bpjs_pensiun_pekerja = calc_bpjs_pensiun_pekerja  # Pensiun Pekerja = formula only (no addition)
            pot_bpjs_pensiun_majikan = calc_bpjs_pensiun_majikan  # Majikan always formula only
            
            pot_bpjs_pekerja_total = round2(pot_bpjs_kesehatan_pekerja + pot_bpjs_pensiun_pekerja)
            pot_bpjs_kesehatan_total = round2(pot_bpjs_kesehatan_pekerja + pot_bpjs_kesehatan_majikan)
            pot_bpjs_pensiun_total = round2(pot_bpjs_pensiun_pekerja + pot_bpjs_pensiun_majikan)
            
            # Update BPJS Component fields
            data['pot_bpjs_kesehatan_pekerja'] = pot_bpjs_kesehatan_pekerja
            data['pot_bpjs_kesehatan_majikan'] = pot_bpjs_kesehatan_majikan
            data['pot_bpjs_pensiun_pekerja'] = pot_bpjs_pensiun_pekerja
            data['pot_bpjs_pensiun_majikan'] = pot_bpjs_pensiun_majikan
            data['pot_bpjs_pekerja_total'] = pot_bpjs_pekerja_total
            data['pot_bpjs_kesehatan_total'] = pot_bpjs_kesehatan_total
            data['pot_bpjs_pensiun_total'] = pot_bpjs_pensiun_total
            
            # Also update 'pot_bpjs_kes' for backward compatibility
            data['pot_bpjs_kes'] = pot_bpjs_kesehatan_pekerja

            # --- 3. Calculate Total Potongan Upah Kotor ---
            # FIX: KOREKSI is now stored ONLY in 'koreksi' field (not in dynamic dict)
            # to prevent double counting. Total = koreksi value only.
            pot_koreksi = float(data.get('pot_koreksi', 0.0) or 0.0)
            
            # Total is simply the koreksi value (no dynamic items for potongan upah kotor)
            potongan_upah_kotor_total = pot_koreksi
            
            # Update nested structure with final values
            # Note: dynamic dict is kept empty for potongan_upah_kotor
            data['potongan_upah_kotor']['koreksi'] = pot_koreksi
            data['potongan_upah_kotor']['total'] = potongan_upah_kotor_total
            data['potongan_upah_kotor_total'] = potongan_upah_kotor_total

            # --- 4. Calculate Upah Kotor (Premi) & Jumlah Upah Kotor ---
            # Formula: (Gaji Pokok + Total Tunjangan + Total Premi) - Potongan Upah Kotor Total
            gaji_pokok = float(data.get('gaji_pokok', 0.0) or 0.0)
            
            jumlah_upah_kotor = (gaji_pokok + total_tunjangan + total_premi) - potongan_upah_kotor_total
            data['jumlah_upah_kotor'] = jumlah_upah_kotor
            data['upah_kotor_premi'] = jumlah_upah_kotor

            # --- 5. Calculate Total Potongan Bersih ---
            # Formula: BPJS (pekerja only) + Kesehatan (pekerja only) + Pensiun (pekerja only) + Astek (pekerja only) + PPh21 + SPSI + Other deductions
            pot_spsi = float(data.get('pot_spsi', 0.0) or 0.0)
            pot_pph21 = float(data.get('pot_pph21', 0.0) or 0.0)
            pot_kontan = float(data.get('pot_kontan', 0.0) or 0.0)
            pot_thr = float(data.get('pot_thr', 0.0) or 0.0)
            pot_pinjam = float(data.get('pot_pinjam', 0.0) or 0.0)
            pot_tiket = float(data.get('pot_tiket', 0.0) or 0.0)
            pot_alat = float(data.get('pot_alat', 0.0) or 0.0)
            pot_kl = float(data.get('pot_kl', 0.0) or 0.0)
            
            # IMPORTANT: User Requirement - "Ambil yang pekerja aja" for BPJS/ASTEK
            # caruman_pekerja = Astek Pekerja
            # pot_bpjs_kesehatan_pekerja = BPJS Kesehatan Pekerja
            # pot_bpjs_pensiun_pekerja = BPJS Pensiun Pekerja
            
            # FIX: Calculate total_potongan properly without double counting
            # Dynamic dict now contains ALL deductions except SPSI and PPH21 (which are static)
            # BPJS values are calculated (not from DB), so we add them directly
            
            # Get sum of all items in dynamic dict (KONTAN, THR, PINJAM, TIKET, ALAT, KL, POTONGAN PREMI, TIKET KEDATANGAN, etc)
            nested_bersih_dynamic = data.get('potongan_upah_bersih', {}).get('dynamic', {})
            dynamic_bersih_sum = sum(float(v or 0.0) for v in nested_bersih_dynamic.values())
            
            # Total Potongan Bersih = BPJS (calculated, pekerja only) + SPSI (static) + PPH21 (static) + Dynamic sum
            # BPJS components are calculated values, not from dynamic dict
            total_potongan_bersih = (
                caruman_pekerja +                           # Astek (pekerja portion) - calculated
                pot_bpjs_kesehatan_pekerja +                 # BPJS Kesehatan (pekerja portion) - calculated
                pot_bpjs_pensiun_pekerja +                   # BPJS Pensiun (pekerja portion) - calculated
                pot_spsi +                                  # SPSI - static from DB
                pot_pph21 +                                 # PPh21 - static from DB
                dynamic_bersih_sum                          # All other deductions from dynamic dict
            )

            # --- 6. Update Nested Structures ---
            # Keep only the fields that exist in the simplified nested structure
            data['potongan_upah_bersih']['spsi'] = pot_spsi
            data['potongan_upah_bersih']['pph21'] = pot_pph21
            data['potongan_upah_bersih']['total'] = total_potongan_bersih
            data['total_potongan_bersih'] = total_potongan_bersih  # Top-level for frontend

            # --- 7. Calculate Upah Bersih ---
            # Formula: Upah Kotor - Total Potongan Bersih
            upah_bersih = jumlah_upah_kotor - total_potongan_bersih
            data['upah_bersih'] = upah_bersih

            # --- 7. Legacy Total Potongan (for backward compatibility) ---
            # Sum of all deductions (only worker portions for BPJS-related items)
            # User requested Total Potongan to include specific components ONLY (Astek, BPJS, SPSI, PPH21, Defined Deductions)
            # Dynamic Potongan and Koreksi are already deducted from Gross (Jumlah Upah Kotor) so they are NOT included here.
            total_potongan = total_potongan_bersih
            data['total_potongan'] = total_potongan
            
            final_data.append(data)

        # Build dynamic_premi_headers map (header -> field mapping)
        # This mirrors the structure of dynamic_potongan_headers for frontend consistency
        # Use same _normalize_premi_field_name function as premi data assignment for consistency
        dynamic_premi_headers = {}
        for idx, header in enumerate(valid_headers):
            # Use the same normalization function used when assigning premi data
            field_name = self._normalize_premi_field_name(header)
            if field_name:
                dynamic_premi_headers[header] = field_name
        
        logger.info(f"[PREMI DEBUG] dynamic_premi_headers map: {dynamic_premi_headers}")

        # DEBUG: Final data size
        logger.info(f"[DEBUG] final_data size before return: {len(final_data)}")

        return {
            'gang_code': gang_code,
            'month': month,
            'year': year,
            'data_rows': final_data,
            'dynamic_potongan_headers': dynamic_pot_global_map,
            'dynamic_premi_headers': dynamic_premi_headers
        }
    def _get_hk_query(self, gang_code: str, start_date: str, end_date: str, division_code: str = None) -> Dict[str, Any]:
        """
        Get real HK (Hari Kerja) data from PR_EMP_ATTN_ARC table
        Based on reference code get_monthly_hk_count method
        """
        condition_sql, condition_params = self._get_gang_condition_sql(gang_code, division_code)
        return {
            'sql': f"""
                SELECT DISTINCT
                        e.EmpCode,
                        COUNT(CASE WHEN a.IsPresent = 'true' THEN 1 END) as hari_kerja
                    FROM HR_EMPLOYEE e
                JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                LEFT JOIN PR_EMP_ATTN_ARC a ON a.EmpCode = e.EmpCode
                    AND a.AttnDate >= ?
                    AND a.AttnDate < ?
                WHERE {condition_sql}
                GROUP BY e.EmpCode
                ORDER BY e.EmpCode
            """,
            'params': [start_date, end_date] + condition_params
        }
        # Merge HK data (real attendance data) - FIXED: only 2 columns returned
        for hk_row in (results.get('hk_data') or []):
            emp_code, hari_kerja = hk_row
            emp_code = str(emp_code).strip()
            if emp_code in employee_data:
                employee_data[emp_code].update({
                    'hari_kerja': hari_kerja or 0
                })



    @staticmethod
    def get_instance() -> 'ThreadedDataExtractor':
        """Singleton pattern for ThreadedDataExtractor"""
        if not hasattr(ThreadedDataExtractor, '_instance'):
            ThreadedDataExtractor._instance = ThreadedDataExtractor()
        return ThreadedDataExtractor._instance
