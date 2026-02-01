from fastapi import APIRouter, Depends, Query, HTTPException, status, Response
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import datetime
import asyncio
import os
from app.models.user import User
from app.services.payroll_service import PayrollService
from app.services.gang_service import GangService
from app.services.header_service import HeaderService
from app.services.threaded_header_service import ThreadedHeaderService
from app.services.threaded_data_extractor import ThreadedDataExtractor
from app.services.cache_service import CacheService
from app.repositories.employee_repository_db import EmployeeRepositoryDB
from app.repositories.employee_repository_db import EmployeeRepositoryDB
from app.repositories.gang_repository_db import GangRepositoryDB
from app.models.payroll import PayrollRow
import logging
from app.api.auth import get_current_user_from_token
from app.core.config import is_test_mode, DEFAULT_GANG, DEFAULT_MONTH, DEFAULT_YEAR
import time
import tracemalloc
from database.services.database import Database

logger = logging.getLogger(__name__)

router = APIRouter()

class PayrollRequest(BaseModel):
    upah_dasar: float
    hk_count: int
    allowances: Dict[str, float] = {}
    deductions: Dict[str, float] = {}

@router.post("/calculate")
async def calculate_payroll(req: PayrollRequest, user=Depends(get_current_user_from_token)):
    svc = PayrollService()
    return await svc.calculate(req.upah_dasar, req.hk_count, req.allowances, req.deductions)

@router.get("/report/division-raw-tree")
async def get_division_raw_tree(
    division_code: str = Query(..., description="Division code (e.g., PG1A)"),
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    response: Response = None,
    user=Depends(get_current_user_from_token)
):
    """
    Get raw payroll data for a division in a nested tree structure.
    No backend aggregation is performed.
    """
    try:
        start_time = time.perf_counter()
        
        # Extract data using threaded extractor with division filtering
        # Use asyncio.to_thread to prevent blocking the event loop
        extracted_data = await asyncio.to_thread(
            threaded_data_extractor.extract_all_payroll_data_parallel,
            month, year, "ALL", division_code
        )
        
        raw_rows = extracted_data.get('data_rows', [])
        
        # Filter out employees with jumlah_hk = 0 (no working days / no attendance)
        raw_rows = [row for row in raw_rows if float(row.get('jumlah_hk') or 0) > 0]
        
        dynamic_headers = extracted_data.get('dynamic_headers', {})
        dynamic_potongan_headers = extracted_data.get('dynamic_potongan_headers', {})
        dynamic_premi_headers = extracted_data.get('dynamic_premi_headers', {})
        
        # Group by gang
        gangs_map = {}
        
        for row in raw_rows:
            gang = row.get('gang_code', 'UNKNOWN')
            if gang not in gangs_map:
                gangs_map[gang] = []
            gangs_map[gang].append(row)
            
        # Format response
        gangs_list = []
        for gang_code, employees in gangs_map.items():
            gangs_list.append({
                "gang_code": gang_code,
                "employees": employees
            })
            
        # Sort gangs by code
        gangs_list.sort(key=lambda x: x['gang_code'])
        
        execution_time = (time.perf_counter() - start_time) * 1000
        
        if response:
            response.headers["X-Total-Count"] = str(len(raw_rows))
            response.headers["X-Execution-Time-Ms"] = str(int(execution_time))

        logger.info(f"Division raw tree generated for {division_code} in {execution_time:.2f}ms")
        
        return {
            "division": division_code,
            "month": month,
            "year": year,
            "gangs": gangs_list,
            "dynamic_headers": dynamic_headers,
            "dynamic_potongan_headers": dynamic_potongan_headers,
            "dynamic_premi_headers": dynamic_premi_headers,
            "meta": {
                "execution_time_ms": execution_time,
                "row_count": len(raw_rows)
            }
        }
    except Exception as e:
        logger.error(f"Error generating division raw tree: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/report", response_model=List[PayrollRow])
