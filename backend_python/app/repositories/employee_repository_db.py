from typing import List, Optional, Dict, Any
from pathlib import Path
import json
import sys
import os
# Add the parent directory to sys.path to import database module
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from database.services.database import Database

def _map_gender(v) -> str:
    try:
        i = int(v)
        if i == 1:
            return 'L'
        if i == 2:
            return 'P'
        return 'L'
    except Exception:
        return 'L'

class EmployeeRepositoryDB:
    def __init__(self):
        # Initialize with the same pattern as reference engine
        # Get the project root directory (5 levels up from repositories)
        project_root = Path(__file__).parent.parent.parent.parent  # Go to refactor_production
        self.query_file = project_root / "Engine_HTML_Templating" / "template_report" / "query" / "get_detail_emp_each_gang.sql"
        self.config_file = Path(__file__).parent.parent.parent / "config.json"
        self.query = self._load_query()
        self.db_config = self._load_config()
        self.db = Database.instance()

    def _load_query(self) -> str:
        """Load SQL query from file - same as reference engine"""
        try:
            if self.query_file.exists():
                with open(self.query_file, 'r', encoding='utf-8') as f:
                    query = f.read().strip()
                    print(f"[EmployeeRepo] Loaded query from {self.query_file}")
                    return query
            else:
                print(f"[EmployeeRepo] Query file not found: {self.query_file}, using fallback query")
                # Fallback query that matches the reference pattern
                return '''
                    SELECT
                        e."EmpCode" AS nik,
                        e."EmpName" AS nama,
                        CASE
                            WHEN e."Gender" = 1 THEN 'L'
                            WHEN e."Gender" = 2 THEN 'P'
                            ELSE 'L'
                        END AS jenis_kelamin,
                        e."LocCode" AS loc_code,
                        COALESCE(g."GangCode", e."LocCode") AS gang_code
                    FROM "HR_EMPLOYEE" e
                    LEFT JOIN "HR_GANGLN" g ON g."GangMember" = e."EmpCode"
                    WHERE e."Status" = 'A'
                        AND (g."GangCode" = ? OR e."LocCode" = ? OR ? IS NULL)
                    ORDER BY e."EmpName"
                '''
        except Exception as e:
            print(f"[EmployeeRepo] Failed to load query: {e}")
            raise

    def _load_config(self) -> Dict[str, Any]:
        """Load database configuration - same as reference engine"""
        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
                db_config = config.get('database', {})
                print(f"[EmployeeRepo] Loaded config from {self.config_file}")
                return db_config
        except Exception as e:
            print(f"[EmployeeRepo] Failed to load config: {e}")
            # Fallback config
            return {
                "driver": "ODBC Driver 17 for SQL Server",
                "server": "localhost",
                "port": 1433,
                "username": "sa",
                "password": "windows0819",
                "database_name": "db_ptrj"
            }

    def _get_connection_string(self) -> str:
        """Build ODBC connection string - same as reference engine"""
        cfg = self.db_config
        return f'DRIVER={{{cfg["driver"]}}};SERVER={cfg["server"]},{cfg["port"]};DATABASE={cfg["database_name"]};UID={cfg["username"]};PWD={cfg["password"]}'

    def list(self, skip: int = 0, limit: int = 100, gang_code: Optional[str] = None, loc_code: Optional[str] = None, division: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get employees using the database service for connection pooling"""
        try:
            print(f"[EmployeeRepo] Querying employees for gang: {gang_code} division: {division}")
            print(f"[EmployeeRepo] Skip: {skip}, Limit: {limit}")

            # Resolve ALL selection with optional division filter
            gc = (str(gang_code).strip().upper() if gang_code else None)
            if gc == '':
                gc = None
            rows: List[Any] = []
            if gc == 'ALL':
                # When ALL, fetch employees across gangs; restrict to division prefixes if provided
                # Division mapping consistent with GangService
                division_prefix_map = {
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
                    'IJL': ['IJL'],
                    'STF-OFFICE': ['STF'],
                    'SECURITY': ['SEC']
                }
                params: List[str] = []
                where_clause = ''
                if division and division in division_prefix_map:
                    prefixes = division_prefix_map.get(division, [])
                    conds = []
                    for p in prefixes:
                        conds.append('UPPER(g."GangCode") LIKE UPPER(?)')
                        params.append(p + '%')
                    where_clause = 'WHERE ' + ' OR '.join(conds)
                else:
                    where_clause = ''

                sql_all = (
                    'SELECT DISTINCT '
                    'e."EmpCode" AS nik, '
                    'e."EmpName" AS nama, '
                    'CASE WHEN e."Gender" = 1 THEN \'L\' WHEN e."Gender" = 2 THEN \'P\' ELSE \'L\' END AS jenis_kelamin, '
                    'e."LocCode" AS loc_code, '
                    'g."GangCode" AS gang_code '
                    'FROM "HR_EMPLOYEE" e '
                    'JOIN "HR_GANGLN" g ON g."GangMember" = e."EmpCode" '
                    f'{where_clause} '
                    'ORDER BY e."EmpName"'
                )
                rows = self.db.query_all(sql_all, tuple(params))
            else:
                # Use parameterized query from file for specific gang
                rows = self.db.query_all(self.query, (gc if gc else None,))
            print(f"[EmployeeRepo] Found {len(rows)} employee records")

            

            # Convert to dictionary format
            employees = []
            for row in rows:
                emp = {
                    'nik': str(row[0]).strip() if row[0] else '',
                    'nama': str(row[1]).strip() if row[1] else '',
                    'jenis_kelamin': str(row[2]).strip() if row[2] else 'L',
                    'loc_code': str(row[3]).strip() if row[3] else '',
                    'gang_code': str(row[4]).strip() if row[4] else (gc or ''),
                    'gaji_pokok': 0.0,
                    'phone': '-'
                }
                employees.append(emp)

            # Apply loc_code filter if specified
            if loc_code:
                loc_code_clean = str(loc_code).strip().upper()
                employees = [emp for emp in employees if emp.get('loc_code', '').upper() == loc_code_clean]
                print(f"[EmployeeRepo] After loc_code filter ({loc_code}): {len(employees)} employees")

            # Apply pagination
            total_count = len(employees)
            if skip >= total_count:
                employees = []
            else:
                end_index = min(skip + limit, total_count)
                employees = employees[skip:end_index]

            print(f"[EmployeeRepo] Returning {len(employees)} employees (skip={skip}, limit={limit})")
            return employees

        except Exception as e:
            print(f"[EmployeeRepo] Failed to query employees: {e}")
            return []

    def get_available_gangs(self) -> List[str]:
        """Get list of available gang codes - additional utility method"""
        try:
            query = '''
                SELECT DISTINCT "GangCode" FROM "HR_GANGLN"
                WHERE "GangCode" IS NOT NULL AND "GangCode" != ''
                ORDER BY "GangCode"
            '''
            rows = self.db.query_all(query)

            gangs = [str(row[0]).strip() for row in rows if row[0]]
            return gangs

        except Exception as e:
            print(f"[EmployeeRepo] Failed to get available gangs: {e}")
            return []

    def test_connection(self) -> bool:
        """Test database connection - additional utility method"""
        return self.db.test_connection()

    def list_fields_by_gang(self, gang_code: str, fields: List[str], skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        colmap = {
            'nik': 'HR_EMPLOYEE.EmpCode',
            'nama': 'HR_EMPLOYEE.EmpName',
            'jenis_kelamin': 'HR_EMPLOYEE.Gender',
            'loc_code': 'HR_EMPLOYEE.LocCode',
            'gang_code': 'HR_GANGLN.GangCode'
        }
        allowed = [f for f in fields if f in colmap]
        if not allowed:
            allowed = ['nik', 'nama']
        select_cols = ', '.join([f'"{colmap[f]}"' for f in allowed])
        sql = f'SELECT {select_cols} FROM "HR_EMPLOYEE" JOIN "HR_GANGLN" ON "HR_GANGLN"."GangMember" = "HR_EMPLOYEE"."EmpCode" WHERE "HR_GANGLN"."GangCode" = ? ORDER BY "HR_EMPLOYEE"."EmpName"'
        rows = self.db.query_all(sql, (str(gang_code).strip(),))
        out: List[Dict[str, Any]] = []
        for r in rows:
            item: Dict[str, Any] = {}
            for i, f in enumerate(allowed):
                if f == 'jenis_kelamin':
                    item[f] = _map_gender(r[i])
                else:
                    item[f] = str(r[i]).strip()
            out.append(item)
        return out[skip:skip+limit]

    def get_by_nik(self, nik: str) -> Optional[Dict[str, Any]]:
        sql = 'SELECT "EmpCode","EmpName","Gender","LocCode" FROM "HR_EMPLOYEE" WHERE "EmpCode" = ?'
        row = self.db.query_one(sql, (str(nik).strip(),))
        if not row:
            return None
        return {
            'nik': str(row[0]).strip(),
            'nama': str(row[1]).strip(),
            'jenis_kelamin': _map_gender(row[2]),
            'loc_code': str(row[3]).strip()
        }
