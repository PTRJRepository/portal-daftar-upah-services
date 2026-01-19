from fastapi import APIRouter, Depends, BackgroundTasks
from pydantic import BaseModel
from app.core.security import get_current_active_user
from app.services.report_service import ReportService

router = APIRouter()

class ReportParams(BaseModel):
    month: int
    year: int
    gang_code: str = ""
    loc_code: str = ""

svc = ReportService()

@router.post("/generate")
def generate_report(params: ReportParams, tasks: BackgroundTasks, user=Depends(get_current_active_user)):
    return svc.start(params.dict(), tasks)

@router.get("/{job_id}")
def get_report(job_id: str, user=Depends(get_current_active_user)):
    return svc.get(job_id)
