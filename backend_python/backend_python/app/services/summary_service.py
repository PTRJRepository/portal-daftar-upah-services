"""
Summary Report Service
Connects to databases via API Gateway to fetch aggregation data.

Uses Database.for_database() for accessing different databases:
- db_ptrj: main database (via Database.instance())
- extend_db_ptrj: aggregation database (via Database.for_database('extend_db_ptrj'))
"""

import os
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


def _get_db_ptrj():
    """Get Database instance for db_ptrj (main database)"""
    from database.services.database import Database
    return Database.instance()


def _get_extend_db():
    """
    Get Database instance for extend_db_ptrj (aggregation database).
    ALWAYS uses SERVER_PROFILE_1 (dev server) for reports, regardless of backend RUN_MODE.
    """
    from database.services.database import Database
    return Database.for_reports('extend_db_ptrj')


def _get_venus_hr_db():
    """
    Get Database instance for VenusHR14 (Mill payroll database).
    ALWAYS uses SERVER_PROFILE_1 (dev server) for reports, regardless of backend RUN_MODE.
    """
    from database.services.database import Database
    return Database.for_reports('VenusHR14')


def _load_november_2025_override_data() -> List[Dict[str, Any]]:
    """
    Load November 2025 override data from JSON file.
    This data is used in comparison mode when previous month is November 2025.
    Returns list of division summary data from JSON.
    """
    import json
    from pathlib import Path
    
    try:
        json_path = Path(__file__).parent.parent / "data" / "november_summary_report.json"
        if not json_path.exists():
            logger.warning(f"[SummaryService] November 2025 override JSON not found: {json_path}")
            return []
        
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        logger.info(f"[SummaryService] Loaded {len(data)} divisions from November 2025 override JSON")
        return data
    except Exception as e:
        logger.error(f"[SummaryService] Failed to load November 2025 override JSON: {e}")
        return []


def _load_thumbprint_data(month: int, year: int) -> Dict[str, float]:
    """
    Load thumbprint data from JSON file for a specific month/year.
    Currently only supports December 2025.
    Returns dict mapping division_code -> total_upah_bersih from thumbprint.
    """
    import json
    from pathlib import Path
    
    # Mapping from thumbprint codes to system codes
    # Updated to match current desember_thumbprint.json format
    THUMBPRINT_TO_SYSTEM = {
        # These codes already match system codes in the JSON
        "P1A": "P1A",
        "P1B": "P1B",
        "P2A": "P2A",
        "P2B": "P2B",
        "DME": "DME",
        "ARA": "ARA",
        "AB1": "AB1",
        "AB2": "AB2",
        "ARC": "ARC",
        "MILL": "MILL",
        "NRS": "NRS",
        "INF": "INF",
        "WKS_AR": "WKS_AR",
        "IJL": "IJL",
        # Special mapping - thumbprint has WPGE, system uses WKS_PG
        "WPGE": "WKS_PG",
    }
    
    # Only December 2025 has thumbprint data for now
    if month != 12 or year != 2025:
        return {}
    
    try:
        json_path = Path(__file__).parent.parent / "data" / "desember_thumbprint.json"
        if not json_path.exists():
            logger.warning(f"[SummaryService] Thumbprint JSON not found: {json_path}")
            return {}
        
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        # Build mapping with system division codes
        result = {}
        for item in data:
            thumb_code = item.get("estate_division_code", "")
            system_code = THUMBPRINT_TO_SYSTEM.get(thumb_code, thumb_code)
            upah = float(item.get("total_upah_bersih", 0))
            
            # Handle duplicate codes (P2B appears twice) - accumulate values
            if system_code in result:
                result[system_code] += upah
            else:
                result[system_code] = upah
        
        logger.info(f"[SummaryService] Loaded thumbprint data for {month}/{year}: {len(result)} divisions")
        return result
    except Exception as e:
        logger.error(f"[SummaryService] Failed to load thumbprint JSON: {e}")
        return {}


def _get_november_2025_division_data() -> List[Dict[str, Any]]:
    """
    Get November 2025 division data in the same format as get_all_divisions_premi_totals.
    Uses estate_division_code field directly from JSON for accurate mapping.
    Fetches TBS weight from aggregation table.
    """
    json_data = _load_november_2025_override_data()
    if not json_data:
        return []
    
    # Get descriptions from database
    descriptions = get_division_descriptions()
    
    # Fetch TBS weights from aggregation table for November 2025
    tbs_weights = {}
    try:
        query = """
            SELECT division_code, MAX(ISNULL(total_ffb_weight, 0)) as total_ffb_weight
            FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = 11 AND period_year = 2025 AND division_code IS NOT NULL
            GROUP BY division_code
        """
        rows = _get_extend_db().query_all(query, ())
        for row in rows:
            if row[0]:
                tbs_weights[str(row[0]).strip()] = float(row[1] or 0)
        logger.info(f"[SummaryService] Fetched TBS weights for Nov 2025: {tbs_weights}")
    except Exception as e:
        logger.warning(f"[SummaryService] Failed to fetch TBS weights for Nov 2025: {e}")
    
    results = []
    for item in json_data:
        # Use estate_division_code directly from JSON
        division_code = item.get("estate_division_code", "")
        division_name = item.get("estate_division", "")
        
        if not division_code:
            logger.warning(f"[SummaryService] Missing division code for: {division_name}")
            continue
        
        # Get TBS weight from aggregation table (not from JSON)
        tbs_weight = tbs_weights.get(division_code, 0)
        
        results.append({
            "division_code": division_code,
            "description": descriptions.get(division_code, division_name),
            "total_premi": float(item.get("total_premi", 0)),
            "total_employees": int(item.get("workers", 0)),
            "total_hk": float(item.get("hk_cekroll", 0)),
            "total_upah_bersih": float(item.get("total_upah_bersih", 0)),
            "total_pph21": float(item.get("total_pph21", 0)),
            "total_spsi": float(item.get("pot_spsi", 0)),
            "total_lembur": float(item.get("total_lembur", 0)),
            "total_gangs": 0,  # Not available in JSON
            "total_premi_prunning": float(item.get("pruning", 0)),  # Mapped from JSON
            "total_ffb_weight": tbs_weight,  # From aggregation table, NOT JSON
            "thumb_print": float(item.get("total_upah_bersih", 0)),
            "total_manual": float(item.get("total_upah_bersih", 0)),
            "selisih": float(item.get("selisih", 0)),
            "is_subtotal": False,
            "is_grand_total": False,
            "group": division_code[0] if division_code else ""
        })
    
    logger.info(f"[SummaryService] Mapped {len(results)} divisions from November 2025 JSON")
    return results


