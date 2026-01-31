from fastapi import APIRouter, Depends, Query, HTTPException, status
from typing import List, Optional
from app.core.security import get_current_active_user, require_roles
from app.models.employee import EmployeeResponse, EmployeeCreate, EmployeeUpdate
from app.services.employee_service import EmployeeService, get_repo

router = APIRouter()

def get_service():
    return EmployeeService(get_repo())

@router.get("/", response_model=List[EmployeeResponse])
def get_employees(skip: int = 0, limit: int = 100, gang_code: Optional[str] = Query(None), loc_code: Optional[str] = Query(None), user=Depends(get_current_active_user)):
    svc = get_service()
    return svc.list(skip, limit, gang_code, loc_code)

@router.post("/", response_model=EmployeeResponse, dependencies=[Depends(require_roles(["admin","payroll"]))])
def create_employee(payload: EmployeeCreate, user=Depends(get_current_active_user)):
    svc = get_service()
    return svc.create(payload)

@router.put("/{id}", response_model=EmployeeResponse, dependencies=[Depends(require_roles(["admin","payroll"]))])
def update_employee(id: int, payload: EmployeeUpdate, user=Depends(get_current_active_user)):
    svc = get_service()
    item = svc.update(id, payload)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return item

@router.delete("/{id}", dependencies=[Depends(require_roles(["admin"]))])
def delete_employee(id: int, user=Depends(get_current_active_user)):
    svc = get_service()
    ok = svc.delete(id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return {"deleted": True}
