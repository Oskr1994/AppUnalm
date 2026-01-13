from sqlalchemy.orm import Session
from . import models

def create_audit_log(db: Session, user_id: int, action: str, module: str, details: str = None):
    """Crea un registro de auditoría"""
    try:
        db_log = models.AuditLog(
            user_id=user_id,
            action=action,
            module=module,
            details=details
        )
        db.add(db_log)
        db.commit()
        db.refresh(db_log)
        return db_log
    except Exception as e:
        print(f"Error creating audit log: {e}")
        # No propagar error para no interrumpir el flujo principal
        return None
