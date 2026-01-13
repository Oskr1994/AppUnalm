# Documentación del Proyecto APP_UNALM

## 📋 Descripción General
Aplicación web para la gestión de personas y accesos en el sistema HikCentral Professional. Permite administrar usuarios, personas, niveles de acceso y reconocimiento facial a través de una interfaz moderna y segura.

## 🏗️ Arquitectura
- **Backend**: FastAPI (Python) con SQLAlchemy, autenticación JWT e integración completa con API de HikCentral.
- **Frontend**: React + Vite con Bootstrap, integra reconocimiento facial (face-api.js) y navegación fluida con React Router.
- **Base de datos**: SQLite (por defecto, configurable para otros motores).

## 🛠️ Tecnologías Principales

### Backend
- **Framework**: FastAPI
- **ORM**: SQLAlchemy
- **Validación**: Pydantic
- **Autenticación**: JWT con passlib y python-jose
- **Integración**: Cliente HTTP personalizado para HikCentral API

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite
- **UI Kit**: Bootstrap 5
- **HTTP Client**: Axios
- **IA**: face-api.js para reconocimiento facial
- **Routing**: React Router

## 🚀 Funcionalidades
- 🔐 **Sistema de Autenticación**: Roles diferenciados (admin, operador, viewer).
- 👥 **Gestión de Personas**: CRUD completo sincronizado con HikCentral.
- 📊 **Dashboard Administrativo**: Vista general del sistema.
- 📷 **Reconocimiento Facial**: Módulo para detección e identificación de peatones.
- 🏢 **Gestión Organizacional**: Administración de organizaciones y grupos.

## 📁 Estructura del Proyecto
```
APP_UNALM/
├── backend/              # API FastAPI y lógica de negocio
│   ├── app/
│   │   ├── main.py       # Punto de entrada
│   │   ├── models.py     # Modelos BD
│   │   ├── routers/      # Endpoints API
│   │   └── hikcentral.py # Cliente HikCentral
│   └── requirements.txt
├── frontend/             # Aplicación React
│   ├── src/
│   │   ├── pages/        # Vistas (Login, Dashboard, etc.)
│   │   ├── components/   # Componentes reutilizables
│   │   └── services/     # Servicios de comunicación API
│   └── package.json
└── INSTRUCCIONES_INICIO.md  # Guía detallada de instalación
```

## 📚 Documentación Adicional
- [Documentación del Backend](./backend/README.md)
- [Documentación del Frontend](./frontend/README.md)
- [Guía de Inicio Rápido](./INSTRUCCIONES_INICIO.md)
- [Guía de Despliegue y Mantenimiento](./INSTRUCCIONES_DESPLIEGUE.md)

## 🔧 Instalación Rápida

### Backend
```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows
# source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev -- --host
```

## 🌐 Accesos Directos
- **Backend API (Swagger UI)**: http://localhost:8000/docs
- **Frontend**: http://localhost:5174
- **Credenciales por defecto**: `admin` / `admin123`

## 📝 Notas Importantes
- Es necesario configurar las credenciales de HikCentral en el archivo `.env` del backend.
- El sistema incluye modelos de IA pre-entrenados para detección facial.
- Diseñado para funcionar en red local.