async def report_grid(
    gang_code: Optional[str] = Query(None),
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    skip: Optional[int] = Query(0, ge=0),
    limit: Optional[int] = Query(500, ge=1, le=2000),
    fields: Optional[str] = Query(None),
    benchmark: Optional[bool] = Query(False),
    monitor: Optional[bool] = Query(False),
    use_threading: Optional[bool] = Query(True, description="Use threaded data extraction for consistent results"),
    force_sequential: Optional[bool] = Query(False, description="Force sequential extraction (debug only)"),
    response: Response = None,
    user=Depends(get_current_user_from_token)
):
    """
    Generate payroll report with CONSISTENT data extraction.

    IMPORTANT: Default is now use_threading=True to ensure data consistency.
    The threaded extractor uses real-time database queries without caching,
    preventing data override issues between requests.
    """
    try:
        if is_test_mode():
            if response is not None:
                response.headers["X-Test-Mode"] = "true"

        start_time = time.perf_counter()

        # Use threading by default for consistency, unless explicitly forced sequential for debugging
        use_threaded_extraction = use_threading and not force_sequential

        if use_threaded_extraction:
            # ALWAYS use threaded data extraction for consistency
            # This prevents caching issues and ensures fresh data from database
            # Use asyncio.to_thread to prevent blocking the event loop
            extracted_data = await asyncio.to_thread(
                threaded_data_extractor.extract_all_payroll_data_parallel,
                month or datetime.now().month,
                year or datetime.now().year,
                gang_code or "ALL"
            )

            raw_rows = extracted_data.get('data_rows', [])
            processing_type = "threaded_consistent"

            # Convert dict data to PayrollRow objects
            rows = []
            for row_dict in raw_rows:
                if isinstance(row_dict, dict):
                    # Handle nested premi dictionary properly
                    premi_data = row_dict.get('premi', {})
                    if not premi_data:
                        # Build premi dict from individual fields if available
                        premi_data = {}
                        for key, value in row_dict.items():
                            if key.startswith('premi_') and key != 'total_premi':
                                premi_data[key] = value
                        if row_dict.get('premi_brondol', 0) > 0:
                            premi_data['premi_brondol'] = row_dict.get('premi_brondol', 0)

                    # Ensure total_premi is properly calculated from all premi fields
                    calculated_total_premi = row_dict.get('total_premi', 0.0)
                    if calculated_total_premi == 0.0:
                        # Calculate from nested premi dict if total_premi is 0
                        calculated_total_premi = sum(float(v or 0) for v in premi_data.values())

                    # Override total_premi with calculated value to ensure it's not empty
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
                        potongan_upah_kotor_total=float(row_dict.get('potongan_upah_kotor_total', 0.0)),
                        upah_kotor_premi=float(row_dict.get('upah_kotor_premi', 0.0)),
                        gaji_pokok_ideal=float(row_dict.get('gaji_pokok_ideal', 0.0)),
                        gaji_pokok_dibayarkan=float(row_dict.get('gaji_pokok_dibayarkan', 0.0)),
                        koreksi_hk=float(row_dict.get('koreksi_hk', 0.0)),
                        upah_bersih=float(row_dict.get('upah_bersih', 0.0)),
                        tidak_hadir_cth=int(row_dict.get('tidak_hadir_cth', 0)),
                        tidak_hadir_alpa=int(row_dict.get('tidak_hadir_alpa', 0))
                    )

                    # Add dynamic premi fields
                    for key, value in row_dict.items():
                        if key.startswith('premi_') and key not in ['premi_brondol', 'total_premi']:
                            setattr(payroll_row, key, value)

                    # Add dynamic potongan fields (pot_dynamic_X)
                    for key, value in row_dict.items():
                        if key.startswith('pot_dynamic_'):
                            setattr(payroll_row, key, value)

                    rows.append(payroll_row)

            # Filter out employees with jumlah HK = 0
            rows = [row for row in rows if getattr(row, 'jumlah_hk', 0) > 0]

            # Apply pagination if needed
            if skip or limit:
                rows = rows[skip:skip + limit]

            # NOTE: Do NOT filter fields in response!
            # The fields parameter is only used for query optimization.
            # Pydantic PayrollRow model requires ALL fields to be present,
            # so filtering the response would break validation.
            # Frontend should use AG Grid's columnDefs to control visibility,
            # not the fields parameter to filter the response.

        else:
            # Fallback to original service (only for debugging)
            logger.warning("Using sequential extraction - potential data inconsistency issues!")
            svc = PayrollService()
            repo = EmployeeRepositoryDB()
            f_list = None
            if fields:
                f_list = [x.strip() for x in fields.split(',') if x.strip()]

            if monitor:
                tracemalloc.start()

            rows = await svc.generate_rows(repo, gang_code=gang_code, month=month, year=year, skip=skip, limit=limit, fields=f_list)
            processing_type = "sequential_debug"

            if monitor:
                current, peak = tracemalloc.get_traced_memory()
                tracemalloc.stop()
                if response is not None:
                    response.headers["X-Memory-Current-KB"] = str(int(current/1024))
                    response.headers["X-Memory-Peak-KB"] = str(int(peak/1024))

        execution_time = time.perf_counter() - start_time

        # Add performance headers
        if benchmark and response is not None:
            response.headers["X-TotalMs"] = str(int(execution_time * 1000))
            response.headers["X-Rows"] = str(len(rows))
            response.headers["X-Processing-Type"] = processing_type
            response.headers["X-Threading-Enabled"] = str(use_threaded_extraction)
            response.headers["X-Data-Consistency"] = "threaded_realtime" if use_threaded_extraction else "sequential_cached"

        try:
            fields_count = len([x.strip() for x in (fields or '').split(',') if x.strip()])
            logger.info(f"payroll_report_grid gang_code={gang_code} month={month} year={year} skip={skip} limit={limit} fields={fields_count} rows={len(rows)} ms={int(execution_time*1000)} type={processing_type} threading={use_threaded_extraction} force_sequential={force_sequential} test_mode={is_test_mode()}")
        except Exception:
            pass

        return rows
    except Exception as e:
        logger.error(f"Database error: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return []

# Initialize services
gang_service = GangService()
header_service = HeaderService()
threaded_header_service = ThreadedHeaderService()
threaded_data_extractor = ThreadedDataExtractor()

@router.get("/divisions", response_model=List[str])
async def get_divisions(user=Depends(get_current_user_from_token)):
    """Get all available divisions"""
    out = gang_service.get_all_divisions()
    try:
        logger.info(f"gang_divisions count={len(out)}")
    except Exception:
        pass
    return out

@router.get("/subdivisions", response_model=List[str])
async def get_sub_divisions(user=Depends(get_current_user_from_token)):
    """Get all available sub-divisions."""
    try:
        sub_divisions = gang_service.get_sub_divisions()
        logger.info(f"Sub-divisions count={len(sub_divisions)}")
        return sub_divisions
    except Exception as e:
        logger.error(f"Failed to get sub-divisions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch sub-divisions"
        )

class GangResponse(BaseModel):
    gang_code: str
    description: Optional[str] = None

@router.get("/gangs", response_model=List[GangResponse])
async def get_gangs(
    division: Optional[str] = Query(None, description="Filter gangs by division"),
    search: Optional[str] = Query(None, description="Search gangs with LIKE operator"),
    force: Optional[bool] = Query(False, description="Force refresh from database"),
    user=Depends(get_current_user_from_token)
):
    """Get gangs with description, optional division filtering and LIKE search"""
    try:
        logger.info(f"gang_list division={division} search={search} force={force}")
        if not division or division.upper() == 'ALL':
            division = None
            accessible = gang_service.get_all_divisions() if user.role.upper() == 'ADMIN' else user.divisions
            # If explicit ALL requested, we pass None to gang service (which means all)
            # But we check permissions if not admin
            if user.role.upper() != 'ADMIN' and division != None and division not in (user.divisions or []):
                 raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Division not accessible")
        else:
            if user.role.upper() != 'ADMIN' and division not in (user.divisions or []):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Division not accessible")

        # Use gang service with real database connection
        gangs = gang_service.fetch_gangs_from_database(division=division, search=search, force=bool(force))
        try:
            logger.info(f"gang_list_return division={division} count={len(gangs)}")
        except Exception:
            pass

        if division and not gangs:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No gangs found for division {division}. Available divisions: {gang_service.get_all_divisions()}"
            )

        return gangs
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch gangs: {str(e)}"
        )

@router.get("/gangs/by-loc", response_model=List[str])
async def get_gangs_by_loc(
    loc_code: str = Query(..., description="Exact LocCode to filter gangs (e.g., AB2)"),
    force: Optional[bool] = Query(False, description="Force refresh from database"),
    user=Depends(get_current_user_from_token)
):
    """Get gang codes by LocCode using HR_GANG table"""
    try:
        codes = gang_service.fetch_gangs_by_loc_code(loc_code=loc_code, force=bool(force))
        try:
            logger.info(f"gangs_by_loc loc_code={loc_code} count={len(codes)}")
        except Exception:
            pass
        if not codes:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No gangs found for locCode {loc_code}")
        return codes
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to fetch gangs by locCode: {str(e)}")

@router.get("/gangs/codes", response_model=List[str])
async def get_gang_codes(
    force: Optional[bool] = Query(False, description="Force refresh from database"),
    user=Depends(get_current_user_from_token)
):
    try:
        repo = GangRepositoryDB()
        codes = repo.list_codes(division=None, force=bool(force))
        try:
            logger.info(f"gang_codes count={len(codes)}")
        except Exception:
            pass
        if not codes:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No gang codes found")
        return codes
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to fetch gang codes: {str(e)}")

