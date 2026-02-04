import threading
import concurrent.futures
import time
import calendar
import re
from typing import List, Dict, Any, Optional, Tuple
from database.services.database import Database
from database.services.queries import Queries
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ThreadedDataExtractor:
    """Optimized data extractor with threading and parallel query processing"""

    def __init__(self, max_workers: int = 4):
        self.max_workers = max_workers
        self.db = Database.instance(pool_size=20)
        self.queries = Queries()
    
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
        
        name = name.lower().replace(' ', '_')
        name = re.sub(r'[^a-z0-9_]', '', name)
        name = re.sub(r'_+', '_', name)
        name = name.strip('_')
        
        if not name:
            return ""
            
        if not name.startswith('premi_'):
            name = f'premi_{name}'
            
        return name

    def extract_all_payroll_data_parallel(self, month: int, year: int, gang_code: str) -> Dict[str, Any]:
        """
        Extract all payroll data using parallel queries for maximum performance.
        This replaces sequential query execution with concurrent processing.
        No fallback - always uses real database data.
        """
        start_time = time.perf_counter()

        # Prepare query parameters
        start_date = f"{year}-{str(month).zfill(2)}-01"
        if month == 12:
            end_date = f"{year+1}-01-01"
        else:
            end_date = f"{year}-{str(month+1).zfill(2)}-01"

        # Define all query tasks that can be executed in parallel
        query_tasks = {
            'employee_data': self._get_employees_query(gang_code),
            'attendance_data': self._get_attendance_query(gang_code, start_date, end_date),
            'premi_headers': self._get_dynamic_premi_headers_query(gang_code, start_date, end_date),
            'premi_amounts': self._get_premi_amounts_query(gang_code, start_date, end_date),
            'brondol_data': self._get_brondol_query(gang_code, start_date, end_date),
            'tunjangan_data': self._get_tunjangan_query(gang_code, start_date, end_date),
            'potongan_data': self._get_potongan_query(gang_code, start_date, end_date),
            'cuti_data': self._get_cuti_query(gang_code, start_date, end_date),
            'hk_data': self._get_hk_query(gang_code, start_date, end_date),
            'upah_pokok_data': self._get_upah_pokok_query(gang_code, start_date, end_date)
        }

        results = {}
        query_times = {}

        # Execute queries in parallel using ThreadPoolExecutor
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # Submit all queries to the thread pool
            future_to_name = {
                executor.submit(self._execute_query_with_timing, name, query_def): name
                for name, query_def in query_tasks.items()
            }

            # Collect results as they complete
            for future in concurrent.futures.as_completed(future_to_name):
                task_name = future_to_name[future]
                try:
                    result_data, execution_time = future.result(timeout=30)  # 30 second timeout per query
                    results[task_name] = result_data
                    query_times[task_name] = execution_time
                    logger.info(f"Completed query: {task_name} in {execution_time:.2f}ms")
                except Exception as e:
                    logger.error(f"Query {task_name} failed: {e}")
                    raise RuntimeError(f"Database query failed for {task_name}: {e}") from e

        # Process and merge results - no fallback, always process what we get from database
        merged_data = self._process_parallel_results(results, gang_code, month, year)
        merged_data['query_performance'] = query_times

        total_time = time.perf_counter() - start_time
        logger.info(f"Parallel data extraction completed in {total_time:.2f} seconds")

        return merged_data

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

    def _execute_query(self, task_name: str, query_def: Dict[str, Any]) -> List[Tuple]:
        """Execute a single query with error handling"""
        result, _ = self._execute_query_with_timing(task_name, query_def)
        return result

    def _get_employees_query(self, gang_code: str) -> Dict[str, Any]:
        """Get employees by gang code"""
        return {
            'sql': """
                SELECT DISTINCT
                    e.EmpCode as nik,
                    e.EmpName as nama,
                    e.Gender as jenis_kelamin,
                    '' as tanggal_join,
                    '' as departemen,
                    '' as jabatan,
                    g.GangCode as gang
                FROM HR_EMPLOYEE e
                LEFT JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                WHERE g.GangCode = ? OR ? = 'ALL'
                ORDER BY e.EmpCode
            """,
            'params': [gang_code, gang_code.upper()]
        }

    def _get_attendance_query(self, gang_code: str, start_date: str, end_date: str) -> Dict[str, Any]:
        """
        Get HK (hari kerja) count based on reference code daftar_upah_engine_real_database.py
        This should match the get_employee_hk_count method exactly
        """
        return {
            'sql': """
                SELECT
                    e.EmpCode,
                    COUNT(*) as hk_count  -- Only count days where IsPresent = 'true'
                FROM PR_EMP_ATTN_ARC d
                JOIN HR_EMPLOYEE e ON e.EmpCode = d.EmpCode
                JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                WHERE d.AttnDate >= ?
                  AND d.AttnDate < ?
                  AND d.IsPresent = 'true'
                  AND (g.GangCode = ? OR ? = 'ALL')
                GROUP BY e.EmpCode
                ORDER BY e.EmpCode
            """,
            'params': [start_date, end_date, gang_code, gang_code.upper()]
        }

    def _get_dynamic_premi_headers_query(self, gang_code: str, start_date: str, end_date: str) -> Dict[str, Any]:
        """Get dynamic premi headers with optimized query"""
        return {
            'sql': """
                SELECT DISTINCT t.DocDesc
                FROM PR_ADTRANS_ARC AS t
                JOIN PR_ADTRANSLN_ARC AS ln ON t.ID = ln.MasterID
                JOIN HR_GANGLN AS g ON g.GangMember = t.EmpCode
                WHERE g.GangCode = ?
                    AND t.DocDate >= ?
                    AND t.DocDate < ?
                    AND COALESCE(ln.Amount,0) > 0
                    AND t.DocDesc IS NOT NULL
                    AND UPPER(t.DocDesc) NOT IN ('KOREKSI','POTONGAN PPH21','POTONGAN SPSI','TUNJANGAN JABATAN','TUNJANGAN MASA KERJA','PPH 21','PPH21','SPSI')
                    AND UPPER(t.DocDesc) NOT LIKE '%PPH%'
                    AND UPPER(t.DocDesc) NOT LIKE '%KOR%'
                ORDER BY t.DocDesc
            """,
            'params': [gang_code, start_date, end_date]
        }

    def _get_premi_amounts_query(self, gang_code: str, start_date: str, end_date: str) -> Dict[str, Any]:
        """Get premi amounts for all employees"""
        return {
            'sql': """
                SELECT
                    t.EmpCode,
                    t.DocDesc,
                    SUM(COALESCE(ln.Amount,0)) as TotalAmount
                FROM PR_ADTRANS_ARC AS t
                JOIN PR_ADTRANSLN_ARC AS ln ON t.ID = ln.MasterID
                JOIN HR_GANGLN AS g ON g.GangMember = t.EmpCode
                WHERE g.GangCode = ?
                    AND t.DocDate >= ?
                    AND t.DocDate < ?
                    AND COALESCE(ln.Amount,0) > 0
                GROUP BY t.EmpCode, t.DocDesc
            """,
            'params': [gang_code, start_date, end_date]
        }

    def _get_brondol_query(self, gang_code: str, start_date: str, end_date: str) -> Dict[str, Any]:
        """Get brondol amounts from PR_LOOSEFRUIT_ARC using reference query"""
        return {
            'sql': """
                SELECT 
                    LFLN.EmpCode, 
                    SUM(LFLN.Amount) AS TotalAmount
                FROM "PR_LOOSEFRUIT_ARC" LF
                JOIN "PR_LOOSEFRUITLN_ARC" LFLN ON LF.ID = LFLN.MasterID
                JOIN HR_GANGLN g ON g.GangMember = LFLN.EmpCode
                WHERE g.GangCode = ?
                  AND LF.DocDate >= ?
                  AND LF.DocDate < ?
                GROUP BY LFLN.EmpCode
            """,
            'params': [gang_code, start_date, end_date]
        }

    def _get_tunjangan_query(self, gang_code: str, start_date: str, end_date: str) -> Dict[str, Any]:
        """Get tunjangan data"""
        return {
            'sql': """
                SELECT
                    t.EmpCode,
                    t.DocDesc,
                    SUM(COALESCE(ln.Amount,0)) as TotalAmount
                FROM PR_ADTRANS_ARC AS t
                JOIN PR_ADTRANSLN_ARC AS ln ON t.ID = ln.MasterID
                JOIN HR_GANGLN AS g ON g.GangMember = t.EmpCode
                WHERE g.GangCode = ?
                    AND t.DocDate >= ?
                    AND t.DocDate < ?
                    AND UPPER(t.DocDesc) LIKE '%TUNJANGAN%'
                GROUP BY t.EmpCode, t.DocDesc
            """,
            'params': [gang_code, start_date, end_date]
        }

    def _get_potongan_query(self, gang_code: str, start_date: str, end_date: str) -> Dict[str, Any]:
        """Get potongan data"""
        return {
            'sql': """
                SELECT
                    t.EmpCode,
                    t.DocDesc,
                    SUM(COALESCE(ln.Amount,0)) as TotalAmount
                FROM PR_ADTRANS_ARC AS t
                JOIN PR_ADTRANSLN_ARC AS ln ON t.ID = ln.MasterID
                JOIN HR_GANGLN AS g ON g.GangMember = t.EmpCode
                WHERE g.GangCode = ?
                    AND t.DocDate >= ?
                    AND t.DocDate < ?
                    AND (UPPER(t.DocDesc) LIKE '%POTONGAN%'
                         OR UPPER(t.DocDesc) LIKE '%PPH%'
                         OR UPPER(t.DocDesc) LIKE '%BPJS%'
                         OR UPPER(t.DocDesc) LIKE '%PINJAM%'
                         OR UPPER(t.DocDesc) LIKE '%KL%')
                GROUP BY t.EmpCode, t.DocDesc
            """,
            'params': [gang_code, start_date, end_date]
        }

    def _get_cuti_query(self, gang_code: str, start_date: str, end_date: str) -> Dict[str, Any]:
        """
        Get real cuti data from database using TaskCode classification with ARC tables
        Based on reference queries get_cuti_tahunan.sql and get_cuti_sakit.sql
        """
        return {
            'sql': """
                WITH cuti_tahunan AS (
                    SELECT
                        tr.EmpCode,
                        COUNT(*) as cuti_tahunan_hari
                    FROM PR_TASKREGLN_ARC tr
                    WHERE tr.TaskCode = 'GA9129AB2'
                      AND tr.CreatedDate >= ?
                      AND tr.CreatedDate < ?
                      AND tr.EmpCode IN (
                          SELECT g.GangMember
                          FROM HR_GANGLN g
                          WHERE g.GangCode = ? OR ? = 'ALL'
                      )
                    GROUP BY tr.EmpCode
                ),
                cuti_sakit AS (
                    SELECT
                        tr.EmpCode,
                        COUNT(*) as cuti_sakit_haid_hari
                    FROM PR_TASKREGLN_ARC tr
                    WHERE tr.TaskCode = 'GA9126AB2'
                      AND tr.CreatedDate >= ?
                      AND tr.CreatedDate < ?
                      AND tr.EmpCode IN (
                          SELECT g.GangMember
                          FROM HR_GANGLN g
                          WHERE g.GangCode = ? OR ? = 'ALL'
                      )
                    GROUP BY tr.EmpCode
                ),
                hk_minggu AS (
                    SELECT
                        a.EmpCode,
                        COUNT(*) as cuti_minggu_hari
                    FROM PR_EMP_ATTN_ARC a
                    WHERE a.AttnDate >= ?
                      AND a.AttnDate < ?
                      AND a."TodayIsRestDay" = 'true'
                      AND a.EmpCode IN (
                          SELECT g.GangMember
                          FROM HR_GANGLN g
                          WHERE g.GangCode = ? OR ? = 'ALL'
                      )
                    GROUP BY a.EmpCode
                ),
                hk_nasional AS (
                    SELECT
                        a.EmpCode,
                        COUNT(*) as cuti_nasional_hari
                    FROM PR_EMP_ATTN_ARC a
                    WHERE a.AttnDate >= ?
                      AND a.AttnDate < ?
                      AND a.IsPresent = 'true'
                      AND a."TodayIsHoliday" = 'true'
                      AND a.EmpCode IN (
                          SELECT g.GangMember
                          FROM HR_GANGLN g
                          WHERE g.GangCode = ? OR ? = 'ALL'
                      )
                    GROUP BY a.EmpCode
                ),
                cuti_izin AS (
                    SELECT
                        e.EmpCode,
                        0 as cuti_izin_hari
                    FROM HR_EMPLOYEE e
                    JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                    WHERE (g.GangCode = ? OR ? = 'ALL')
                )
                SELECT DISTINCT
                    e.EmpCode,
                    COALESCE(ct.cuti_tahunan_hari, 0) as cuti_tahunan_hari,
                    COALESCE(cs.cuti_sakit_haid_hari, 0) as cuti_sakit_haid_hari,
                    0 as cuti_haid_hari,
                    COALESCE(hm.cuti_minggu_hari, 0) as cuti_minggu_hari,
                    COALESCE(hn.cuti_nasional_hari, 0) as cuti_nasional_hari,
                    COALESCE(ci.cuti_izin_hari, 0) as cuti_izin_hari
                FROM HR_EMPLOYEE e
                JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                LEFT JOIN cuti_tahunan ct ON ct.EmpCode = e.EmpCode
                LEFT JOIN cuti_sakit cs ON cs.EmpCode = e.EmpCode
                LEFT JOIN hk_minggu hm ON hm.EmpCode = e.EmpCode
                LEFT JOIN hk_nasional hn ON hn.EmpCode = e.EmpCode
                LEFT JOIN cuti_izin ci ON ci.EmpCode = e.EmpCode
                WHERE (g.GangCode = ? OR ? = 'ALL')
                ORDER BY e.EmpCode
            """,
            'params': [start_date, end_date, gang_code, gang_code.upper(),
                      start_date, end_date, gang_code, gang_code.upper(),
                      gang_code, gang_code.upper()]
        }

    def _get_hk_query(self, gang_code: str, start_date: str, end_date: str) -> Dict[str, Any]:
        """
        Get real HK (Hari Kerja) data from PR_EMP_ATTN_ARC table
        Based on reference code get_monthly_hk_count method
        """
        return {
            'sql': """
                SELECT DISTINCT
                    e.EmpCode,
                    COUNT(CASE WHEN a.IsPresent = 'true' THEN 1 END) as hari_kerja,
                    COUNT(CASE WHEN a.IsPresent = 'false' AND a.TodayIsRestDay = 'false' AND a.TodayIsHoliday = 'false' THEN 1 END) as tidak_hadir_cth,
                    COUNT(CASE WHEN a.IsPresent = 'false' AND (a.TodayIsRestDay = 'true' OR a.TodayIsHoliday = 'true') THEN 1 END) as tidak_hadir_alpa
                FROM HR_EMPLOYEE e
                JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                LEFT JOIN PR_EMP_ATTN_ARC a ON a.EmpCode = e.EmpCode
                    AND a.AttnDate >= ?
                    AND a.AttnDate < ?
                WHERE (g.GangCode = ? OR ? = 'ALL')
                GROUP BY e.EmpCode
                ORDER BY e.EmpCode
            """,
            'params': [start_date, end_date, gang_code, gang_code.upper()]
        }

    def _get_upah_pokok_query(self, gang_code: str, start_date: str, end_date: str) -> Dict[str, Any]:
        """Get upah pokok and upah dasar data from database using reference engine logic"""
        return {
            'sql': """
                SELECT DISTINCT
                    e.EmpCode,
                    p."PayRate" as upah_dasar,
                    p."PayRate" as upah_harian  -- Use PayRate as fallback
                FROM HR_EMPLOYEE e
                LEFT JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                LEFT JOIN HR_PAYROLL p ON p.EmpCode = e.EmpCode
                WHERE g.GangCode = ? OR ? = 'ALL'
            """,
            'params': [gang_code, gang_code.upper()]
        }

    def _process_parallel_results(self, results: Dict[str, List[Tuple]], gang_code: str, month: int, year: int) -> Dict[str, Any]:
        """Process and merge results from parallel queries"""

        # Build dynamic header map
        raw_headers = [str(row[0]).strip() for row in results.get('premi_headers', []) if row and row[0]]
        dynamic_header_map = {}
        for idx, header_text in enumerate(raw_headers[:7]):  # Limit to 7 dynamic fields
            dynamic_header_map[header_text] = f"premi_dynamic_{idx+1}"

        # Build employee base data
        employee_data = {}
        for emp_row in results.get('employee_data', []):
            nik, nama, jenis_kelamin, tanggal_join, departemen, jabatan, gang = emp_row
            employee_data[nik] = {
                'nik': nik,
                'nama': nama,
                'jenis_kelamin': jenis_kelamin or 'L',
                'tanggal_join': tanggal_join,
                'departemen': departemen,
                'jabatan': jabatan,
                'gang_code': gang or gang_code,
                'no': 0,  # Will be set later
                'upah_dasar': 0,
                'hari_kerja': 0,
                'upah_pokok': 0,
                'jumlah_hk': 0,
                'gaji_pokok': 0,
                'cuti_tahunan_hari': 0,
                'cuti_sakit_haid_hari': 0,
                'cuti_haid_hari': 0,
                'cuti_minggu_hari': 0,
                'cuti_nasional_hari': 0,
                'cuti_izin_hari': 0,
                'total_ketidakhadiran': 0,
                'beras_rate': 0,
                'beras_jumlah': 0,
                'jabatan_rate': 0,
                'jabatan_jumlah': 0,
                'masa_kerja_tahun': 0,
                'masa_kerja_jumlah': 0,
                'lembur_jam': 0,
                'lembur_jumlah': 0,
                'total_tunjangan': 0,
                'premi_brondol': 0,
                'premi': {}, # Initialize premi dict for nested structure
                'premi_dynamic_1': 0.0,
                'premi_dynamic_2': 0.0,
                'premi_dynamic_3': 0.0,
                'premi_dynamic_4': 0.0,
                'premi_dynamic_5': 0.0,
                'premi_dynamic_6': 0.0,
                'premi_dynamic_7': 0.0,
                'total_premi': 0,
                'jumlah_upah_kotor': 0,
                'pot_pph21': 0,
                'pot_kontan': 0,
                'pot_thr': 0,
                'pot_pinjam': 0,
                'pot_kl': 0,
                'pot_bpjs_kes': 0,
                'pot_bpjs_pek': 0,
                'pot_bpjs_maj': 0,
                'pot_total_1': 0,
                'pot_total_2': 0,
                'pot_total_3': 0,
                'pot_total_4': 0,
                'total_potongan': 0,
                'upah_bersih': 0,
                'tidak_hadir_cth': 0,
                'tidak_hadir_alpa': 0
            }

        # Merge upah pokok data
        for upah_row in results.get('upah_pokok_data', []):
            emp_code, upah_dasar, upah_harian = upah_row
            if emp_code in employee_data:
                employee_data[emp_code].update({
                    'upah_dasar': upah_dasar or 0,
                    'gaji_pokok': upah_dasar or 0,  # Use upah_dasar as gaji_pokok
                    'upah_pokok': upah_harian or 0
                })

        # Set HK and hari kerja for all employees from actual attendance data
        # Based on reference code: hk_count = COUNT(*) WHERE IsPresent = 'true'
        for att_row in results.get('attendance_data', []):
            emp_code, hk_count = att_row
            if emp_code in employee_data:
                employee_data[emp_code].update({
                    'jumlah_hk': hk_count or 0,  # This is the actual HK count (days present)
                    'hari_kerja': hk_count or 0  # Same as hk_count in reference code
                })

        # Merge HK data (real attendance data)
        for hk_row in results.get('hk_data', []):
            emp_code, hari_kerja, cth, alpa = hk_row
            if emp_code in employee_data:
                employee_data[emp_code].update({
                    'hari_kerja': hari_kerja or 0,
                    'tidak_hadir_cth': cth or 0,
                    'tidak_hadir_alpa': alpa or 0
                })

        # Merge cuti data
        for cuti_row in results.get('cuti_data', []):
            emp_code, tahunan, sakit_haid, haid, minggu, nasional, izin = cuti_row
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

            # Use HK data if available, otherwise use calculated hari kerja
            if emp_data.get('hari_kerja', 0) == 0:
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
            if emp_code in employee_data:
                val = amount or 0
                employee_data[emp_code]['premi_brondol'] = val
                employee_data[emp_code]['premi']['premi_brondol'] = val

        # Merge premi amounts (dynamic only)
        for premi_row in results.get('premi_amounts', []):
            emp_code, doc_desc, amount = premi_row
            if emp_code in employee_data and doc_desc:
                doc_desc_clean = str(doc_desc).strip()
                
                # Exclusion patterns (based on backend/database/queries/premi.json and user requirements)
                # These should match the "NOT LIKE" filters in the dynamic header query
                exclusion_patterns = [
                    'POTONGAN',  # Starts with POTONGAN (was POT)
                    # 'TUNJANGAN', # REMOVED: Allow generic Tunjangan (e.g. Tunjangan Rajin) to appear as dynamic premi if not explicitly excluded below
                ]
                
                is_excluded = False
                for pattern in exclusion_patterns:
                    if doc_desc_clean.upper().startswith(pattern):
                        is_excluded = True
                        break
                
                if is_excluded:
                    continue
                
                # 1. Handle premi_dynamic_X mapping (for older support)
                if doc_desc_clean in dynamic_header_map:
                    field_name = dynamic_header_map[doc_desc_clean]
                    employee_data[emp_code][field_name] = (employee_data[emp_code][field_name] or 0) + (amount or 0)
                
                # 2. Handle premi nested dict mapping (for SimplifiedHeaderService)
                normalized_name = self._normalize_premi_field_name(doc_desc_clean)
                if normalized_name:
                    current_val = employee_data[emp_code]['premi'].get(normalized_name, 0.0)
                    employee_data[emp_code]['premi'][normalized_name] = current_val + (amount or 0)

        # Merge tunjangan data
        for tunj_row in results.get('tunjangan_data', []):
            emp_code, doc_desc, amount = tunj_row
            if emp_code in employee_data and doc_desc:
                doc_desc_upper = doc_desc.upper()
                if 'BERAS' in doc_desc_upper:
                    employee_data[emp_code]['beras_jumlah'] = amount or 0
                elif 'JABATAN' in doc_desc_upper:
                    employee_data[emp_code]['jabatan_jumlah'] = amount or 0
                elif 'MASA KERJA' in doc_desc_upper:
                    employee_data[emp_code]['masa_kerja_jumlah'] = amount or 0
                elif 'LEMBUR' in doc_desc_upper:
                    employee_data[emp_code]['lembur_jumlah'] = amount or 0

        # Map to track dynamic deductions across all employees to ensure consistent column mapping
        dynamic_pot_global_map = {}
        dynamic_pot_counter = 1
        
        # Initialize totals for dynamic premiums
        dynamic_premi_totals = {f'premi_dynamic_{i}': 0.0 for i in range(1, 11)}

        # First pass: Process Potongan to identify dynamic items and populate employee data
        for pot_row in results.get('potongan_data', []):
            emp_code, doc_desc, amount = pot_row
            if emp_code in employee_data and doc_desc:
                doc_desc_upper = doc_desc.upper()
                if 'PPH21' in doc_desc_upper or 'PPH 21' in doc_desc_upper:
                    employee_data[emp_code]['pot_pph21'] = amount or 0
                elif 'KONTAN' in doc_desc_upper:
                    employee_data[emp_code]['pot_kontan'] = amount or 0
                elif 'THR' in doc_desc_upper:
                    employee_data[emp_code]['pot_thr'] = amount or 0
                elif 'PINJAM' in doc_desc_upper:
                    employee_data[emp_code]['pot_pinjam'] = amount or 0
                elif 'BPJS KES' in doc_desc_upper:
                    employee_data[emp_code]['pot_bpjs_kes'] = amount or 0
                elif 'BPJS PEK' in doc_desc_upper:
                    employee_data[emp_code]['pot_bpjs_pek'] = amount or 0
                elif 'BPJS MAJ' in doc_desc_upper:
                    employee_data[emp_code]['pot_bpjs_maj'] = amount or 0

        # Calculate derived values using correct formulas from reference code
        final_data = []
        for emp_data in employee_data.values():
            # Calculate totals
            # Calculate total premi from the nested dict to ensure accuracy
            premi_values = emp_data['premi'].values()
            total_premi_val = sum(premi_values)
            emp_data['total_premi'] = total_premi_val
            # Also set total_premi inside the nested dict
            emp_data['premi']['total_premi'] = total_premi_val

            emp_data['total_tunjangan'] = (
                emp_data['beras_jumlah'] + emp_data['jabatan_jumlah'] +
                emp_data['masa_kerja_jumlah'] + emp_data['lembur_jumlah']
            )

            # Total Potongan should only include standard deductions (BPJS, Tax, Union, Fixed Loans)
            # Dynamic deductions and Koreksi are handled at Gross level (if applicable) or ignored for this total
            emp_data['total_potongan'] = (
                emp_data['pot_pph21'] + emp_data['pot_kontan'] + emp_data['pot_thr'] +
                emp_data['pot_pinjam'] + emp_data['pot_kl'] + emp_data['pot_bpjs_kes'] +
                emp_data['pot_bpjs_pek'] + emp_data['pot_bpjs_maj'] + # Note: pot_bpjs_maj usually excluded? Check threaded_data_extractor.py logic
                emp_data['pot_total_1'] + emp_data['pot_total_2'] +
                emp_data['pot_total_3'] + emp_data['pot_total_4']
            )
            
            # Calculate upah kotor and bersih
            hk_count = emp_data.get('jumlah_hk', 0)
            hari_kerja = emp_data.get('hari_kerja', 0)
            payrate = emp_data.get('upah_dasar', 0)

            # Calculate gaji_pokok (from jumlah_hk) and upah_pokok (from hari_kerja)
            emp_data['gaji_pokok'] = hk_count * payrate
            emp_data['upah_pokok'] = hari_kerja * payrate

            # Calculate jumlah_upah_kotor using gaji_pokok (from jumlah_hk * upah_dasar) not upah_pokok
            emp_data['jumlah_upah_kotor'] = emp_data['gaji_pokok'] + emp_data['total_tunjangan'] + emp_data['total_premi']
            emp_data['upah_bersih'] = emp_data['jumlah_upah_kotor'] - emp_data['total_potongan']
            
            # Convert to list for final sorting
            final_data.append(emp_data)
            
        # Sort by No/Name
        final_data.sort(key=lambda x: x['nama'])
        
        # Assign NO
        for idx, row in enumerate(final_data, 1):
            row['no'] = idx

        return {
            'data_rows': final_data,
            'premi_headers': raw_headers,
            'total_employees': len(final_data),
            'execution_time_ms': (time.perf_counter() - time.perf_counter()) * 1000  # This will be updated in the calling function
        }

    @staticmethod
    def get_instance() -> 'ThreadedDataExtractor':
        """Singleton pattern for ThreadedDataExtractor"""
        if not hasattr(ThreadedDataExtractor, '_instance'):
            ThreadedDataExtractor._instance = ThreadedDataExtractor()
        return ThreadedDataExtractor._instance