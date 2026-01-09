# asignar_access_level.py

# ============================================================================
# IMPORTACIONES
# ============================================================================
import requests      # Para realizar peticiones HTTP
import hashlib       # Para calcular hashes MD5 y SHA256
import hmac          # Para firmar mensajes con HMAC
import base64        # Para codificar en base64
import uuid          # Para generar identificadores únicos
import time          # Para obtener timestamps
import json          # Para serializar/deserializar JSON
import urllib3       # Para desactivar advertencias SSL
import argparse      # Para parsear argumentos de línea de comandos
from datetime import datetime, timezone

# ============================================================================
# CONFIGURACIÓN DE LA API
# ============================================================================
BASE_URL = "https://172.16.0.39:443"  # URL base del servidor Artemis
APP_KEY, APP_SECRET, USER_ID = "53569134", "WOoL6JUp67ZlCNBjvUXQ", "admin"  # Credenciales de autenticación
ACCEPT, CTYPE = "application/json", "application/json; charset=UTF-8"  # Headers de tipo de contenido
VERIFY_SSL = False  # Desactivar verificación SSL para certificados autofirmados

# Endpoints de la API
PATH_PERSON_INFO_BY_CODE = "/artemis/api/resource/v1/person/personCode/personInfo"  # Obtener info de persona por código
PATH_ADD_PERSONS_TO_PRIVILEGE = "/artemis/api/acs/v1/privilege/group/single/addPersons"  # Agregar personas a grupo de privilegios

# Desactivar advertencias de certificado SSL no verificado
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ============================================================================
# FUNCIONES AUXILIARES PARA AUTENTICACIÓN
# ============================================================================

def now_gmt():
    """Retorna la fecha y hora actual en formato GMT requerido por la API"""
    return datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")

def md5_b64(s: str) -> str:
    """Calcula el hash MD5 de una cadena y lo retorna en base64"""
    return base64.b64encode(hashlib.md5(s.encode("utf-8")).digest()).decode()

def sign_post(accept_v: str, md5_v: str, ctype_v: str, date_v: str, headers_to_sign_v: str, path: str) -> str:
    """
    Genera la firma HMAC-SHA256 requerida para autenticar la petición POST.
    
    Args:
        accept_v: Valor del header Accept
        md5_v: Hash MD5 del body en base64
        ctype_v: Valor del header Content-Type
        date_v: Fecha en formato GMT
        headers_to_sign_v: Headers adicionales a firmar
        path: Ruta del endpoint
    
    Returns:
        Firma en base64
    """
    # Construir el string que se va a firmar con todos los componentes
    sts = "\n".join([
        "POST",
        accept_v,
        md5_v,
        ctype_v,
        date_v,
        headers_to_sign_v,
        path,
    ])
    # Generar firma HMAC-SHA256 y codificar en base64
    return base64.b64encode(
        hmac.new(APP_SECRET.encode("utf-8"), sts.encode("utf-8"), hashlib.sha256).digest()
    ).decode()

def build_headers(content_md5: str, date_v: str, nonce: str, ts: str, signature: str) -> dict:
    """
    Construye el diccionario de headers HTTP requeridos por la API.
    
    Args:
        content_md5: Hash MD5 del contenido en base64
        date_v: Fecha en formato GMT
        nonce: Número único (UUID)
        ts: Timestamp en milisegundos
        signature: Firma HMAC-SHA256 en base64
    
    Returns:
        Diccionario con todos los headers necesarios
    """
    return {
        "Accept": ACCEPT,
        "Content-Type": CTYPE,
        "Content-MD5": content_md5,
        "Date": date_v,
        "userId": USER_ID,
        "X-Ca-Key": APP_KEY,
        "X-Ca-Nonce": nonce,
        "X-Ca-Timestamp": ts,
        "X-Ca-Signature-Headers": "userid,x-ca-key,x-ca-nonce,x-ca-timestamp",
        "X-Ca-Signature-Method": "HmacSHA256",
        "X-Ca-Signature": signature,
        "Connection": "close",
    }

# ============================================================================
# FUNCIÓN PRINCIPAL PARA REALIZAR PETICIONES FIRMADAS
# ============================================================================

