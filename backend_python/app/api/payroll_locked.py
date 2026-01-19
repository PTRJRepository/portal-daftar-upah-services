"""
Division-Locked Payroll Endpoints
Endpoints where division is locked from URL parameter, only gang can be changed.
Uses RS256 JWT verification from external system.
"""
from fastapi import APIRouter, Depends, Query, HTTPException, status, Response
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import datetime
import logging
import time

from app.services.unified_auth import get_current_user as get_external_user, is_proxy_mode
from app.services.external_auth_service import external_auth_service
from app.services.gang_service import GangService
from app.services.threaded_data_extractor import ThreadedDataExtractor
from app.services.header_service import HeaderService
from app.services.employee_detail_service import EmployeeDetailService
from app.models.payroll import PayrollRow

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize services
gang_service = GangService()
threaded_data_extractor = ThreadedDataExtractor()
header_service = HeaderService()
employee_detail_service = EmployeeDetailService()


class LockedDivisionInfo(BaseModel):
    """Response model for locked division info"""
    division: str
    locked: bool = True
    message: str = "Division is locked and cannot be changed"


class GangResponse(BaseModel):
    """Response model for gang list"""
    gang_code: str
    description: Optional[str] = None


@router.get("/info")
async def get_locked_info(
    div: str = Query(..., description="Locked division code (e.g., PG1A)"),
    user=Depends(get_external_user)
):
    """
    Get information about the locked division.
    This confirms the division is locked and returns its details.
    """
    return LockedDivisionInfo(
        division=div,
        locked=True,
        message=f"Division {div} is locked. You can only select gangs within this division."
    )


@router.get("/verify")
async def verify_external_token(
    user=Depends(get_external_user)
):
    """
    Verify external JWT token and return user claims.
    Frontend can use this to validate localStorage token before auto-login.
    Returns user info extracted from the RS256 JWT token.
    """
    logger.info(f"external_token_verified user={user.get('username', 'unknown')}")
    
    # Build user response from token claims
    return {
        "valid": True,
        "username": user.get("username") or user.get("sub"),
        "division": user.get("division"),
        "role": user.get("role", "user"),
        "divisions": user.get("divisions", []),  # Use divisions from unified_auth (includes all for admin)
        "is_admin": user.get("is_admin", False),
        "message": "Token verified successfully using RS256"
    }


@router.get("/divisions")
async def get_locked_division(
    div: str = Query(None, description="Locked division code (optional for admin)"),
    user=Depends(get_external_user)
):
    """
    Returns the locked division for normal users.
    For admin users, returns all available divisions.
    """
    # Check if user is admin
    # Admin if is_admin flag, role is ADMIN, or division is ALL
    is_admin = user.get("is_admin", False)
    user_role = user.get("role", "user") or "user"
    user_division = (div or "").upper()
    if not is_admin:
        is_admin = (user_role.upper() == "ADMIN") or (user_division == "ALL")
    
    if is_admin:
        # Admin users can access all divisions
        ALL_DIVISIONS = ["PG1A", "PG1B", "PG2A", "PG2B", "DME", "ARA", "ARB1", "ARB2", "INFRA", "AREC", "IJL", "STF-OFFICE", "SECURITY", "INF", "Nursery", "Workshop"]
        logger.info(f"locked_division: admin_user_granted_all_divisions username={user.get('username')}")
        return {
            "divisions": ALL_DIVISIONS,
            "locked": False,
            "is_admin": True,
            "message": "Admin user has access to all divisions."
        }
    else:
        # Regular users only get their locked division
        return {
            "divisions": [div] if div else [],
            "locked": True,
            "is_admin": False,
            "message": "Division selection is disabled. Only the specified division is available."
        }