@router.get("/gang/{gang_code}/info", response_model=dict)
async def get_gang_info(gang_code: str, user=Depends(get_current_user_from_token)):
    """Get detailed information about a specific gang"""
    try:
        info = gang_service.get_gang_info(gang_code)
        if not info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Gang {gang_code} not found"
            )
        try:
            logger.info(f"gang_info gang_code={gang_code} keys={list(info.keys()) if isinstance(info, dict) else 'n/a'}")
        except Exception:
            pass
        return info
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get gang info: {str(e)}"
        )

@router.get("/headers", response_model=dict)
async def get_dynamic_headers(
    month: Optional[int] = Query(None, description="Month for report (1-12)"),
    year: Optional[int] = Query(None, description="Year for report"),
    gang_code: Optional[str] = Query(None, description="Gang code filter"),
    use_threading: Optional[bool] = Query(True, description="Use threaded processing for better performance"),
    response: Response = None,
    user=Depends(get_current_user_from_token)
):
    """Generate dynamic headers based on real data with optional threading optimization"""
    try:
        if is_test_mode():
            if response is not None:
                response.headers["X-Test-Mode"] = "true"

        start_time = time.perf_counter()

        if use_threading:
            # Use optimized threaded service
            try:
                headers = await asyncio.wait_for(asyncio.to_thread(
                    threaded_header_service.generate_optimized_headers_parallel,
                    month=month,
                    year=year,
                    gang_code=gang_code
                ), timeout=int(os.getenv('REQUEST_TIMEOUT_SEC','30')))
            except asyncio.TimeoutError:
                raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="Header generation timed out")
            processing_type = "threaded"
        else:
            # Use optimized HeaderService with new ABSANSI structure
            try:
                headers = await asyncio.wait_for(asyncio.to_thread(
                    header_service.generate_dynamic_headers,
                    month=month,
                    year=year,
                    gang_code=gang_code
                ), timeout=int(os.getenv('REQUEST_TIMEOUT_SEC','30')))
            except asyncio.TimeoutError:
                raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="Header generation timed out")
            processing_type = "simplified"

        execution_time = time.perf_counter() - start_time

        # Add performance metrics to response
        if isinstance(headers, dict):
            headers['performance_info'] = {
                'processing_type': processing_type,
                'execution_time_ms': int(execution_time * 1000),
                'threading_enabled': use_threading
            }

        if response is not None:
            response.headers["X-Processing-Type"] = processing_type
            response.headers["X-Execution-Time-Ms"] = str(int(execution_time * 1000))
            response.headers["X-Threading-Enabled"] = str(use_threading)

        return headers
    except Exception as e:
        logger.error(f"Header generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate headers: {str(e)}"
        )

