from typing import List, Optional
from database.services.database import Database
from database.services.cache import Cache
from database.services.queries import Queries

DIVMAP = {
    'PG1A': 'A', 'PG1B': 'B', 'PG2A': 'C', 'PG2B': 'D', 'DME': 'E', 'ARA': 'F',
    'ARB1': 'G', 'ARB2': 'H', 'INFRA': 'I', 'AREC': 'J', 'IJL': 'IJL', 'STF-OFFICE': 'STF', 'SECURITY': 'SEC'
}

class GangRepositoryDB:
    def __init__(self):
        self.db = Database.instance()
        self.cache = Cache.instance()
        self.queries = Queries()

    def list_codes(self, division: Optional[str] = None, force: bool = False) -> List[str]:
        key = f"gangs:{division or 'all'}"
        if not force:
            cached = self.cache.get(key)
            if cached is not None:
                return cached
        try:
            if division:
                prefix = DIVMAP.get(division)
                if not prefix:
                    return []
                q = self.queries.get('gangs', 'gangs_by_prefix')
                rows = self.db.query_all(q['sql'], (prefix + '%',))
            else:
                q = self.queries.get('gangs', 'gangs_all')
                rows = self.db.query_all(q['sql'])
            codes = [r[0] for r in rows]
            self.cache.set(key, codes, ttl=300)
            return codes
        except Exception:
            return []

    def list_codes_by_loc_code(self, loc_code: str, force: bool = False) -> List[str]:
        key = f"gangs_loc:{(loc_code or '').upper()}"
        if not force:
            cached = self.cache.get(key)
            if cached is not None:
                return cached
        try:
            q = self.queries.get('gangs', 'gangs_by_loc_code')
            rows = self.db.query_all(q['sql'], (str(loc_code or '').upper(),))
            codes = [str(r[0]).strip() for r in rows]
            self.cache.set(key, codes, ttl=300)
            return codes
        except Exception:
            return []

    def list(self, division: Optional[str] = None) -> List[dict]:
        try:
            if division:
                prefix = DIVMAP.get(division)
                if not prefix:
                    return []
                q = self.queries.get('gangs', 'gangs_with_desc_by_prefix')
                rows = self.db.query_all(q['sql'], (prefix + '%',))
            else:
                q = self.queries.get('gangs', 'gangs_all_with_desc')
                rows = self.db.query_all(q['sql'], ())
            return [{"code": r[0], "description": r[1]} for r in rows]
        except Exception:
            return []

    def get_details(self, gang_code: str) -> Optional[dict]:
        try:
            sql = 'SELECT g."GangCode", g."Description", g."LocCode" FROM "HR_GANG" g WHERE UPPER(g."GangCode") = UPPER(?)'
            row = self.db.query_one(sql, (str(gang_code or '').strip(),))
            if not row:
                return None
            return {"gang_code": str(row[0]).strip(), "description": str(row[1]).strip() if row[1] is not None else '', "loc_code": str(row[2]).strip() if row[2] is not None else ''}
        except Exception:
            return None
