from pydantic import BaseModel
from typing import Optional

class EmployeeBase(BaseModel):
    nik: str
    nama: str
    jenis_kelamin: str
    loc_code: Optional[str] = None
    gang_code: Optional[str] = None

class EmployeeCreate(EmployeeBase):
    pass

class EmployeeUpdate(BaseModel):
    nama: Optional[str] = None
    jenis_kelamin: Optional[str] = None
    loc_code: Optional[str] = None
    gang_code: Optional[str] = None

class EmployeeResponse(EmployeeBase):
    id: int
    gaji_pokok: Optional[float] = None
