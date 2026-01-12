from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import auth_routes, person_routes
from .config import settings
from . import models, auth
from .database import SessionLocal

# Crear tablas
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="HikCentral Management API",
    description="API para gestión de personas en HikCentral con autenticación y roles",
    version="1.0.0"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir routers
app.include_router(auth_routes.router)
app.include_router(person_routes.router)

@app.on_event("startup")
async def startup_event():
    """Crea un usuario admin por defecto si no existe"""
    db = SessionLocal()
    try:
        # Verificar si existe un admin
        admin = db.query(models.User).filter(models.User.username == settings.ADMIN_USERNAME).first()
        if not admin:
            from .schemas import UserCreate
            admin_user = UserCreate(
                username=settings.ADMIN_USERNAME,
                email=settings.ADMIN_EMAIL,
                full_name="Administrador",
                password=settings.ADMIN_PASSWORD,
                role="admin"
            )
            auth.create_user(db, admin_user)
            print(f"✅ Usuario admin creado: username={settings.ADMIN_USERNAME}")
            print("⚠️  IMPORTANTE: Cambiar contraseña en producción")
    except Exception as e:
        print(f"❌ Error al crear usuario admin: {e}")
    finally:
        db.close()

@app.get("/")
async def root():
    """Endpoint raíz"""
    return {
        "message": "HikCentral Management API",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running"
    }

@app.get("/health")
async def health():
    """Health check"""
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