@router.get("/columns", response_model=List[dict])
async def get_column_definitions(
    month: Optional[int] = Query(None, description="Month for report (1-12)"),
    year: Optional[int] = Query(None, description="Year for report"),
    gang_code: Optional[str] = Query(None, description="Gang code filter"),
    fallback: Optional[bool] = Query(False, description="Force fallback column definitions"),
    response: Response = None,
    user=Depends(get_current_user_from_token)
):
    try:
        import re
        start_time = time.perf_counter()
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
            # Do not fail columns when gang is not found; proceed without strict validation
            try:
                repo = GangRepositoryDB()
                _ = repo.get_details(gang_code)
            except Exception:
                pass
        if is_test_mode():
            if response is not None:
                response.headers["X-Test-Mode"] = "true"
        if bool(fallback):
            # Use optimized HeaderService instead of old fallback
            column_defs = header_service._get_fallback_column_defs()
        else:
            column_defs = None
            try:
                # Use optimized HeaderService with new ABSANSI structure
                column_defs = await asyncio.wait_for(asyncio.to_thread(
                    header_service.get_column_definitions,
                    month=month,
                    year=year,
                    gang_code=gang_code
                ), timeout=int(os.getenv('REQUEST_TIMEOUT_SEC','30')))
            except asyncio.TimeoutError:
                # Fallback to simplified defs
                column_defs = header_service._get_fallback_column_defs()
            except Exception:
                # Fallback to simplified defs
                column_defs = header_service._get_fallback_column_defs()
        def _is_group(x):
            return isinstance(x, dict) and isinstance(x.get('children'), list) and isinstance(x.get('headerName'), str)
        def _is_leaf(x):
            return isinstance(x, dict) and isinstance(x.get('field'), str) and isinstance(x.get('headerName'), str)
        if not isinstance(column_defs, list) or len(column_defs) == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No column definitions available")
        if not all(_is_group(c) or _is_leaf(c) for c in column_defs):
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invalid column structure")
        agg_specs = {
            'total_tunjangan': {'type': 'sum', 'fields': ['beras_jumlah','jabatan_jumlah','masa_kerja_jumlah','lembur_jumlah']},
            # Sum static premi fields (only BRONDOL) plus dynamic premi fields (premi_1..7, which includes PRUNING and others as dynamic headers)
            'total_premi': {
                'type': 'sum',
                'fields': [
                    'premi_brondol',  # Static BRONDOL from Loosefruit table
                    'premi_1',        # Dynamic premiums (including PRUNING, PANEN, etc.)
                    'premi_2',
                    'premi_3',
                    'premi_4',
                    'premi_5',
                    'premi_6',
                    'premi_7'
                ]
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
                # Handle exclude_fields specification
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
            except Exception:
                pass
        try:
            logger.info(f"payroll_columns gang_code={gang_code} month={month} year={year} count={len(column_defs)} test_mode={is_test_mode()}")
        except Exception:
            pass
        return column_defs
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate column definitions: {str(e)}"
        )

@router.get("/export_html")
async def export_html(
    gang_code: Optional[str] = Query(None, description="Gang code (e.g., H1H)"),
    month: Optional[int] = Query(None, description="Month for report (1-12)"),
    year: Optional[int] = Query(None, description="Year for report"),
    user=Depends(get_current_user_from_token)
):
    try:
        import sys
        from pathlib import Path
        engine_dir = Path(__file__).parent.parent.parent.parent.parent / "Engine_HTML_Templating" / "template_report" / "ui"
        sys.path.insert(0, str(engine_dir))
        from daftar_upah_engine_real_database import DaftarUpahEngineRealFixed

        m = str((month or datetime.now().month)).zfill(2)
        y = str(year or datetime.now().year)
        gc = gang_code

        engine = DaftarUpahEngineRealFixed(month=m, year=y)
        out_path = engine.generate_report_from_real_database(
            gang_code=gc,
            limit=1000,
            template_file='daftar_upah_template_final.html',
            output_file=None
        )
        if not out_path:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to generate HTML report")
        with open(out_path, 'r', encoding='utf-8') as f:
            html = f.read()
        return Response(content=html, media_type='text/html')
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Export failed: {str(e)}")

@router.get("/reference_html")
async def reference_html(
    file_path: str = Query(..., description="Full path to reference HTML file"),
    user=Depends(get_current_user_from_token)
):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            html = f.read()
        return Response(content=html, media_type='text/html')
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Failed to read reference HTML: {str(e)}")

def _strip_html(s: str) -> str:
    import re
    return re.sub(r"<[^>]*>", "", s or "").strip()

def _num(s: str):
    try:
        import re
        cleaned = re.sub(r"[^0-9.-]", "", s or "")
        if cleaned == "":
            return None
        v = float(cleaned)
        return v
    except Exception:
        return None

@router.get("/validate_html")
async def validate_html(
    file_path: str = Query(..., description="Full path to reference HTML file"),
    gang_code: Optional[str] = Query(None),
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    user=Depends(get_current_user_from_token)
):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            html = f.read()

        import re
        thead_match = re.search(r"<thead[\s\S]*?<\/thead>", html, re.IGNORECASE)
        tbody_match = re.search(r"<tbody[\s\S]*?<\/tbody>", html, re.IGNORECASE)
        if not tbody_match:
            raise HTTPException(status_code=400, detail="No <tbody> found in reference HTML")
        tbody = tbody_match.group(0)

        # Extract rows
        tr_list = re.findall(r"<tr[\s\S]*?<\/tr>", tbody, re.IGNORECASE)
        rows_ref = []
        for tr in tr_list:
            tds = re.findall(r"<t[dh][^>]*>([\s\S]*?)<\/t[dh]>", tr, re.IGNORECASE)
            vals = [_strip_html(x) for x in tds]
            if len(vals) >= 5:
                rows_ref.append(vals)

        # Build a minimal header map by searching for known column names in the last header row
        header_leaf = []
        if thead_match:
            thead = thead_match.group(0)
            trs_h = re.findall(r"<tr[\s\S]*?<\/tr>", thead, re.IGNORECASE)
            if trs_h:
                last = trs_h[-1]
                header_leaf = [ _strip_html(m) for m in re.findall(r"<th[^>]*>([\s\S]*?)<\/th>", last, re.IGNORECASE) ]

        # Indices for key columns in reference
        def idx(name: str) -> int:
            try:
                return header_leaf.index(name)
            except Exception:
                return -1

        idx_map = {
            'nik': idx('NIK'),
            'nama': idx('NAMA'),
            'upah_dasar': idx('UPAH DASAR'),
            'hari_kerja': idx('HARI KERJA'),
            'upah_pokok': idx('UPAH POKOK')
        }

        # Build reference dict keyed by NIK
        ref_dict = {}
        for r in rows_ref:
            nidx = idx_map['nik']
            if nidx < 0 or nidx >= len(r):
                continue
            nik = r[nidx].strip()
            ref_item = {
                'nik': nik,
                'nama': r[idx_map['nama']] if idx_map['nama'] >= 0 else None,
                'upah_dasar': _num(r[idx_map['upah_dasar']]) if idx_map['upah_dasar'] >= 0 else None,
                'hari_kerja': int(_num(r[idx_map['hari_kerja']]) or 0) if idx_map['hari_kerja'] >= 0 else None,
                'upah_pokok': _num(r[idx_map['upah_pokok']]) if idx_map['upah_pokok'] >= 0 else None
            }
            ref_dict[nik] = ref_item

        # Get live rows from the system
        svc = PayrollService()
        repo = EmployeeRepositoryDB()
        live_rows = await svc.generate_rows(repo, gang_code=gang_code, month=month, year=year)
        live_dict = { row.nik.strip(): row for row in live_rows }

        # Compare
        diffs = []
        all_keys = ['upah_dasar','hari_kerja','upah_pokok']
        for nik, ref in ref_dict.items():
            live = live_dict.get(nik)
            if not live:
                diffs.append({'nik': nik, 'status': 'missing_live_row'})
                continue
            mismatch = {}
            for k in all_keys:
                rv = ref.get(k)
                lv = getattr(live, k)
                if rv is None:
                    continue
                if float(lv or 0) != float(rv or 0):
                    mismatch[k] = {'reference': rv, 'live': lv}
            if mismatch:
                diffs.append({'nik': nik, 'nama': ref.get('nama'), 'mismatch': mismatch})

        # Heuristics for root cause
        same_upah_dasar = len({ r.upah_dasar for r in live_rows }) <= 1
        same_hari_kerja = len({ r.hari_kerja for r in live_rows }) <= 1
        same_upah_pokok = len({ r.upah_pokok for r in live_rows }) <= 1
        root = []
        if same_upah_dasar:
            root.append('Upah dasar constant across rows (likely fallback or single payrate).')
        if same_hari_kerja:
            root.append('Hari kerja constant across rows (HK count query or calendar misapplied).')
        if same_upah_pokok:
            root.append('Upah pokok constant because upah dasar and hari kerja are constant.')

        result = {
            'summary': {
                'total_reference_rows': len(ref_dict),
                'total_live_rows': len(live_rows),
                'differences_found': len(diffs),
                'root_cause_hints': root
            },
            'differences': diffs
        }
        logger.info(f"Validation summary: {result['summary']}")
        return result
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Validation failed: {str(e)}")
@router.get("/report/row/{nik}", response_model=PayrollRow)
async def report_single_row(
    nik: str,
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    fields: Optional[str] = Query(None),
    response: Response = None,
    user=Depends(get_current_user_from_token)
):
    try:
        if is_test_mode():
            if response is not None:
                response.headers["X-Test-Mode"] = "true"
        repo = EmployeeRepositoryDB()
        emp = repo.get_by_nik(nik)
        if not emp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
        class SingleRepo:
            def list(self, skip, limit, gang_code=None, loc_code=None):
                return [emp]
        f_list = None
        if fields:
            f_list = [x.strip() for x in fields.split(',') if x.strip()]
        svc = PayrollService()
        out = await svc.generate_rows(SingleRepo(), gang_code=None, month=month, year=year, skip=0, limit=1, fields=f_list)
        return out[0]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/report/column/{field}", response_model=List[dict])
async def report_single_column(
    field: str,
    gang_code: Optional[str] = Query(None),
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    skip: Optional[int] = Query(0, ge=0),
    limit: Optional[int] = Query(500, ge=1, le=2000),
    response: Response = None,
    user=Depends(get_current_user_from_token)
):
    try:
        if is_test_mode():
            if response is not None:
                response.headers["X-Test-Mode"] = "true"
        svc = PayrollService()
        repo = EmployeeRepositoryDB()
        rows = await svc.generate_rows(repo, gang_code=gang_code, month=month, year=year, skip=skip, limit=limit, fields=[field])
        out = []
        for r in rows:
            out.append({"nik": r.nik, field: getattr(r, field)})
        return out
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/debug/employee_query", response_model=dict)
async def debug_employee_query(
    gang_code: Optional[str] = Query("H1H", description="Gang code to test"),
    response: Response = None,
    user=Depends(get_current_user_from_token)
):
    """
    Debug endpoint to test the new employee query system
    """
    try:
        from app.repositories.employee_repository_db import EmployeeRepositoryDB

        gang_code_clean = str(gang_code).strip().upper() if gang_code else None

        debug_info = {
            "gang_code": gang_code_clean,
            "timestamp": datetime.now().isoformat(),
            "tests": {}
        }

        # Test 1: Employee repository initialization
        try:
            repo = EmployeeRepositoryDB()
            debug_info["tests"]["repository_init"] = {
                "status": "healthy",
                "query_file": str(repo.query_file),
                "config_file": str(repo.config_file),
                "query_loaded": len(repo.query) > 0
            }
        except Exception as e:
            debug_info["tests"]["repository_init"] = {
                "status": "error",
                "error": str(e)
            }

        # Test 2: Database connection
        try:
            repo = EmployeeRepositoryDB()
            connection_healthy = repo.test_connection()
            debug_info["tests"]["database_connection"] = {
                "status": "healthy" if connection_healthy else "unhealthy",
                "connection_string": repo._get_connection_string()[:50] + "..."
            }
        except Exception as e:
            debug_info["tests"]["database_connection"] = {
                "status": "error",
                "error": str(e)
            }

        # Test 3: Employee query with specific gang
        try:
            repo = EmployeeRepositoryDB()
            employees = repo.list(skip=0, limit=10, gang_code=gang_code_clean)
            debug_info["tests"]["employee_query"] = {
                "status": "healthy",
                "employees_found": len(employees),
                "sample_employees": [
                    {
                        "nik": emp.get("nik"),
                        "nama": emp.get("nama"),
                        "loc_code": emp.get("loc_code"),
                        "gang_code": emp.get("gang_code")
                    }
                    for emp in employees[:3]
                ]
            }
        except Exception as e:
            debug_info["tests"]["employee_query"] = {
                "status": "error",
                "error": str(e)
            }

        # Test 4: Available gangs
        try:
            repo = EmployeeRepositoryDB()
            available_gangs = repo.get_available_gangs()
            debug_info["tests"]["available_gangs"] = {
                "status": "healthy",
                "count": len(available_gangs),
                "gang_codes": available_gangs[:20]  # First 20 gangs
            }
        except Exception as e:
            debug_info["tests"]["available_gangs"] = {
                "status": "error",
                "error": str(e)
            }

        # Test 5: Query without gang code (all employees)
        try:
            repo = EmployeeRepositoryDB()
            all_employees = repo.list(skip=0, limit=5, gang_code=None)
            debug_info["tests"]["all_employees_query"] = {
                "status": "healthy",
                "employees_found": len(all_employees),
                "sample_employees": [
                    {
                        "nik": emp.get("nik"),
                        "nama": emp.get("nama"),
                        "loc_code": emp.get("loc_code")
                    }
                    for emp in all_employees[:3]
                ]
            }
        except Exception as e:
            debug_info["tests"]["all_employees_query"] = {
                "status": "error",
                "error": str(e)
            }

        return debug_info

    except Exception as e:
        logger.error(f"Debug employee query failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Debug error: {str(e)}"
        )

@router.get("/debug/employees", response_model=dict)
async def debug_employees(
    gang_code: Optional[str] = Query("H1H", description="Gang code to debug"),
    response: Response = None,
    user=Depends(get_current_user_from_token)
):
    """
    Debug endpoint to check employee data and database structure
    """
    try:
        from database.services.database import Database

        db = Database.instance()
        gang_code_clean = str(gang_code).strip().upper()

        debug_info = {
            "gang_code": gang_code_clean,
            "timestamp": datetime.now().isoformat(),
            "checks": {}
        }

        # Check 1: Employee table exists and has data
        try:
            count_query = 'SELECT COUNT(*) FROM "HR_EMPLOYEE"'
            result = db.query_one(count_query)
            total_employees = result[0] if result else 0
            debug_info["checks"]["employee_table"] = {
                "status": "healthy",
                "total_employees": total_employees
            }
        except Exception as e:
            debug_info["checks"]["employee_table"] = {
                "status": "error",
                "error": str(e)
            }

        # Check 2: Active employees
        try:
            active_query = 'SELECT COUNT(*) FROM "HR_EMPLOYEE" WHERE "Status" = \'A\''
            result = db.query_one(active_query)
            active_employees = result[0] if result else 0
            debug_info["checks"]["active_employees"] = {
                "status": "healthy",
                "active_employees": active_employees
            }
        except Exception as e:
            debug_info["checks"]["active_employees"] = {
                "status": "error",
                "error": str(e)
            }

        # Check 3: Check HR_GANGLN table
        try:
            gang_table_query = 'SELECT COUNT(*) FROM "HR_GANGLN"'
            result = db.query_one(gang_table_query)
            gang_records = result[0] if result else 0
            debug_info["checks"]["gang_table"] = {
                "status": "healthy",
                "total_gang_records": gang_records
            }
        except Exception as e:
            debug_info["checks"]["gang_table"] = {
                "status": "error",
                "error": str(e)
            }

        # Check 4: Find matching gang codes
        try:
            gang_search_query = '''
                SELECT DISTINCT "GangCode" FROM "HR_GANGLN"
                WHERE UPPER("GangCode") LIKE UPPER(?)
            '''
            result = db.query_all(gang_search_query, (f'%{gang_code_clean}%',))
            found_gangs = [str(row[0]).strip() for row in result] if result else []
            debug_info["checks"]["gang_search"] = {
                "status": "healthy",
                "found_gangs": found_gangs,
                "search_term": gang_code_clean
            }
        except Exception as e:
            debug_info["checks"]["gang_search"] = {
                "status": "error",
                "error": str(e)
            }

        # Check 5: Test employee query with gang join
        try:
            join_query = '''
                SELECT COUNT(*)
                FROM "HR_EMPLOYEE" e
                JOIN "HR_GANGLN" g ON g."GangMember" = e."EmpCode"
                WHERE UPPER(g."GangCode") = UPPER(?)
            '''
            result = db.query_one(join_query, (gang_code_clean,))
            joined_employees = result[0] if result else 0
            debug_info["checks"]["join_query"] = {
                "status": "healthy",
                "joined_employees": joined_employees
            }
        except Exception as e:
            debug_info["checks"]["join_query"] = {
                "status": "error",
                "error": str(e)
            }

        # Check 6: Test LocCode match
        try:
            loc_code_query = '''
                SELECT COUNT(*) FROM "HR_EMPLOYEE"
                WHERE UPPER("LocCode") = UPPER(?) AND "Status" = \'A\'
            '''
            result = db.query_one(loc_code_query, (gang_code_clean,))
            loc_code_employees = result[0] if result else 0
            debug_info["checks"]["loc_code_query"] = {
                "status": "healthy",
                "loc_code_employees": loc_code_employees
            }
        except Exception as e:
            debug_info["checks"]["loc_code_query"] = {
                "status": "error",
                "error": str(e)
            }

        # Check 7: Sample employees for the gang
        try:
            repo = EmployeeRepositoryDB()
            sample_employees = repo.list(skip=0, limit=5, gang_code=gang_code_clean)
            debug_info["checks"]["sample_employees"] = {
                "status": "healthy",
                "count": len(sample_employees),
                "employees": [
                    {
                        "nik": emp.get("nik"),
                        "nama": emp.get("nama"),
                        "loc_code": emp.get("loc_code"),
                        "gang_code": emp.get("gang_code")
                    }
                    for emp in sample_employees
                ]
            }
        except Exception as e:
            debug_info["checks"]["sample_employees"] = {
                "status": "error",
                "error": str(e)
            }

        # Check 8: Get available gang codes
        try:
            available_gangs_query = '''
                SELECT DISTINCT "GangCode" FROM "HR_GANGLN" ORDER BY "GangCode"
            '''
            result = db.query_all(available_gangs_query)
            available_gangs = [str(row[0]).strip() for row in result] if result else []
            debug_info["checks"]["available_gangs"] = {
                "status": "healthy",
                "count": len(available_gangs),
                "gang_codes": available_gangs[:20]  # First 20 gangs
            }
        except Exception as e:
            debug_info["checks"]["available_gangs"] = {
                "status": "error",
                "error": str(e)
            }

        return debug_info

    except Exception as e:
        logger.error(f"Debug employees failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Debug error: {str(e)}"
        )

@router.get("/debug/db-connection", response_model=dict)
async def debug_db_connection(
    profile: Optional[str] = Query(None, description="Database profile name (e.g., 'remote' or 'local')"),
    user=Depends(get_current_user_from_token)
):
    try:
        import pyodbc
        from database.config.settings import get_db_config, connection_string
        cfg = get_db_config(profile)
        s = connection_string(profile)
        ok = False
        try:
            conn = pyodbc.connect(s, timeout=15)
            cur = conn.cursor()
            cur.execute("SELECT 1")
            r = cur.fetchone()
            cur.close()
            conn.close()
            ok = bool(r and r[0] == 1)
        except Exception as e:
            logger.error(f"Profile {profile or 'default'} connection failed: {e}")
            ok = False

        safe_cfg = {
            "driver": cfg.get("driver"),
            "server": cfg.get("server"),
            "port": cfg.get("port"),
            "database_name": cfg.get("database_name"),
            "username": cfg.get("username"),
            "profile": profile or (os.getenv('DB_PROFILE') or 'default')
        }
        return {"status": "healthy" if ok else "error", "config": safe_cfg}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/health", response_model=dict)
async def health_check(response: Response = None, user=Depends(get_current_user_from_token)):
    """
    Database and system health check endpoint
    """
    try:
        from database.services.database import Database

        start_time = time.perf_counter()

        # Test database connection
        db = Database.instance()
        db_healthy = db.test_connection()

        # Test basic query
        try:
            test_query = "SELECT COUNT(*) as employee_count FROM HR_EMPLOYEE WHERE Status = 'A'"
            result = db.query_one(test_query)
            employee_count = result[0] if result else 0
            query_healthy = True
        except Exception as e:
            employee_count = 0
            query_healthy = False
            logger.error(f"Basic query failed: {e}")

        # Test payroll service
        try:
            repo = EmployeeRepositoryDB()
            employees = repo.list(skip=0, limit=1, gang_code="H1H")
            service_healthy = len(employees) >= 0
        except Exception as e:
            service_healthy = False
            logger.error(f"Payroll service test failed: {e}")

        # Test header service
        try:
            headers = header_service.generate_dynamic_headers(month=5, year=2025, gang_code="H1H")
            header_healthy = headers is not None
        except Exception as e:
            header_healthy = False
            logger.error(f"Header service test failed: {e}")

        health_time = time.perf_counter() - start_time

        overall_healthy = db_healthy and query_healthy and service_healthy and header_healthy

        result = {
            "status": "healthy" if overall_healthy else "unhealthy",
            "timestamp": datetime.now().isoformat(),
            "checks": {
                "database_connection": {
                    "status": "healthy" if db_healthy else "unhealthy",
                    "response_time_ms": int(health_time * 1000)
                },
                "basic_query": {
                    "status": "healthy" if query_healthy else "unhealthy",
                    "employee_count": employee_count
                },
                "payroll_service": {
                    "status": "healthy" if service_healthy else "unhealthy"
                },
                "header_service": {
                    "status": "healthy" if header_healthy else "unhealthy"
                }
            },
            "performance": {
                "total_response_time_ms": int(health_time * 1000)
            }
        }

        if response is not None:
            response.headers["X-Health-Status"] = result["status"]
            response.headers["X-Response-Time-Ms"] = str(int(health_time * 1000))

        # Return appropriate HTTP status
        if not overall_healthy:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="One or more health checks failed"
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Health check error: {str(e)}"
        )