@router.get("/gangs", response_model=List[GangResponse])
async def get_gangs_in_locked_division(
    div: str = Query(..., description="Locked division code"),
    search: Optional[str] = Query(None, description="Search gangs with LIKE operator"),
    force: Optional[bool] = Query(False, description="Force refresh from database"),
    user=Depends(get_external_user)
):
    """
    Get gangs from the locked division only.
    User can only select gang within this division.
    """
    try:
        logger.info(f"locked_gang_list division={div} search={search}")
        
        # Fetch gangs from the locked division
        gangs = gang_service.fetch_gangs_from_database(
            division=div,
            search=search,
            force=bool(force)
        )
        
        if not gangs:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No gangs found for locked division {div}"
            )
        
        logger.info(f"locked_gang_list_return division={div} count={len(gangs)}")
        return gangs
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch gangs for locked division: {str(e)}"
        )


@router.get("/report", response_model=List[PayrollRow])
async def get_locked_report(
    div: str = Query(..., description="Locked division code (cannot be changed)"),
    gang_code: Optional[str] = Query(None, description="Gang code within the locked division"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Month (1-12)"),
    year: Optional[int] = Query(None, ge=2000, le=2100, description="Year"),
    skip: Optional[int] = Query(0, ge=0),
    limit: Optional[int] = Query(500, ge=1, le=2000),
    response: Response = None,
    user=Depends(get_external_user)
):
    """
    Get payroll report with LOCKED division.
    
    - `div` parameter LOCKS the division - it cannot be changed
    - User can only select `gang_code` within the locked division
    - Uses RS256 JWT verification with external public key
    """
    try:
        start_time = time.perf_counter()
        
        # Validate that gang belongs to the locked division (if specified)
        if gang_code:
            available_gangs = gang_service.fetch_gangs_from_database(division=div)
            gang_codes = [g.get('gang_code') or g.gang_code for g in available_gangs]
            
            if gang_code not in gang_codes:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Gang {gang_code} is not in locked division {div}"
                )
        
        # Extract data using threaded extractor with division filtering
        extracted_data = threaded_data_extractor.extract_all_payroll_data_parallel(
            month=month or datetime.now().month,
            year=year or datetime.now().year,
            gang_code=gang_code or "ALL",
            division_code=div  # Use the locked division
        )
        
        raw_rows = extracted_data.get('data_rows', [])
        
        # Convert to PayrollRow objects
        rows = []
        for row_dict in raw_rows:
            if isinstance(row_dict, dict):
                premi_data = row_dict.get('premi', {})
                if not premi_data:
                    premi_data = {}
                    for key, value in row_dict.items():
                        if key.startswith('premi_') and key != 'total_premi':
                            premi_data[key] = value
                
                calculated_total_premi = row_dict.get('total_premi', 0.0)
                if calculated_total_premi == 0.0:
                    calculated_total_premi = sum(float(v or 0) for v in premi_data.values())
                
                row_dict['total_premi'] = calculated_total_premi
                
                payroll_row = PayrollRow(
                    no=row_dict.get('no', 0),
                    jenis_kelamin=str(row_dict.get('jenis_kelamin', '')),
                    nik=str(row_dict.get('nik', '')),
                    nama=str(row_dict.get('nama', '')),
                    phone=str(row_dict.get('phone', '-')),
                    upah_dasar=float(row_dict.get('upah_dasar', 0.0)),
                    hari_kerja=int(row_dict.get('hari_kerja', 0)),
                    upah_pokok=float(row_dict.get('upah_pokok', 0.0)),
                    cuti_tahunan_hari=int(row_dict.get('cuti_tahunan_hari', 0)),
                    cuti_sakit_haid_hari=int(row_dict.get('cuti_sakit_haid_hari', 0)),
                    cuti_haid_hari=int(row_dict.get('cuti_haid_hari', 0)),
                    cuti_minggu_hari=int(row_dict.get('cuti_minggu_hari', 0)),
                    cuti_nasional_hari=int(row_dict.get('cuti_nasional_hari', 0)),
                    cuti_izin_hari=int(row_dict.get('cuti_izin_hari', 0)),
                    jumlah_hk=int(row_dict.get('jumlah_hk', 0)),
                    gaji_pokok=float(row_dict.get('gaji_pokok', 0.0)),
                    beras_rate=float(row_dict.get('beras_rate', 0.0)),
                    beras_jumlah=float(row_dict.get('beras_jumlah', 0.0)),
                    jabatan_rate=float(row_dict.get('jabatan_rate', 0.0)),
                    jabatan_jumlah=float(row_dict.get('jabatan_jumlah', 0.0)),
                    masa_kerja_tahun=int(row_dict.get('masa_kerja_tahun', 0)),
                    masa_kerja_jumlah=float(row_dict.get('masa_kerja_jumlah', 0.0)),
                    masa_kerja_amount=float(row_dict.get('masa_kerja_amount', 0.0)),
                    lembur_jam=int(row_dict.get('lembur_jam', 0)),
                    lembur_jumlah=float(row_dict.get('lembur_jumlah', 0.0)),
                    total_tunjangan=float(row_dict.get('total_tunjangan', 0.0)),
                    premi_brondol=float(row_dict.get('premi_brondol', 0.0)),
                    premi=premi_data,
                    total_premi=float(row_dict.get('total_premi', 0.0)),
                    jumlah_upah_kotor=float(row_dict.get('jumlah_upah_kotor', 0.0)),
                    pot_pph21=float(row_dict.get('pot_pph21', 0.0)),
                    pot_kontan=float(row_dict.get('pot_kontan', 0.0)),
                    pot_thr=float(row_dict.get('pot_thr', 0.0)),
                    pot_pinjam=float(row_dict.get('pot_pinjam', 0.0)),
                    pot_kl=float(row_dict.get('pot_kl', 0.0)),
                    pot_bpjs_kes=float(row_dict.get('pot_bpjs_kes', 0.0)),
                    pot_bpjs_pek=float(row_dict.get('pot_bpjs_pek', 0.0)),
                    pot_bpjs_maj=float(row_dict.get('pot_bpjs_maj', 0.0)),
                    pot_bpjs_kesehatan_pekerja=float(row_dict.get('pot_bpjs_kesehatan_pekerja', 0.0)),
                    pot_bpjs_kesehatan_majikan=float(row_dict.get('pot_bpjs_kesehatan_majikan', 0.0)),
                    pot_bpjs_pensiun_pekerja=float(row_dict.get('pot_bpjs_pensiun_pekerja', 0.0)),
                    pot_bpjs_pensiun_majikan=float(row_dict.get('pot_bpjs_pensiun_majikan', 0.0)),
                    pot_bpjs_jumlah=float(row_dict.get('pot_bpjs_jumlah', 0.0)),
                    pot_bpjs_pekerja_total=float(row_dict.get('pot_bpjs_pekerja_total', 0.0)),
                    pot_bpjs_kesehatan_total=float(row_dict.get('pot_bpjs_kesehatan_total', 0.0)),
                    pot_bpjs_pensiun_total=float(row_dict.get('pot_bpjs_pensiun_total', 0.0)),
                    pot_total_1=float(row_dict.get('pot_total_1', 0.0)),
                    pot_total_2=float(row_dict.get('pot_total_2', 0.0)),
                    pot_total_3=float(row_dict.get('pot_total_3', 0.0)),
                    pot_total_4=float(row_dict.get('pot_total_4', 0.0)),
                    total_potongan=float(row_dict.get('total_potongan', 0.0)),
                    pot_spsi=float(row_dict.get('pot_spsi', 0.0)),
                    pot_koreksi=float(row_dict.get('pot_koreksi', 0.0)),
                    pot_dynamic_1=float(row_dict.get('pot_dynamic_1', 0.0)),
                    pot_dynamic_2=float(row_dict.get('pot_dynamic_2', 0.0)),
                    pot_dynamic_3=float(row_dict.get('pot_dynamic_3', 0.0)),
                    pot_dynamic_4=float(row_dict.get('pot_dynamic_4', 0.0)),
                    pot_dynamic_5=float(row_dict.get('pot_dynamic_5', 0.0)),
                    pot_dynamic_6=float(row_dict.get('pot_dynamic_6', 0.0)),
                    pot_dynamic_7=float(row_dict.get('pot_dynamic_7', 0.0)),
                    potongan_upah_kotor_total=float(row_dict.get('potongan_upah_kotor_total', 0.0)),
                    upah_kotor_premi=float(row_dict.get('upah_kotor_premi', 0.0)),
                    upah_bersih=float(row_dict.get('upah_bersih', 0.0)),
                    tidak_hadir_cth=int(row_dict.get('tidak_hadir_cth', 0)),
                    tidak_hadir_alpa=int(row_dict.get('tidak_hadir_alpa', 0))
                )
                rows.append(payroll_row)
        
        # Filter out employees with jumlah HK = 0
        rows = [row for row in rows if getattr(row, 'jumlah_hk', 0) > 0]
        
        # Apply pagination
        if skip or limit:
            rows = rows[skip:skip + limit]
        
        execution_time = (time.perf_counter() - start_time) * 1000
        
        if response:
            response.headers["X-Total-Count"] = str(len(raw_rows))
            response.headers["X-Execution-Time-Ms"] = str(int(execution_time))
            response.headers["X-Locked-Division"] = div
            response.headers["X-Auth-Type"] = "RS256-External"
        
        logger.info(
            f"locked_payroll_report div={div} gang={gang_code} month={month} year={year} "
            f"rows={len(rows)} ms={int(execution_time)}"
        )
        
        return rows
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in locked report: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate locked report: {str(e)}"
        )


