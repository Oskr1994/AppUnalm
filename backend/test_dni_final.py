import requests, hashlib, hmac, base64, uuid, time, json, urllib3
from datetime import datetime, timezone

BASE_URL = "https://172.16.0.39:443"
APP_KEY, APP_SECRET, USER_ID = "53569134", "WOoL6JUp67ZlCNBjvUXQ", "admin"
ACCEPT, CTYPE = "application/json", "application/json; charset=UTF-8"
VERIFY_SSL = False

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

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

if __name__ == "__main__":
    print("=" * 80)
    print("TEST: Crear persona y agregar DNI")
    print("=" * 80)
    
    # PASO 1: Crear persona
    person_code = f"TEST{int(time.time())}"
    person_data = {
        "personGivenName": "Test",
        "personFamilyName": "DNI",
        "personCode": person_code,
        "gender": "1",
        "orgIndexCode": "1"
    }
    
    print("\nPASO 1: Crear persona")
    print(f"Datos: {json.dumps(person_data, indent=2)}")
    
    path_add = "/artemis/api/resource/v1/person/single/add"
    response = post_signed(path_add, person_data)
    
    print(f"\nRespuesta:")
    print(json.dumps(response, indent=2, ensure_ascii=False))
    
    if str(response.get("code")) != "0":
        print("\n❌ ERROR: No se pudo crear persona")
        exit(1)
    
    # Extraer personId
    data = response.get("data")
    person_id = data if isinstance(data, str) else data.get("personId") if isinstance(data, dict) else None
    
    print(f"\n✓ Persona creada")
    print(f"  PersonId: {person_id}")
    print(f"  PersonCode: {person_code}")
    
    if not person_id:
        print("❌ ERROR: No se obtuvo personId")
        exit(1)
    
    # PASO 2: Agregar DNI
    print("\n" + "=" * 80)
    print("PASO 2: Agregar DNI con customFieldsUpdate")
    print("=" * 80)
    
    dni_value = "12345678"
    path_update = f"/artemis/api/resource/v1/person/{person_id}/customFieldsUpdate"
    
    body_update = {
        "personId": person_id,
        "personCode": person_code,
        "list": [
            {
                "id": "1",
                "customFiledName": "DNI",  # Typo intencional de la API
                "customFieldType": 0,
                "customFieldValue": dni_value
            }
        ]
    }
    
    print(f"\nPath: {path_update}")
    print(f"Body:")
    print(json.dumps(body_update, indent=2))
    
    update_response = post_signed(path_update, body_update)
    
    print(f"\nRespuesta:")
    print(json.dumps(update_response, indent=2, ensure_ascii=False))
    
    if str(update_response.get("code")) != "0":
        print(f"\n❌ ERROR al actualizar DNI: {update_response.get('msg')}")
    else:
        print(f"\n✓ DNI actualizado exitosamente")
    
    # PASO 3: Verificar
    print("\n" + "=" * 80)
    print("PASO 3: Verificar persona con DNI")
    print("=" * 80)
    
    path_info = "/artemis/api/resource/v1/person/personCode/personInfo"
    info_response = post_signed(path_info, {"personCode": person_code})
    
    if str(info_response.get("code")) == "0":
        custom_fields = info_response.get("data", {}).get("customFieldList", [])
        print(f"\nCustom Fields ({len(custom_fields)}):")
        for field in custom_fields:
            name = field.get('customFieldName') or field.get('customFiledName')
            value = field.get('customFieldValue')
            print(f"  - {name}: '{value}'")
            
        # Verificar si el DNI se guardó
        dni_field = next((f for f in custom_fields if (f.get('customFieldName') or f.get('customFiledName')) == 'DNI'), None)
        if dni_field and dni_field.get('customFieldValue') == dni_value:
            print(f"\n✓✓✓ ÉXITO: DNI guardado correctamente con valor '{dni_value}'")
        else:
            print(f"\n❌ FALLO: DNI no se guardó o tiene valor incorrecto")
    else:
        print(f"❌ ERROR al verificar: {info_response.get('msg')}")