@router.get("/performance/compare", response_model=dict)
async def compare_performance(
    gang_code: Optional[str] = Query(None, description="Gang code for testing"),
    month: Optional[int] = Query(None, description="Month for testing"),
    year: Optional[int] = Query(None, description="Year for testing"),
    response: Response = None,
    user=Depends(get_current_user_from_token)
):
    """
    Compare performance between sequential and threaded processing.
    This endpoint runs both methods and returns performance comparison.
    """
    try:
        if is_test_mode():
            gang_code = gang_code or DEFAULT_GANG
            month = month or DEFAULT_MONTH
            year = year or DEFAULT_YEAR
            if response is not None:
                response.headers["X-Test-Mode"] = "true"

        # Test 1: Sequential header generation
        seq_start = time.perf_counter()
        sequential_headers = header_service.generate_dynamic_headers(
            month=month,
            year=year,
            gang_code=gang_code
        )
        seq_time = time.perf_counter() - seq_start

        # Test 2: Threaded header generation
        thread_start = time.perf_counter()
        threaded_headers = threaded_header_service.generate_optimized_headers_parallel(
            month=month,
            year=year,
            gang_code=gang_code
        )
        thread_time = time.perf_counter() - thread_start

        # Test 3: Sequential data extraction (limited sample)
        seq_data_start = time.perf_counter()
        svc = PayrollService()
        repo = EmployeeRepositoryDB()
        sequential_data = await svc.generate_rows(repo, gang_code=gang_code, month=month, year=year, skip=0, limit=50)
        seq_data_time = time.perf_counter() - seq_data_start

        # Test 4: Threaded data extraction (limited sample)
        thread_data_start = time.perf_counter()
        threaded_extracted = threaded_data_extractor.extract_all_payroll_data_parallel(
            month=month,
            year=year,
            gang_code=gang_code
        )
        threaded_data = threaded_extracted.get('data_rows', [])[:50]  # Limit to 50 for fair comparison
        thread_data_time = time.perf_counter() - thread_data_start

        # Calculate performance improvements
        header_improvement = ((seq_time - thread_time) / seq_time * 100) if seq_time > 0 else 0
        data_improvement = ((seq_data_time - thread_data_time) / seq_data_time * 100) if seq_data_time > 0 else 0

        result = {
            "test_parameters": {
                "gang_code": gang_code,
                "month": month,
                "year": year,
                "sample_size": 50
            },
            "header_generation": {
                "sequential_time_ms": int(seq_time * 1000),
                "threaded_time_ms": int(thread_time * 1000),
                "improvement_percent": round(header_improvement, 2),
                "faster_by": round(seq_time / thread_time, 2) if thread_time > 0 else 0
            },
            "data_extraction": {
                "sequential_time_ms": int(seq_data_time * 1000),
                "threaded_time_ms": int(thread_data_time * 1000),
                "improvement_percent": round(data_improvement, 2),
                "faster_by": round(seq_data_time / thread_data_time, 2) if thread_data_time > 0 else 0
            },
            "overall": {
                "total_sequential_ms": int((seq_time + seq_data_time) * 1000),
                "total_threaded_ms": int((thread_time + thread_data_time) * 1000),
                "overall_improvement_percent": round(((seq_time + seq_data_time) - (thread_time + thread_data_time)) / (seq_time + seq_data_time) * 100, 2) if (seq_time + seq_data_time) > 0 else 0
            },
            "data_consistency": {
                "header_count_match": len(sequential_headers.get('table_structure', {}).get('generated_headers', {}).get('level_3', {}).get('columns', [])) == len(threaded_headers.get('table_structure', {}).get('generated_headers', {}).get('level_3', {}).get('columns', [])),
                "data_count_match": len(sequential_data) == len(threaded_data)
            }
        }

        if response is not None:
            response.headers["X-Header-Improvement"] = f"{round(header_improvement, 2)}%"
            response.headers["X-Data-Improvement"] = f"{round(data_improvement, 2)}%"
            response.headers["X-Overall-Improvement"] = f"{result['overall']['overall_improvement_percent']}%"

        logger.info(f"Performance comparison completed. Header improvement: {round(header_improvement, 2)}%, Data improvement: {round(data_improvement, 2)}%")

        return result
    except Exception as e:
        logger.error(f"Performance comparison failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Performance comparison failed: {str(e)}"
        )


