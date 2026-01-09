import requests, hashlib, hmac, base64, uuid, time, json, urllib3, os
from datetime import datetime, timezone


# ======= CONFIG =======
BASE_URL = "https://172.16.1.15:443"

# Endpoint para actualizar la foto
PATH_UPLOAD = "/artemis/api/resource/v1/person/face/update"

# Endpoint para listar personas por DNI
PATH_LIST = "/artemis/api/resource/v1/person/advance/personList"

APP_KEY = "53569134"
APP_SECRET = "WOoL6JUp67ZlCNBjvUXQ"
USER_ID = "admin"

ACCEPT = "application/json"
CTYPE = "application/json; charset=UTF-8"

# Desactiva verificación SSL si usas IP/HTTPS con certificado no válido en LAN
VERIFY_SSL = False
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


# ======= HELPERS FIRMA / CABECERAS =======
def now_gmt() -> str:
    """Fecha actual en formato GMT requerido por la API."""
    return datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")


def md5_b64(s: str) -> str:
    """MD5 en Base64 del string dado (usado en Content-MD5)."""
    return base64.b64encode(hashlib.md5(s.encode("utf-8")).digest()).decode()


def sign_post(accept_v: str, md5_v: str, ctype_v: str,
              date_v: str, headers_to_sign_v: str, path: str) -> str:
    """
    Construye la firma HmacSHA256 para una petición POST según el esquema Artemis.
    """
    sts = "\n".join([
        "POST",
        accept_v,
        md5_v,
        ctype_v,
        date_v,
        headers_to_sign_v,
        path,
    ])
    return base64.b64encode(
        hmac.new(APP_SECRET.encode(), sts.encode(), hashlib.sha256).digest()
    ).decode()


def build_headers(content_md5: str, date_v: str, nonce: str,
                  ts: str, signature: str) -> dict:
    """Construye las cabeceras necesarias para la llamada."""
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


def read_image_base64(image_path: str) -> str:
    """Lee una imagen del disco y la devuelve codificada en Base64 (string)."""
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode()


# ======= LISTADO PERSONAS Y BÚSQUEDA POR DNI =======
def fetch_person_page(page_no: int, page_size: int = 100) -> dict:
    """
    Obtiene una página de personas desde HikCentral.
    Devuelve el JSON de respuesta o {} si falla.
    """
    body_json = json.dumps(
        {"pageNo": page_no, "pageSize": page_size},
        separators=(",", ":")
    )

    ts = str(int(time.time() * 1000))
    nonce = str(uuid.uuid4())
    date_v = now_gmt()
    md5_v = md5_b64(body_json)

    headers_to_sign = "\n".join([
        f"userid:{USER_ID}",
        f"x-ca-key:{APP_KEY}",
        f"x-ca-nonce:{nonce}",
        f"x-ca-timestamp:{ts}",
    ])
    sig = sign_post(ACCEPT, md5_v, CTYPE, date_v, headers_to_sign, PATH_LIST)
    headers = build_headers(md5_v, date_v, nonce, ts, sig)

    r = requests.post(
        BASE_URL + PATH_LIST,
        headers=headers,
        data=body_json,
        verify=VERIFY_SSL,
        timeout=20,
    )
    try:
        return r.json()
    except Exception:
        return {}


def find_person_code_by_dni(dni: str) -> str | None:
    """
    Busca en la API a la persona cuyo customField 'dni' coincide
    y devuelve personCode. Si no encuentra, devuelve None.

    Recorre páginas de personList y revisa customFieldList
    buscando un campo llamado 'dni'.
    """
    page, page_size, total = 1, 100, None
    dni_l = dni.strip().lower()

    while True:
        j = fetch_person_page(page, page_size)
        if str(j.get("code", "0")) != "0":
            break

        data = j.get("data") or {}
        lst = data.get("list") or []

        if total is None:
            total = data.get("total", 0)

        for p in lst:
            for campo in p.get("customFieldList", []):
                name = (
                    campo.get("customFieldName")
                    or campo.get("customFiledName")
                    or ""
                ).strip().lower()
                value = (campo.get("customFieldValue") or "").strip()
                if name == "dni" and value.strip().lower() == dni_l:
                    return p.get("personCode")

        if not lst or page * page_size >= total:
            break
        page += 1

    return None


# ======= SUBIDA DE FOTO (ROSTRO) POR personCode =======

