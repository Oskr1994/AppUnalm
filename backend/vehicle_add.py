import requests, hashlib, hmac, base64, uuid, time, json, urllib3, argparse
from datetime import datetime, timezone, timedelta

# ======= CONFIG (MISMAS CREDENCIALES) =======
BASE_URL = "https://172.16.0.39:443"

APP_KEY, APP_SECRET, USER_ID = "53569134", "WOoL6JUp67ZlCNBjvUXQ", "admin"
ACCEPT, CTYPE = "application/json", "application/json; charset=UTF-8"
VERIFY_SSL = False

PATH_VEHICLE_ADD = "/artemis/api/resource/v1/vehicle/single/add"

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ======= HELPERS (MISMA FIRMA QUE TUS SCRIPTS) =======
def now_gmt():
    return datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")

def md5_b64(s: str) -> str:
    return base64.b64encode(hashlib.md5(s.encode("utf-8")).digest()).decode()

def sign_post(accept_v: str, md5_v: str, ctype_v: str, date_v: str, headers_to_sign_v: str, path: str) -> str:
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
        hmac.new(APP_SECRET.encode(), sts.encode("utf-8"), hashlib.sha256).digest()
    ).decode()

def build_headers(content_md5: str, date_v: str, nonce: str, ts: str, signature: str) -> dict:
    return {
        "Accept": ACCEPT,
        "Content-Type": CTYPE,
        "Content-MD5": content_md5,
        "Date": date_v,
        "userId": USER_ID,  # header requerido en la guía :contentReference[oaicite:6]{index=6}
        "X-Ca-Key": APP_KEY,
        "X-Ca-Nonce": nonce,
        "X-Ca-Timestamp": ts,
        "X-Ca-Signature-Headers": "userid,x-ca-key,x-ca-nonce,x-ca-timestamp",
        "X-Ca-Signature-Method": "HmacSHA256",
        "X-Ca-Signature": signature,
        "Connection": "close",
    }

def post_signed(path: str, body: dict, timeout: int = 20) -> dict:
    body_json = json.dumps(body, separators=(",", ":"), ensure_ascii=False)
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

    sig = sign_post(ACCEPT, md5_v, CTYPE, date_v, headers_to_sign, path)
    headers = build_headers(md5_v, date_v, nonce, ts, sig)

    r = requests.post(
        BASE_URL + path,
        headers=headers,
        data=body_json,
        verify=VERIFY_SSL,
        timeout=timeout,
    )
    try:
        return r.json()
    except Exception:
        return {"code": "HTTP_ERROR", "msg": f"Non-JSON response (HTTP {r.status_code})", "text": r.text}

def iso8601_with_tz(dt: datetime) -> str:
    # La guía pide ISO 8601 con zona horaria (ej: 2018-07-26T15:00:00+08:00) :contentReference[oaicite:7]{index=7}
    return dt.isoformat(timespec="seconds")

# ======= MAIN =======
def main():
    ap = argparse.ArgumentParser(description="Add vehicle via HikCentral OpenAPI")
    ap.add_argument("--plateNo", required=True, help="Placa (plateNo) [Req]")
    ap.add_argument("--vehicleGroupIndexCode", required=True, help="ID del grupo/lista de vehículos [Req]")
    ap.add_argument("--effectiveDate", default="", help="Inicio vigencia ISO8601 (si vacío: ahora)")
    ap.add_argument("--expiredDate", default="", help="Fin vigencia ISO8601 (si vacío: ahora + 365 días)")

    # Opcionales
    ap.add_argument("--personId", default="")
    ap.add_argument("--personGivenName", default="")
    ap.add_argument("--personFamilyName", default="")
    ap.add_argument("--phoneNo", default="")
    ap.add_argument("--plateCategory", default="")
    ap.add_argument("--plateArea", type=int, default=None)
    ap.add_argument("--vehicleColor", type=int, default=None)

    args = ap.parse_args()

    # Fechas por defecto (con tz). Si tu servidor usa otra tz, pásalas por CLI.
    now_local = datetime.now().astimezone()
    eff = args.effectiveDate.strip() or iso8601_with_tz(now_local)
    exp = args.expiredDate.strip() or iso8601_with_tz(now_local + timedelta(days=365))

    body = {
        "plateNo": args.plateNo.strip(),
        # En la tabla del PDF aparece como "vehicleGroupIndexcode" (c minúscula),
        # pero en respuestas y otros endpoints aparece "vehicleGroupIndexCode".
        # Aquí enviamos la forma más usada en requests; si tu servidor exigiera la otra,
        # cambia la key a "vehicleGroupIndexcode".
        "vehicleGroupIndexCode": args.vehicleGroupIndexCode.strip(),
        "effectiveDate": eff,
        "expiredDate": exp,
    }

    # Adjunta opcionales solo si vienen
    if args.personId.strip():
        body["personId"] = args.personId.strip()
    if args.personGivenName.strip():
        body["personGivenName"] = args.personGivenName.strip()
    if args.personFamilyName.strip():
        body["personFamilyName"] = args.personFamilyName.strip()
    if args.phoneNo.strip():
        body["phoneNo"] = args.phoneNo.strip()
    if args.plateCategory.strip():
        body["plateCategory"] = args.plateCategory.strip()
    if args.plateArea is not None:
        body["plateArea"] = args.plateArea
    if args.vehicleColor is not None:
        body["vehicleColor"] = args.vehicleColor

    resp = post_signed(PATH_VEHICLE_ADD, body)

    print(json.dumps(resp, ensure_ascii=False, indent=2))

    if str(resp.get("code")) == "0":
        print("\nOK: Vehículo registrado.")
    else:
        print("\nERROR: No se pudo registrar. Revisa 'msg' y parámetros enviados.")

if __name__ == "__main__":
    main()
