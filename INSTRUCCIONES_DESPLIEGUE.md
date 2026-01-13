# Guía de Mantenimiento y Despliegue - APP UNALM

Esta guía explica cómo aplicar cambios en el código (`src`) y actualizarlos en la versión de producción (`dist`), así como los comandos para iniciar el sistema completo.

## 1. Flujo de Trabajo (Cómo guardar cambios)

La carpeta `dist` **NO se edita directamente**. Es el resultado de "compilar" tu código.
Si haces cambios en `src`, debes **reconstruir** `dist`.

### Paso A: Editar Código
Modifica los archivos en `AppUnalm/frontend/src` (React) o `AppUnalm/backend` (Python).

### Paso B: Reconstruir Frontend (Solo si cambiaste React)
Si modificaste el frontend, ejecuta esto para actualizar `dist`:

```bash
cd ~/APP_UNALM/AppUnalm/frontend

# IMPORTANTE: Asegúrate de usar la IP de TU servidor servidor
# Si tu IP cambió, actualízala aquí.
VITE_API_URL=http://172.16.0.38:8000/api npm run build
```
*Esto generará una nueva carpeta `dist` con tus cambios.*

---

## 2. Iniciar el Sistema (Levantar todo)

Para que la App funcione, necesitas **2 terminales** abiertas.

### Terminal 1: Backend (Base de Datos y API)
```bash
cd ~/APP_UNALM/AppUnalm/backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
*(Mantener esta ventana abierta)*

### Terminal 2: Frontend (Interfaz de Usuario)
```bash
cd ~/APP_UNALM/AppUnalm/frontend
serve -s dist -l 8080
```
*(Mantener esta ventana abierta)*

---

## 3. Acceso

*   **Desde la misma PC**: `http://localhost:8080`
*   **Desde otros PC/Celulares**: `http://172.16.0.38:8080`

> ⚠️ **Nota sobre Cámara**: En otros dispositivos, la cámara podría bloquearse por no usar HTTPS. Ver solución temporal en `walkthrough.md` o configurar certificados SSL.

---

## 4. Mantener corriendo al cerrar la terminal (Segundo Plano)

Si cierras la terminal, el servidor se apaga. Para evitarlo, usa `nohup`.

### Opción Rápida (nohup)

**Para el Backend:**
```bash
cd ~/APP_UNALM/AppUnalm/backend
source venv/bin/activate
# El '&' al final lo manda al fondo
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
```

**Para el Frontend:**
```bash
cd ~/APP_UNALM/AppUnalm/frontend
nohup serve -s dist -l 8080 > frontend.log 2>&1 &
```

### Cómo detenerlos después
Como no tienes la terminal abierta, debes buscar el proceso y matarlo:
```bash
# Ver procesos corriendo
ps aux | grep uvicorn
ps aux | grep serve

# Matar proceso (usando el PID, el número que sale en la segunda columna)
kill <NUMERO_PID>

# O matar todos de una vez (cuidado):
pkill -f uvicorn
pkill -f serve
```
