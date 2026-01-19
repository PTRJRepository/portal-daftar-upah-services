from typing import List, Optional
from sqlalchemy import text
from app.services.mssql_service import mssql_service

class GangService:
    # GangCode to Division mapping sesuai kebutuhan user
    DIVISION_MAPPING = {
        "PG1A": ["A"],
        "PG1B": ["B"],
        "PG2A": ["C"],
        "PG2B": ["D"],
        "DME": ["E"],
        "ARA": ["F"],
        "ARB1": ["G"],
        "ARB2": ["H"],
        "INFRA": ["I"],
        "AREC": ["J"],
        "IJL": ["L"],
        "STF-OFFICE": ["O"],
        "SECURITY": ["SEC"]
    }

    # Mapping from old division names to HR_GANG LocCode
    # This handles the case where user.divisions contains legacy names
    DIVISION_TO_LOCCODE = {
        "PG1A": "P1A",
        "PG1B": "P1B",
        "PG2A": "P2A",
        "PG2B": "P2B",
        "PGE": "PGE",
        "DME": "DME",
        "ARA": "ARA",
        "ARC": "ARC",
        "ARB1": "AB1",
        "ARB2": "AB2",
        "IJL": "IJL",
    }

    # Reverse mapping for lookup
    PREFIX_TO_DIVISION = {}
    for division, prefixes in DIVISION_MAPPING.items():
        for prefix in prefixes:
            PREFIX_TO_DIVISION[prefix] = division

    def __init__(self):
        self.mssql_service = mssql_service

    def convert_division_to_loccode(self, division: str) -> str:
        """
        Convert legacy division name to HR_GANG LocCode.
        E.g., PG1A -> P1A, PG2B -> P2B
        If already a valid LocCode, returns as-is.
        """
        if not division:
            return division
        
        division_upper = division.strip().upper()
        
        # Check if it's already a valid LocCode
        try:
            from app.services.summary_service import get_divisions_from_hr_gang
            valid_loccodes = get_divisions_from_hr_gang()
            if division_upper in valid_loccodes:
                return division_upper
        except Exception:
            pass
        
        # Try conversion mapping
        if division_upper in self.DIVISION_TO_LOCCODE:
            return self.DIVISION_TO_LOCCODE[division_upper]
        
        # Return as-is if no mapping found
        return division_upper


    def get_all_divisions(self, include_virtual: bool = True) -> List[str]:
        """Get list of all available divisions (LocCodes) from HR_GANG table, including virtual divisions"""
        try:
            # Use DivisionDefinition for centralized division management
            from app.services.division_definition import division_definition
            divisions = division_definition.get_all_divisions(include_virtual=include_virtual)
            return divisions
        except Exception as e:
            print(f"[ERROR] Failed to get divisions: {e}")
            # Return empty list on error - no more hardcoded fallback
            return []
    
    def get_sub_divisions(self) -> List[str]:
        """Get a unique list of sub-divisions (first 2 chars of GangCode)."""
        try:
            query = text("SELECT DISTINCT SUBSTRING(GangCode, 1, 2) as sub_division FROM HR_GANG ORDER BY sub_division")
            result = self.mssql_service.execute_query_v2(query)
            # result is a list of tuples/rows, e.g., [('A1',), ('A2',)]
            sub_divisions = [row[0] for row in result if row and row[0]]
            return sub_divisions
        except Exception as e:
            print(f"[ERROR] Failed to get sub-divisions: {e}")
            return []

    def get_divisions_for_prefix(self, gang_code: str) -> Optional[str]:
        """Get division for a specific gang code prefix"""
        if not gang_code:
            return None

        up = gang_code.upper()
        if up.startswith('SEC'):
            return "SECURITY"
        if up.startswith('L'):
            return "IJL"
        if up.startswith('O'):
            return "STF-OFFICE"
        first_char = up[0]
        return self.PREFIX_TO_DIVISION.get(first_char)

    def get_gang_prefixes_for_division(self, division: str) -> List[str]:
        """Get gang code prefixes for a specific division"""
        return self.DIVISION_MAPPING.get(division, [])

    def filter_gangs_by_division(self, gangs: List[str], division: str) -> List[str]:
        """Filter gang list by division"""
        if not division:
            return gangs

        prefixes = self.get_gang_prefixes_for_division(division)
        if not prefixes:
            return []

        filtered_gangs = []
        for gang in gangs:
            gang_upper = gang.upper()
            # Check if gang starts with any of the division prefixes
            for prefix in prefixes:
                if gang_upper.startswith(prefix):
                    filtered_gangs.append(gang)
                    break

        return sorted(list(set(filtered_gangs)))  # Remove duplicates and sort

    def fetch_gangs_from_database(self, division: Optional[str] = None, search: Optional[str] = None, force: bool = False) -> List[dict]:
        """
        Fetch gangs from database with optional division filtering and LIKE search.

        Args:
            division: Filter gangs by division (LocCode from HR_GANG, e.g., 'P2B')
            search: Search term with LIKE operator (flexible search)
            force: Force refresh from database, ignore cache

        Returns:
            List of dicts {'gang_code': str, 'description': str} filtered and searched
        """
        try:
            print(f"[DEBUG] Fetching gangs from database - division: {division}, search: {search}, force: {force}")

            # Use HR_GANG query via summary_service if division (LocCode) is provided
            if division:
                # Convert legacy division name to LocCode (e.g., PG1A -> P1A, PG2B -> P2B)
                loc_code = self.convert_division_to_loccode(division)
                print(f"[DEBUG] Converted division '{division}' to LocCode: '{loc_code}'")
                
                try:
                    from app.services.summary_service import get_gangs_by_loc_code
                    gangs_data = get_gangs_by_loc_code(loc_code)
                    # gangs_data is [{'gang_code': '...', 'description': '...', 'loc_code': '...'}, ...]
                    normalized_gangs = [
                        {'gang_code': g['gang_code'], 'description': g['description'] or ''}
                        for g in gangs_data
                    ]
                    print(f"[DEBUG] Got {len(normalized_gangs)} gangs from HR_GANG for LocCode: {division}")
                except Exception as e:
                    print(f"[WARN] Failed to get gangs from HR_GANG for LocCode {division}: {e}")
                    # Fallback to repository method
                    from app.repositories.gang_repository_db import GangRepositoryDB
                    repo = GangRepositoryDB()
                    gangs_data = repo.list(division=None)
                    normalized_gangs = [
                        {'gang_code': g['code'], 'description': g['description'] or ''}
                        for g in gangs_data
                    ]
                    # Apply prefix-based filtering as fallback
                    prefixes = self.get_gang_prefixes_for_division(division)
                    if prefixes:
                        filtered_gangs = []
                        for g in normalized_gangs:
                            code = g['gang_code'].upper()
                            for prefix in prefixes:
                                if code.startswith(prefix):
                                    filtered_gangs.append(g)
                                    break
                        normalized_gangs = filtered_gangs
            else:
                # Fetch all gangs if no division specified
                from app.repositories.gang_repository_db import GangRepositoryDB
                repo = GangRepositoryDB()
                gangs_data = repo.list(division=None)
                normalized_gangs = [
                    {'gang_code': g['code'], 'description': g['description'] or ''}
                    for g in gangs_data
                ]

            print(f"[DEBUG] Got {len(normalized_gangs)} rows from database")

            # Apply search filter if provided (case-insensitive LIKE)
            if search and normalized_gangs:
                search_term = search.upper().strip()
                final_gangs = []
                for g in normalized_gangs:
                    code = g['gang_code'].upper()
                    desc = g['description'].upper()
                    if search_term in code or search_term in desc:
                        final_gangs.append(g)
                normalized_gangs = final_gangs
                print(f"[DEBUG] After search filter '{search_term}': {len(normalized_gangs)} codes")

            # Sort results by gang_code
            result = sorted(normalized_gangs, key=lambda x: x['gang_code'])
            print(f"[DEBUG] Final result count: {len(result)}")
            return result

        except Exception as e:
            print(f"[ERROR] Error fetching gangs from database: {e}")
            import traceback
            traceback.print_exc()
            # Fallback to mock data if database fails
            return self.get_mock_gangs_data(division, search)

    def get_mock_gangs_data(self, division: Optional[str] = None, search: Optional[str] = None) -> List[dict]:
        """Fallback mock data when database is unavailable"""
        mock_codes = [
            # PG1A Division (A)
            "A001", "A002", "A003", "A101", "A102", "A201", "A202",
            # PG1B Division (B)
            "B001", "B002", "B003", "B101", "B102", "B201", "B202",
            # ... (Truncated for brevity, assuming simple list for mock)
            "H1H", "H1M", "H1T"
        ]
        
        # Convert to dicts
        mock_gangs = [{'gang_code': c, 'description': f'Mock Description for {c}'} for c in mock_codes]

        # Apply filters logic similar to above
        if division:
            prefixes = self.get_gang_prefixes_for_division(division)
            if prefixes:
                mock_gangs = [g for g in mock_gangs if any(g['gang_code'].upper().startswith(p) for p in prefixes)]
            else:
                mock_gangs = []

        if search:
            s = search.upper()
            mock_gangs = [g for g in mock_gangs if s in g['gang_code'].upper()]

        return sorted(mock_gangs, key=lambda x: x['gang_code'])

    def get_gang_info(self, gang_code: str) -> dict:
        """Get detailed information about a specific gang"""
        division = self.get_divisions_for_prefix(gang_code)
        try:
            from app.repositories.gang_repository_db import GangRepositoryDB
            repo = GangRepositoryDB()
            details = repo.get_details(gang_code) or {}
        except Exception:
            details = {}

        return {
            "gang_code": gang_code,
            "division": division,
            "prefix": gang_code[0] if gang_code else None,
            "is_security": gang_code.upper().startswith('SEC') if gang_code else False,
            "description": details.get("description", ""),
            "loc_code": details.get("loc_code", "")
        }

    def fetch_gangs_by_loc_code(self, loc_code: str, force: bool = False) -> List[str]:
        """Fetch gangs strictly by LocCode using HR_GANG table"""
        try:
            from app.repositories.gang_repository_db import GangRepositoryDB
            repo = GangRepositoryDB()
            codes = repo.list_codes_by_loc_code(loc_code=loc_code, force=force)
            return sorted(codes)
        except Exception as e:
            print(f"[ERROR] fetch_gangs_by_loc_code failed: {e}")
            return []
