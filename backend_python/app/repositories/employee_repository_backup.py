from typing import List, Optional, Dict, Any
from app.services.mssql_service import mssql_service

class EmployeeRepository:
    def __init__(self):
        self.mssql_service = mssql_service

    def list(self, skip: int = 0, limit: int = 100, gang_code: Optional[str] = None, loc_code: Optional[str] = None):
        try:
            if gang_code:
                # Get employees by gang code from database
                db_employees = self.mssql_service.get_employees_by_gang(gang_code, limit)

                # Convert database results to expected format
                employees = []
                for emp in db_employees:
                    employee = {
                        "nik": emp.get("EmpCode", ""),
                        "nama": emp.get("EmpName", ""),
                        "jenis_kelamin": emp.get("Gender", ""),
                        "loc_code": emp.get("LocCode", ""),
                        "gang_code": gang_code,
                        "gaji_pokok": 0  # Will be calculated later
                    }
                    employees.append(employee)

                return employees[skip:skip+limit]
            else:
                # If no gang_code specified, return empty list or get all employees
                return []
        except Exception as e:
            print(f"Error fetching employees from database: {e}")
            # Fallback to empty list
            return []

    def get(self, id: int):
        # Not implemented for database version
        return None

    def create(self, data: Dict[str, Any]):
        # Not implemented for database version
        return None

    def update(self, id: int, data: Dict[str, Any]):
        # Not implemented for database version
        return None

    def delete(self, id: int):
        # Not implemented for database version
        return False
