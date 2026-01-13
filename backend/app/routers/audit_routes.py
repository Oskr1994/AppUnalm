from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/api/audit-logs", tags=["Auditoría"])

@router.get("/", response_model=List[schemas.AuditLogResponse])
async def list_audit_logs(
    skip: int = 0, 
    limit: int = 100,
    user_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin"]))
):
    """Lista registros de auditoría con filtros opcionales (solo admin)"""
    query = db.query(models.AuditLog)
    
    if user_id:
        query = query.filter(models.AuditLog.user_id == user_id)
        
    if start_date:
        try:
            start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            query = query.filter(models.AuditLog.timestamp >= start)
        except ValueError:
            pass
            
    if end_date:
        try:
            end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            # Ajustar al final del día si solo viene fecha
            query = query.filter(models.AuditLog.timestamp <= end)
        except ValueError:
            pass

    logs = query.order_by(models.AuditLog.timestamp.desc()).offset(skip).limit(limit).all()
    
    # Enriquecer con username
    result = []
    for log in logs:
        log_resp = schemas.AuditLogResponse.from_orm(log)
        if log.user:
            log_resp.username = log.user.username
        result.append(log_resp)
        
    return result

@router.get("/users", response_model=List[schemas.User])
async def list_users_for_filter(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin"]))
):
    """Lista usuarios para el filtro de auditoría"""
    users = db.query(models.User).all()
    return users
