"""
Division Definition Service
Centralized definition for all divisions including virtual divisions.

Virtual divisions are divisions that don't exist in the database but are
derived from existing divisions by filtering gang codes based on patterns.
"""

import re
import logging
from typing import List, Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)


class DivisionDefinition:
    """
    Centralized division definition with virtual division support.
    
    Virtual Divisions:
    - INF: Gangs from P1A starting with "IN" (Infrastruktur)
    - NRS: Gang "B2N" from P1B (Nursery)
    - WKS_PG: Workshop Parit Gunung - gangs with "workshop" AND "parit" in description
    - WKS_AR: Workshop Air Ruak - gangs with "workshop" AND "air ruak" in description
    """
    
    # Virtual division configurations
    # Each virtual division defines:
    # - name: Display name
    # - source_division: The parent LocCode to get gangs from (None = all)
    # - pattern: Regex pattern to match gang codes
    # - exclude_from_source: If True, matching gangs are excluded from source division
    VIRTUAL_DIVISIONS = {
        "INF": {
            "name": "Infrastruktur",
            "source_division": "P1A",
            "pattern": r"^IN",  # Starts with "IN"
            "exclude_from_source": True,
            "description": "Divisi Infrastruktur - Gang yang dimulai dengan IN"
        },
        "NRS": {
            "name": "Nursery",
            "source_division": "P1B",
            "pattern": r"^B2N$",  # Exact match "B2N"
            "exclude_from_source": True,
            "description": "Divisi Nursery - Gang B2N"
        },
        "WKS_PG": {
            "name": "Workshop Parit Gunung",
            "source_division": None,  # From any division
            "pattern": None,  # No GangCode pattern - only match by Description
            "description_pattern": r"workshop.*(parit|pge|p\.g)",  # Match workshop + parit/PGE/P.G
            "exclude_from_source": True,
            "description": "Divisi Workshop Parit Gunung - Gang dengan Description mengandung 'workshop' DAN 'parit/PGE'"
        },
        "WKS_AR": {
            "name": "Workshop Air Ruak",
            "source_division": None,  # From any division
            "pattern": None,  # No GangCode pattern - only match by Description
            "description_pattern": r"workshop.*(air\s*ruak|are|a\.r)",  # Match workshop + air ruak/ARE/A.R
            "exclude_from_source": True,
            "description": "Divisi Workshop Air Ruak - Gang dengan Description mengandung 'workshop' DAN 'air ruak/ARE'"
        }
    }
    
    # Order of virtual divisions in the list
    # MILL is not a virtual division (doesn't match gangcode patterns)
    # but it's a special division that needs to be added to the list
    VIRTUAL_DIVISION_ORDER = ["INF", "NRS", "WKS_PG", "WKS_AR", "MILL"]
    
    def __init__(self):
        self._cached_real_divisions: Optional[List[str]] = None
        self._cached_all_gangs: Optional[Dict[str, List[Dict[str, Any]]]] = None
    
    def _get_db(self):
        """Get Database instance for queries"""
        from database.services.database import Database
        return Database.instance()
    
    def is_virtual_division(self, division_code: str) -> bool:
        """Check if a division code is a virtual division."""
        # MILL is treated as a special division, not a virtual division
        if division_code.upper() == "MILL":
            return False
        return division_code.upper() in self.VIRTUAL_DIVISIONS
    
    def get_virtual_division_config(self, division_code: str) -> Optional[Dict[str, Any]]:
        """Get configuration for a virtual division."""
        return self.VIRTUAL_DIVISIONS.get(division_code.upper())
    
    def get_source_division(self, virtual_code: str) -> Optional[str]:
        """Get the source (parent) division for a virtual division."""
        config = self.get_virtual_division_config(virtual_code)
        if config:
            return config.get("source_division")
        return None
    
    def get_all_divisions(self, include_virtual: bool = True) -> List[str]:
        """
        Get all divisions including virtual divisions and MILL.
        
        Args:
            include_virtual: If True, includes virtual divisions and MILL
            
        Returns:
            List of division codes, real divisions first, then virtual, then MILL
        """
        try:
            db = self._get_db()
            
            query = """
                SELECT DISTINCT [LocCode]
                FROM [dbo].[HR_GANG]
                WHERE LocCode IS NOT NULL AND LocCode != ''
                ORDER BY [LocCode]
            """
            
            rows = db.query_all(query)
            real_divisions = [row[0].strip() for row in rows if row[0]]
            
            logger.info(f"[DivisionDefinition] Found {len(real_divisions)} real divisions: {real_divisions}")
            
            if include_virtual:
                # Add virtual divisions and MILL at the end
                all_divisions = real_divisions + self.VIRTUAL_DIVISION_ORDER
                logger.info(f"[DivisionDefinition] Including virtual divisions and MILL: {self.VIRTUAL_DIVISION_ORDER}")
                return all_divisions
            
            return real_divisions
            
        except Exception as e:
            logger.error(f"[DivisionDefinition] Error fetching divisions: {e}")
            raise
    
    def get_gangs_for_division(
        self, 
        division_code: str,
        exclude_virtual_gangs: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Get gangs for a division, including virtual division handling.
        
        For real divisions, if exclude_virtual_gangs is True, gangs that belong
        to virtual divisions will be excluded.
        
        For virtual divisions, returns only gangs matching the pattern.
        
        Args:
            division_code: Division code (real or virtual)
            exclude_virtual_gangs: If True, exclude gangs that belong to virtual divisions
            
        Returns:
            List of gang dictionaries with gang_code, description, loc_code
        """
        division_upper = division_code.strip().upper()
        
        if self.is_virtual_division(division_upper):
            return self._get_virtual_division_gangs(division_upper)
        else:
            return self._get_real_division_gangs(division_upper, exclude_virtual_gangs)
    
    def _get_real_division_gangs(
        self, 
        loc_code: str, 
        exclude_virtual: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Get gangs for a real division from HR_GANG table.
        
        Args:
            loc_code: The LocCode to filter by
            exclude_virtual: If True, exclude gangs that belong to virtual divisions
        """
        try:
            db = self._get_db()
            
            loc_code_cleaned = loc_code.strip().upper()
            
            query = """
                SELECT [GangCode], [Description], [LocCode]
                FROM [dbo].[HR_GANG]
                WHERE RTRIM(LTRIM(UPPER(LocCode))) = ?
                ORDER BY [GangCode]
            """
            
            rows = db.query_all(query, (loc_code_cleaned,))
            
            results = []
            for row in rows:
                gang_code = row[0].strip() if row[0] else ""
                description = row[1].strip() if row[1] else ""
                
                # Check if this gang should be excluded (belongs to virtual division)
                if exclude_virtual and self._gang_belongs_to_virtual(gang_code, loc_code_cleaned, description):
                    logger.debug(f"[DivisionDefinition] Excluding gang {gang_code} from {loc_code_cleaned} (belongs to virtual)")
                    continue
                
                results.append({
                    "gang_code": gang_code,
                    "description": description,
                    "loc_code": row[2].strip() if row[2] else ""
                })
            
            logger.info(f"[DivisionDefinition] Found {len(results)} gangs for real division '{loc_code_cleaned}'")
            
            return results
            
        except Exception as e:
            logger.error(f"[DivisionDefinition] Error fetching gangs for '{loc_code}': {e}")
            raise
    
    def _get_virtual_division_gangs(self, virtual_code: str) -> List[Dict[str, Any]]:
        """
        Get gangs for a virtual division by applying pattern matching.
        Matches by GangCode pattern OR Description pattern.
        
        Args:
            virtual_code: Virtual division code (INF, NRS, WKS)
        """
        config = self.get_virtual_division_config(virtual_code)
        if not config:
            logger.warning(f"[DivisionDefinition] Unknown virtual division: {virtual_code}")
            return []
        
        pattern = config.get("pattern", "")
        description_pattern = config.get("description_pattern", "")  # New: pattern for Description
        source_division = config.get("source_division")
        
        try:
            db = self._get_db()
            
            # Build query based on source division
            if source_division:
                query = """
                    SELECT [GangCode], [Description], [LocCode]
                    FROM [dbo].[HR_GANG]
                    WHERE RTRIM(LTRIM(UPPER(LocCode))) = ?
                    ORDER BY [GangCode]
                """
                rows = db.query_all(query, (source_division,))
            else:
                # Get from all divisions
                query = """
                    SELECT [GangCode], [Description], [LocCode]
                    FROM [dbo].[HR_GANG]
                    WHERE LocCode IS NOT NULL AND LocCode != ''
                    ORDER BY [GangCode]
                """
                rows = db.query_all(query)
            
            results = []
            code_regex = re.compile(pattern, re.IGNORECASE) if pattern else None
            desc_regex = re.compile(description_pattern, re.IGNORECASE) if description_pattern else None
            
            for row in rows:
                gang_code = row[0].strip() if row[0] else ""
                description = row[1].strip() if row[1] else ""
                
                # Match by GangCode pattern OR Description pattern
                code_match = code_regex.search(gang_code) if code_regex else False
                desc_match = desc_regex.search(description) if desc_regex else False
                
                if code_match or desc_match:
                    results.append({
                        "gang_code": gang_code,
                        "description": description,
                        "loc_code": virtual_code,  # Use virtual code as loc_code
                        "source_loc_code": row[2].strip() if row[2] else ""  # Original loc_code
                    })
            
            logger.info(f"[DivisionDefinition] Found {len(results)} gangs for virtual division '{virtual_code}' (code_pattern: {pattern}, desc_pattern: {description_pattern})")
            
            return results
            
        except Exception as e:
            logger.error(f"[DivisionDefinition] Error fetching gangs for virtual division '{virtual_code}': {e}")
            raise
    
    def _gang_belongs_to_virtual(self, gang_code: str, source_loc_code: str, description: str = "") -> bool:
        """
        Check if a gang code belongs to any virtual division.
        
        Args:
            gang_code: The gang code to check
            source_loc_code: The source LocCode of the gang
            description: The gang description (optional)
            
        Returns:
            True if gang belongs to a virtual division
        """
        for virt_code, config in self.VIRTUAL_DIVISIONS.items():
            if not config.get("exclude_from_source", False):
                continue
            
            pattern = config.get("pattern", "")
            description_pattern = config.get("description_pattern", "")
            source_division = config.get("source_division")
            
            # Check if source matches (None means any source)
            if source_division and source_division.upper() != source_loc_code.upper():
                continue
            
            # Check pattern match on GangCode
            if pattern:
                code_regex = re.compile(pattern, re.IGNORECASE)
                if code_regex.search(gang_code):
                    return True
            
            # Check pattern match on Description
            if description_pattern and description:
                desc_regex = re.compile(description_pattern, re.IGNORECASE)
                if desc_regex.search(description):
                    return True
        
        return False
    
    def get_division_info(self, division_code: str) -> Dict[str, Any]:
        """
        Get information about a division.
        
        Returns:
            Dict with name, is_virtual, source_division, description
        """
        division_upper = division_code.strip().upper()
        
        if self.is_virtual_division(division_upper):
            config = self.get_virtual_division_config(division_upper)
            return {
                "code": division_upper,
                "name": config.get("name", division_upper),
                "is_virtual": True,
                "source_division": config.get("source_division"),
                "description": config.get("description", ""),
                "pattern": config.get("pattern", "")
            }
        else:
            return {
                "code": division_upper,
                "name": division_upper,
                "is_virtual": False,
                "source_division": None,
                "description": f"Divisi {division_upper}"
            }
    
    def get_virtual_division_gangs_mapping(self) -> Dict[str, List[str]]:
        """
        Get mapping of virtual division code to list of gang codes.
        
        Returns:
            Dict like {"INF": ["INA", "INB"], "NRS": ["B2N"], ...}
        """
        mapping = {}
        for virt_code in self.VIRTUAL_DIVISION_ORDER:
            gangs = self.get_gangs_for_division(virt_code)
            mapping[virt_code] = [g["gang_code"] for g in gangs]
        return mapping


# Singleton instance
division_definition = DivisionDefinition()


# Convenience functions for backward compatibility
def get_divisions_with_virtual() -> List[str]:
    """Get all divisions including virtual ones."""
    return division_definition.get_all_divisions(include_virtual=True)


def get_gangs_by_division(division_code: str) -> List[Dict[str, Any]]:
    """Get gangs for a division (real or virtual)."""
    return division_definition.get_gangs_for_division(division_code)


def is_virtual_division(division_code: str) -> bool:
    """Check if division is virtual."""
    return division_definition.is_virtual_division(division_code)