@router.get("/report/real", response_model=List[PayrollRow])
async def report_real_data(
    gang_code: Optional[str] = Query(None),
    division: Optional[str] = Query(None),
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    skip: Optional[int] = Query(0, ge=0),
    limit: Optional[int] = Query(50, ge=1, le=500),
    user=Depends(get_current_user_from_token)
):
    try:
        logger.info(f"payroll_report_real gang_code={gang_code} month={month} year={year} skip={skip} limit={limit} test_mode={is_test_mode()}")
        cache = CacheService.instance()
        cache_key = f"payroll_real:{gang_code}:{division}:{month}:{year}:{skip}:{limit}"
        cached_result = cache.get(cache_key)
        if cached_result:
            logger.info(f"Cache hit for payroll data: {gang_code} ({len(cached_result)} records)")
            return cached_result

        svc = PayrollService()
        repo = EmployeeRepositoryDB()
        timeout_sec = int(os.getenv('REQUEST_TIMEOUT_SEC', '30'))
        retries = 2
        delay = 0.5
        last_exc = None
        for attempt in range(retries + 1):
            try:
                rows = await asyncio.wait_for(
                    svc.generate_rows(repo, gang_code=gang_code, division=division, month=month, year=year, skip=skip, limit=limit),
                    timeout=timeout_sec
                )
                break
            except asyncio.TimeoutError as te:
                last_exc = te
                logger.error(f"report_real_data timeout (attempt {attempt + 1})")
                if attempt == retries:
                    raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="Request timed out")
                await asyncio.sleep(delay)
                delay = min(delay * 2, 2.0)
            except Exception as exc:
                last_exc = exc
                logger.error(f"report_real_data error (attempt {attempt + 1}): {exc}")
                if attempt == retries:
                    raise
                await asyncio.sleep(delay)
                delay = min(delay * 2, 2.0)

        ttl = int(os.getenv('CACHE_TTL_SECONDS', '120'))
        cache.set(cache_key, rows, ttl=ttl)
        logger.info(f"Cached payroll data for gang {gang_code} ({len(rows)} records)")
        return rows
    except Exception as e:
        logger.error(f"Real payroll endpoint failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch real payroll data: {str(e)}"
        )

