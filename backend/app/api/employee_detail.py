"""
Employee Detail API - Endpoints for employee checkroll data
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional, Dict, Any
from app.services.employee_detail_service import EmployeeDetailService
from app.api.auth import get_current_user_from_token
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{emp_code}/checkroll")
async def get_employee_checkroll(
    emp_code: str,
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    year: int = Query(..., ge=2000, le=2100, description="Year"),
    div: Optional[str] = Query(None, description="Division code"),
    user=Depends(get_current_user_from_token)
) -> Dict[str, Any]:
    """
    Get employee checkroll detail with attendance and overtime breakdown.
    """
    logger.info(f"API Request: get_employee_checkroll(emp_code={emp_code}, month={month}, year={year}, div={div})")
    try:
        service = EmployeeDetailService()
        result = service.get_employee_checkroll(emp_code, month, year, division_code=div)
        
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
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{emp_code}/attendance/detail")
async def get_employee_attendance_detail(
    emp_code: str,
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    year: int = Query(..., ge=2000, le=2100, description="Year"),
    div: Optional[str] = Query(None, description="Division code"),
    user=Depends(get_current_user_from_token)
) -> Dict[str, Any]:
    """
    Get detailed employee attendance matrix using JSON-based queries.

    Returns day-by-day attendance status with complete details including:
    - Daily attendance status (hadir, sakit, cuti, alpa, minggu, libur)
    - Leave details from PR_TASKREGLN
    - Summary statistics by attendance type
    """
    try:
        service = EmployeeDetailService()
        result = service.get_detailed_attendance_matrix(emp_code, month, year)

        return result

    except Exception as e:
        logger.error(f"Failed to get employee attendance detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{emp_code}/overtime/detail")
async def get_employee_overtime_detail(
    emp_code: str,
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    year: int = Query(..., ge=2000, le=2100, description="Year"),
    div: Optional[str] = Query(None, description="Division code"),
    user=Depends(get_current_user_from_token)
) -> Dict[str, Any]:
    """
    Get detailed employee overtime matrix using JSON-based queries.

    Returns day-by-day overtime details including:
    - Hours, amount, rate, task code for each overtime transaction
    - Day type (Hari Kerja, Hari Libur, Hari Minggu)
    - Overtime summary by type/description
    - Total hours, amounts, and average rate
    """
    try:
        service = EmployeeDetailService()
        result = service.get_detailed_overtime_matrix(emp_code, month, year)

        return result

    except Exception as e:
        logger.error(f"Failed to get employee overtime detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{emp_code}/matrices/detail")
async def get_employee_complete_matrices(
    emp_code: str,
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    year: int = Query(..., ge=2000, le=2100, description="Year"),
    div: Optional[str] = Query(None, description="Division code"),
    user=Depends(get_current_user_from_token)
) -> Dict[str, Any]:
    """
    Get complete detailed attendance and overtime matrices.

    Combines both attendance and overtime data with:
    - Day-by-day attendance matrix
    - Day-by-day overtime matrix with amounts
    - Combined summary statistics
    - Employee information
    """
    try:
        service = EmployeeDetailService()
        result = service.get_complete_detailed_matrices(emp_code, month, year)

        return result

    except Exception as e:
        logger.error(f"Failed to get employee complete matrices: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/debug/matrices")
async def debug_detailed_matrices(
    emp_code: str = Query("EMP001", description="Employee code for testing"),
    month: int = Query(5, ge=1, le=12, description="Month (default: May)"),
    year: int = Query(2025, ge=2000, le=2100, description="Year (default: 2025)"),
    user=Depends(get_current_user_from_token)
) -> Dict[str, Any]:
    """
    Debug endpoint to test the new detailed matrix functionality.
    Returns both old and new implementations for comparison.
    """
    try:
        service = EmployeeDetailService()

        # Get original implementation
        original_result = service.get_employee_checkroll(emp_code, month, year)

        # Get new detailed implementation
        detailed_result = service.get_complete_detailed_matrices(emp_code, month, year)

        return {
            "test_parameters": {
                "emp_code": emp_code,
                "month": month,
                "year": year
            },
            "original_implementation": {
                "attendance_days": len(original_result.get('attendance', {}).get('matrix', {})),
                "overtime_days": len([d for d in original_result.get('overtime', {}).get('matrix', {}).values() if d.get('has_overtime')]),
                "working_days": original_result.get('attendance', {}).get('summary', {}).get('total_hadir', 0),
                "overtime_hours": original_result.get('overtime', {}).get('summary', {}).get('total_hours', 0)
            },
            "new_detailed_implementation": {
                "attendance_days": len(detailed_result.get('attendance', {}).get('matrix', {})),
                "overtime_days": len([d for d in detailed_result.get('overtime', {}).get('matrix', {}).values() if d.get('has_overtime')]),
                "working_days": detailed_result.get('attendance', {}).get('summary', {}).get('total_hadir', 0),
                "overtime_hours": detailed_result.get('overtime', {}).get('summary', {}).get('total_hours', 0),
                "overtime_amount": detailed_result.get('overtime', {}).get('summary', {}).get('total_amount', 0),
                "overtime_types": list(detailed_result.get('overtime', {}).get('summary', {}).get('overtime_types', {}).keys())
            },
            "comparison": {
                "attendance_match": original_result.get('attendance', {}).get('summary', {}).get('total_hadir', 0) == detailed_result.get('attendance', {}).get('summary', {}).get('total_hadir', 0),
                "overtime_hours_match": abs(original_result.get('overtime', {}).get('summary', {}).get('total_hours', 0) - detailed_result.get('overtime', {}).get('summary', {}).get('total_hours', 0)) < 0.01
            }
        }

    except Exception as e:
        logger.error(f"Failed to debug detailed matrices: {e}")
        raise HTTPException(status_code=500, detail=str(e))