def get_mill_pks_totals(month: int, year: int) -> Dict[str, Any]:
    """
    [DEPRECATED] Fetch Mill PKS (Pabrik) aggregated payroll data from VenusHR14.
    
    **THIS FUNCTION IS NOW DEPRECATED.**
    Mill PKS data is now seeded into daftar_upah_aggregation_history table 
    with division_code='MILL' and gang_code='MILL_PKS' by the aggregation seeder.
    
    Use get_all_divisions_premi_totals() or get_division_summary() instead,
    which will automatically include Mill data from the aggregation table.
    
    This function is kept temporarily for backward compatibility with the /mill-totals endpoint.
    It will be removed in a future version.
    """
    try:
        db = _get_venus_hr_db()
        
        # Build period pattern: PYW/PTRJ/YYYYMM%
        # Matches PYW/PTRJ/202511/001 etc.
        period_pattern = f"PYW/PTRJ/{year}{str(month).zfill(2)}%"
        
        logger.info(f"[SummaryService] Fetching Mill PKS data for period pattern: {period_pattern}")
        
        # Query 1: Total Take Home Pay (Upah Bersih)
        query_thp = """
            SELECT CAST(SUM([CompAmount]) AS BIGINT) AS TotalCompAmount
            FROM [VenusHR14].[dbo].[HR_T_PYWeekly_DComponent]
            WHERE [PYNumber] LIKE @p0
              AND [IsTakeHomePay] = 1
        """
        
        # Query 2: Total PPH21 (Use ABS to ensure positive value)
        query_pph21 = """
            SELECT ABS(SUM([CompAmount])) AS [totalCount]
            FROM [VenusHR14].[dbo].[HR_T_PYWeekly_DComponent]
            WHERE [PYNumber] LIKE @p0
              AND [PYCompCode] LIKE '#PPH21%'
        """
        
        # Query 3: Total SPSI (Use ABS to ensure positive value)
        # Updated based on getTotalAmountSPSIByItsPeriod.sql
        query_spsi = """
            SELECT ABS(SUM([CompAmount])) AS [totalCount]
            FROM [VenusHR14].[dbo].[HR_T_PYWeekly_DComponent]
            WHERE [PYNumber] LIKE @p0
              AND [PYCompCode] LIKE '#POT_spsi%'
        """
        
        # Query 4: Total Lembur (Overtime)
        # Updated based on latest instruction to use PYCompCode
        query_lembur = """
            SELECT SUM([CompAmount]) AS Total_CompAmount
            FROM [VenusHR14].[dbo].[HR_T_PYWeekly_DComponent]
            WHERE [PYNumber] LIKE @p0
              AND [PYCompCode] LIKE '%#OT%'
        """
        
        # Query 5: Total Employees
        # Count distinct employees who have HK > 0 (DaysInMonth - TAAbsence > 0)
        # Note: Assuming HR_T_PYWeekly_M contains monthly records.
        query_employees = """
            SELECT COUNT(DISTINCT m.[EmployeeID])
            FROM [VenusHR14].[dbo].[HR_T_PYWeekly_M] m
            WHERE m.[PYNumber] LIKE @p0
              AND (
                  DAY(EOMONTH(CAST(SUBSTRING(m.[PYNumber], 10, 6) + '01' AS DATE))) - ISNULL(m.[TAAbsence], 0)
              ) > 0
        """
        
        # Execute queries
        result_thp = db.query_one(query_thp, (period_pattern,))
        result_pph21 = db.query_one(query_pph21, (period_pattern,))
        result_spsi = db.query_one(query_spsi, (period_pattern,))
        result_lembur = db.query_one(query_lembur, (period_pattern,))
        result_employees = db.query_one(query_employees, (period_pattern,))
        
        # Extract values safely
        total_upah_bersih = float(result_thp[0]) if result_thp and result_thp[0] else 0
        total_pph21 = float(result_pph21[0]) if result_pph21 and result_pph21[0] else 0
        total_spsi = float(result_spsi[0]) if result_spsi and result_spsi[0] else 0
        total_lembur = float(result_lembur[0]) if result_lembur and result_lembur[0] else 0
        total_employees = int(result_employees[0]) if result_employees and result_employees[0] else 0
        
        logger.info(f"[SummaryService] Mill PKS data: employees={total_employees}, upah_bersih={total_upah_bersih}, pph21={total_pph21}, spsi={total_spsi}, lembur={total_lembur}")
        
        # Return as division-like structure
        return {
            "division_code": "MILL",
            "description": "MILL PKS",
            "total_premi": 0,  # Mill doesn't have premi in same structure
            "total_employees": total_employees,
            "total_hk": 0,  # HK not tracked same way for mill
            "total_upah_bersih": total_upah_bersih,
            "total_pph21": total_pph21,
            "total_spsi": total_spsi,
            "total_lembur": total_lembur,
            "total_gangs": 1,  # Single "gang" for mill
            "thumb_print": total_upah_bersih,
            "total_manual": total_upah_bersih,
            "selisih": 0,
            "is_subtotal": False,
            "is_grand_total": False,
            "group": "M"  # Group prefix for frontend
        }
        
    except Exception as e:
        logger.error(f"[SummaryService] Error fetching Mill PKS data: {e}")
        # Return empty/zero data on error instead of raising
        return {
            "division_code": "MILL",
            "description": "MILL PKS",
            "total_premi": 0,
            "total_employees": 0,
            "total_hk": 0,
            "total_upah_bersih": 0,
            "total_pph21": 0,
            "total_spsi": 0,
            "total_lembur": 0,
            "total_gangs": 0,
            "thumb_print": 0,
            "total_manual": 0,
            "selisih": 0,
            "is_subtotal": False,
            "is_grand_total": False,
            "group": "M"
        }


