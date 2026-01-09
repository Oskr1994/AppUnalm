"""
Script para crear un usuario con rol de Personal de Seguridad
"""
from app.database import SessionLocal, engine
from app.models import Base, User
from app.auth import get_password_hash

# Crear las tablas si no existen
Base.metadata.create_all(bind=engine)

def create_security_user():
    db = SessionLocal()
    try:
        # Verificar si el usuario ya existe
        existing_user = db.query(User).filter(User.username == "seguridad").first()
        if existing_user:
            print("❌ El usuario 'seguridad' ya existe en la base de datos")
            return
        
        # Crear nuevo usuario
        user = User(
            username="seguridad",
            email="seguridad@unalm.edu.pe",
            full_name="Personal de Seguridad",
            hashed_password=get_password_hash("seguridad123"),
            role="personal_seguridad",
            is_active=True
        )
        
        db.add(user)
        db.commit()
        db.refresh(user)
        
        print("✅ Usuario de Personal de Seguridad creado exitosamente!")
        print(f"   Usuario: seguridad")
        print(f"   Contraseña: seguridad123")
        print(f"   Email: seguridad@unalm.edu.pe")
        print(f"   Rol: personal_seguridad")
        
    except Exception as e:
        print(f"❌ Error al crear usuario: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_security_user()
