# Guía de Migración y Despliegue en Nueva PC

Esta guía detalla los pasos para mover el proyecto **APP_UNALM** a una nueva computadora y dejarlo funcionando correctamente.

## 📋 Requisitos Previos

Antes de comenzar, asegúrate de instalar el siguiente software en la nueva PC:

1.  **Python** (versión 3.9 o superior).
    *   Al instalar, marca la casilla: `Add Python to PATH`.
2.  **Node.js** (versión 18 o superior) y **npm**.
3.  **Git** (opcional, si vas a clonar el repositorio).
4.  **VS Code** (recomendado para editar código).

---

## 🚀 Paso 1: Copiar el Proyecto

Tienes dos opciones:
*   **Opción A (Git):** Clonar el repositorio si está en GitHub/GitLab.
    *   `git clone <URL_DEL_REPOSITORIO>`
    *   `cd APP_UNALM`
*   **Opción B (Manual):** Copiar toda la carpeta `APP_UNALM` desde la PC antigua a la nueva.
    *   *Nota:* No es necesario copiar las carpetas `node_modules`, `venv` o `__pycache__`, ya que se recrearán.

---

## 🐍 Paso 2: Configurar el Backend (Python)

1.  Abre una terminal en la carpeta `backend`:
    ```powershell
    cd APP_UNALM/backend
    ```

2.  **Crear entorno virtual:**
    ```powershell
    python -m venv venv
    ```

3.  **Activar entorno virtual:**
    ```powershell
    .\venv\Scripts\Activate
    ```
    *(Si sale error de permisos, ejecuta: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` y vuelve a probar).*

4.  **Instalar dependencias:**
    ```powershell
    pip install -r requirements.txt
    ```

5.  **Configurar Variables de Entorno (.env):**
    *   Crea un archivo llamado `.env` en la carpeta `backend` (si no existe).
    *   Copia el contenido del `.env` de la PC anterior. Debe contener las credenciales de HikCentral y otras configuraciones secretas.

---

## ⚛️ Paso 3: Configurar el Frontend (React)

1.  Abre una nueva terminal en la carpeta `frontend`:
    ```powershell
    cd APP_UNALM/frontend
    ```

2.  **Instalar dependencias:**
    ```powershell
    npm install
    ```

---

## ▶️ Paso 4: Iniciar la Aplicación

Debes tener **dos terminales abiertas**:

**Terminal 1 (Backend):**
```powershell
cd APP_UNALM/backend
.\venv\Scripts\Activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 (Frontend):**
```powershell
cd APP_UNALM/frontend
npm run dev -- --host
```

---

## 🌍 Paso 5: Configurar Acceso Remoto (Ngrok)

Si necesitas acceder a la cámara desde otros dispositivos:

1.  Instala Ngrok o la librería de Python necesaria:
    ```powershell
    pip install pyngrok
    ```
2.  Configura tu token (solo la primera vez):
    ```powershell
    ngrok config add-authtoken <TU_TOKEN>
    # O usando python: python -c "from pyngrok import ngrok; ngrok.set_auth_token('<TU_TOKEN>')"
    ```
3.  Ejecuta el script de inicio:
    ```powershell
    cd APP_UNALM
    python start_ngrok.py
    ```

---

## ✅ Verificación

1.  Abre el navegador en `http://localhost:5173` (o el puerto que indique Vite).
2.  Inicia sesión y verifica que cargue la lista de personas.
3.  Prueba la cámara en Agregar/Editar persona.