def get_division_summary(
    division_code: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None
) -> List[Dict[str, Any]]:
    """Fetch aggregation data for a division"""
    import json
    
    try:
        db = _get_extend_db()
        
        query = """
            SELECT 
                id, period_month, period_year, division_code, gang_code,
                gang_description, total_employees, total_hk, total_hari_kerja,
                total_cuti_tahunan, total_cuti_sakit, total_cuti_minggu,
                total_cuti_nasional, total_upah_dasar, total_upah_pokok,
                total_gaji_pokok, total_beras, total_jabatan, total_masa_kerja,
                total_lembur, total_tunjangan, total_premi_brondol,
                total_premi_prunning, total_premi, dynamic_premi_data,
                total_koreksi, total_potongan, total_pph21,
                total_bpjs_pekerja, total_bpjs_majikan, total_spsi,
                total_upah_kotor, total_upah_bersih, created_at, updated_at,
                source_endpoint
            FROM dbo.daftar_upah_aggregation_history
            WHERE 1=1
        """
        params = []
        
        if division_code:
            try:
                gangs_for_loc = get_gangs_by_loc_code(division_code)
                if gangs_for_loc:
                    gang_codes = [g['gang_code'] for g in gangs_for_loc if g.get('gang_code')]
                    if gang_codes:
                        placeholders = ','.join(['?' for _ in gang_codes])
                        query += f" AND gang_code IN ({placeholders})"
                        params.extend(gang_codes)
                    else:
                        query += " AND division_code = ?"
                        params.append(division_code)
                else:
                    query += " AND division_code = ?"
                    params.append(division_code)
            except Exception as e:
                logger.warning(f"[SummaryService] Failed to get gangs: {e}")
                query += " AND division_code = ?"
                params.append(division_code)
        
        if month:
            query += " AND period_month = ?"
            params.append(month)
        
        if year:
            query += " AND period_year = ?"
            params.append(year)
        
        query += " ORDER BY division_code, gang_code"
        
        rows = db.query_all(query, tuple(params) if params else None)
        
        columns = [
            'id', 'period_month', 'period_year', 'division_code', 'gang_code',
            'gang_description', 'total_employees', 'total_hk', 'total_hari_kerja',
            'total_cuti_tahunan', 'total_cuti_sakit', 'total_cuti_minggu',
            'total_cuti_nasional', 'total_upah_dasar', 'total_upah_pokok',
            'total_gaji_pokok', 'total_beras', 'total_jabatan', 'total_masa_kerja',
            'total_lembur', 'total_tunjangan', 'total_premi_brondol',
            'total_premi_prunning', 'total_premi', 'dynamic_premi_data',
            'total_koreksi', 'total_potongan', 'total_pph21',
            'total_bpjs_pekerja', 'total_bpjs_majikan', 'total_spsi',
            'total_upah_kotor', 'total_upah_bersih', 'created_at', 'updated_at',
            'source_endpoint'
        ]
        
        all_premi_headers = set()
        raw_results = []
        
        for row in rows:
            record = {}
            for i, col_name in enumerate(columns):
                if i >= len(row):
                    break
                value = row[i]
                
                if col_name == 'dynamic_premi_data' and value:
                    try:
                        premi_list = json.loads(value) if isinstance(value, str) else value
                        record['_dynamic_premi_list'] = premi_list
                        for item in premi_list:
                            if isinstance(item, dict) and 'header' in item:
                                all_premi_headers.add(item['header'])
                    except:
                        record['_dynamic_premi_list'] = []
                    continue
                
                if hasattr(value, 'isoformat'):
                    record[col_name] = value.isoformat()
                elif value is None:
                    record[col_name] = None
                else:
                    try:
                        record[col_name] = float(value) if hasattr(value, '__float__') else str(value).strip() if isinstance(value, str) else value
                    except:
                        record[col_name] = str(value) if value else None
            
            raw_results.append(record)
        
        results = []
        sorted_premi_headers = sorted(all_premi_headers)
        
        for record in raw_results:
            premi_map = {item['header']: item['total'] for item in record.get('_dynamic_premi_list', []) if isinstance(item, dict) and 'header' in item and 'total' in item}
            
            for header in sorted_premi_headers:
                col_key = f"premi_{header.lower().replace(' ', '_').replace('-', '_')}"
                record[col_key] = premi_map.get(header, 0)
            
            record['_premi_headers'] = sorted_premi_headers
            record.pop('_dynamic_premi_list', None)
            
            # DEBUG: Log lembur value for each record
            lembur_val = record.get('total_lembur', 'NOT_FOUND')
            logger.info(f"[SummaryService DEBUG] Gang {record.get('gang_code')}: total_lembur = {lembur_val}")
            
            results.append(record)
        
        logger.info(f"[SummaryService] Found {len(results)} records")
        return results
        
    except Exception as e:
        logger.error(f"[SummaryService] Error fetching summary: {e}")
        raise


