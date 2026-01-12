from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # API Configuration
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Database
    DATABASE_URL: str
    
    # HikCentral API
    HIKCENTRAL_BASE_URL: str
    HIKCENTRAL_APP_KEY: str
    HIKCENTRAL_APP_SECRET: str
    HIKCENTRAL_USER_ID: str
    HIKCENTRAL_VERIFY_SSL: bool = False
    
    # CORS
    FRONTEND_URL: str = "http://localhost:5173"
    
    # Admin User
    ADMIN_USERNAME: str = "admin"
    ADMIN_EMAIL: str = "admin@unalm.edu.pe"
    ADMIN_PASSWORD: str = "admin123"
    
    class Config:
        env_file = ".env"

settings = Settings()
