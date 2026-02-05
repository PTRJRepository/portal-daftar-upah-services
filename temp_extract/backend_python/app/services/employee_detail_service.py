"""
Employee Detail Service - Provides checkroll data for individual employees
Includes daily attendance matrix and overtime breakdown
"""
from typing import Dict, List, Any, Optional
from datetime import datetime, date
from calendar import monthrange
import sys
import os
import logging

# Ensure lembur_engine can be imported
# Backend is at .../backend/app/services/employee_detail_service.py
# We need to reach .../refactor_production/lembur_engine
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(current_dir, '..', '..', '..'))
if root_dir not in sys.path:
    sys.path.append(root_dir)

from database.services.database import Database
from database.services.queries import Queries

# Lazy import for LemburCalculator to avoid potential circular issues if any,
# but usually safe here. We'll import inside the method to be safe.
# from lembur_engine.lembur_calculator import LemburCalculator

logger = logging.getLogger(__name__)


class EmployeeDetailService:
    """Service for fetching detailed employee checkroll data"""
    
    def __init__(self):
        self.db = Database.instance()
    
    def _get_holidays_from_hr_gph(self, month: int, year: int) -> Dict[int, Dict]:
        """
        Get national holidays from HR_GPH table for the given month/year.
        Returns a dict mapping day_of_month -> holiday info (description, is_religious).
        
        HR_GPH columns:
        - HolidayDate: date of the holiday
        - Description: holiday description (e.g., "Hari Raya Idul Fitri")
        - IsRegionPH: 1 = religious holiday, 0 = regular national holiday
        - Status: 1 = active
        """
        start_date = f"{year}-{month:02d}-01"
        end_date = f"{year}-{month:02d}-{monthrange(year, month)[1]}"
        
        query = """
            SELECT 
                DAY(HolidayDate) as day_of_month,
                HolidayDate,
                Description,
                IsRegionPH
            FROM HR_GPH 
            WHERE HolidayDate >= ? AND HolidayDate <= ?
              AND Status = 1
            ORDER BY HolidayDate
        """
        
        holidays = {}
        try:
            rows = self.db.execute_query(query, [start_date, end_date])
            for row in rows:
                day = row[0]
                holiday_date = row[1]
                description = (row[2] or '').strip()
                is_religious = int(row[3]) == 1 if row[3] is not None else False
                
                holidays[day] = {
                    'date': str(holiday_date)[:10] if holiday_date else f"{year}-{month:02d}-{day:02d}",
                    'description': description,
                    'is_religious': is_religious,
                    'holiday_type': 'Libur Keagamaan' if is_religious else 'Libur Nasional'
                }
                logger.info(f"Holiday found: {day} {month}/{year} - {description} (Religious: {is_religious})")
        except Exception as e:
            logger.error(f"Failed to get holidays from HR_GPH: {e}")
        
        return holidays

    
    def _execute_query_with_fallback(self, query_template: str, params: list, month: int, year: int) -> List[Any]:
        """
        Execute query trying both current and ARC tables if necessary.
        query_template should contain {table_suffix} placeholder.
        """
        # Strategy 1: Try based on date logic first
        now = datetime.now()
        is_past = year < now.year or (year == now.year and month < now.month)
        
        suffixes = ["_ARC", ""] if is_past else ["", "_ARC"]
        
        for suffix in suffixes:
            try:
                table_suffix = suffix
                final_query = query_template.format(table_suffix=suffix)
                rows = self.db.execute_query(final_query, params)
                
                if rows and len(rows) > 0:
                    return rows
            except Exception as e:
                logger.warning(f"Query failed with suffix '{suffix}': {e}")
                continue
                
        return []

    def get_employee_info(self, emp_code: str) -> Dict[str, Any]:
        """Get basic employee information"""
        logger.info(f"Getting employee info for: '{emp_code}'")
        query = """
            SELECT DISTINCT
                e.EmpCode as nik,
                e.EmpName as nama,
                e.Gender as jenis_kelamin,
                e.LocCode as loc_code,
                g.GangCode as gang_code,
                p."PayRate" as upah_dasar
            FROM HR_EMPLOYEE e
            LEFT JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
            LEFT JOIN HR_PAYROLL p ON p.EmpCode = e.EmpCode
            WHERE e.EmpCode = ?
        """
        try:
            # Try exact match first
            rows = self.db.execute_query(query, [emp_code])
            
            # If no match, try stripped version if different
            if not rows and emp_code.strip() != emp_code:
                logger.info(f"No match for '{emp_code}', trying stripped '{emp_code.strip()}'")
                rows = self.db.execute_query(query, [emp_code.strip()])
                
            if rows and len(rows) > 0:
                row = rows[0]
                logger.info(f"Found employee: {row[1]} (Gang: {row[4]})")
                
                # Fix gender mapping: 1=L (Laki-laki), 2=P (Perempuan)
                jenis_kelamin = row[2]
                if str(jenis_kelamin) == '1':
                    gender_mapped = 'L'
                elif str(jenis_kelamin) == '2':
                    gender_mapped = 'P'
                else:
                    gender_mapped = 'L' if str(jenis_kelamin or '').upper() != 'P' else 'P'
                    
                return {
                    'nik': row[0],
                    'nama': row[1],
                    'jenis_kelamin': gender_mapped,
                    'loc_code': row[3],
                    'gang_code': row[4],
                    'upah_dasar': float(row[5] or 0)
                }
        except Exception as e:
            logger.error(f"Failed to get employee info: {e}")
        return {}

    def _get_leave_data(self, emp_code: str, start_date: str, end_date: str, month: int, year: int) -> Dict[int, Dict]:
        """Get leave data from PR_TASKREGLN
        
        VALIDATION: JOIN to PR_TASKREG ensures only records with valid master are counted.
        """
        query_template = """
            SELECT 
                DAY(trl.TrxDate) as day_of_month,
                trl.TaskCode,
                trl.Hours,
                trl.Amount
            FROM PR_TASKREGLN{table_suffix} trl
            JOIN PR_TASKREG{table_suffix} tm ON trl.MasterID = tm.ID
            WHERE trl.EmpCode = ?
              AND trl.TrxDate >= ?
              AND trl.TrxDate <= ?
              AND (trl.TaskCode LIKE 'GA912%' OR trl.TaskCode LIKE 'GA913%')
        """
        leaves = {}
        rows = self._execute_query_with_fallback(query_template, [emp_code, start_date, end_date], month, year)
        for row in rows:
            day = row[0]
            task_code = row[1] or ''
            hours = float(row[2] or 0)
            amount = float(row[3] or 0)
            
            # Map code to status and type
            leave_type = 'cuti_lain'
            desc = 'Cuti'
            status = 'cuti'
            
            if 'GA9129' in task_code:
                leave_type = 'cuti_tahunan'
                desc = 'Cuti Tahunan'
                status = 'cuti'
            elif 'GA9126' in task_code:
                leave_type = 'sakit'
                desc = 'Sakit'
                status = 'sakit'
            elif 'GA9127' in task_code:
                leave_type = 'cuti_minggu'
                desc = 'Cuti Minggu'
                status = 'cuti'
            elif 'GA9128' in task_code:
                leave_type = 'cuti_nasional'
                desc = 'Cuti Nasional'
                status = 'libur'
            elif 'GA913' in task_code:
                leave_type = 'sakit'
                desc = 'Sakit'
                status = 'sakit'
            
            leaves[day] = {
                'status': status, 
                'desc': desc, 
                'code': task_code,
                'type': leave_type,
                'hours': hours,
                'amount': amount
            }
        return leaves

    def get_daily_attendance(self, emp_code: str, month: int, year: int) -> Dict[str, Any]:
        """
        Get daily attendance data for an employee in a specific month
        Returns a matrix with date keys (1-31) and status values
        
        Logic (using PR_TASKREGLN):
        - Matrix only shows status for days that HAVE data in taskreg
        - Minggu/Libur: only rendered if there's data in taskreg for that day
        - Alpa: day has NO data, but there IS data on LATER days (data entry has passed this date)
        - No_data: day has NO data, and there is NO data after this day either (not yet entered)
        - Hadir = TaskCode NOT starting with 'GA' AND NOT Sunday AND NOT in HR_GPH
        - Cuti/Sakit = TaskCode starting with GA (GA9129=Cuti, GA9126=Sakit, etc)
        """
        start_date = f"{year}-{month:02d}-01"
        end_date = f"{year}-{month:02d}-{monthrange(year, month)[1]}"
        
        # Get holiday data from HR_GPH first (needed for status determination)
        holidays = self._get_holidays_from_hr_gph(month, year)
        holiday_dates = set(holidays.keys())
        
        # Query PR_TASKREGLN for attendance data
        # VALIDATION: JOIN to PR_TASKREG ensures only records with valid master are counted.
        query_template = """
            SELECT 
                DAY(trl.TrxDate) as day_of_month,
                trl.TrxDate,
                trl.TaskCode,
                trl.Hours,
                trl.Amount
            FROM PR_TASKREGLN{table_suffix} trl
            JOIN PR_TASKREG{table_suffix} tm ON trl.MasterID = tm.ID
            WHERE trl.EmpCode = ?
              AND trl.TrxDate >= ?
              AND trl.TrxDate <= ?
              AND trl.OT = 0
            ORDER BY trl.TrxDate
        """
        
        # Initialize result with all days in month
        days_in_month = monthrange(year, month)[1]
        attendance_matrix = {}
        summary = {
            'total_hadir': 0,
            'total_tidak_hadir': 0,
            'cuti_tahunan': 0,
            'cuti_sakit': 0,
            'cuti_minggu': 0,
            'libur': 0,
            'alpa': 0,
            'no_data': 0,
            'total_hk': 0,  # Total days with data (OT=0)
            'kehadiran_efektif': 0  # HK - minggu - libur - cuti - sakit
        }
        
        for day in range(1, days_in_month + 1):
            attendance_matrix[day] = {
                'date': f"{year}-{month:02d}-{day:02d}",
                'status': 'no_data',
                'is_present': None,
                'is_rest_day': False,
                'is_holiday': False,
                'remarks': '',
                'task_code': '',
                'has_data': False  # Flag to indicate if this day has data in taskreg
            }
        
        try:
            rows = self._execute_query_with_fallback(query_template, [emp_code, start_date, end_date], month, year)
            
            # Track which days have data
            days_with_data = set()
            max_data_day = 0  # Track the latest day with data
            
            for row in rows:
                day = row[0]
                trx_date = row[1]
                task_code = row[2] or ''
                hours = float(row[3] or 0)
                amount = float(row[4] or 0)
                
                days_with_data.add(day)
                if day > max_data_day:
                    max_data_day = day
                
                summary['total_hk'] += 1  # Count total days with data
                
                # Determine the date object for day-of-week check
                if trx_date:
                    if isinstance(trx_date, str):
                        date_obj = datetime.strptime(trx_date[:10], "%Y-%m-%d")
                    else:
                        date_obj = trx_date
                else:
                    date_obj = datetime(year, month, day)
                
                # Check if it's Sunday (weekday 6 in Python)
                is_sunday = date_obj.weekday() == 6
                is_holiday = day in holiday_dates
                
                # Determine status based on TaskCode
                # Only specific GA912X codes are leave - other GAs are regular work
                if task_code.startswith('GA9129'):
                    status = 'cuti_tahunan'
                    remarks = 'Cuti Tahunan'
                    summary['cuti_tahunan'] += 1
                    summary['total_tidak_hadir'] += 1
                elif task_code.startswith('GA9126'):
                    status = 'sakit'
                    remarks = 'Sakit'
                    summary['cuti_sakit'] += 1
                    summary['total_tidak_hadir'] += 1
                elif task_code.startswith('GA9127'):
                    status = 'cuti_minggu'
                    remarks = 'Cuti Minggu'
                    summary['cuti_minggu'] += 1
                elif task_code.startswith('GA9128'):
                    status = 'libur'
                    remarks = 'Cuti Nasional'
                    summary['libur'] += 1
                elif is_sunday:
                    # Sunday with data in taskreg
                    status = 'minggu'
                    remarks = 'Hari Minggu'
                    summary['cuti_minggu'] += 1
                elif is_holiday:
                    # Holiday with data in taskreg
                    holiday_info = holidays.get(day, {})
                    if holiday_info.get('is_religious'):
                        status = 'libur_keagamaan'
                    else:
                        status = 'libur_nasional'
                    remarks = holiday_info.get('description', 'Libur Nasional')
                    summary['libur'] += 1
                else:
                    # Regular work day (includes GA* codes that are not leave)
                    status = 'hadir'
                    remarks = ''
                    summary['total_hadir'] += 1
                    summary['kehadiran_efektif'] += 1
                
                attendance_matrix[day] = {
                    'date': f"{year}-{month:02d}-{day:02d}",
                    'status': status,
                    'is_present': status == 'hadir',
                    'is_rest_day': is_sunday,
                    'is_holiday': is_holiday,
                    'remarks': remarks,
                    'task_code': task_code,
                    'hours': hours,
                    'amount': amount,
                    'has_data': True
                }
            
            # Handle days WITHOUT data
            # Logic: 
            # - If day < max_data_day and NOT Sunday: alpa (data entry has passed this date)
            # - If day >= max_data_day or is Sunday with no data: no_data (not yet entered or Sunday without data)
            for day in range(1, days_in_month + 1):
                if day not in days_with_data:
                    date_obj = datetime(year, month, day)
                    is_sunday = date_obj.weekday() == 6
                    is_holiday = day in holiday_dates
                    
                    # Determine if this is alpa or no_data
                    if max_data_day > 0 and day < max_data_day and not is_sunday and not is_holiday:
                        # There is data after this day, and it's not Sunday/holiday -> alpa
                        status = 'alpa'
                        summary['alpa'] += 1
                        summary['total_tidak_hadir'] += 1
                    else:
                        # Either no data at all, or this day is after last data entry, or it's Sunday/holiday without data
                        status = 'no_data'
                        summary['no_data'] += 1
                    
                    attendance_matrix[day]['status'] = status
                    attendance_matrix[day]['is_rest_day'] = is_sunday
                    attendance_matrix[day]['is_holiday'] = is_holiday
                    attendance_matrix[day]['has_data'] = False
                    
        except Exception as e:
            logger.error(f"Failed to get daily attendance: {e}")
        
        # Enrich with holiday info for days that have data
        for day, holiday_info in holidays.items():
            if day in attendance_matrix and attendance_matrix[day].get('has_data'):
                attendance_matrix[day]['holiday_info'] = holiday_info
                existing_remarks = attendance_matrix[day].get('remarks', '')
                holiday_desc = holiday_info.get('description', '')
                if holiday_desc and holiday_desc not in existing_remarks:
                    attendance_matrix[day]['remarks'] = f"{existing_remarks} {holiday_desc}".strip()
        
        # Build holiday list
        holiday_list = [{'day': day, **info} for day, info in holidays.items()]
        
        return {
            'matrix': attendance_matrix,
            'summary': summary,
            'holidays': holiday_list,
            'max_data_day': max_data_day  # Include for reference
        }
    
    def _get_day_name(self, date_obj) -> str:
        """Get Indonesian day name from date"""
        day_names = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
        return day_names[date_obj.weekday()]

    def get_daily_overtime(self, emp_code: str, month: int, year: int) -> Dict[str, Any]:
        """
        Get daily overtime data for an employee in a specific month
        Returns a matrix with date keys and overtime details
        """
        start_date = f"{year}-{month:02d}-01"
        end_date = f"{year}-{month:02d}-{monthrange(year, month)[1]}"
        
        # Initialize result
        days_in_month = monthrange(year, month)[1]
        overtime_matrix = {}
        total_hours = 0.0
        total_amount = 0.0
        overtime_list = []
        
        for day in range(1, days_in_month + 1):
            overtime_matrix[day] = {
                'date': f"{year}-{month:02d}-{day:02d}",
                'has_overtime': False,
                'hours': 0,
                'amount': 0,
                'details': []
            }
        
        try:
            # ---------------------------------------------------------
            # INTEGRATION: Lembur Calculator Formula
            # ---------------------------------------------------------
            # Calculate formula-based amounts using the Lembur Engine
            formula_map = {}
            try:
                from lembur_engine.lembur_calculator import LemburCalculator
                
                logger.info(f"Calculating overtime formula for {emp_code} - {month}/{year}")
                # Initialize calculator
                calc = LemburCalculator()
                # Calculate for the whole month
                result = calc.calculate(emp_code, month, year)
                
                # Map results by day of month for easy lookup
                for record in result.records:
                    day_val = record.trx_date.day
                    # Store detailed info from engine
                    formula_map[day_val] = {
                        'amount': record.breakdown.total_amount if record.breakdown else 0,
                        'day_type': record.day_type.get_display_name() if record.day_type else '-',
                        'day_name': self._get_day_name(record.trx_date)
                    }
                        
                logger.info(f"Formula calculation complete. Found {len(formula_map)} records.")
                
            except Exception as e:
                logger.error(f"Failed to calculate overtime formula: {e}")
                # Continue without formula amounts if engine fails

            # Manually handle fallback to adjust query for NormalDay column presence
            now = datetime.now()
            is_past = year < now.year or (year == now.year and month < now.month)
            suffixes = ["_ARC", ""] if is_past else ["", "_ARC"]
            
            rows = []
            for suffix in suffixes:
                # Adjust NormalDay column selection based on suffix
                normal_day_col = "trl.NormalDay" if suffix == "" else "0 as NormalDay"
                
                query = f"""
                    SELECT 
                        DAY(trl.TrxDate) as day_of_month,
                        trl.TrxDate,
                        trl.Hours,
                        trl.Amount,
                        trl.Rate,
                        trl.TaskCode,
                        {normal_day_col},
                        trl.ShiftCode
                    FROM PR_TASKREGLN{suffix} trl
                    JOIN PR_TASKREG{suffix} t ON t.ID = trl.MasterID
                    WHERE trl.EmpCode = ?
                      AND trl.TrxDate >= ?
                      AND trl.TrxDate <= ?
                      AND trl.OT = 1
                    ORDER BY trl.TrxDate
                """
                
                try:
                    rows = self.db.execute_query(query, [emp_code, start_date, end_date])
                    if rows and len(rows) > 0:
                        break
                except Exception as e:
                    logger.warning(f"Overtime query failed with suffix '{suffix}': {e}")
                    continue

            for row in rows:
                day = row[0]
                trx_date = row[1]
                hours = float(row[2] or 0)
                amount = float(row[3] or 0)
                rate = float(row[4] or 0)
                task_code = row[5] or ''
                normal_day = row[6]
                shift_code = row[7] or ''
                
                # Default day name and type if not found in formula
                current_date = trx_date if trx_date else date(year, month, day)
                if isinstance(current_date, str):
                     current_date = datetime.strptime(current_date[:10], "%Y-%m-%d").date()
                elif isinstance(current_date, datetime):
                     current_date = current_date.date()
                     
                day_name = self._get_day_name(current_date)
                day_type = 'Hari Kerja' # Default
                
                # Check formula map first for accurate day type
                amount_formula = 0
                if day in formula_map:
                    f_data = formula_map[day]
                    amount_formula = f_data['amount']
                    day_type = f_data['day_type']
                    # day_name from formula is also reliable
                    day_name = f_data['day_name']
                else:
                    # Fallback logic for day type if formula missed it
                    if normal_day is not None:
                        if str(normal_day) == '0':
                            day_type = 'Libur Umum'
                        elif str(normal_day) == '2':
                            day_type = 'Minggu'
                
                # Add to matrix
                overtime_matrix[day]['has_overtime'] = True
                overtime_matrix[day]['hours'] += hours
                overtime_matrix[day]['amount'] += amount
                overtime_matrix[day]['amount_formula'] = amount_formula

                overtime_matrix[day]['details'].append({
                    'hours': hours,
                    'amount': amount, # amount_server
                    'rate': rate,
                    'task_code': task_code,
                    'day_type': day_type,
                    'shift_code': shift_code,
                    'day_name': day_name
                })
                
                # Add to list
                overtime_list.append({
                    'date': str(trx_date)[:10] if trx_date else f"{year}-{month:02d}-{day:02d}",
                    'day': day,
                    'day_name': day_name,
                    'hours': hours,
                    'amount_server': amount,     # Renamed for clarity
                    'amount': amount,            # Keep for backward compatibility
                    'amount_formula': amount_formula,
                    'rate': rate,
                    'task_code': task_code,
                    'day_type': day_type
                })
                
                total_hours += hours
                total_amount += amount
            
            # Post-process: Add formula amounts to matrix where we might have missed them in the loop?
            # No, the loop covers all DB records. If formula has records but DB query doesn't,
            # it means either DB query is wrong or formula is finding something else.
            # But we rely on DB query for the list structure.
            # The previous code had a loop to add amount_formula to matrix items, which we now do inside the loop.
            # But we should ensure we don't double count if we have multiple records per day.
            # Since formula_map[day] is the TOTAL for the day, and we assign it to 'amount_formula' for EACH record in that day,
            # this might look like each record has that total amount.
            # Ideally, we should split it or just show it on the first record?
            # Or better: The UI should handle it. But if we show it in a table row, it might be misleading.
            # However, 'overtime_list' usually has one entry per day unless multiple OT tasks.
            # If multiple tasks, we'll see the same formula amount repeated. 
            # We can leave it for now or try to be smarter. 
            # Let's trust that usually 1 OT record per day.

        except Exception as e:
            logger.error(f"Failed to get daily overtime: {e}")
        
        return {
            'matrix': overtime_matrix,
            'list': overtime_list,
            'summary': {
                'total_hours': total_hours,
                'total_amount': total_amount,
                'total_days': len([d for d in overtime_matrix.values() if d['has_overtime']])
            }
        }
    
    def get_employee_checkroll(self, emp_code: str, month: int, year: int, payroll_row: Dict = None, division_code: str = None) -> Dict[str, Any]:
        """
        Get complete checkroll data for an employee
        Combines employee info, attendance matrix, and overtime matrix
        """
        employee_info = self.get_employee_info(emp_code)
        
        if not employee_info:
            logger.warning(f"Employee info not found for {emp_code}")
            return {'emp_code': emp_code, 'error': 'Employee not found'}

        # Fetch payroll data if not provided (e.g. direct access via URL)
        if not payroll_row:
            gang_code = employee_info.get('gang_code')
            if gang_code:
                try:
                    # Lazy import to avoid circular dependencies
                    from app.services.threaded_data_extractor import ThreadedDataExtractor
                    
                    logger.info(f"Fetching payroll data for {emp_code} (Gang: {gang_code}, Div: {division_code}) via ThreadedDataExtractor")
                    
                    extractor = ThreadedDataExtractor()
                    # Fetch whole gang data (usually small) and filter
                    data = extractor.extract_all_payroll_data_parallel(month, year, gang_code, division_code)
                    rows = data.get('data_rows', [])
                    
                    found_row = False
                    for row in rows:
                        # Check for NIK match (handle potential case sensitivity or whitespace)
                        row_nik = str(row.get('nik') or '').strip()
                        if row_nik == str(emp_code).strip():
                            payroll_row = row
                            found_row = True
                            logger.info(f"Found payroll row for {emp_code}")
                            break
                    
                    if not found_row:
                        logger.warning(f"Payroll row not found for {emp_code} in gang {gang_code}")
                        
                except Exception as e:
                    logger.error(f"Failed to fetch payroll data for {emp_code}: {e}")
            else:
                logger.warning(f"Cannot fetch payroll data: No gang code for {emp_code}")
        
        attendance_data = self.get_daily_attendance(emp_code, month, year)
        overtime_data = self.get_daily_overtime(emp_code, month, year)
        
        return {
            'emp_code': emp_code,
            'month': month,
            'year': year,
            'employee': employee_info,
            'payroll_data': payroll_row or {},
            'attendance': attendance_data,
            'overtime': overtime_data
        }

    def get_detailed_attendance_matrix(self, emp_code: str, month: int, year: int) -> Dict[str, Any]:
        """
        Get detailed attendance matrix using JSON-based queries
        Returns day-by-day attendance status with complete details
        """
        queries = Queries()
        start_date = f"{year}-{month:02d}-01"
        end_date = f"{year}-{month:02d}-{monthrange(year, month)[1]}"

        # Initialize result matrix
        days_in_month = monthrange(year, month)[1]
        attendance_matrix = {}
        summary = {
            'total_hadir': 0,
            'total_tidak_hadir': 0,
            'cuti_tahunan': 0,
            'cuti_sakit': 0,
            'cuti_minggu': 0,
            'cuti_nasional': 0,
            'cuti_lain': 0,
            'alpa': 0,
            'minggu': 0,
            'libur': 0
        }

        # Initialize all days
        for day in range(1, days_in_month + 1):
            attendance_matrix[day] = {
                'date': f"{year}-{month:02d}-{day:02d}",
                'status': 'no_data',
                'is_present': False,
                'is_rest_day': False,
                'is_holiday': False,
                'remarks': '',
                'details': {}
            }

        try:
            # Get holiday data from HR_GPH first (needed for status determination)
            holidays = self._get_holidays_from_hr_gph(month, year)
            holiday_dates = set(holidays.keys())
            
            # Get detailed attendance from PR_TASKREGLN
            query = queries.get('absensi', 'kehadiran_detail')
            if query:
                # Use fallback logic for table suffix
                now = datetime.now()
                is_past = year < now.year or (year == now.year and month < now.month)
                suffixes = ["_ARC", ""] if is_past else ["", "_ARC"]

                rows = []
                for suffix in suffixes:
                    try:
                        final_query = query['sql'].replace('PR_TASKREGLN_ARC', f'PR_TASKREGLN{suffix}')
                        rows = self.db.execute_query(final_query, [emp_code, start_date, end_date])
                        if rows and len(rows) > 0:
                            break
                    except Exception as e:
                        logger.warning(f"Attendance query failed with suffix '{suffix}': {e}")
                        continue

                # Track which days have data
                days_with_data = set()
                max_data_day = 0  # Track the latest day with data
                
                for row in rows:
                    day = row[0]
                    trx_date = row[1]
                    task_code = row[2] or ''
                    hours = float(row[3] or 0)
                    amount = float(row[4] or 0)
                    status = row[5] if len(row) > 5 else 'hadir'  # status from CASE in SQL
                    
                    days_with_data.add(day)
                    if day > max_data_day:
                        max_data_day = day
                    
                    # Determine the date object for day-of-week check
                    if trx_date:
                        if isinstance(trx_date, str):
                            date_obj = datetime.strptime(trx_date[:10], "%Y-%m-%d")
                        else:
                            date_obj = trx_date
                    else:
                        date_obj = datetime(year, month, day)
                    
                    # Check if it's Sunday (weekday 6 in Python)
                    is_sunday = date_obj.weekday() == 6
                    is_holiday = day in holiday_dates
                    
                    # Use status from the SQL CASE or determine locally
                    if status == 'hadir':
                        # Only specific GA912X codes are leave - other GAs are regular work
                        if task_code.startswith('GA9129'):
                            status = 'cuti_tahunan'
                        elif task_code.startswith('GA9126'):
                            status = 'sakit'
                        elif task_code.startswith('GA9127'):
                            status = 'cuti_minggu'
                        elif task_code.startswith('GA9128'):
                            status = 'cuti_nasional'
                        elif is_sunday:
                            status = 'minggu'
                        elif is_holiday:
                            holiday_info = holidays.get(day, {})
                            if holiday_info.get('is_religious'):
                                status = 'libur_keagamaan'
                            else:
                                status = 'libur_nasional'
                        # else: status remains 'hadir' (including other GA* codes)
                    
                    # Get remarks based on status
                    remarks = ''
                    if status == 'cuti_tahunan':
                        remarks = 'Cuti Tahunan'
                    elif status == 'sakit':
                        remarks = 'Sakit'
                    elif status == 'minggu':
                        remarks = 'Hari Minggu'
                    elif is_holiday:
                        remarks = holidays.get(day, {}).get('description', 'Libur Nasional')
                    
                    is_present = status == 'hadir'
                    
                    # Update matrix
                    if day in attendance_matrix:
                        attendance_matrix[day].update({
                            'date': str(trx_date)[:10] if trx_date else f"{year}-{month:02d}-{day:02d}",
                            'status': status,
                            'is_present': is_present,
                            'is_rest_day': is_sunday,
                            'is_holiday': is_holiday,
                            'remarks': remarks,
                            'has_data': True,
                            'details': {
                                'task_code': task_code,
                                'hours': hours,
                                'amount': amount,
                                'is_sunday': is_sunday,
                                'is_holiday': is_holiday
                            }
                        })

                        # Update summary
                        if status == 'hadir':
                            summary['total_hadir'] += 1
                        elif status == 'sakit':
                            summary['total_tidak_hadir'] += 1
                            summary['cuti_sakit'] += 1
                        elif status == 'cuti_tahunan':
                            summary['total_tidak_hadir'] += 1
                            summary['cuti_tahunan'] += 1
                        elif status == 'cuti_minggu':
                            summary['cuti_minggu'] += 1
                        elif status == 'cuti_nasional':
                            summary['cuti_nasional'] += 1
                        elif status == 'cuti_lain':
                            summary['total_tidak_hadir'] += 1
                            summary['cuti_lain'] += 1
                        elif status == 'minggu':
                            summary['minggu'] += 1
                        elif status in ['libur', 'libur_keagamaan', 'libur_nasional']:
                            summary['libur'] += 1
                        elif status == 'alpa':
                            summary['total_tidak_hadir'] += 1
                            summary['alpa'] += 1

            # Handle days WITHOUT data
            # Logic: 
            # - If day < max_data_day and NOT Sunday/holiday: alpa (data entry has passed this date)
            # - Otherwise: no_data (not yet entered or Sunday/holiday without data)
            for day in range(1, days_in_month + 1):
                if day not in days_with_data:
                    date_obj = datetime(year, month, day)
                    is_sunday = date_obj.weekday() == 6
                    is_holiday = day in holiday_dates
                    
                    # Determine if this is alpa or no_data
                    if max_data_day > 0 and day < max_data_day and not is_sunday and not is_holiday:
                        # There is data after this day, and it's not Sunday/holiday -> alpa
                        status = 'alpa'
                        summary['alpa'] += 1
                        summary['total_tidak_hadir'] += 1
                    else:
                        # Either no data at all, or this day is after last data entry, or it's Sunday/holiday without data
                        status = 'no_data'
                    
                    attendance_matrix[day]['status'] = status
                    attendance_matrix[day]['is_rest_day'] = is_sunday
                    attendance_matrix[day]['is_holiday'] = is_holiday
                    attendance_matrix[day]['has_data'] = False
            
            # Enrich with holiday info for days that have data
            for day, holiday_info in holidays.items():
                if day in attendance_matrix and attendance_matrix[day].get('has_data'):
                    attendance_matrix[day]['holiday_info'] = holiday_info
                    existing_remarks = attendance_matrix[day].get('remarks', '')
                    holiday_desc = holiday_info.get('description', '')
                    if holiday_desc and holiday_desc not in existing_remarks:
                        attendance_matrix[day]['remarks'] = f"{existing_remarks} {holiday_desc}".strip()

        except Exception as e:
            logger.error(f"Failed to get detailed attendance matrix: {e}")

        # Build holiday list for response
        holiday_list = []
        holidays = self._get_holidays_from_hr_gph(month, year)
        for day, h_info in holidays.items():
            holiday_list.append({
                'day': day,
                'date': h_info['date'],
                'description': h_info['description'],
                'is_religious': h_info['is_religious'],
                'holiday_type': h_info['holiday_type']
            })

        return {
            'matrix': attendance_matrix,
            'summary': summary,
            'holidays': holiday_list,
            'month': month,
            'year': year,
            'emp_code': emp_code
        }

    def get_detailed_overtime_matrix(self, emp_code: str, month: int, year: int) -> Dict[str, Any]:
        """
        Get detailed overtime matrix using JSON-based queries
        Returns day-by-day overtime details with amounts
        """
        queries = Queries()
        start_date = f"{year}-{month:02d}-01"
        end_date = f"{year}-{month:02d}-{monthrange(year, month)[1]}"

        # Initialize result matrix
        days_in_month = monthrange(year, month)[1]
        overtime_matrix = {}
        summary = {
            'total_hours': 0.0,
            'total_amount': 0.0,
            'total_days': 0,
            'total_transactions': 0,
            'avg_rate': 0.0,
            'overtime_types': {}
        }

        # Initialize all days
        for day in range(1, days_in_month + 1):
            overtime_matrix[day] = {
                'date': f"{year}-{month:02d}-{day:02d}",
                'has_overtime': False,
                'total_hours': 0.0,
                'total_amount': 0.0,
                'transactions': []
            }

        try:
            # Get detailed overtime using JSON query
            query = queries.get('payroll_dynamic', 'lembur_detail')
            if query:
                # Use fallback logic for table suffix
                now = datetime.now()
                is_past = year < now.year or (year == now.year and month < now.month)
                suffixes = ["_ARC", ""] if is_past else ["", "_ARC"]

                rows = []
                for suffix in suffixes:
                    try:
                        final_query = query['sql'].format(table_suffix=suffix)
                        rows = self.db.execute_query(final_query, [emp_code, start_date, end_date])
                        if rows and len(rows) > 0:
                            break
                    except Exception as e:
                        logger.warning(f"Overtime query failed with suffix '{suffix}': {e}")
                        continue

                # Process results
                total_rate_sum = 0.0
                rate_count = 0

                for row in rows:
                    day = row[0]
                    overtime_date = str(row[1])[:10] if row[1] else f"{year}-{month:02d}-{day:02d}"
                    hours = float(row[2]) if row[2] else 0.0
                    amount = float(row[3]) if row[3] else 0.0
                    rate = float(row[4]) if row[4] else 0.0
                    task_code = row[5] if row[5] else ''
                    normal_day = row[6] if row[6] else 1
                    shift_code = row[7] if row[7] else ''
                    description = row[8] if row[8] else ''
                    day_type = row[9] if row[9] else 'Hari Kerja'

                    # Create transaction detail
                    transaction = {
                        'date': overtime_date,
                        'hours': hours,
                        'amount': amount,
                        'rate': rate,
                        'task_code': task_code,
                        'normal_day': normal_day,
                        'shift_code': shift_code,
                        'description': description,
                        'day_type': day_type
                    }

                    # Update matrix
                    if day in overtime_matrix:
                        overtime_matrix[day]['has_overtime'] = True
                        overtime_matrix[day]['total_hours'] += hours
                        overtime_matrix[day]['total_amount'] += amount
                        overtime_matrix[day]['transactions'].append(transaction)

                    # Update summary
                    summary['total_hours'] += hours
                    summary['total_amount'] += amount
                    summary['total_transactions'] += 1

                    if rate > 0:
                        total_rate_sum += rate
                        rate_count += 1

                    # Track overtime types
                    if description not in summary['overtime_types']:
                        summary['overtime_types'][description] = {
                            'days': set(),
                            'hours': 0.0,
                            'amount': 0.0,
                            'transactions': 0
                        }

                    summary['overtime_types'][description]['days'].add(day)
                    summary['overtime_types'][description]['hours'] += hours
                    summary['overtime_types'][description]['amount'] += amount
                    summary['overtime_types'][description]['transactions'] += 1

                # Calculate average rate
                if rate_count > 0:
                    summary['avg_rate'] = total_rate_sum / rate_count

                # Count total days with overtime
                summary['total_days'] = len([d for d in overtime_matrix.values() if d['has_overtime']])

                # Convert sets to counts for overtime types
                for ot_type in summary['overtime_types']:
                    summary['overtime_types'][ot_type]['days'] = len(summary['overtime_types'][ot_type]['days'])

            # Get overtime summary from JSON query
            summary_query = queries.get('payroll_dynamic', 'lembur_summary_employee')
            if summary_query:
                # Use same fallback logic
                for suffix in suffixes:
                    try:
                        final_summary_query = summary_query['sql'].format(table_suffix=suffix)
                        summary_rows = self.db.execute_query(final_summary_query, [emp_code, start_date, end_date])
                        if summary_rows and len(summary_rows) > 0:
                            srow = summary_rows[0]
                            # Update summary with query results
                            summary['total_days'] = int(srow[0]) if srow[0] else 0
                            summary['total_hours'] = float(srow[1]) if srow[1] else 0.0
                            summary['total_amount'] = float(srow[2]) if srow[2] else 0.0
                            summary['avg_rate'] = float(srow[3]) if srow[3] else 0.0
                            summary['total_transactions'] = int(srow[4]) if srow[4] else 0
                            break
                    except Exception as e:
                        logger.warning(f"Overtime summary query failed with suffix '{suffix}': {e}")
                        continue

        except Exception as e:
            logger.error(f"Failed to get detailed overtime matrix: {e}")

        return {
            'matrix': overtime_matrix,
            'summary': summary,
            'month': month,
            'year': year,
            'emp_code': emp_code
        }

    def get_complete_detailed_matrices(self, emp_code: str, month: int, year: int) -> Dict[str, Any]:
        """
        Get both detailed attendance and overtime matrices using JSON-based queries
        """
        attendance_data = self.get_detailed_attendance_matrix(emp_code, month, year)
        overtime_data = self.get_detailed_overtime_matrix(emp_code, month, year)

        return {
            'emp_code': emp_code,
            'month': month,
            'year': year,
            'attendance': attendance_data,
            'overtime': overtime_data,
            'combined_summary': {
                'working_days': attendance_data['summary']['total_hadir'],
                'overtime_days': overtime_data['summary']['total_days'],
                'total_overtime_hours': overtime_data['summary']['total_hours'],
                'total_overtime_amount': overtime_data['summary']['total_amount']
            }
        }
