"""
MSSQL Service - API Gateway Version
This is a wrapper around the Database class for backward compatibility.
All direct pyodbc connections have been replaced with API Gateway calls.
"""
from typing import List, Dict, Any, Optional
from database.services.database import Database


class MSSQLService:
    """
    MSSQL Service using API Gateway.
    Maintains same interface as legacy version for backward compatibility.
    """
    
    def __init__(self, config_path: str = None):
        # Use the Database singleton which now uses API Gateway
        self._db = Database.instance()
    
    def execute_query(self, query: str, params: tuple = None) -> List[Dict[str, Any]]:
        """
        Execute SQL query and return results as list of dictionaries.
        This maintains compatibility with code expecting Dict results.
        """
        try:
            rows = self._db.query_all(query, params)
            
            # We need to convert tuples back to dicts if columns are needed
            # This requires knowing the column names from the query
            # For now, return tuples wrapped in a simple dict structure
            return [{"row": row} for row in rows]
            
        except Exception as e:
            raise Exception(f"Failed to execute query: {e}")
    
    def execute_query_v2(self, query: str, params: tuple = None) -> List[tuple]:
        """
        Execute SQL query and return results as list of tuples.
        This is a simpler version that returns raw tuples.
        """
        return self._db.query_all(query, params)

    def get_employees_by_gang(self, gang_code: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get employees by gang code"""
        query = f'''
            SELECT TOP {limit}
                "HR_EMPLOYEE"."EmpCode",
                "HR_EMPLOYEE"."EmpName",
                "HR_EMPLOYEE"."Gender",
                "HR_EMPLOYEE"."LocCode"
            FROM "HR_EMPLOYEE"
            JOIN "HR_GANGLN" ON "HR_GANGLN"."GangMember" = "HR_EMPLOYEE"."EmpCode"
            WHERE "HR_GANGLN"."GangCode" = ?
            ORDER BY "HR_EMPLOYEE"."EmpName"
        '''
        
        rows = self._db.query_all(query, (gang_code,))
        return [
            {
                "EmpCode": row[0],
                "EmpName": row[1],
                "Gender": row[2],
                "LocCode": row[3]
            }
            for row in rows
        ]

    def get_all_gangs(self) -> List[Dict[str, Any]]:
        """Get all available gang codes"""
        query = '''
            SELECT DISTINCT
                "HR_GANGLN"."GangCode",
                COUNT("HR_GANGLN"."GangMember") as member_count
            FROM "HR_GANGLN"
            GROUP BY "HR_GANGLN"."GangCode"
            ORDER BY "HR_GANGLN"."GangCode"
        '''
        
        rows = self._db.query_all(query)
        return [
            {
                "GangCode": row[0],
                "member_count": row[1]
            }
            for row in rows
        ]

    def test_connection(self) -> bool:
        """Test database connection via API Gateway health check"""
        return self._db.test_connection()

    def close_connection(self):
        """No-op in API Gateway mode - connections handled by httpx client"""
        pass
    
    def get_connection_string(self) -> str:
        """Legacy method - returns API Gateway URL for debugging"""
        import os
        return f"API Gateway: {os.getenv('DB_API_URL', 'http://localhost:8001')}"

    def get_connection(self):
        """Legacy method - returns Database instance"""
        return self._db


# Global MSSQL service instance
mssql_service = MSSQLService()
