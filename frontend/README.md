# Frontend - AppUnalm

Aplicación React construida con Vite, diseñada para la gestión de accesos y reconocimiento facial.

## 🛠️ Tecnologías

- **React 19**: Biblioteca UI principal.
- **Vite**: Entorno de desarrollo y bundler ultra rápido.
- **Bootstrap 5**: Framework de estilos para diseño responsivo.
- **Face API JS**: Librería para detección y reconocimiento facial en el navegador.
- **React Router**: Gestión de rutas y navegación SPA.
- **Axios**: Cliente HTTP para comunicación con el backend.

## 📁 Estructura del Frontend

```
frontend/
├── public/              # Archivos estáticos (favicon, manifest, etc.)
├── src/
│   ├── components/      # Componentes reutilizables (Navbar, Cards, Modals)
│   ├── pages/           # Vistas de la aplicación (Login, Dashboard, Users)
│   ├── services/        # Servicios para peticiones API
│   ├── App.jsx          # Componente raíz y configuración de rutas
│   └── main.jsx         # Punto de entrada
├── index.html           # Template HTML principal
└── package.json         # Dependencias y scripts
```

## 🚀 Instalación y Desarrollo

### Prerrequisitos
- Node.js (versión LTS recomendada)
- NPM

### Pasos

1. **Instalar dependencias**:
```bash
npm install
```

2. **Iniciar servidor de desarrollo**:
```bash
npm run dev
# Para exponer en red local:
npm run dev -- --host
```

3. **Construir para producción**:
```bash
npm run build
```
Esto generará la carpeta `dist/` optimizada para despliegue.

## 🔑 Variables de Entorno

El proyecto puede usar variables de entorno para configuración (crear archivo `.env`):

```env
VITE_API_BASE_URL=http://localhost:8000
```

## 🧩 Características Clave

- **Reconocimiento Facial**: Integrado en la vista de Peatones para validación de ingresos.
- **Protección de Rutas**: Sistema de `PrivateRoute` para asegurar vistas según autenticación.
- **Interfaz Adaptable**: Diseño responsivo compatible con dispositivos móviles y escritorio.
