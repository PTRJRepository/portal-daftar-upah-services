"""
Database Service for Lembur Engine

Handles all database queries for overtime records and holidays.
Uses the existing database connection infrastructure from the backend.
"""

import os
import sys
from datetime import date, datetime
from typing import List, Dict, Optional, Tuple

# Add backend to path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
backend_dir = os.path.join(parent_dir, 'backend')
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from .models import OvertimeRecord, HolidayInfo


class LemburDBService:
    """Database service for overtime data queries"""
    
    def __init__(self, db_profile: str = None):
        """
        Initialize database service
        
        Args:
            db_profile: Database profile to use (local, remote, remote_2)
                       If None, uses DB_PROFILE environment variable
        """
        self.db_profile = db_profile or os.getenv('DB_PROFILE', 'remote')
        self._db = None
    
    def _get_db(self):
        """Get database instance from backend"""
        if self._db is None:
            try:
                from database.services.database import Database
                self._db = Database.instance()
            except ImportError as e:
                raise ImportError(f"Failed to import backend database: {e}. Make sure backend is in path.")
        return self._db
    
    def _is_current_month(self, month: int, year: int) -> bool:
        """Check if the requested month/year is the current month"""
        today = date.today()
        return month == today.month and year == today.year
    
    def get_overtime_records(
        self,
        emp_code: str,
        month: int,
        year: int
    ) -> List[OvertimeRecord]:
        """
        Get overtime records for an employee in a specific month
        
        Tries both PR_TASKREGLN and PR_TASKREGLN_ARC to find records.
        
        Args:
            emp_code: Employee code
            month: Month (1-12)
            year: Year
            
        Returns:
            List of OvertimeRecord objects
        """
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1)
        else:
            end_date = date(year, month + 1, 1)
        
        # Determine check order based on date
        today = date.today()
        is_past = year < today.year or (year == today.year and month < today.month)
        
        # List of (table_ln, table_master) tuples to try
        if is_past:
            table_configs = [
                ("PR_TASKREGLN_ARC", "PR_TASKREG_ARC"),
                ("PR_TASKREGLN", "PR_TASKREG")
            ]
        else:
            table_configs = [
                ("PR_TASKREGLN", "PR_TASKREG"),
                ("PR_TASKREGLN_ARC", "PR_TASKREG_ARC")
            ]
            
        for table_ln, table_master in table_configs:
            sql = f"""
                SELECT 
                    trl.[ID],
                    trl.[EmpCode],
                    '' as EmpName,
                    trl.[TrxDate],
                    trl.[Hours],
                    trl.[TaskCode],
                    trl.[ShiftCode],
                    trl.[ChargeTo]
                FROM [{table_ln}] trl
                JOIN [{table_master}] t ON trl.MasterID = t.ID
                WHERE trl.[OT] = 1
                    AND trl.[EmpCode] = ?
                    AND trl.[TrxDate] >= ?
                    AND trl.[TrxDate] < ?
                ORDER BY trl.[TrxDate]
            """
            
            try:
                db = self._get_db()
                rows = db.query_all(sql, (emp_code, start_date.isoformat(), end_date.isoformat()))
                
                if rows:
                    records = []
                    for row in rows:
                        trx_date = row[3]
                        if isinstance(trx_date, str):
                            trx_date = datetime.strptime(trx_date[:10], '%Y-%m-%d').date()
                        elif isinstance(trx_date, datetime):
                            trx_date = trx_date.date()
                        
                        record = OvertimeRecord(
                            id=row[0],
                            emp_code=row[1].strip() if row[1] else '',
                            emp_name=row[2].strip() if row[2] else '',
                            trx_date=trx_date,
                            hours=float(row[4]) if row[4] else 0.0,
                            task_code=row[5].strip() if row[5] else None,
                            shift_code=row[6].strip() if row[6] else None,
                            charge_to=row[7].strip() if row[7] else None
                        )
                        records.append(record)
                    
                    return records
                    
            except Exception as e:
                print(f"Error fetching overtime records from {table_ln}: {e}")
                # Continue to next table if one fails
                continue
        
        return []
    
    def get_overtime_records_batch(
        self,
        emp_codes: List[str],
        month: int,
        year: int
    ) -> Dict[str, List[OvertimeRecord]]:
        """
        Get overtime records for MULTIPLE employees in ONE query (batch mode)
        
        This is significantly faster than calling get_overtime_records() for each employee.
        
        Args:
            emp_codes: List of employee codes
            month: Month (1-12)
            year: Year
            
        Returns:
            Dictionary mapping emp_code to list of OvertimeRecord objects
        """
        if not emp_codes:
            return {}
            
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1)
        else:
            end_date = date(year, month + 1, 1)
        
        # Determine check order based on date
        today = date.today()
        is_past = year < today.year or (year == today.year and month < today.month)
        
        # List of (table_ln, table_master) tuples to try
        if is_past:
            table_configs = [
                ("PR_TASKREGLN_ARC", "PR_TASKREG_ARC"),
                ("PR_TASKREGLN", "PR_TASKREG")
            ]
        else:
            table_configs = [
                ("PR_TASKREGLN", "PR_TASKREG"),
                ("PR_TASKREGLN_ARC", "PR_TASKREG_ARC")
            ]
        
        # Build IN clause with placeholders
        placeholders = ','.join(['?' for _ in emp_codes])
        
        for table_ln, table_master in table_configs:
            sql = f"""
                SELECT 
                    trl.[ID],
                    trl.[EmpCode],
                    '' as EmpName,
                    trl.[TrxDate],
                    trl.[Hours],
                    trl.[TaskCode],
                    trl.[ShiftCode],
                    trl.[ChargeTo]
                FROM [{table_ln}] trl
                JOIN [{table_master}] t ON trl.MasterID = t.ID
                WHERE trl.[OT] = 1
                    AND trl.[EmpCode] IN ({placeholders})
                    AND trl.[TrxDate] >= ?
                    AND trl.[TrxDate] < ?
                ORDER BY trl.[EmpCode], trl.[TrxDate]
            """
            
            try:
                db = self._get_db()
                # Parameters: all emp_codes + start_date + end_date
                params = tuple(emp_codes) + (start_date.isoformat(), end_date.isoformat())
                rows = db.query_all(sql, params)
                
                if rows:
                    # Group records by employee code
                    result: Dict[str, List[OvertimeRecord]] = {code: [] for code in emp_codes}
                    
                    for row in rows:
                        trx_date = row[3]
                        if isinstance(trx_date, str):
                            trx_date = datetime.strptime(trx_date[:10], '%Y-%m-%d').date()
                        elif isinstance(trx_date, datetime):
                            trx_date = trx_date.date()
                        
                        emp_code = row[1].strip() if row[1] else ''
                        
                        record = OvertimeRecord(
                            id=row[0],
                            emp_code=emp_code,
                            emp_name=row[2].strip() if row[2] else '',
                            trx_date=trx_date,
                            hours=float(row[4]) if row[4] else 0.0,
                            task_code=row[5].strip() if row[5] else None,
                            shift_code=row[6].strip() if row[6] else None,
                            charge_to=row[7].strip() if row[7] else None
                        )
                        
                        if emp_code in result:
                            result[emp_code].append(record)
                    
                    print(f"[BATCH] Fetched {len(rows)} overtime records for {len(emp_codes)} employees from {table_ln}")
                    return result
                    
            except Exception as e:
                print(f"Error fetching batch overtime records from {table_ln}: {e}")
                # Continue to next table if one fails
                continue
        
        # Return empty lists for all employees if no data found
        return {code: [] for code in emp_codes}
    
    def get_holidays(self, year: int) -> Dict[date, HolidayInfo]:
        """
        Get all active holidays for a specific year
        
        Args:
            year: Year to get holidays for
            
        Returns:
            Dictionary mapping dates to HolidayInfo
        """
        sql = """
            SELECT 
                [GPHCode],
                [Description],
                [HolidayDate],
                [IsRegionPH]
            FROM [db_ptrj].[dbo].[HR_GPH]
            WHERE [Status] = 1
                AND YEAR([HolidayDate]) = ?
            ORDER BY [HolidayDate]
        """
        
        holidays = {}
        try:
            db = self._get_db()
            rows = db.query_all(sql, (year,))
            
            for row in rows:
                holiday_date = row[2]
                if isinstance(holiday_date, str):
                    holiday_date = datetime.strptime(holiday_date[:10], '%Y-%m-%d').date()
                elif isinstance(holiday_date, datetime):
                    holiday_date = holiday_date.date()
                
                # IsRegionPH comes as string '0' or '1' from MSSQL, need to convert properly
                # bool('0') would be True (non-empty string), so we must convert to int first
                is_region_ph = row[3]
                if isinstance(is_region_ph, str):
                    is_religious = is_region_ph == '1'
                else:
                    is_religious = bool(is_region_ph)
                
                holiday = HolidayInfo(
                    code=row[0].strip() if row[0] else '',
                    description=row[1].strip() if row[1] else '',
                    holiday_date=holiday_date,
                    is_religious=is_religious
                )
                holidays[holiday_date] = holiday
                
        except Exception as e:
            print(f"Error fetching holidays: {e}")
            raise
        
        return holidays
    
    def get_employee_name(self, emp_code: str) -> Optional[str]:
        """Get employee name from latest overtime record or HR_EMPLOYEE"""
        sql = """
            SELECT TOP 1 EmpName
            FROM [db_ptrj].[dbo].[HR_EMPLOYEE]
            WHERE [EmpCode] = ?
        """
        try:
            db = self._get_db()
            rows = db.query_all(sql, (emp_code,))
            if rows:
                return rows[0][0]
        except Exception as e:
            print(f"Error fetching employee name: {e}")
            # Don't raise, just return None
            return None
        return None
    
    def close(self):
        """Close database connection - Database instance manages its own pool"""
        # Database singleton manages its own connection pool
        self._db = None


if __name__ == "__main__":
    # Quick test
    service = LemburDBService()
    
    print("Testing holiday query...")
    holidays = service.get_holidays(2025)
    print(f"Found {len(holidays)} holidays in 2025")
    for d, h in list(holidays.items())[:5]:
        print(f"  {d}: {h.description} (religious={h.is_religious})")
    
    print("\nTesting overtime query...")
    records = service.get_overtime_records('B0497', 11, 2025)
    print(f"Found {len(records)} overtime records")
    for r in records[:3]:
        print(f"  {r.trx_date}: {r.hours} hours")
    
    service.close()