@router.get("/report/raw-tree")
async def get_locked_division_raw_tree(
    div: str = Query(..., description="Locked division code"),
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    response: Response = None,
    user=Depends(get_external_user)
):
    """
    Get raw payroll data for locked division in nested tree structure.
    Division is locked from URL parameter.
    """
    try:
        start_time = time.perf_counter()
        
        extracted_data = threaded_data_extractor.extract_all_payroll_data_parallel(
            month=month,
            year=year,
            gang_code="ALL",
            division_code=div
        )
        
        raw_rows = extracted_data.get('data_rows', [])
        
        # Filter out employees with jumlah_hk = 0 (no working days / no attendance)
        # Handle string or int values safely
        raw_rows = [
            row for row in raw_rows 
            if float(row.get('jumlah_hk') or 0) > 0
        ]
        
        # Group by gang
        gangs_map = {}
        for row in raw_rows:
            gang = row.get('gang_code', 'UNKNOWN')
            if gang not in gangs_map:
                gangs_map[gang] = []
            gangs_map[gang].append(row)
        
        # Initialize gang service to fetch descriptions
        gang_service_instance = GangService()

        # Format response
        gangs_list = []
        for gang_code, employees in gangs_map.items():
            # Get gang description from database
            gang_info = gang_service_instance.get_gang_info(gang_code)
            gang_description = gang_info.get("description", "")

            gangs_list.append({
                "gang_code": gang_code,
                "gang_description": gang_description,
                "employees": employees
            })
        
        gangs_list.sort(key=lambda x: x['gang_code'])
        
        execution_time = (time.perf_counter() - start_time) * 1000
        
        if response:
            response.headers["X-Total-Count"] = str(len(raw_rows))
            response.headers["X-Execution-Time-Ms"] = str(int(execution_time))
            response.headers["X-Locked-Division"] = div
        
        # Debug: Log what we're getting from extracted_data
        dph = extracted_data.get('dynamic_premi_headers', {})
        dpoh = extracted_data.get('dynamic_potongan_headers', {})
        logger.info(f"[LOCKED DEBUG] dynamic_premi_headers: {dph}")
        logger.info(f"[LOCKED DEBUG] dynamic_potongan_headers: {dpoh}")
        
        logger.info(f"Locked division raw tree for {div} in {execution_time:.2f}ms")
        
        return {
            "division": div,
            "locked": True,
            "month": month,
            "year": year,
            "gangs": gangs_list,
            "dynamic_premi_headers": extracted_data.get('dynamic_premi_headers', {}),
            "dynamic_potongan_headers": extracted_data.get('dynamic_potongan_headers', {}),
            "meta": {
                "execution_time_ms": execution_time,
                "row_count": len(raw_rows),
                "auth_type": "RS256-External"
            }
        }
        
    except Exception as e:
        logger.error(f"Error generating locked division raw tree: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/columns", response_model=List[dict])