@router.get("/report/simple", response_model=List[PayrollRow])
async def report_simple_data(
    gang_code: Optional[str] = Query(None),
    division: Optional[str] = Query(None),
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    skip: Optional[int] = Query(0, ge=0),
    limit: Optional[int] = Query(10, ge=1, le=50),
    user=Depends(get_current_user_from_token)
):
    try:
        logger.info(f"payroll_report_simple gang_code={gang_code} month={month} year={year} skip={skip} limit={limit} test_mode={is_test_mode()}")
        cache = CacheService.instance()
        cache_key = f"payroll_simple:{gang_code}:{division}:{month}:{year}:{skip}:{limit}"
        cached = cache.get(cache_key)
        if cached:
            return cached
        svc = PayrollService()
        repo = EmployeeRepositoryDB()
        timeout_sec = int(os.getenv('REQUEST_TIMEOUT_SEC', '30'))
        retries = 2
        delay = 0.5
        for attempt in range(retries + 1):
            try:
                rows = await asyncio.wait_for(
                    svc.generate_rows(repo, gang_code=gang_code, division=division, month=month, year=year, skip=skip, limit=limit),
                    timeout=timeout_sec
                )
                break
            except asyncio.TimeoutError:
                logger.error(f"report_simple_data timeout (attempt {attempt + 1})")
                if attempt == retries:
                    raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="Request timed out")
                await asyncio.sleep(delay)
                delay = min(delay * 2, 2.0)
            except Exception as exc:
                logger.error(f"report_simple_data error (attempt {attempt + 1}): {exc}")
                if attempt == retries:
                    raise
                await asyncio.sleep(delay)
                delay = min(delay * 2, 2.0)
        ttl = int(os.getenv('CACHE_TTL_SECONDS', '120'))
        cache.set(cache_key, rows, ttl=ttl)
        return rows
    except Exception as e:
        logger.error(f"Simple payroll endpoint failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Simple payroll endpoint failed: {str(e)}"
        )

