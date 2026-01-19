from fastapi import APIRouter, Depends
from app.core.security import get_current_active_user

router = APIRouter()

@router.get("/")
def get_config(user=Depends(get_current_active_user)):
    return {"status": "ok"}
