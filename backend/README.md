# HikCentral Management Backend

Backend FastAPI para gestión de personas en HikCentral Professional con autenticación JWT y sistema de roles.

## Características

- 🔐 Autenticación JWT
- 👥 Sistema de roles (admin, operador, viewer)
- 🏢 Gestión de personas en HikCentral
- 🔑 Asignación de access levels
- 📊 API RESTful completa

## Instalación

1. Crear entorno virtual:
```bash
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows PowerShell
```

2. Instalar dependencias:
```bash
pip install -r requirements.txt
```

3. Configurar variables de entorno:
```bash
cp .env.example .env
# Editar .env con tus credenciales
```

## Ejecutar

```bash
# Modo desarrollo con recarga automática
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# O directamente
python -m app.main
```

La API estará disponible en: http://localhost:8000

Documentación interactiva: http://localhost:8000/docs

## Usuarios por Defecto

Al iniciar por primera vez, se crea un usuario admin:
- **Username:** admin
- **Password:** admin123
- **Rol:** admin

⚠️ **IMPORTANTE:** Cambia la contraseña en producción

## Roles y Permisos

- **admin**: Acceso completo, gestión de usuarios
- **operador**: Puede agregar/editar personas y asignar access levels
- **viewer**: Solo puede ver información

## Endpoints Principales

### Autenticación
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Información del usuario actual
- `GET /api/auth/users` - Listar usuarios (admin)

### Personas
- `POST /api/persons/add` - Agregar persona
- `GET /api/persons/list` - Listar personas
- `GET /api/persons/{person_code}` - Obtener persona
- `POST /api/persons/assign-access-level` - Asignar access level
- `GET /api/persons/access-levels/list` - Listar access levels
- `GET /api/persons/organizations/list` - Listar organizaciones

## Estructura del Proyecto

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py           # Aplicación principal
│   ├── config.py         # Configuración
│   ├── database.py       # Conexión BD
│   ├── models.py         # Modelos SQLAlchemy
│   ├── schemas.py        # Schemas Pydantic
│   ├── auth.py           # Autenticación JWT
│   ├── hikcentral.py     # Cliente HikCentral API
│   └── routers/
│       ├── auth_routes.py
│       └── person_routes.py
├── requirements.txt
├── .env
└── README.md
```