def get_available_periods(division_code: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get available periods from aggregation table"""
    try:
        db = _get_extend_db()
        query = "SELECT DISTINCT period_year, period_month FROM dbo.daftar_upah_aggregation_history WHERE 1=1"
        params = []
        if division_code:
            query += " AND division_code = ?"
            params.append(division_code)
        query += " ORDER BY period_year DESC, period_month DESC"
        
        rows = db.query_all(query, tuple(params) if params else None)
        return [{"period_year": row[0], "period_month": row[1]} for row in rows]
    except Exception as e:
        logger.error(f"[SummaryService] Error fetching periods: {e}")
        raise


def get_available_divisions() -> List[str]:
    """Get divisions with aggregation data"""
    try:
        db = _get_extend_db()
        rows = db.query_all("SELECT DISTINCT division_code FROM dbo.daftar_upah_aggregation_history WHERE division_code IS NOT NULL ORDER BY division_code")
        return [row[0].strip() for row in rows if row[0]]
    except Exception as e:
        logger.error(f"[SummaryService] Error fetching divisions: {e}")
        raise


def test_connection() -> bool:
    """Test database connection"""
    try:
        return _get_db_ptrj().test_connection()
    except Exception as e:
        logger.error(f"[SummaryService] Connection test failed: {e}")
        return False


def get_divisions_from_hr_gang(include_virtual: bool = True) -> List[str]:
    """Get divisions from HR_GANG via DivisionDefinition"""
    try:
        from app.services.division_definition import division_definition
        return division_definition.get_all_divisions(include_virtual=include_virtual)
    except Exception as e:
        logger.error(f"[SummaryService] Error: {e}")
        raise


def get_gangs_by_loc_code(loc_code: str, exclude_virtual_gangs: bool = True) -> List[Dict[str, Any]]:
    """Get gangs for a LocCode"""
    try:
        from app.services.division_definition import division_definition
        return division_definition.get_gangs_for_division(loc_code.strip().upper(), exclude_virtual_gangs=exclude_virtual_gangs)
    except Exception as e:
        logger.error(f"[SummaryService] Error: {e}")
        raise


def get_dynamic_premi_headers_by_loc_code(loc_code: str, month: int, year: int) -> List[str]:
    """Get unique premi headers for gangs in a LocCode (uses db_ptrj)"""
    try:
        start_date = f"{year}-{str(month).zfill(2)}-01"
        end_date = f"{year+1}-01-01" if month == 12 else f"{year}-{str(month+1).zfill(2)}-01"
        
        gangs = get_gangs_by_loc_code(loc_code)
        gang_codes = [g['gang_code'] for g in gangs if g.get('gang_code')]
        if not gang_codes:
            return []
        
        placeholders = ','.join(['?' for _ in gang_codes])
        query = f"""
            SELECT DISTINCT t.DocDesc FROM PR_ADTRANS_ARC AS t
            JOIN PR_ADTRANSLN_ARC AS ln ON t.ID = ln.MasterID
            JOIN HR_GANGLN AS g ON g.GangMember = t.EmpCode
            WHERE g.GangCode IN ({placeholders}) AND t.DocDate >= ? AND t.DocDate < ?
            AND COALESCE(ln.Amount, 0) > 0 AND t.DocDesc IS NOT NULL
            AND UPPER(t.DocDesc) NOT LIKE '%PPH%' AND UPPER(t.DocDesc) NOT LIKE '%SPSI%'
            AND UPPER(t.DocDesc) NOT LIKE '%BERAS%' AND UPPER(t.DocDesc) NOT LIKE '%JABATAN%'
            AND UPPER(t.DocDesc) NOT LIKE '%MASA%' AND UPPER(t.DocDesc) NOT LIKE '%KOREKSI%'
            AND UPPER(t.DocDesc) NOT LIKE '%POT%' AND UPPER(t.DocDesc) NOT LIKE '%LEMBUR%'
            AND UPPER(t.DocDesc) NOT LIKE '%BPJS%' AND UPPER(t.DocDesc) NOT LIKE '%ASTEK%'
            ORDER BY t.DocDesc
        """
        
        rows = _get_db_ptrj().query_all(query, tuple(gang_codes + [start_date, end_date]))
        return [row[0].strip() for row in rows if row[0]]
    except Exception as e:
        logger.error(f"[SummaryService] Error: {e}")
        raise


def get_division_descriptions() -> Dict[str, str]:
    """Get division descriptions from Divisi_Description table (extend_db_ptrj)"""
    try:
        rows = _get_extend_db().query_all("SELECT [Divisi], [Description] FROM [dbo].[Divisi_Description] WHERE [Divisi] IS NOT NULL ORDER BY [Divisi]")
        return {row[0].strip(): row[1].strip() if row[1] else row[0].strip() for row in rows if row[0]}
    except Exception as e:
        logger.error(f"[SummaryService] Error: {e}")
        raise


def get_all_divisions_premi_totals(month: int, year: int) -> List[Dict[str, Any]]:
    """Aggregate totals by division (uses extend_db_ptrj) + Mill PKS data"""
    try:
        descriptions = get_division_descriptions()
        # NOTE: total_ffb_weight is stored at division-level (same for all gangs in a division)
        # so we use MAX() instead of SUM() to avoid duplicate counting
        query = """
            SELECT 
                division_code,
                SUM(ISNULL(total_premi, 0)) as total_premi,
                SUM(ISNULL(total_employees, 0)) as total_employees,
                SUM(ISNULL(total_hk, 0)) as total_hk,
                SUM(ISNULL(total_upah_bersih, 0)) as total_upah_bersih,
                SUM(ISNULL(total_pph21, 0)) as total_pph21,
                SUM(ISNULL(total_spsi, 0)) as total_spsi,
                SUM(ISNULL(total_lembur, 0)) as total_lembur,
                COUNT(DISTINCT gang_code) as total_gangs,
                SUM(ISNULL(total_premi_prunning, 0)) as total_premi_prunning,
                MAX(ISNULL(total_ffb_weight, 0)) as total_ffb_weight
            FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = ? AND period_year = ? AND division_code IS NOT NULL
            GROUP BY division_code ORDER BY division_code
        """
        rows = _get_extend_db().query_all(query, (month, year))
        
        # Load thumbprint data for comparison (only for Dec 2025)
        thumbprint_data = _load_thumbprint_data(month, year)
        
        results = []
        for row in rows:
            try:
                # Row is a tuple from dict values, access by index
                # Columns: division_code(0), total_premi(1), total_employees(2), 
                # total_hk(3), total_upah_bersih(4), total_pph21(5), 
                # total_spsi(6), total_lembur(7), total_gangs(8), 
                # total_premi_prunning(9), total_ffb_weight(10)
                if len(row) < 11:
                    logger.warning(f"[SummaryService] Skipping row with insufficient columns: {len(row)}, data: {row}")
                    continue
                
                div = str(row[0]).strip() if row[0] else None
                if not div:
                    continue
                
                upah = float(row[4]) if row[4] else 0
                
                # Get thumbprint value for this division (0 if not found)
                thumb_value = thumbprint_data.get(div, 0)
                # Calculate selisih: Portal - Thumbprint
                selisih_value = upah - thumb_value if thumb_value > 0 else 0
                
                results.append({
                    "division_code": div,
                    "description": descriptions.get(div, div),
                    "total_premi": float(row[1] or 0),
                    "total_employees": int(row[2] or 0),
                    "total_hk": float(row[3] or 0),
                    "total_upah_bersih": upah,
                    "total_pph21": float(row[5] or 0),
                    "total_spsi": float(row[6] or 0),
                    "total_lembur": float(row[7] or 0),
                    "total_gangs": int(row[8] or 0),
                    "total_premi_prunning": float(row[9] or 0),
                    "total_ffb_weight": float(row[10] or 0),
                    "thumb_print": thumb_value,  # From thumbprint JSON
                    "total_manual": upah,
                    "selisih": selisih_value,  # Portal - Thumbprint
                    "is_subtotal": False,
                    "is_grand_total": False,
                    "group": div[0] if div else ""
                })
                # Debug logging for TBS and prunning
                logger.info(f"[SummaryService] Division {div}: prunning={row[9]}, tbs={row[10]}, thumb={thumb_value}, selisih={selisih_value}")
            except (IndexError, TypeError, ValueError) as e:
                logger.warning(f"[SummaryService] Error processing row: {e}, row: {row}")
                continue
        
        # Mill PKS data is now aggregated in daftar_upah_aggregation_history table (division_code='MILL')
        # So we don't need to manually fetch and append it here anymore.
        
        logger.info(f"[SummaryService] get_all_divisions_premi_totals returned {len(results)} results for {month}/{year}")
        return results
    except Exception as e:
        logger.error(f"[SummaryService] Error: {e}")
        raise


def get_all_divisions_comparison(month: int, year: int) -> Dict[str, Any]:
    """
    Fetch comparison data for all divisions between current month and previous month.
    Uses ONLY daftar_upah_aggregation_history table - no external queries.
    TBS weight must be pre-populated in aggregation table by seeder.
    
    Returns comparison data structure with KPI summaries and division-level comparisons.
    """
    # Calculate previous month/year
    prev_month = month - 1 if month > 1 else 12
    prev_year = year if month > 1 else year - 1
    
    # Fetch current month data from aggregation table
    current_data = get_all_divisions_premi_totals(month, year)
    
    # Fetch previous month data - use JSON override for November 2025
    logger.info(f"[SummaryService] Checking prev_month={prev_month}, prev_year={prev_year}")
    if prev_month == 11 and prev_year == 2025:
        logger.info(f"[SummaryService] >>> USING November 2025 JSON override for previous month data <<<")
        previous_data = _get_november_2025_division_data()
        logger.info(f"[SummaryService] JSON returned {len(previous_data)} divisions")
        for d in previous_data[:3]:  # Log first 3 as sample
            logger.info(f"[SummaryService] JSON sample: {d.get('division_code')} = {d.get('total_upah_bersih')}")
        if not previous_data:
            logger.warning("[SummaryService] JSON override failed, falling back to aggregation table")
            previous_data = get_all_divisions_premi_totals(prev_month, prev_year)
    else:
        logger.info(f"[SummaryService] Using aggregation table for previous month data")
        previous_data = get_all_divisions_premi_totals(prev_month, prev_year)
    
    # Create lookup dict for previous data
    prev_lookup = {d['division_code']: d for d in previous_data}
    
    # Merge and calculate trends
    comparison_rows = []
    for curr in current_data:
        div_code = curr['division_code']
        prev = prev_lookup.get(div_code, {})
        
        # Current month values (all from aggregation table)
        curr_workers = curr.get('total_employees', 0)
        curr_gaji = curr.get('total_upah_bersih', 0)
        curr_tbs = curr.get('total_ffb_weight', 0)  # From existing aggregation column
        curr_pph21 = curr.get('total_pph21', 0)
        curr_spsi = curr.get('total_spsi', 0)
        curr_premi = curr.get('total_premi', 0)
        curr_prunning = curr.get('total_premi_prunning', 0)
        curr_lembur = curr.get('total_lembur', 0)
        curr_thumb_print = curr.get('thumb_print', 0)  # From thumbprint JSON
        
        # Previous month values (all from aggregation table)
        prev_workers = prev.get('total_employees', 0)
        prev_gaji = prev.get('total_upah_bersih', 0)
        prev_tbs = prev.get('total_ffb_weight', 0)  # From existing aggregation column
        
        # Calculate trend for GAJI
        if prev_gaji > 0:
            gaji_diff = curr_gaji - prev_gaji
            if gaji_diff > 0:
                trend = "NAIK"
            elif gaji_diff < 0:
                trend = "TURUN"
            else:
                trend = "TETAP"
        else:
            trend = "TETAP" if curr_gaji == 0 else "NAIK"
        
        # Calculate SELISIH (salary difference)
        selisih = curr_gaji - prev_gaji
        
        comparison_rows.append({
            "division_code": div_code,
            "description": curr.get('description', div_code),
            # Worker counts
            "workers_previous": prev_workers,
            "workers_current": curr_workers,
            # Current month metrics (single values)
            "total_pph21_current": curr_pph21,
            "total_spsi_current": curr_spsi,
            "total_premi_current": curr_premi,
            "total_prunning_current": curr_prunning,
            "total_lembur_current": curr_lembur,
            # Previous month group
            "previous_month": {
                "gaji": prev_gaji,
                "tbs_weight": prev_tbs
            },
            # Current month group
            "current_month": {
                "gaji": curr_gaji,
                "tbs_weight": curr_tbs,
                "thumb_print": curr_thumb_print  # From thumbprint JSON for Dec 2025
            },
            # SELISIH (salary difference)
            "selisih": selisih,
            # Trend indicator
            "trend": trend
        })
    
    # Calculate KPI totals (estate vs mill)
    estate_total_curr = sum(r['current_month']['gaji'] for r in comparison_rows if r['division_code'] != 'MILL')
    estate_total_prev = sum(r['previous_month']['gaji'] for r in comparison_rows if r['division_code'] != 'MILL')
    
    mill_row = next((r for r in comparison_rows if r['division_code'] == 'MILL'), None)
    mill_total_curr = mill_row['current_month']['gaji'] if mill_row else 0
    mill_total_prev = mill_row['previous_month']['gaji'] if mill_row else 0
    
    tbs_total_curr = sum(r['current_month']['tbs_weight'] for r in comparison_rows)
    tbs_total_prev = sum(r['previous_month']['tbs_weight'] for r in comparison_rows)
    
    logger.info(f"[SummaryService] Comparison: {month}/{year} vs {prev_month}/{prev_year} - {len(comparison_rows)} divisions")
    
    return {
        "current_period": {"month": month, "year": year},
        "previous_period": {"month": prev_month, "year": prev_year},
        "kpi_summary": {
            "estate_gaji": {
                "current": estate_total_curr,
                "previous": estate_total_prev
            },
            "mill_gaji": {
                "current": mill_total_curr,
                "previous": mill_total_prev
            },
            "tbs_weight": {
                "current": tbs_total_curr,
                "previous": tbs_total_prev
            }
        },
        "divisions": comparison_rows
    }


def get_division_luas_hektar() -> Dict[str, float]:
    """Get division Luas Hektar from Divisi_Description table (extend_db_ptrj)"""
    try:
        rows = _get_extend_db().query_all(
            "SELECT [Divisi], [Luas_Hektar] FROM [dbo].[Divisi_Description] WHERE [Divisi] IS NOT NULL"
        )
        return {row[0].strip(): float(row[1]) if row[1] else 0.0 for row in rows if row[0]}
    except Exception as e:
        logger.error(f"[SummaryService] Error getting luas hektar: {e}")
        return {}


def get_dynamic_premi_insentif_panen(month: int, year: int) -> Dict[str, Dict[str, float]]:
    """
    Get INSENTIF_PANEN totals from dynamic_premi_data JSON column.
    Returns dict: {division_code: {'total': insentif_panen_total}}
    """
    import json
    try:
        query = """
            SELECT 
                division_code,
                dynamic_premi_data
            FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = ? AND period_year = ? AND division_code IS NOT NULL
        """
        rows = _get_extend_db().query_all(query, (month, year))
        
        # Aggregate by division
        division_totals = {}
        for row in rows:
            div_code = str(row[0]).strip() if row[0] else None
            if not div_code:
                continue
                
            premi_data = row[1]
            if not premi_data:
                continue
                
            try:
                premi_list = json.loads(premi_data) if isinstance(premi_data, str) else premi_data
                for item in premi_list:
                    if isinstance(item, dict) and item.get('header', '').upper() == 'INSENTIF_PANEN':
                        if div_code not in division_totals:
                            division_totals[div_code] = {'insentif_panen': 0}
                        division_totals[div_code]['insentif_panen'] += float(item.get('total', 0))
            except:
                continue
        
        return division_totals
    except Exception as e:
        logger.error(f"[SummaryService] Error getting insentif panen: {e}")
        return {}


def get_impact_report_data(month: int, year: int) -> Dict[str, Any]:
    """
    Generate Impact Report data with 3-table structure:
    1. Main Table: Estate comparison (Luas Ha, Workers, Gaji, TBS, % Gaji Naik/Turun)
    2. Pruning Table: Pruning per division + Total Premi
    3. HK Analysis Table: HK × UPAH_DASAR calculations + Insentif Panen + Summary Analysis
    
    Data sources:
    - Luas Hektar: Divisi_Description.Luas_Hektar
    - Insentif Panen: dynamic_premi_data JSON column (header = 'INSENTIF_PANEN')
    - Other data: daftar_upah_aggregation_history
    """
    from app.core.config import UPAH_DASAR
    
    # Calculate previous month/year
    prev_month = month - 1 if month > 1 else 12
    prev_year = year if month > 1 else year - 1
    
    # Fetch all required data
    descriptions = get_division_descriptions()
    luas_hektar = get_division_luas_hektar()
    
    # Get current month aggregation data
    current_data = get_all_divisions_premi_totals(month, year)
    
    # Get previous month data - use JSON override for November 2025
    logger.info(f"[SummaryService] Impact Report: Checking prev_month={prev_month}, prev_year={prev_year}")
    if prev_month == 11 and prev_year == 2025:
        logger.info(f"[SummaryService] >>> USING November 2025 JSON override for Impact Report previous month data <<<")
        previous_data = _get_november_2025_division_data()
        if not previous_data:
            logger.warning("[SummaryService] JSON override failed, falling back to aggregation table")
            previous_data = get_all_divisions_premi_totals(prev_month, prev_year)
    else:
        previous_data = get_all_divisions_premi_totals(prev_month, prev_year)
    
    # Get insentif panen from dynamic_premi_data
    current_insentif = get_dynamic_premi_insentif_panen(month, year)
    previous_insentif = get_dynamic_premi_insentif_panen(prev_month, prev_year)
    
    # Create lookup dict for previous data
    prev_lookup = {d['division_code']: d for d in previous_data}
    
    # =====================
    # TABLE 1: MAIN TABLE
    # =====================
    main_table_rows = []
    total_luas = 0
    total_workers_prev = 0
    total_workers_curr = 0
    total_gaji_prev = 0
    total_gaji_curr = 0
    total_tbs_prev = 0
    total_tbs_curr = 0
    
    for curr in current_data:
        div_code = curr['division_code']
        prev = prev_lookup.get(div_code, {})
        
        # Values
        luas = luas_hektar.get(div_code, 0)
        workers_prev = prev.get('total_employees', 0)
        workers_curr = curr.get('total_employees', 0)
        workers_diff = workers_curr - workers_prev
        
        gaji_prev = prev.get('total_upah_bersih', 0)
        gaji_curr = curr.get('total_upah_bersih', 0)
        gaji_diff = gaji_curr - gaji_prev
        
        tbs_prev = prev.get('total_ffb_weight', 0)
        tbs_curr = curr.get('total_ffb_weight', 0)
        tbs_diff = tbs_curr - tbs_prev
        
        # Calculate percentages
        pct_tbs_diff = ((tbs_diff / tbs_prev) * 100) if tbs_prev > 0 else 0
        pct_gaji_naik_turun = ((gaji_diff / gaji_prev) * 100) if gaji_prev > 0 else 0
        
        # Get HK values
        hk_prev = prev.get('total_hk', 0)
        hk_curr = curr.get('total_hk', 0)
        
        # Get Premi values
        premi_prev = prev.get('total_premi', 0)
        premi_curr = curr.get('total_premi', 0)
        
        # Get Lembur (OT) values
        lembur_prev = prev.get('total_lembur', 0)
        lembur_curr = curr.get('total_lembur', 0)
        
        # Get Pruning values
        prunning_prev = prev.get('total_premi_prunning', 0)
        prunning_curr = curr.get('total_premi_prunning', 0)
        
        # Get Insentif Panen values
        insentif_curr = current_insentif.get(div_code, {}).get('insentif_panen', 0)
        insentif_prev = previous_insentif.get(div_code, {}).get('insentif_panen', 0)
        
        main_table_rows.append({
            "estate": descriptions.get(div_code, div_code),
            "division_code": div_code,
            "luas_ha": luas,
            "workers_prev": workers_prev,
            "workers_curr": workers_curr,
            "workers_diff": workers_diff,
            "hk_prev": hk_prev,
            "hk_curr": hk_curr,
            "premi_prev": premi_prev,
            "premi_curr": premi_curr,
            "lembur_prev": lembur_prev,
            "lembur_curr": lembur_curr,
            "prunning_prev": prunning_prev,
            "prunning_curr": prunning_curr,
            "insentif_prev": insentif_prev,
            "insentif_curr": insentif_curr,
            "gaji_prev": gaji_prev,
            "gaji_curr": gaji_curr,
            "gaji_diff": gaji_diff,
            "tbs_prev": tbs_prev,
            "tbs_curr": tbs_curr,
            "tbs_diff": tbs_diff,
            "pct_tbs_diff": round(pct_tbs_diff, 2),
            "pct_gaji_naik_turun": round(pct_gaji_naik_turun, 2)
        })
        
        # Accumulate totals
        total_luas += luas
        total_workers_prev += workers_prev
        total_workers_curr += workers_curr
        total_gaji_prev += gaji_prev
        total_gaji_curr += gaji_curr
        total_tbs_prev += tbs_prev
        total_tbs_curr += tbs_curr
    
    # Main table grand totals
    main_table_totals = {
        "estate": "TOTAL",
        "division_code": "",
        "luas_ha": round(total_luas, 2),
        "workers_prev": total_workers_prev,
        "workers_curr": total_workers_curr,
        "workers_diff": total_workers_curr - total_workers_prev,
        "gaji_prev": total_gaji_prev,
        "gaji_curr": total_gaji_curr,
        "gaji_diff": total_gaji_curr - total_gaji_prev,
        "tbs_prev": round(total_tbs_prev, 2),
        "tbs_curr": round(total_tbs_curr, 2),
        "tbs_diff": round(total_tbs_curr - total_tbs_prev, 2),
        "pct_tbs_diff": round(((total_tbs_curr - total_tbs_prev) / total_tbs_prev * 100) if total_tbs_prev > 0 else 0, 2),
        "pct_gaji_naik_turun": round(((total_gaji_curr - total_gaji_prev) / total_gaji_prev * 100) if total_gaji_prev > 0 else 0, 2)
    }
    
    # ========================
    # TABLE 2: PRUNING TABLE
    # ========================
    pruning_table_rows = []
    total_prunning_curr = 0
    
    for curr in current_data:
        div_code = curr['division_code']
        # Use total_premi_prunning for pruning table, not total_premi
        prunning = curr.get('total_premi_prunning', 0)
        
        pruning_table_rows.append({
            "estate": descriptions.get(div_code, div_code),
            "division_code": div_code,
            "premi_this_month": prunning,  # Pruning premi
            "prunning_this_month": prunning,
            "total": prunning  # Total = prunning for this month
        })
        total_prunning_curr += prunning
    
    pruning_totals = {
        "estate": "TOTAL PRUNING",
        "division_code": "",
        "premi_this_month": total_prunning_curr,
        "prunning_this_month": total_prunning_curr,
        "total": total_prunning_curr
    }
    
    # ===========================
    # TABLE 3: HK ANALYSIS TABLE
    # ===========================
    # Calculate total HK for both months
    total_hk_prev = sum(d.get('total_hk', 0) for d in previous_data)
    total_hk_curr = sum(d.get('total_hk', 0) for d in current_data)
    hk_diff = total_hk_curr - total_hk_prev
    
    # Calculate HK × UPAH_DASAR
    gaji_hk_prev = total_hk_prev * UPAH_DASAR
    gaji_hk_curr = total_hk_curr * UPAH_DASAR
    gaji_hk_diff = gaji_hk_curr - gaji_hk_prev
    
    # Calculate Insentif Panen totals
    insentif_prev_total = sum(v.get('insentif_panen', 0) for v in previous_insentif.values())
    insentif_curr_total = sum(v.get('insentif_panen', 0) for v in current_insentif.values())
    insentif_diff = insentif_curr_total - insentif_prev_total
    
    hk_analysis = {
        "upah_dasar": UPAH_DASAR,
        "hk_prev": total_hk_prev,
        "hk_curr": total_hk_curr,
        "hk_diff": hk_diff,
        "gaji_hk_prev": gaji_hk_prev,
        "gaji_hk_curr": gaji_hk_curr,
        "gaji_hk_diff": gaji_hk_diff,
        "insentif_panen_prev": insentif_prev_total,
        "insentif_panen_curr": insentif_curr_total,
        "insentif_panen_diff": insentif_diff
    }
    
    # ======================
    # SUMMARY ANALYSIS
    # ======================
    # Calculate various metrics for summary
    total_premi_curr = sum(d.get('total_premi', 0) for d in current_data)
    total_premi_prev = sum(d.get('total_premi', 0) for d in previous_data)
    premi_estate_diff = total_premi_curr - total_premi_prev
    
    total_lembur_prev = sum(d.get('total_lembur', 0) for d in previous_data)
    total_lembur_curr = sum(d.get('total_lembur', 0) for d in current_data)
    ot_estate_mill_diff = total_lembur_curr - total_lembur_prev
    
    total_prunning_prev = sum(d.get('total_premi_prunning', 0) for d in previous_data)
    total_prunning_curr = sum(d.get('total_premi_prunning', 0) for d in current_data)
    progressive_prunning_diff = total_prunning_curr - total_prunning_prev
    
    # Total Impact = sum of all differences
    total_impact = gaji_hk_diff + premi_estate_diff + ot_estate_mill_diff + progressive_prunning_diff + insentif_diff
    
    summary_analysis = {
        "turun_hk_value": gaji_hk_diff,
        "premi_estate_diff": premi_estate_diff,
        "ot_estate_mill_diff": ot_estate_mill_diff,
        "progressive_prunning_diff": progressive_prunning_diff,
        "insentif_panen_diff": insentif_diff,
        "total_impact": total_impact,
        "tonase_tbs_diff": round(total_tbs_curr - total_tbs_prev, 2),
        # Direction indicators
        "turun_hk_label": "TURUN" if gaji_hk_diff < 0 else "NAIK" if gaji_hk_diff > 0 else "TETAP",
        "premi_estate_label": "TURUN" if premi_estate_diff < 0 else "NAIK" if premi_estate_diff > 0 else "TETAP",
        "ot_label": "TURUN" if ot_estate_mill_diff < 0 else "NAIK" if ot_estate_mill_diff > 0 else "TETAP",
        "prunning_label": "TURUN" if progressive_prunning_diff < 0 else "NAIK" if progressive_prunning_diff > 0 else "TETAP",
        "insentif_label": "TURUN" if insentif_diff < 0 else "NAIK" if insentif_diff > 0 else "TETAP",
        "tbs_label": "TURUN" if (total_tbs_curr - total_tbs_prev) < 0 else "NAIK" if (total_tbs_curr - total_tbs_prev) > 0 else "TETAP"
    }
    
    logger.info(f"[SummaryService] Impact Report: {month}/{year} - {len(main_table_rows)} divisions, UPAH_DASAR={UPAH_DASAR}")
    
    return {
        "success": True,
        "current_period": {"month": month, "year": year},
        "previous_period": {"month": prev_month, "year": prev_year},
        "upah_dasar": UPAH_DASAR,
        "main_table": main_table_rows,
        "main_table_totals": main_table_totals,
        "pruning_table": pruning_table_rows,
        "pruning_totals": pruning_totals,
        "hk_analysis": hk_analysis,
        "summary_analysis": summary_analysis
    }

def get_analysis_report_data(month: int, year: int, filter_type: str = 'all') -> Dict[str, Any]:
    """
    Generate Analysis Report data (Premi & OT, Progressive Pruning)
    Table 1: Premi & OT Analysis (Prev vs Curr)
    Table 2: Progressive Pruning Analysis (Prev vs Curr)
    
    Data sources:
    - Premi: total_premi
    - OT: total_lembur
    - Pruning: total_premi_prunning
    
    Args:
        month (int): Period month
        year (int): Period year
        filter_type (str): 'all', 'ijl', or 'non_ijl'
    """
    try:
        # Calculate previous month/year
        prev_month = month - 1 if month > 1 else 12
        prev_year = year if month > 1 else year - 1
        
        # Get descriptions from database
        descriptions = get_division_descriptions()
        
        # Get current data
        current_data = get_all_divisions_premi_totals(month, year)
        
        # Get previous data (with Nov 2025 override check)
        logger.info(f"[SummaryService] Analysis Report: Checking prev_month={prev_month}, prev_year={prev_year}")
        if prev_month == 11 and prev_year == 2025:
            logger.info(f"[SummaryService] >>> USING November 2025 JSON override for Analysis Report <<<")
            previous_data = _get_november_2025_division_data()
            if not previous_data:
                 previous_data = get_all_divisions_premi_totals(prev_month, prev_year)
        else:
            previous_data = get_all_divisions_premi_totals(prev_month, prev_year)
            
        # Create lookups
        curr_lookup = {d['division_code']: d for d in current_data}
        prev_lookup = {d['division_code']: d for d in previous_data}
        
        # Get all unique division codes
        all_divs = sorted(list(set(list(curr_lookup.keys()) + list(prev_lookup.keys()))))
        
        # Filter divisions based on filter_type
        filtered_divs = []
        for div in all_divs:
            is_ijl = (div.upper() == 'IJL')
            
            if filter_type == 'ijl':
                if is_ijl:
                    filtered_divs.append(div)
            elif filter_type == 'non_ijl':
                if not is_ijl:
                    filtered_divs.append(div)
            else: # 'all'
                filtered_divs.append(div)
                
        all_divs = filtered_divs
        
        premi_ot_rows = []
        pruning_rows = []
        
        # Totals for footer
        totals = {
            "prev_premi": 0, "prev_ot": 0,
            "curr_premi": 0, "curr_ot": 0,
            "diff_premi": 0, "diff_ot": 0,
            "prev_pruning": 0, "curr_pruning": 0, "diff_pruning": 0
        }
        
        for div_code in all_divs:
            curr = curr_lookup.get(div_code, {})
            prev = prev_lookup.get(div_code, {})
            
            # --- Table 1: Premi & OT ---
            prev_premi = float(prev.get('total_premi', 0) or 0)
            prev_ot = float(prev.get('total_lembur', 0) or 0)
            
            curr_premi = float(curr.get('total_premi', 0) or 0)
            curr_ot = float(curr.get('total_lembur', 0) or 0)
            
            diff_premi = curr_premi - prev_premi
            diff_ot = curr_ot - prev_ot
            
            premi_ot_rows.append({
                "division_code": div_code,
                "estate": curr.get('estate', '') or prev.get('estate', '') or div_code,
                "description": descriptions.get(div_code, div_code),
                "prev_premi": prev_premi,
                "prev_ot": prev_ot,
                "curr_premi": curr_premi,
                "curr_ot": curr_ot,
                "diff_premi": diff_premi,
                "diff_ot": diff_ot
            })
            
            # Accumulate totals
            totals["prev_premi"] += prev_premi
            totals["prev_ot"] += prev_ot
            totals["curr_premi"] += curr_premi
            totals["curr_ot"] += curr_ot
            totals["diff_premi"] += diff_premi
            totals["diff_ot"] += diff_ot
            
            # --- Table 2: Pruning ---
            prev_pruning = float(prev.get('total_premi_prunning', 0) or 0)
            curr_pruning = float(curr.get('total_premi_prunning', 0) or 0)
            diff_pruning = curr_pruning - prev_pruning
            
            pruning_rows.append({
                "division_code": div_code,
                "description": descriptions.get(div_code, div_code),
                "estate": curr.get('estate', '') or prev.get('estate', '') or div_code,
                "prev_pruning": prev_pruning,
                "curr_pruning": curr_pruning,
                "diff_pruning": diff_pruning
            })
            
            totals["prev_pruning"] += prev_pruning
            totals["curr_pruning"] += curr_pruning
            totals["diff_pruning"] += diff_pruning

        return {
            "success": True,
            "current_period": {"month": month, "year": year},
            "previous_period": {"month": prev_month, "year": prev_year},
            "premi_ot_table": premi_ot_rows,
            "pruning_table": pruning_rows,
            "totals": totals
        }
    except Exception as e:
        logger.error(f"[SummaryService] Analysis Report failed: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}
