import requests, hashlib, hmac, base64, uuid, time, json, urllib3
from datetime import datetime, timezone

# ===== CONFIG =====
BASE_URL = "https://172.16.0.39:443"
PATH_CUSTOM_FIELDS = "/artemis/api/resource/v1/person/customFields"

APP_KEY, APP_SECRET, USER_ID = "53569134", "WOoL6JUp67ZlCNBjvUXQ", "admin"
ACCEPT, CTYPE = "application/json", "application/json; charset=UTF-8"
VERIFY_SSL = False

OUTPUT_FILE = "person_custom_fields.json"

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ===== HELPERS (firma HMAC) =====
def now_gmt():
    return datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")

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

def post_signed(path, body, timeout=20):
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

# ===== MAIN =====
def main():
    page = 1
    page_size = 200
    total = None
    all_fields = []

    while True:
        body = {
            "pageNo": page,
            "pageSize": page_size
        }

        j = post_signed(PATH_CUSTOM_FIELDS, body)

        if str(j.get("code", "0")) != "0":
            print("Error en respuesta API:", j)
            break

        data = j.get("data") or {}
        lst = data.get("list") or []

        if total is None:
            total = data.get("total", 0)

        for f in lst:
            all_fields.append(f)

        if not lst:
            break
        if total is not None and page * page_size >= total:
            break

        page += 1

    # Guardar en JSON
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_fields, f, ensure_ascii=False, indent=2)

    print(f"Archivo generado: {OUTPUT_FILE}")
    print(f"Total de Custom Fields: {len(all_fields)}")

if __name__ == "__main__":
    main()