async def get_locked_columns(
    div: str = Query(..., description="Locked division code"),
    month: Optional[int] = Query(None, description="Month for report (1-12)"),
    year: Optional[int] = Query(None, description="Year for report"),
    gang_code: Optional[str] = Query(None, description="Gang code filter"),
    fallback: Optional[bool] = Query(False, description="Force fallback column definitions"),
    response: Response = None,
    user=Depends(get_external_user)
):
    """
    Get column definitions for locked division.
    Uses RS256 JWT verification from external system.
    Returns the same full column structure as /payroll/columns but with external auth.
    """
    try:
        import asyncio
        import re
        
        start_time = time.perf_counter()
        
        # Validate parameters
        if month is not None:
            if not isinstance(month, int) or month < 1 or month > 12:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid month, must be 1-12")
        if year is not None:
            if not isinstance(year, int) or year < 1900 or year > 2100:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid year, must be 1900-2100")
        if gang_code is not None:
            gc = str(gang_code or '').strip()
            if gc == '' or not re.match(r'^[A-Za-z0-9]+$', gc):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid gang_code")
            gang_code = gc.upper()
        
        if bool(fallback):
            column_defs = header_service._get_fallback_column_defs()
        else:
            column_defs = None
            try:
                column_defs = await asyncio.wait_for(asyncio.to_thread(
                    header_service.get_column_definitions,
                    month=month,
                    year=year,
                    gang_code=gang_code
                ), timeout=30)
            except asyncio.TimeoutError:
                column_defs = header_service._get_fallback_column_defs()
            except Exception:
                column_defs = header_service._get_fallback_column_defs()
        
        def _is_group(x):
            return isinstance(x, dict) and isinstance(x.get('children'), list) and isinstance(x.get('headerName'), str)
        def _is_leaf(x):
            return isinstance(x, dict) and isinstance(x.get('field'), str) and isinstance(x.get('headerName'), str)
        
        if not isinstance(column_defs, list) or len(column_defs) == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No column definitions available")
        if not all(_is_group(c) or _is_leaf(c) for c in column_defs):
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invalid column structure")
        
        # Add aggregation specs
        agg_specs = {
            'total_tunjangan': {'type': 'sum', 'fields': ['beras_jumlah','jabatan_jumlah','masa_kerja_jumlah','lembur_jumlah']},
            'total_premi': {
                'type': 'sum',
                'fields': ['premi_brondol', 'premi_1', 'premi_2', 'premi_3', 'premi_4', 'premi_5', 'premi_6', 'premi_7']
            },
            'jumlah_upah_kotor': {'type': 'sum', 'fields': ['gaji_pokok','total_tunjangan','total_premi']},
            'total_potongan': {'type': 'sum', 'fields': ['pot_spsi','pot_pph21','pot_koreksi'], 'match_prefix': 'pot_dynamic_', 'exclude_fields': ['pot_bpjs_kesehatan_pekerja','pot_bpjs_pensiun_pekerja','pot_bpjs_pekerja_total','pot_bpjs_pek']},
            'upah_bersih': {'type': 'sub', 'a': 'jumlah_upah_kotor', 'b': 'total_potongan'}
        }
        
        def _apply_agg(c):
            if isinstance(c, dict) and isinstance(c.get('children'), list):
                for k in c['children']:
                    _apply_agg(k)
            else:
                f = c.get('field')
                exclude_fields = agg_specs.get('exclude_fields', [])
                if f in agg_specs and f not in exclude_fields and not c.get('compute'):
                    c['compute'] = agg_specs[f]
        
        for c in column_defs:
            _apply_agg(c)
        
        exec_ms = int((time.perf_counter() - start_time) * 1000)
        
        if response is not None:
            try:
                response.headers["X-Execution-Time-Ms"] = str(exec_ms)
                response.headers["X-Column-Count"] = str(len(column_defs))
                response.headers["X-Locked-Division"] = div
                response.headers["X-Auth-Type"] = "RS256-External"
            except Exception:
                pass
        
        logger.info(f"locked_columns div={div} gang_code={gang_code} month={month} year={year} count={len(column_defs)}")
        return column_defs
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating locked columns: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate locked column definitions: {str(e)}"
        )


