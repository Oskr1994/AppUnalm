#!/usr/bin/env python3
"""
Script para crear un túnel HTTPS con ngrok para la aplicación
Esto permite acceder a la aplicación desde cualquier dispositivo con HTTPS
"""

from pyngrok import ngrok
import time
import sys

def start_ngrok_tunnel(port=5173):
    """
    Inicia un túnel ngrok para el puerto especificado
    """
    try:
        print(f"🚀 Iniciando túnel ngrok para el puerto {port}...")

        # Crear túnel apuntando a HTTPS local
        # bind_tls=True dice que el servidor local usa SSL
        public_url = ngrok.connect(f"https://localhost:{port}")
        print(f"✅ Túnel creado exitosamente!")
        print(f"🔗 URL HTTPS: {public_url}")
        print()
        print("🌐 Comparte esta URL con otros dispositivos:")
        print(f"   {public_url}")
        print()
        print("📱 Desde tu teléfono u otro dispositivo:")
        print(f"   Ve a: {public_url}")
        print("   La cámara funcionará correctamente con HTTPS")
        print()
        print("❌ Presiona Ctrl+C para detener el túnel")

        # Mantener el túnel activo
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n👋 Cerrando túnel...")
            ngrok.disconnect(public_url)
            ngrok.kill()
            print("✅ Túnel cerrado")

    except Exception as e:
        print(f"❌ Error al crear túnel: {e}")
        print("💡 Asegúrate de tener ngrok instalado y configurado")
        return 1

    return 0

if __name__ == "__main__":
    port = 5173  # Puerto del frontend

    print("🔐 NGROK TUNNEL PARA ACCESO HTTPS")
    print("=" * 40)
    print("Este script crea un túnel seguro HTTPS para tu aplicación")
    print("Permitirá acceder a la cámara desde cualquier dispositivo")
    print()
    print("📋 PASOS:")
    print("1. Asegúrate de que el frontend esté corriendo (npm run dev -- --host)")
    print("2. Ejecuta este script")
    print("3. Copia la URL HTTPS que ngrok te dé")
    print("4. Accede desde cualquier dispositivo con esa URL")
    print()

    exit_code = start_ngrok_tunnel(port)
    sys.exit(exit_code)