"""
Summary Report API Routes
Provides endpoints for fetching aggregation data from daftar_upah_aggregation_history
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List, Dict, Any, Optional
import logging

from app.api.auth import get_current_user_from_token
from app.models.user import User
from app.services.summary_service import (
    get_division_summary,
    get_available_periods,
    get_available_divisions,
    get_divisions_from_hr_gang,
    get_gangs_by_loc_code,
    get_dynamic_premi_headers_by_loc_code,
    get_division_descriptions,
    get_all_divisions_premi_totals,
    get_all_divisions_comparison,  # NEW: Comparison function
    get_impact_report_data,  # NEW: Impact Report function
    get_analysis_report_data,  # NEW: Analysis Report function
    test_connection
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/access-check")
async def check_report_access(
    user: User = Depends(get_current_user_from_token)
) -> Dict[str, Any]:
    """
    Check if user can access reports in proxy mode.
    Returns admin status and proxy mode status.
    """
    from app.services.unified_auth import is_admin_in_proxy_mode, is_proxy_mode
    
    can_access = is_admin_in_proxy_mode(user)
    
    return {
        "success": True,
        "can_access_reports": can_access,
        "is_proxy_mode": is_proxy_mode(),
        "is_admin": getattr(user, 'is_admin', False),
        "auth_mode": getattr(user, 'auth_mode', 'unknown')
    }



@router.get("/division")
async def get_summary_by_division(
    division: Optional[str] = Query(None, description="Division code filter (e.g., PG1A)"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Month filter (1-12)"),
    year: Optional[int] = Query(None, ge=2000, le=2100, description="Year filter"),
    user: User = Depends(get_current_user_from_token)
) -> Dict[str, Any]:
    """
    Get summary aggregation data for a division.
    
    Returns grand totals for all gangs in the specified division, 
    filtered by month and year.
    
    Data is sourced from daftar_upah_aggregation_history table in extend_db_ptrj.
    """
    try:
        logger.info(f"[SummaryAPI] Request: div={division}, month={month}, year={year}, user={user.username}")
        
        data = get_division_summary(
            division_code=division,
            month=month,
            year=year
        )
        
        return {
            "success": True,
            "count": len(data),
            "filters": {
                "division": division,
                "month": month,
                "year": year
            },
            "data": data
        }
        
    except Exception as e:
        logger.error(f"[SummaryAPI] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/periods")
async def get_periods(
    division: Optional[str] = Query(None, description="Filter periods by division"),
    user: User = Depends(get_current_user_from_token)
) -> Dict[str, Any]:
    """
    Get available periods (year-month combinations) in the aggregation data.
    Useful for populating filter dropdowns.
    """
    try:
        periods = get_available_periods(division_code=division)
        
        return {
            "success": True,
            "count": len(periods),
            "periods": periods
        }
        
    except Exception as e:
        logger.error(f"[SummaryAPI] Error getting periods: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/divisions")
async def get_divisions_with_data(
    user: User = Depends(get_current_user_from_token)
) -> Dict[str, Any]:
    """
    Get divisions (LocCodes) from HR_GANG table.
    """
    try:
        divisions = get_divisions_from_hr_gang()
        
        return {
            "success": True,
            "count": len(divisions),
            "divisions": divisions
        }
        
    except Exception as e:
        logger.error(f"[SummaryAPI] Error getting divisions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/gangs/{loc_code}")
async def get_gangs_for_division(
    loc_code: str,
    user: User = Depends(get_current_user_from_token)
) -> Dict[str, Any]:
    """
    Get gangs for a specific LocCode (division) with their descriptions.
    """
    try:
        gangs = get_gangs_by_loc_code(loc_code)
        
        return {
            "success": True,
            "loc_code": loc_code,
            "count": len(gangs),
            "gangs": gangs
        }
        
    except Exception as e:
        logger.error(f"[SummaryAPI] Error getting gangs for {loc_code}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check(
    user: User = Depends(get_current_user_from_token)
) -> Dict[str, Any]:
    """
    Check connection to extend_db_ptrj database.
    """
    try:
        is_connected = test_connection()
        
        return {
            "success": is_connected,
            "database": "extend_db_ptrj",
            "table": "daftar_upah_aggregation_history",
            "message": "Connection OK" if is_connected else "Connection failed"
        }
        
    except Exception as e:
        logger.error(f"[SummaryAPI] Health check error: {e}")
        return {
            "success": False,
            "database": "extend_db_ptrj",
            "error": str(e)
        }


@router.get("/premi-headers")
async def get_premi_headers_for_division(
    loc_code: str = Query(..., description="LocCode/Division (e.g., P1A, P2B, DME)"),
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    year: int = Query(..., ge=2000, le=2100, description="Year"),
    user: User = Depends(get_current_user_from_token)
) -> Dict[str, Any]:
    """
    Get dynamic premi headers for all gangs in a division.
    
    Queries unique DocDesc values from PR_ADTRANS_ARC for all gangs 
    within the specified LocCode, filtered by month and year.
    
    Excludes: PPH, SPSI, BERAS, JABATAN, MASA, KOREKSI, POT, LEMBUR, BPJS, ASTEK, SEHAT
    """
    try:
        logger.info(f"[SummaryAPI] Premi headers request: loc_code={loc_code}, month={month}, year={year}, user={user.username}")
        
        headers = get_dynamic_premi_headers_by_loc_code(
            loc_code=loc_code,
            month=month,
            year=year
        )
        
        return {
            "success": True,
            "loc_code": loc_code,
            "month": month,
            "year": year,
            "count": len(headers),
            "headers": headers
        }
        
    except Exception as e:
        logger.error(f"[SummaryAPI] Error getting premi headers for {loc_code}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/all-divisions")
async def get_all_divisions_summary(
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    year: int = Query(..., ge=2000, le=2100, description="Year"),
    user: User = Depends(get_current_user_from_token)
) -> Dict[str, Any]:
    """
    Get aggregated premi totals for all divisions for a specific period.
    
    Returns list of divisions with their total premi, aggregated from all gangs.
    Division descriptions are fetched from Divisi_Description table.
    
    Used for "Wages Rebinmas Report" which shows overview across all divisions.
    """
    try:
        logger.info(f"[SummaryAPI] All divisions request: month={month}, year={year}, user={user.username}")
        
        data = get_all_divisions_premi_totals(month=month, year=year)
        
        # Calculate grand totals (exclude subtotal rows)
        non_subtotal_data = [d for d in data if not d.get("is_subtotal", False)]
        total_upah_bersih = sum(d["total_upah_bersih"] for d in non_subtotal_data)
        total_thumbprint = sum(d.get("thumb_print", 0) for d in non_subtotal_data)
        total_selisih = sum(d.get("selisih", 0) for d in non_subtotal_data)
        
        grand_total = {
            "division_code": "",
            "description": "GRAND TOTAL",
            "total_premi": sum(d["total_premi"] for d in non_subtotal_data),
            "total_employees": sum(d["total_employees"] for d in non_subtotal_data),
            "total_hk": sum(d["total_hk"] for d in non_subtotal_data),
            "total_upah_bersih": total_upah_bersih,
            "total_pph21": sum(d["total_pph21"] for d in non_subtotal_data),
            "total_spsi": sum(d.get("total_spsi", 0) for d in non_subtotal_data),
            "total_lembur": sum(d["total_lembur"] for d in non_subtotal_data),
            "total_gangs": sum(d["total_gangs"] for d in non_subtotal_data),
            "thumb_print": total_thumbprint,  # From thumbprint JSON
            "total_manual": total_upah_bersih,
            "selisih": total_selisih,  # Portal - Thumbprint
            "is_subtotal": False,
            "is_grand_total": True
        }
        
        return {
            "success": True,
            "month": month,
            "year": year,
            "count": len(data),
            "data": data,
            "grand_total": grand_total
        }
        
    except Exception as e:
        logger.error(f"[SummaryAPI] Error getting all divisions summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mill-totals")
async def get_mill_totals(
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    year: int = Query(..., ge=2000, le=2100, description="Year"),
    user: User = Depends(get_current_user_from_token)
) -> Dict[str, Any]:
    """
    Get Mill PKS totals from VenusHR14 database.
    Used by aggregation seeder to populate history table.
    """
    try:
        from app.services.summary_service import get_mill_pks_totals
        data = get_mill_pks_totals(month=month, year=year)
        return {
            "success": True,
            "data": data
        }
    except Exception as e:
        logger.error(f"[SummaryAPI] Error getting Mill totals: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/division-descriptions")
async def get_division_descriptions_api(
    user: User = Depends(get_current_user_from_token)
) -> Dict[str, Any]:
    """
    Get division code to description mapping from Divisi_Description table.
    """
    try:
        descriptions = get_division_descriptions()
        
        return {
            "success": True,
            "count": len(descriptions),
            "descriptions": descriptions
        }
        
    except Exception as e:
        logger.error(f"[SummaryAPI] Error getting division descriptions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/comparison")
async def get_comparison_summary(
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    year: int = Query(..., ge=2000, le=2100, description="Year"),
    user: User = Depends(get_current_user_from_token)
) -> Dict[str, Any]:
    """
    Get month-over-month comparison for all divisions.
    Compares selected month with previous month.
    
    Data is sourced entirely from daftar_upah_aggregation_history table.
    TBS weight must be pre-populated in aggregation table by seeder.
    
    Returns:
        - current_period: {month, year}
        - previous_period: {month, year}
        - kpi_summary: Estate/Mill/TBS totals for both periods
        - divisions: Array of division comparisons with trends
    """
    try:
        logger.info(f"[SummaryAPI] Comparison request: month={month}, year={year}, user={user.username}")
        
        data = get_all_divisions_comparison(month=month, year=year)
        
        return {
            "success": True,
            **data  # Spread operator to include all comparison data
        }
        
    except Exception as e:
        logger.error(f"[SummaryAPI] Error getting comparison summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/impact-report")
async def get_impact_report(
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    year: int = Query(..., ge=2000, le=2100, description="Year"),
    user: User = Depends(get_current_user_from_token)
) -> Dict[str, Any]:
    """
    Get comprehensive Impact Report data with 3-table structure.
    Compares selected month with previous month.
    
    Data structure:
    - main_table: Estate comparison (Luas Ha, Workers, Gaji, TBS, % Gaji Naik/Turun)
    - pruning_table: Pruning per division + Total Premi
    - hk_analysis: HK × UPAH_DASAR calculations + Insentif Panen
    - summary_analysis: Comprehensive summary of all differences
    
    UPAH_DASAR is read from environment variable (default: 129220).
    """
    try:
        logger.info(f"[SummaryAPI] Impact Report request: month={month}, year={year}, user={user.username}")
        
        data = get_impact_report_data(month=month, year=year)
        
        return data  # Already includes success: True
        
    except Exception as e:
        logger.error(f"[SummaryAPI] Error getting impact report: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analysis-report")
async def get_analysis_report(
    month: int = Query(..., ge=1, le=12, description="Month filter (1-12)"),
    year: int = Query(..., ge=2000, le=2100, description="Year filter"),
    type: str = Query('all', description="Filter type: 'all', 'ijl', 'non_ijl'"),
    user: User = Depends(get_current_user_from_token)
) -> Dict[str, Any]:
    """
    Get Analysis Report Data (Premi & OT, Pruning)
    Returns:
    - premi_ot_table: List of {division, prev_premi, curr_premi, diff_premi, prev_ot, curr_ot, diff_ot}
    - pruning_table: List of {division, prev_pruning, curr_pruning, diff_pruning}
    - totals: Dictionary of totals
    """
    try:
        logger.info(f"[SummaryAPI] Analysis Report: month={month}, year={year}, type={type}, user={user.username}")
        return get_analysis_report_data(month, year, filter_type=type)
    except Exception as e:
        logger.error(f"[SummaryAPI] Analysis Report Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
