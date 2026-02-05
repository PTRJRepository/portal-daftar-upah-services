from fastapi import APIRouter
from .auth import router as auth_router
from .users import router as users_router
from .payroll import router as payroll_router
from .payroll_locked import router as payroll_locked_router
from .reports import router as reports_router
from .config import router as config_router
from .employee_detail import router as employee_detail_router
from .summary_routes import router as summary_router

router = APIRouter()
router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(users_router, tags=["users"])
router.include_router(payroll_router, prefix="/payroll", tags=["payroll"])
router.include_router(payroll_locked_router, prefix="/payroll/locked", tags=["payroll-locked"])
router.include_router(reports_router, prefix="/reports", tags=["reports"])
router.include_router(config_router, prefix="/config", tags=["config"])
router.include_router(employee_detail_router, prefix="/payroll/employee", tags=["employee-detail"])
router.include_router(summary_router, prefix="/payroll/summary", tags=["summary-reports"])
