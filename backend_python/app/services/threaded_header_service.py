import threading
import concurrent.futures
import time
from typing import List, Dict, Any, Optional
from datetime import datetime
from database.services.database import Database
from database.services.queries import Queries
from database.services.cache import Cache
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ThreadedHeaderService:
    """Optimized header service with threading and parallel processing"""

    def __init__(self, max_workers: int = 3):
        self.max_workers = max_workers
        self.db = Database.instance(pool_size=20)
        self.queries = Queries()

    def _allowed_premi_keywords(self, table_structure: Dict[str, Any]) -> set:
        try:
            hierarchy = table_structure.get('hierarchy', {})
            level2 = hierarchy.get('level_2', {}).get('columns', [])
            tokens = set()
            for c in level2:
                if (c.get('parent') or '').strip().lower() == 'premi':
                    t = (c.get('text') or '').strip().upper()
                    t = t.replace('PREMI ', '')
                    for w in t.split():
                        if w and w not in {'PREMI'}:
                            tokens.add(w)
            base = {'PANEN','CUCI','UNIT','BLOWER','TABUR','KERANI','MANDOR','HARVEST','INCENTIVE','ANGKUT','TBS','PUPUK','MATERIAL'}
            return tokens | base
        except Exception:
            return {'PANEN','CUCI','UNIT','BLOWER','TABUR','KERANI','MANDOR','HARVEST','INCENTIVE','ANGKUT','TBS','PUPUK','MATERIAL'}

    def generate_headers(self, month: int, year: int, gang_code: str) -> Dict[str, Any]:
        """Generate headers using parallel processing"""
        return self.generate_optimized_headers_parallel(month, year, gang_code)

    def generate_optimized_headers_parallel(self, month: int, year: int, gang_code: str) -> Dict[str, Any]:
        """
        Generate headers using parallel processing for maximum performance.
        Separates static headers from dynamic processing for better concurrency.
        """
        start_time = time.perf_counter()

        # Prepare date parameters
        start_date = f"{year}-{str(month).zfill(2)}-01"
        if month == 12:
            end_date = f"{year+1}-01-01"
        else:
            end_date = f"{year}-{str(month+1).zfill(2)}-01"

        # Define parallel tasks
        tasks = {
            'static_structure': self._load_static_structure_task(),
            'dynamic_premi': self._get_dynamic_premi_task(gang_code, start_date, end_date),
            'dynamic_potongan': self._get_dynamic_potongan_task(gang_code, start_date, end_date),
            'employee_count': self._get_employee_count_task(gang_code),
            'report_metadata': self._get_report_metadata_task(month, year, gang_code)
        }

        # Execute all tasks in parallel
        results = {}
        execution_times = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # Submit tasks
            future_to_name = {
                executor.submit(self._execute_task, name, task_def): name
                for name, task_def in tasks.items()
            }

            # Collect results with timing
            for future in concurrent.futures.as_completed(future_to_name):
                task_name = future_to_name[future]
                task_start = time.perf_counter()
                try:
                    result = future.result(timeout=10)
                    execution_time = (time.perf_counter() - task_start) * 1000
                    results[task_name] = result
                    execution_times[task_name] = execution_time
                    logger.info(f"Task {task_name} completed in {execution_time:.2f}ms")
                except Exception as e:
                    logger.error(f"Task {task_name} failed: {e}")
                    results[task_name] = None

        # Process results and build final structure
        final_headers = self._build_final_headers(results, month, year, gang_code)

        total_time = time.perf_counter() - start_time
        logger.info(f"Parallel header generation completed in {total_time:.2f} seconds")

        return {
            **final_headers,
            'performance_metrics': {
                'total_execution_time_ms': total_time * 1000,
                'task_execution_times': execution_times,
                'parallel_workers_used': self.max_workers
            }
        }

    def _load_static_structure_task(self):
        """Load static header structure from JSON file"""
        try:
            import json
            from pathlib import Path

            # Load headers.json directly since it contains the entire structure
            headers_path = Path(__file__).parent.parent.parent / "database" / "queries" / "headers.json"
            with open(headers_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load static structure: {e}")
            return {}

    def _get_dynamic_premi_task(self, gang_code: str, start_date: str, end_date: str):
        """Get dynamic premi headers"""
        def execute_task():
            try:
                q = self.queries.get('premi', 'dynamic_premi_headers_filtered')
                if q and 'sql' in q:
                    rows = self.db.query_all(q['sql'], [gang_code, start_date, end_date])
                    headers = [str(row[0]) for row in rows if row and row[0]]
                    return headers
                return []
            except Exception as e:
                logger.error(f"Dynamic premi query failed: {e}")
                return []

        return execute_task

    def _get_dynamic_potongan_task(self, gang_code: str, start_date: str, end_date: str):
        """Get dynamic potongan headers"""
        def execute_task():
            try:
                q = self.queries.get('potongan', 'dynamic_potongan_with_amounts')
                if q and 'sql' in q:
                    rows = self.db.query_all(q['sql'], [gang_code, start_date, end_date])
                    headers = [str(row[0]) for row in rows if row and row[0]]
                    return headers
                return []
            except Exception as e:
                logger.error(f"Dynamic potongan query failed: {e}")
                return []

        return execute_task

    def _get_employee_count_task(self, gang_code: str):
        """Get employee count"""
        def execute_task():
            try:
                q = self.queries.get('headers', 'employee_count')
                if q and 'sql' in q:
                    result = self.db.query_one(q['sql'], [gang_code])
                    return result[0] if result and len(result) > 0 else 0
                return 0
            except Exception as e:
                logger.error(f"Employee count query failed: {e}")
                return 0

        return execute_task

    def _get_report_metadata_task(self, month: int, year: int, gang_code: str):
        """Get report metadata"""
        def execute_task():
            try:
                # Get month name in Indonesian
                month_names = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
                month_name = month_names[month] if month else "Unknown"

                return {
                    "title": f"DAFTAR UPAH - {month_name} {year or datetime.now().year}",
                    "generated_date": datetime.now().strftime("%Y-%m-%d_%H-%M-%S"),
                    "gang": gang_code or "All Gangs",
                    "database": "ARC",
                    "description": "Laporan daftar upah dengan header dinamis lengkap (PREMI + POTONGAN)"
                }
            except Exception as e:
                logger.error(f"Report metadata task failed: {e}")
                return {}

        return execute_task

    def _execute_task(self, name: str, task_def):
        """Execute a single task"""
        try:
            if callable(task_def):
                return task_def()
            return task_def
        except Exception as e:
            logger.error(f"Task {name} failed: {e}")
            return None

    def _build_final_headers(self, results: Dict[str, Any], month: int, year: int, gang_code: str) -> Dict[str, Any]:
        """Build final header structure from results"""
        # Get month name in Indonesian
        month_names = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
        month_name = month_names[month] if month else "Unknown"

        # Start building structure
        table_structure = results.get('static_structure', {})
        hierarchy = table_structure.get('hierarchy', {})

        # Build base structure
        final_headers = {}

        # Basic info fields
        final_headers['perusahaan'] = "PT REBINMAS"
        final_headers['periode'] = f"{month_name} {year}"
        final_headers['disetujui_oleh'] = "MANAGER"

        # Level 1: Main categories
        level1 = hierarchy.get('level_1', {})
        for main_cat, main_data in level1.items():
            header_name = main_cat.get('text', '').strip()
            if header_name:
                final_headers[header_name] = main_data

        # Add dynamic fields
        all_premi = results.get('dynamic_premi', [])
        all_potongan = results.get('dynamic_potongan', [])

        return final_headers
