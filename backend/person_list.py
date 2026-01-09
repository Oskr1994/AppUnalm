import requests, hashlib, hmac, base64, uuid, time, json, urllib3
from datetime import datetime, timezone

# ======= CONFIG =======
BASE_URL  = "https://172.16.0.39:443"
PATH_LIST = "/artemis/api/resource/v1/person/advance/personList"
APP_KEY, APP_SECRET, USER_ID = "53569134", "WOoL6JUp67ZlCNBjvUXQ", "admin"
ACCEPT, CTYPE = "application/json", "application/json; charset=UTF-8"
VERIFY_SSL = False
OUTPUT_FILE = "person_data.json"  # exporta todos

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ======= HELPERS =======
def now_gmt():
    return datetime.now(timezone.utc).strftime('%a, %d %b %Y %H:%M:%S GMT')

def md5_b64(s):
    return base64.b64encode(hashlib.md5(s.encode("utf-8")).digest()).decode()

def sign_post(accept_v, md5_v, ctype_v, date_v, headers_to_sign_v, path):
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

def build_headers(content_md5, date_v, nonce, ts, signature):
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

def fetch_page(page_no, page_size=100):
    body_json = json.dumps(
        {"pageNo": page_no, "pageSize": page_size},
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

# ======= MAIN =======
def main():
    personas = []
    page, page_size, total = 1, 100, None
    sin_foto_count = 0
    con_foto_count = 0

    while True:
        j = fetch_page(page, page_size)
        if str(j.get("code", "0")) != "0":
            print("Error en respuesta API:", j)
            break

        data = j.get("data") or {}
        lst = data.get("list") or []
        if total is None:
            total = data.get("total", 0)

        for p in lst:
            # --- Custom fields: DNI / Departamento / Puesto ---
            dni = None
            departament_cf = None
            position_cf = None

            for campo in p.get("customFieldList", []):
                name = (campo.get("customFieldName")
                        or campo.get("customFiledName")  # typo
                        or "").strip().lower()
                value = campo.get("customFieldValue")

                if name == "dni":
                    dni = value
                elif name in ("departamento", "department", "departament", "area", "área"):
                    departament_cf = value
                elif name in ("position", "puesto", "cargo"):
                    position_cf = value

            # --- Foto ---
            pic_uri = ((p.get("personPhoto") or {}).get("picUri") or "").strip()
            tiene_foto = bool(pic_uri)
            if tiene_foto:
                con_foto_count += 1
            else:
                sin_foto_count += 1

            # --- Departamento ---
            departament = (
                departament_cf
                or p.get("orgName")          # nombre de la org/departamento
                or p.get("orgIndexCode")
            )

            # --- Puesto / Position (ampliado) ---

            position = (
                position_cf
                or p.get("post")
                or p.get("postId")
                or p.get("postName")
                or p.get("position")
                or p.get("jobTitle")
                or p.get("jobName")
                or p.get("title")
            )

            # --- Género: numérico + descripción ---
            gender_code = p.get("gender") or p.get("sex")
            if isinstance(gender_code, str) and gender_code.isdigit():
                gender_code = int(gender_code)

            gender_map = {
                1: "Masculino",
                2: "Femenino",
                0: "Desconocido",
            }
            gender_desc = gender_map.get(gender_code, "Desconocido")

            personas.append({
                "ID": p.get("personCode"),
                "personID": p.get("personId"),
                "Nombre": p.get("personName"),
                "DNI": dni,
                "Departament": departament,
                "Gender": gender_code,
                "GenderDesc": gender_desc,
                "Position": position,
                "FotoURI": pic_uri if pic_uri else None,
                "TieneFoto": tiene_foto,
            })

        if not lst or page * page_size >= total:
            break
        page += 1

    # Exporta JSON con TODAS las personas
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(personas, f, ensure_ascii=False, indent=2)

    print(f"\nArchivo generado: {OUTPUT_FILE}")
    print(f"Total de personas reportado por API: {total}")
    print(f"Personas exportadas: {len(personas)}")
    print(f"Con foto: {con_foto_count}")
    print(f"Sin foto: {sin_foto_count}")

if __name__ == "__main__":
    main()