@router.get("/debug/arc-test")
async def debug_arc_test_locked(
    month: int = Query(12, description="Month to test"),
    year: int = Query(2025, description="Year to test"),
    div: Optional[str] = Query("PG1A", description="Division for gang filter"),
    user=Depends(get_external_user)
):
    """
    Debug endpoint to test ARC fallback by querying both ARC and non-ARC tables directly.
    Uses RS256 external auth like other locked endpoints.
    """
    try:
        from database.services.database import Database
        from database.config.settings import get_db_config
        import os
        
        db = Database.instance()
        
        start_date = f"{year}-{str(month).zfill(2)}-01"
        if month == 12:
            end_date = f"{year+1}-01-01"
        else:
            end_date = f"{year}-{str(month+1).zfill(2)}-01"
        
        # Get current DB config
        db_config = get_db_config()
        
        debug_info = {
            "timestamp": datetime.now().isoformat(),
            "parameters": {
                "month": month,
                "year": year,
                "start_date": start_date,
                "end_date": end_date,
                "div": div
            },
            "database": {
                "profile": os.getenv("DB_PROFILE", "unknown"),
                "server": db_config.get("server"),
                "port": db_config.get("port"),
                "database_name": db_config.get("database_name")
            },
            "checks": {}
        }
        
        # Check 1: Count data in PR_EMP_ATTN_ARC for the month
        try:
            arc_count_sql = """
                SELECT COUNT(*) as cnt 
                FROM PR_EMP_ATTN_ARC 
                WHERE AttnDate >= ? AND AttnDate < ?
            """
            result = db.query_one(arc_count_sql, [start_date, end_date])
            arc_count = result[0] if result else 0
            debug_info["checks"]["arc_table_count"] = {
                "table": "PR_EMP_ATTN_ARC",
                "count": arc_count,
                "status": "has_data" if arc_count > 0 else "empty"
            }
        except Exception as e:
            debug_info["checks"]["arc_table_count"] = {"error": str(e)}
        
        # Check 2: Count data in PR_EMP_ATTN (non-ARC) for the month
        try:
            non_arc_count_sql = """
                SELECT COUNT(*) as cnt 
                FROM PR_EMP_ATTN 
                WHERE AttnDate >= ? AND AttnDate < ?
            """
            result = db.query_one(non_arc_count_sql, [start_date, end_date])
            non_arc_count = result[0] if result else 0
            debug_info["checks"]["non_arc_table_count"] = {
                "table": "PR_EMP_ATTN",
                "count": non_arc_count,
                "status": "has_data" if non_arc_count > 0 else "empty"
            }
        except Exception as e:
            debug_info["checks"]["non_arc_table_count"] = {"error": str(e)}
        
        # Check 3: Sample data from PR_EMP_ATTN (non-ARC) for the month - TOP 10
        try:
            sample_sql = """
                SELECT TOP 10 EmpCode, AttnDate, IsPresent, LocCode
                FROM PR_EMP_ATTN 
                WHERE AttnDate >= ? AND AttnDate < ?
                ORDER BY AttnDate DESC
            """
            result = db.query_all(sample_sql, [start_date, end_date])
            samples = []
            for row in (result or []):
                samples.append({
                    "EmpCode": row[0],
                    "AttnDate": str(row[1]),
                    "IsPresent": row[2],
                    "LocCode": row[3]
                })
            debug_info["checks"]["non_arc_sample_data"] = {
                "count": len(samples),
                "samples": samples
            }
        except Exception as e:
            debug_info["checks"]["non_arc_sample_data"] = {"error": str(e)}
        
        # Check 4: Check MAX and MIN dates in PR_EMP_ATTN for recent data
        try:
            date_range_sql = """
                SELECT MIN(AttnDate) as min_date, MAX(AttnDate) as max_date
                FROM PR_EMP_ATTN
            """
            result = db.query_one(date_range_sql, [])
            if result:
                debug_info["checks"]["non_arc_date_range"] = {
                    "min_date": str(result[0]) if result[0] else None,
                    "max_date": str(result[1]) if result[1] else None
                }
        except Exception as e:
            debug_info["checks"]["non_arc_date_range"] = {"error": str(e)}
        
        # Check 5: Show all gangs with attendance data in the month (for the division)
        try:
            all_gangs_sql = """
                SELECT TOP 20 g.GangCode, COUNT(DISTINCT a.EmpCode) as cnt
                FROM PR_EMP_ATTN a
                JOIN HR_GANGLN g ON g.GangMember = a.EmpCode
                WHERE a.AttnDate >= ? AND a.AttnDate < ?
                GROUP BY g.GangCode
                ORDER BY g.GangCode
            """
            result = db.query_all(all_gangs_sql, [start_date, end_date])
            gangs_with_data = {}
            for row in (result or []):
                gangs_with_data[row[0]] = row[1]
            debug_info["checks"]["all_gangs_with_data"] = {
                "total_gangs": len(gangs_with_data),
                "gangs": gangs_with_data
            }
        except Exception as e:
            debug_info["checks"]["all_gangs_with_data"] = {"error": str(e)}
        
        # Summary
        arc_data = debug_info["checks"].get("arc_table_count", {}).get("count", 0)
        non_arc_data = debug_info["checks"].get("non_arc_table_count", {}).get("count", 0)
        
        debug_info["summary"] = {
            "arc_table_has_data": arc_data > 0,
            "non_arc_table_has_data": non_arc_data > 0,
            "fallback_should_work": non_arc_data > 0 and arc_data == 0,
            "recommendation": ""
        }
        
        if arc_data > 0:
            debug_info["summary"]["recommendation"] = "ARC table has data, fallback not needed"
        elif non_arc_data > 0:
            debug_info["summary"]["recommendation"] = "Fallback should find data in non-ARC table"
        else:
            debug_info["summary"]["recommendation"] = "NO DATA in either table for this month!"
        
        return debug_info
    except Exception as e:
        logger.error(f"Debug arc test failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Debug error: {str(e)}"
        )


# =============================================================================
# EMPLOYEE CHECKROLL (External RS256 Auth)
# =============================================================================
@router.get("/employee/{emp_code}/checkroll")
async def get_locked_employee_checkroll(
    emp_code: str,
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    year: int = Query(..., ge=2000, le=2100, description="Year"),
    div: Optional[str] = Query(None, description="Division code"),
    user=Depends(get_external_user)
):
    """
    Get employee checkroll detail with attendance and overtime breakdown.
    Uses RS256 external authentication for proxy/production mode.
    """
    logger.info(f"Locked API: get_employee_checkroll(emp_code={emp_code}, month={month}, year={year}, div={div})")
    try:
        result = employee_detail_service.get_employee_checkroll(emp_code, month, year, division_code=div)
        
        if result.get('error'):
            logger.warning(f"Service returned error for {emp_code}: {result.get('error')}")
            raise HTTPException(status_code=404, detail=result.get('error'))
            
        if not result.get('employee'):
            logger.warning(f"Employee not found in result for {emp_code}")
            raise HTTPException(status_code=404, detail=f"Employee {emp_code} not found")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get employee checkroll: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
