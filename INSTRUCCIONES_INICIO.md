# Instrucciones para Iniciar la Aplicación

## 📋 Requisitos Previos
- Python instalado con el entorno virtual configurado
- Node.js y npm instalados
- Las dependencias ya instaladas en ambos proyectos

---

## 🚀 Pasos para Iniciar

### 1️⃣ **Iniciar el Backend (Terminal 1)**

Abre una terminal PowerShell y ejecuta:

```powershell
cd 'c:\Users\Oscar Dev\Documents\UNALM\APP_UNALM\backend'
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

✅ El backend estará disponible en:  
- **Local:** http://localhost:8000  
- **Red local:** http://172.17.240.1:8000  
📖 Documentación API: http://localhost:8000/docs

**Para encontrar tu IP:** Abre PowerShell y ejecuta `ipconfig` - busca "Dirección IPv4"

---

### 2️⃣ **Iniciar el Frontend (Terminal 2)**

Abre otra terminal PowerShell y ejecuta:

```powershell
cd 'c:\Users\Oscar Dev\Documents\UNALM\APP_UNALM\frontend'
npm run dev -- --host
```

✅ El frontend estará disponible en:  
- **Local:** http://localhost:5174  
- **Red local:** http://172.17.240.1:5174

---

## � **Reiniciar Servicios Después de Cerrar**

### Pasos Rápidos:

1. **Terminal 1 - Backend:**
   ```powershell
   cd 'c:\Users\Oscar Dev\Documents\UNALM\APP_UNALM\backend'
   .\venv\Scripts\Activate.ps1
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Terminal 2 - Frontend:**
   ```powershell
   cd 'c:\Users\Oscar Dev\Documents\UNALM\APP_UNALM\frontend'
   npm run dev -- --host
   ```

### ✅ Verificación:
- **Backend:** http://172.17.240.1:8000
- **Frontend:** http://172.17.240.1:5174

### 🛑 Para detener:
- Presiona `Ctrl + C` en cada terminal

---

## 🛑 Para Detener

- En cada terminal presiona: **`Ctrl + C`**

---

## 📝 Comandos Rápidos

### Backend
```powershell
# Activar entorno virtual
.\venv\Scripts\Activate.ps1

# Iniciar servidor (accesible desde otros dispositivos)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Iniciar servidor (solo localhost)
uvicorn app.main:app --reload

# Crear migraciones (si usaras Alembic)
alembic revision --autogenerate -m "descripción"
alembic upgrade head
```

### Frontend
```powershell
# Instalar nuevas dependencias
npm install <paquete>

# Iniciar servidor de desarrollo (solo localhost)
npm run dev

# Iniciar servidor de desarrollo (accesible desde otros dispositivos)
npm run dev -- --host

# Compilar para producción
npm run build

# Vista previa de producción
npm run preview
```

---

## 🔧 Solución de Problemas

### Backend no inicia
1. Verifica que el entorno virtual esté activado
2. Revisa que el archivo `.env` exista con las credenciales de HikCentral
3. Asegúrate de que el puerto 8000 no esté en uso
4. Para acceso desde otros dispositivos, usa `--host 0.0.0.0`

### Firewall bloqueando conexiones
Si otros dispositivos no pueden conectarse:
1. **Windows Firewall:** Agrega una regla para el puerto 8000 (TCP)
2. **Antivirus:** Verifica que no esté bloqueando el puerto
3. **Router:** Asegúrate de que no haya restricciones de red local

### Frontend no inicia
1. Verifica que las dependencias estén instaladas: `npm install`
2. Asegúrate de que el puerto 5174 esté libre
3. Verifica que el backend esté corriendo primero

### Error de CORS
- El backend ya tiene CORS configurado para permitir cualquier origen (`*`)
- Si cambias el puerto del frontend, actualiza `app/main.py` si es necesario
- Para desarrollo, CORS permite cualquier origen por simplicidad

---

## 🌐 Acceso desde Otros Dispositivos

### Pasos para acceder desde teléfono/tablet:

1. **Asegúrate de que ambos servidores estén corriendo con `--host 0.0.0.0`**
2. **Encuentra tu IP local:**
   ```powershell
   ipconfig
   ```
   Busca "Dirección IPv4" (ej: 192.168.1.100)

3. **Accede desde otros dispositivos:**
   - **Frontend:** `http://[TU_IP]:5174` (ej: http://192.168.1.100:5174)
   - **Backend API:** `http://[TU_IP]:8000` (ej: http://192.168.1.100:8000)

4. **Asegúrate de que estés en la misma red WiFi**

### ⚠️ Notas importantes:
- **Firewall:** Puede que necesites abrir los puertos 5174 y 8000 en Windows Firewall
- **HTTPS para cámara:** Si la app requiere acceso a cámara desde otros dispositivos, necesitarás HTTPS (usa ngrok o localtunnel)
- **Misma red:** Los dispositivos deben estar conectados a la misma red WiFi

---

## 📦 Estructura del Proyecto

```
APP_UNALM/
├── backend/           # FastAPI + SQLAlchemy + HikCentral API
│   ├── app/
│   ├── venv/
│   └── .env
└── frontend/          # React + Vite + Bootstrap
    ├── src/
    └── package.json
```

---

## 🌍 Acceso Remoto Seguro (Ngrok)

Para acceder a la cámara desde otros dispositivos (celular, tablet) fuera de la red local o si tienes problemas de firewall, usa **Ngrok**. Esto crea una conexión segura (HTTPS) necesaria para la cámara.

### 1️⃣ Activar el Servicio
1. Asegúrate de que el **Frontend** esté corriendo (`npm run dev -- --host`).
2. Abre una **nueva terminal** en la carpeta principal (`APP_UNALM`).
3. Ejecuta:
   ```powershell
   python start_ngrok.py
   ```

### 2️⃣ Usar el Servicio
- El script mostrará una URL segura, por ejemplo: `https://abcd-1234.ngrok-free.app`
- Comparte esa URL con tus usuarios o dispositivos.
- **Importante:** Al abrir el link, verás una pantalla de advertencia de Ngrok. Haz clic en **"Visit Site"** para continuar.

### 3️⃣ Desactivar
- En la terminal donde corre ngrok, presiona **`Ctrl + C`**.
- El túnel se cerrará y la URL dejará de funcionar inmediatamente.

### 4️⃣ Reactivar
- Simplemente vuelve a ejecutar `python start_ngrok.py`.
- **Nota:** La URL cambiará cada vez que reinicies el servicio (a menos que tengas una cuenta de pago de Ngrok). Asegúrate de compartir el nuevo link.
