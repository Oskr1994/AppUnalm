import requests, hashlib, hmac, base64, uuid, time, json, urllib3, argparse
from datetime import datetime, timezone

# ======= CONFIG (MISMAS CREDENCIALES DEL CODIGO ANTERIOR) =======
BASE_URL = "https://172.16.0.39:443"

APP_KEY, APP_SECRET, USER_ID = "53569134", "WOoL6JUp67ZlCNBjvUXQ", "admin"
ACCEPT, CTYPE = "application/json", "application/json; charset=UTF-8"
VERIFY_SSL = False

# Endpoints (según guía: todos llevan /artemis/...)
PATH_VEHICLE_LIST = "/artemis/api/resource/v1/vehicle/vehicleList"
PATH_VEHICLE_GROUP_LIST = "/artemis/api/resource/v1/vehicleGroup/vehicleGroupList"

OUTPUT_FILE = "vehicle_data.json"
DEFAULT_PAGE_SIZE = 200  # guía típica usa 1..500 en muchos listados; ajusta si tu servidor limita

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ======= HELPERS (MISMA FIRMA QUE TU SCRIPT) =======
def now_gmt():
    return datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")

def md5_b64(s: str) -> str:
    return base64.b64encode(hashlib.md5(s.encode("utf-8")).digest()).decode()

def sign_post(accept_v: str, md5_v: str, ctype_v: str, date_v: str, headers_to_sign_v: str, path: str) -> str:
    # Estructura de "signature string" (POST + headers + uri) descrita en la guía :contentReference[oaicite:3]{index=3}
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
        "userId": USER_ID,
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

# ======= VEHICLE GROUP DISCOVERY (OPCIONAL) =======
def guess_vehicle_group_index_code(group_item: dict) -> str | None:
    # Diferentes firmwares/documentos pueden usar nombres levemente distintos.
    for k in (
        "vehicleGroupIndexCode",
        "vehicleGroupId",
        "vehicleGroupCode",
        "indexCode",
        "groupIndexCode",
    ):
        v = group_item.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None

def get_first_vehicle_group_index_code() -> str | None:
    # Muchas APIs de lista usan pageNo/pageSize (ejemplo común en la guía) :contentReference[oaicite:4]{index=4}
    j = post_signed(PATH_VEHICLE_GROUP_LIST, {"pageNo": 1, "pageSize": 200})
    if str(j.get("code")) != "0":
        return None

    data = j.get("data") or {}
    lst = data.get("list") or data.get("vehicleGroupList") or []
    if not lst:
        return None

    for item in lst:
        code = guess_vehicle_group_index_code(item)
        if code:
            return code
    return None

# ======= VEHICLE LIST =======
def fetch_vehicle_page(page_no: int, page_size: int, vehicle_group_index_code: str | None) -> dict:
    body = {"pageNo": page_no, "pageSize": page_size}
    if vehicle_group_index_code:
        body["vehicleGroupIndexCode"] = vehicle_group_index_code
    return post_signed(PATH_VEHICLE_LIST, body)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pageSize", type=int, default=DEFAULT_PAGE_SIZE)
    ap.add_argument("--vehicleGroupIndexCode", default="", help="Si tu servidor lo exige, pásalo aquí.")
    args = ap.parse_args()

    vg = args.vehicleGroupIndexCode.strip() or None
    if vg is None:
        vg = get_first_vehicle_group_index_code()

    vehicles = []
    page = 1
    total = None

    while True:
        j = fetch_vehicle_page(page, args.pageSize, vg)

        if str(j.get("code", "0")) != "0":
            print("Error en respuesta API:", j)
            break

        data = j.get("data") or {}
        lst = data.get("list") or []

        if total is None:
            total = data.get("total", 0)

        vehicles.extend(lst)

        if not lst:
            break
        if total is not None and page * args.pageSize >= total:
            break

        page += 1

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(vehicles, f, ensure_ascii=False, indent=2)

    print(f"Archivo generado: {OUTPUT_FILE}")
    print(f"Total reportado por API: {total}")
    print(f"Registros exportados: {len(vehicles)}")
    if vg:
        print(f"vehicleGroupIndexCode usado: {vg}")
    else:
        print("vehicleGroupIndexCode: (no enviado)")

if __name__ == "__main__":
    main()