def post_signed(path: str, body: dict, timeout: int = 20) -> dict:
    """
    Realiza una petición POST firmada a la API de Artemis.
    
    Args:
        path: Ruta del endpoint (sin la URL base)
        body: Diccionario con el contenido del body
        timeout: Tiempo máximo de espera en segundos
    
    Returns:
        Respuesta de la API en formato JSON
    """
    # Serializar el body a JSON compacto
    body_json = json.dumps(body, separators=(",", ":"), ensure_ascii=False)
    
    # Generar valores únicos para la petición
    ts = str(int(time.time() * 1000))  # Timestamp en milisegundos
    nonce = str(uuid.uuid4())  # UUID único
    date_v = now_gmt()  # Fecha actual en GMT
    md5_v = md5_b64(body_json)  # MD5 del body

    # Construir la cadena de headers que se van a firmar
    headers_to_sign = "\n".join([
        f"userid:{USER_ID}",
        f"x-ca-key:{APP_KEY}",
        f"x-ca-nonce:{nonce}",
        f"x-ca-timestamp:{ts}",
    ])

    # Generar la firma y construir los headers completos
    sig = sign_post(ACCEPT, md5_v, CTYPE, date_v, headers_to_sign, path)
    headers = build_headers(md5_v, date_v, nonce, ts, sig)

    # Realizar la petición HTTP POST
    r = requests.post(
        BASE_URL + path,
        headers=headers,
        data=body_json,
        verify=VERIFY_SSL,
        timeout=timeout,
    )

    # Intentar parsear la respuesta como JSON
    try:
        return r.json()
    except Exception:
        return {"code": "HTTP_ERROR", "msg": f"Non-JSON response (HTTP {r.status_code})", "text": r.text}

# ============================================================================
# FUNCIÓN PARA OBTENER ID DE PERSONA
# ============================================================================

def get_person_id_by_person_code(person_code: str) -> dict:
    """
    Obtiene la información de una persona usando su código de empleado.
    
    Args:
        person_code: Código de empleado de la persona
    
    Returns:
        Diccionario con ok, personId, personCode, personName y raw (respuesta completa)
    """
    # Realizar petición al endpoint de información de persona
    j = post_signed(PATH_PERSON_INFO_BY_CODE, {"personCode": person_code})
    
    # Verificar si la petición fue exitosa (code = 0)
    if str(j.get("code")) != "0":
        return {"ok": False, "raw": j}

    # Extraer datos de la respuesta
    data = j.get("data") or {}
    
    # Intentar capturar campos comunes (pueden variar según servidor)
    person_id = data.get("personId") or data.get("id") or data.get("personID")
    person_name = data.get("personName") or data.get("name")
    person_code_out = data.get("personCode") or person_code

    return {"ok": True, "personId": person_id, "personCode": person_code_out, "personName": person_name, "raw": j}

# ============================================================================
# FUNCIÓN PRINCIPAL DEL PROGRAMA
# ============================================================================

def main():
    """
    Función principal que:
    1. Parsea argumentos de línea de comandos
    2. Obtiene el personId usando el personCode
    3. Agrega la persona al grupo de privilegios especificado
    """
    # Configurar parser de argumentos
    ap = argparse.ArgumentParser()
    ap.add_argument("--privilegeGroupId", required=True, help="ID del grupo de privilegios")
    ap.add_argument("--personCode", required=True, help="Código de empleado de la persona")
    ap.add_argument("--type", default="1", help="Tipo (normalmente 1=persona)")
    args = ap.parse_args()

    # Obtener y limpiar argumentos
    person_code = args.personCode.strip()
    pgid = str(args.privilegeGroupId).strip()
    type_v = int(str(args.type).strip())

    # ========================================================================
    # PASO 1: Obtener información de la persona
    # ========================================================================
    info = get_person_id_by_person_code(person_code)
    
    # Verificar si se obtuvo la información correctamente
    if not info.get("ok"):
        print("No se pudo obtener personId con personCode.")
        print(json.dumps(info.get("raw"), indent=2, ensure_ascii=False))
        return

    # Mostrar información de la persona encontrada
    print("Persona encontrada:", json.dumps({
        "personCode": info.get("personCode"),
        "personId": info.get("personId"),
        "personName": info.get("personName"),
    }, indent=2, ensure_ascii=False))

    # Validar que se haya obtenido el personId
    if not info.get("personId"):
        print("ERROR: la respuesta no trajo personId. Revisa 'raw' para ver el nombre exacto del campo.")
        print(json.dumps(info.get("raw"), indent=2, ensure_ascii=False))
        return

    # ========================================================================
    # PASO 2: Agregar persona al grupo de privilegios
    # ========================================================================
    # Construir el body de la petición con el formato requerido
    body = {
        "privilegeGroupId": pgid,  # ID del grupo de privilegios
        "type": type_v,  # Tipo de entidad (1 = persona)
        "list": [
            {"id": str(info["personId"])}  # Lista con el ID de la persona
        ],
    }

    # Realizar la petición para agregar la persona al grupo
    resp = post_signed(PATH_ADD_PERSONS_TO_PRIVILEGE, body)
    
    # Mostrar respuesta final
    print("Respuesta:", json.dumps(resp, indent=2, ensure_ascii=False))

# ============================================================================
# PUNTO DE ENTRADA DEL SCRIPT
# ============================================================================

if __name__ == "__main__":
    main()


# ============================================================================
# EJEMPLO DE USO
# ============================================================================
# Agregar una persona al grupo de privilegios "ACCESO TOTAL" (ID=2)
# python asignar_access_level.py --privilegeGroupId "2" --personCode "6318119921" --type 1