@router.get("/report/aggregate")
async def report_aggregate(
    gang_code: Optional[str] = Query(None),
    division: Optional[str] = Query(None),
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
):
    try:
        logger.info(f"payroll_report_aggregate gang_code={gang_code} month={month} year={year}")
        cache = CacheService.instance()
        cache_key = f"payroll_aggregate:{gang_code}:{division}:{month}:{year}"
        cached = cache.get(cache_key)
        if cached:
            return cached

        # Use ThreadedDataExtractor for consistency and speed
        extracted_data = threaded_data_extractor.extract_all_payroll_data_parallel(
            month=month,
            year=year,
            gang_code=gang_code or "ALL",
            division_code=division
        )
        
        data_rows = extracted_data.get('data_rows', [])
        dynamic_totals = extracted_data.get('dynamic_premi_totals', {})
        
        # Initialize standard totals
        totals = {
            'count': len(data_rows),
            'upah_pokok': 0.0,
            'beras_jumlah': 0.0,
            'jabatan_jumlah': 0.0,
            'masa_kerja_jumlah': 0.0,
            'lembur_jumlah': 0.0,
            'total_tunjangan': 0.0,
            'total_premi': 0.0,
            'jumlah_upah_kotor': 0.0,
            'pot_bpjs_jumlah': 0.0,
            'total_potongan': 0.0,
            'upah_bersih': 0.0,
        }
        
        # Merge dynamic totals
        totals.update(dynamic_totals)
        
        # Calculate standard totals
        for r in data_rows:
            # r is a dict here, not an object
            totals['upah_pokok'] += float(r.get('upah_pokok', 0) or 0)
            totals['beras_jumlah'] += float(r.get('beras_jumlah', 0) or 0)
            totals['jabatan_jumlah'] += float(r.get('jabatan_jumlah', 0) or 0)
            totals['masa_kerja_jumlah'] += float(r.get('masa_kerja_jumlah', 0) or 0)
            totals['lembur_jumlah'] += float(r.get('lembur_jumlah', 0) or 0)
            totals['total_tunjangan'] += float(r.get('total_tunjangan', 0) or 0)
            totals['total_premi'] += float(r.get('total_premi', 0) or 0)
            totals['jumlah_upah_kotor'] += float(r.get('jumlah_upah_kotor', 0) or 0)
            totals['pot_bpjs_jumlah'] += float(r.get('pot_bpjs_jumlah', 0) or 0)
            totals['total_potongan'] += float(r.get('total_potongan', 0) or 0)
            totals['upah_bersih'] += float(r.get('upah_bersih', 0) or 0)

        ttl = int(os.getenv('CACHE_TTL_SECONDS', '120'))
        cache.set(cache_key, totals, ttl=ttl)
        return totals
    except asyncio.TimeoutError:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="Aggregation timed out")
    except Exception as e:
        logger.error(f"Aggregate payroll endpoint failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/report/count")
async def report_count(
    gang_code: Optional[str] = Query(None),
    division: Optional[str] = Query(None),
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
):
    try:
        from database.services.database import Database
        db = Database.instance()
        gc = str(gang_code or '').strip().upper()
        if gc == 'ALL':
            # Count across all gangs; restrict to division if provided
            division_prefix_map = {
                'PG1A': ['A'],
                'PG1B': ['B'],
                'PG2A': ['C'],
                'PG2B': ['D'],
                'DME': ['E'],
                'ARA': ['F'],
                'ARB1': ['G'],
                'ARB2': ['H'],
                'INFRA': ['I'],
                'AREC': ['J'],
                'IJL': ['IJL'],
                'STF-OFFICE': ['STF'],
                'SECURITY': ['SEC']
            }
            if division and division in division_prefix_map:
                prefixes = division_prefix_map.get(division, [])
                conds = ' OR '.join(['UPPER(g.GangCode) LIKE UPPER(?)' for _ in prefixes])
                sql = f"""
                    SELECT COUNT(DISTINCT g.GangMember)
                    FROM HR_GANGLN g
                    WHERE {conds}
                """
                params = tuple([p + '%' for p in prefixes])
                row = db.query_one(sql, params)
            else:
                sql = """
                    SELECT COUNT(DISTINCT g.GangMember)
                    FROM HR_GANGLN g
                """
                row = db.query_one(sql)
        else:
            sql = """
                SELECT COUNT(DISTINCT g.GangMember)
                FROM HR_GANGLN g
                WHERE UPPER(g.GangCode) = UPPER(?)
            """
            row = db.query_one(sql, (gang_code,))
        count = int(row[0]) if row and row[0] is not None else 0
        return {"count": count}
    except Exception as e:
        logger.error(f"Count endpoint failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/report/division-optimized", response_model=Dict[str, List[PayrollRow]])
async def report_division_optimized(
    division: str = Query(..., description="Division code"),
    month: int = Query(..., description="Month"),
    year: int = Query(..., description="Year"),
    user=Depends(get_current_user_from_token)
):
    """
    Fetch payroll rows for all gangs in a division concurrently.
    Returns grouped data for frontend-side aggregation and rendering.
    """
    try:
        svc = PayrollService()
        start_time = time.perf_counter()
        
        results = await svc.get_division_rows_parallel_async(division, month, year)
        
        duration = time.perf_counter() - start_time
        logger.info(f"Division optimized report for {division} took {duration:.2f}s")
        
        return results
    except Exception as e:
        logger.error(f"Division optimized report failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# Initialize service instances (moved from module level to avoid circular imports)
threaded_data_extractor = ThreadedDataExtractor()
header_service = HeaderService()
threaded_header_service = ThreadedHeaderService()

@router.get("/debug/arc-fallback-test", response_model=dict)
async def debug_arc_fallback_test(
    month: int = Query(12, description="Month to test"),
    year: int = Query(2025, description="Year to test"),
    gang_code: Optional[str] = Query("A1H", description="Gang code prefix"),
    user=Depends(get_current_user_from_token)
):
    """
    Debug endpoint to test ARC fallback by querying both ARC and non-ARC tables directly.
    This helps diagnose why December data may not be appearing.
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
                "gang_code": gang_code
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
        
        # Check 3: Sample data from PR_EMP_ATTN (non-ARC) for the month
        try:
            sample_sql = """
                SELECT TOP 5 EmpCode, AttnDate, IsPresent, LocCode
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
        
        # Check 4: Count employees with attendance for gang_code filter
        try:
            gang_attn_sql = """
                SELECT COUNT(DISTINCT a.EmpCode) as cnt
                FROM PR_EMP_ATTN a
                JOIN HR_GANGLN g ON g.GangMember = a.EmpCode
                WHERE a.AttnDate >= ? AND a.AttnDate < ?
                AND g.GangCode LIKE ?
            """
            result = db.query_one(gang_attn_sql, [start_date, end_date, f"{gang_code}%"])
            gang_count = result[0] if result else 0
            debug_info["checks"]["gang_attendance_count"] = {
                "gang_pattern": f"{gang_code}%",
                "employee_count": gang_count,
                "status": "found" if gang_count > 0 else "no_match"
            }
        except Exception as e:
            debug_info["checks"]["gang_attendance_count"] = {"error": str(e)}
        
        # Check 5: Show all gangs with attendance data in the month
        try:
            all_gangs_sql = """
                SELECT g.GangCode, COUNT(DISTINCT a.EmpCode) as cnt
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
                "gang_sample": dict(list(gangs_with_data.items())[:10])  # First 10
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
        logger.error(f"Debug arc fallback test failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Debug error: {str(e)}"
        )