def upload_photo_for_person(person_code: str, image_path: str,
                            endpoint: str | None = None) -> dict:
    """
    Sube la foto de rostro de una persona usando:
      POST /artemis/api/resource/v1/person/face/update
    Cuerpo JSON:
      {
        "personCode": "XXXXX",
        "faceData":  "<BASE64>"
      }
    """
    if not os.path.exists(image_path):
        return {"code": -1, "msg": f"Archivo no existe: {image_path}"}

    endpoint = endpoint or PATH_UPLOAD

    # Imagen en Base64
    img_b64 = read_image_base64(image_path)
    body_json = json.dumps(
        {
            "personCode": person_code,
            "faceData": img_b64,
        },
        separators=(",", ":"),
    )

    ts = str(int(time.time() * 1000))
    nonce = str(uuid.uuid4())
    date_v = now_gmt()
    md5_v = md5_b64(body_json)

    headers_to_sign = "\n".join([
        f"userid:{USER_ID}",
        f"x-ca-key:{APP_KEY}",
        f"x-ca-nonce:{nonce}",
        f"x-ca-timestamp:{ts}",
    ])
    sig = sign_post(ACCEPT, md5_v, CTYPE, date_v, headers_to_sign, endpoint)
    headers = build_headers(md5_v, date_v, nonce, ts, sig)

    r = requests.post(
        BASE_URL + endpoint,
        headers=headers,
        data=body_json,
        verify=VERIFY_SSL,
        timeout=30,
    )
    try:
        return r.json()
    except Exception:
        return {"code": -2, "msg": "Respuesta no JSON", "status": r.status_code}


# ======= CLI =======

def main():
    """
    CLI:

    1) Subida individual:
       python subir_fotos.py single PERSON_CODE ruta/imagen.jpg

    2) Subida en lote por DNI (archivo = DNI.jpg en carpeta actual):
       python subir_fotos.py batch "*.jpg"

       - El script toma el nombre del archivo (sin extensión) como DNI.
       - Busca en HikCentral el personCode cuyo customField 'dni'
         coincida, y si lo encuentra, sube la foto a esa persona.
    """
    import argparse
    import glob

    parser = argparse.ArgumentParser(description="Subir foto(s) a HikCentral")
    sub = parser.add_subparsers(dest="cmd")

    # Subida individual:
    p_single = sub.add_parser("single", help="Subir una sola foto")
    p_single.add_argument("person_code", help="Código de la persona (personCode)")
    p_single.add_argument("image_path", help="Ruta al archivo de imagen (jpg/png)")
    p_single.add_argument(
        "--endpoint",
        default=None,
        help="Endpoint de subida (por defecto PATH_UPLOAD)",
    )

    # Subida en lote: archivo = DNI.jpg, se busca personCode por DNI
    p_batch = sub.add_parser(
        "batch",
        help="Subir fotos en lote desde carpeta actual (archivo = DNI.jpg)",
    )
    p_batch.add_argument(
        "pattern",
        nargs="?",
        default="*.jpg",
        help="Patrón de archivos (por defecto *.jpg)",
    )
    p_batch.add_argument(
        "--endpoint",
        default=None,
        help="Endpoint de subida (por defecto PATH_UPLOAD)",
    )

    args = parser.parse_args()

    # Si no se especifica comando, por defecto ejecuta batch con patrón por defecto
    if args.cmd is None:
        args.cmd = "batch"
        setattr(args, "pattern", getattr(args, "pattern", "*.jpg"))
        setattr(args, "endpoint", getattr(args, "endpoint", None))

    if args.cmd == "single":
        resp = upload_photo_for_person(
            args.person_code,
            args.image_path,
            endpoint=args.endpoint,
        )
        print(json.dumps(resp, ensure_ascii=False, indent=2))

    elif args.cmd == "batch":
        files = glob.glob(args.pattern)
        if not files:
            print("No se encontraron archivos con el patrón", args.pattern)
            return

        results = []
        for fp in files:
            base = os.path.basename(fp)
            name, _ext = os.path.splitext(base)
            dni = name.strip()

            # Buscar personCode usando el DNI en customFieldList
            person_code = find_person_code_by_dni(dni)
            if not person_code:
                results.append(
                    {
                        "file": fp,
                        "dni": dni,
                        "error": "DNI no encontrado en API",
                    }
                )
                continue

            r = upload_photo_for_person(
                person_code,
                fp,
                endpoint=getattr(args, "endpoint", None),
            )
            results.append(
                {
                    "file": fp,
                    "dni": dni,
                    "personCode": person_code,
                    "response": r,
                }
            )
            # Pequeña pausa para no saturar la API
            time.sleep(0.2)

        print(json.dumps({"batch": results}, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
