import requests, hashlib, hmac, base64, uuid, time, json, urllib3, argparse
from datetime import datetime, timezone

BASE_URL = "https://172.16.0.39:443"
PATH_PERSON_INFO = "/artemis/api/resource/v1/person/personCode/personInfo"

APP_KEY, APP_SECRET, USER_ID = "53569134", "WOoL6JUp67ZlCNBjvUXQ", "admin"
ACCEPT, CTYPE = "application/json", "application/json; charset=UTF-8"
VERIFY_SSL = False

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ===== helpers de firma =====
def now_gmt():
    return datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")

def md5_b64(s):
    return base64.b64encode(hashlib.md5(s.encode("utf-8")).digest()).decode()

def sign_post(accept_v, md5_v, ctype_v, date_v, headers_to_sign_v, path):
    sts = "\n".join(["POST", accept_v, md5_v, ctype_v, date_v, headers_to_sign_v, path])
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
    }

def post_signed(path, body):
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

    r = requests.post(BASE_URL + path, headers=headers, data=body_json, verify=VERIFY_SSL)
    return r.json()

# ===== main =====
if __name__ == "__main__":
    person_code = "6318119921"   # cambia por el que necesites

    body = {
        "personCode": person_code
    }

    resp = post_signed(PATH_PERSON_INFO, body)

    print("Respuesta completa:")
    print(json.dumps(resp, ensure_ascii=False, indent=2))

    # ---- extraer orgIndexCode ----
    data = resp.get("data") or {}
    org_index_code = data.get("orgIndexCode")

    print("\nDato que necesitas:")
    print("orgIndexCode =", org_index_code)
