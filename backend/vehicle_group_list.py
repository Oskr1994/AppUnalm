import os
import json
import uuid
import time
import base64
import hashlib
import hmac
import sys
from datetime import datetime, timezone
from typing import Dict, Any, List

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = os.environ.get("BASE_URL") or "https://172.16.0.39:443"
APP_KEY = os.environ.get("APP_KEY") or "53569134"
APP_SECRET = os.environ.get("APP_SECRET") or "WOoL6JUp67ZlCNBjvUXQ"
USER_ID = os.environ.get("USER_ID") or "admin"
VERIFY_SSL = False
ACCEPT = "application/json"
CTYPE = "application/json; charset=UTF-8"

CANDIDATES: List[Dict[str, Any]] = [
    {"path": "/artemis/api/resource/v1/vehicle/vehicleGroup/page", "body": {"pageNo": 1, "pageSize": 100}},
    {"path": "/artemis/api/resource/v1/vehicle/vehicleGroup/list", "body": {}},
    {"path": "/artemis/api/resource/v1/vehicle/group/page", "body": {"pageNo": 1, "pageSize": 100}},
    {"path": "/artemis/api/resource/v1/vehicle/group/list", "body": {}},
    {"path": "/artemis/api/resource/v1/vehicle/group/tree", "body": {}},
]


def now_gmt() -> str:
    return datetime.now(timezone.utc).strftime('%a, %d %b %Y %H:%M:%S GMT')


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
    return base64.b64encode(hmac.new(APP_SECRET.encode(), sts.encode(), hashlib.sha256).digest()).decode()


def build_headers(body_json: str, path: str) -> Dict[str, str]:
    ts = str(int(time.time() * 1000))
    nonce = str(uuid.uuid4())
    date_v = now_gmt()
    md5_v = md5_b64(body_json)

    headers_to_sign = "\n".join([
        f"x-ca-key:{APP_KEY}",
        f"x-ca-nonce:{nonce}",
        f"x-ca-timestamp:{ts}",
    ])
    sig = sign_post(ACCEPT, md5_v, CTYPE, date_v, headers_to_sign, path)

    return {
        "Accept": ACCEPT,
        "Content-Type": CTYPE,
        "Content-MD5": md5_v,
        "Date": date_v,
        "userId": USER_ID,
        "X-Ca-Key": APP_KEY,
        "X-Ca-Nonce": nonce,
        "X-Ca-Timestamp": ts,
        "X-Ca-Signature-Headers": "x-ca-key,x-ca-nonce,x-ca-timestamp",
        "X-Ca-Signature-Method": "HmacSHA256",
        "X-Ca-Signature": sig,
        "Connection": "close",
    }


def flatten_groups(j: Dict[str, Any]) -> List[Dict[str, Any]]:
    # Intenta extraer lista de grupos desde diferentes estructuras comunes
    data = (j or {}).get("data")
    result: List[Dict[str, Any]] = []

    def take(rec: Dict[str, Any]):
        idx = rec.get("indexCode") or rec.get("groupIndexCode") or rec.get("vehicleGroupIndexCode")
        name = rec.get("name") or rec.get("groupName") or rec.get("vehicleGroupName")
        if idx or name:
            result.append({"indexCode": idx, "name": name})

    if isinstance(data, dict):
        if isinstance(data.get("list"), list):
            for r in data.get("list"):
                if isinstance(r, dict):
                    take(r)
        elif isinstance(data.get("data"), list):
            for r in data.get("data"):
                if isinstance(r, dict):
                    take(r)
        else:
            # podría venir un árbol
            if isinstance(data, dict):
                stack = [data]
                while stack:
                    cur = stack.pop()
                    if isinstance(cur, dict):
                        take(cur)
                        for k in ("children", "nodes", "items"):
                            v = cur.get(k)
                            if isinstance(v, list):
                                stack.extend(v)
    elif isinstance(data, list):
        for r in data:
            if isinstance(r, dict):
                take(r)

    return result


def try_one(path: str, body: Dict[str, Any], dry_run: bool = False) -> Dict[str, Any]:
    body_json = json.dumps(body, separators=(",", ":"))
    headers = build_headers(body_json, path)
    url = BASE_URL + path
    if dry_run:
        return {"url": url, "path": path, "headers": headers, "body": body, "note": "dry-run"}
    r = requests.post(url, headers=headers, data=body_json, verify=VERIFY_SSL, timeout=20)
    try:
        j = r.json()
    except Exception:
        j = {"text": (r.text or "")[:400]}
    return {"status": r.status_code, "json": j}


def main():
    dry = "--dry-run" in sys.argv
    verbose = "--verbose" in sys.argv

    found: List[Dict[str, Any]] = []
    attempts: List[Dict[str, Any]] = []

    for cand in CANDIDATES:
        res = try_one(cand["path"], cand["body"], dry_run=dry)
        attempts.append({"path": cand["path"], "res": res})
        if dry:
            continue
        j = res.get("json") or {}
        code = None
        if isinstance(j, dict):
            code = j.get("code")
        if str(code) == "0":
            groups = flatten_groups(j)
            if groups:
                found = groups
                break

    output = {"found": found, "attempted": [{"path": a["path"], "status": a["res"].get("status"), "code": (a["res"].get("json") or {}).get("code")} for a in attempts]}
    if verbose or not found:
        # mostrar intentos cuando no hay hallazgos
        print(json.dumps(output, ensure_ascii=False, indent=2))
    else:
        print(json.dumps({"found": found}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
