from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# User Schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    role: str = "viewer"

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

class UserInDB(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class User(UserInDB):
    pass

# Token Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# HikCentral Person Schemas
class PersonCreate(BaseModel):
    personGivenName: str
    personFamilyName: str
    personCode: str
    gender: str
    certificateNumber: Optional[str] = None
    photo: Optional[str] = None
    position: Optional[str] = None
    orgIndexCode: str = "1"
    phoneNo: Optional[str] = None
    email: Optional[str] = None
    plateNo: Optional[str] = None  # Placa del vehículo
    effectiveDate: Optional[str] = None  # Fecha de inicio de vigencia
    expiredDate: Optional[str] = None  # Fecha de fin de vigencia

class PersonResponse(BaseModel):
    personCode: str
    personId: Optional[str] = None
    personName: str
    gender: Optional[str] = None
    position: Optional[str] = None
    orgIndexCode: Optional[str] = None

class AccessLevelAssign(BaseModel):
    personCode: str
    privilegeGroupId: str
    type: int = 1

# Generic Response
class MessageResponse(BaseModel):
    message: str
    success: bool
    data: Optional[dict] = None

# Audit Log Schemas
class AuditLogBase(BaseModel):
    action: str
    module: str
    details: Optional[str] = None

class AuditLogCreate(AuditLogBase):
    user_id: int

class AuditLogResponse(AuditLogBase):
    id: int
    user_id: int
    timestamp: datetime
    # Nested user to show name
    username: Optional[str] = None
    
    class Config:
        from_attributes = True
