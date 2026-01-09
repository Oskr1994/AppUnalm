import requests
import hashlib
import hmac
import base64
import uuid
import time
import json
import urllib3
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from .config import settings

# Desactivar advertencias SSL
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class HikCentralAPI:
    """Cliente para interactuar con HikCentral API"""
    
    def __init__(self):
        self.base_url = settings.HIKCENTRAL_BASE_URL
        self.app_key = settings.HIKCENTRAL_APP_KEY
        self.app_secret = settings.HIKCENTRAL_APP_SECRET
        self.user_id = settings.HIKCENTRAL_USER_ID
        self.verify_ssl = settings.HIKCENTRAL_VERIFY_SSL
        self.accept = "application/json"
        self.ctype = "application/json; charset=UTF-8"
    
    def _now_gmt(self) -> str:
        """Retorna fecha actual en formato GMT"""
        return datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")
    
    def _md5_b64(self, s: str) -> str:
        """Calcula MD5 y retorna en base64"""
        return base64.b64encode(hashlib.md5(s.encode("utf-8")).digest()).decode()
    
    def _sign_post(self, accept_v: str, md5_v: str, ctype_v: str, 
                   date_v: str, headers_to_sign_v: str, path: str) -> str:
        """Genera firma HMAC-SHA256"""
        sts = "\n".join([
            "POST", accept_v, md5_v, ctype_v, date_v, headers_to_sign_v, path
        ])
        return base64.b64encode(
            hmac.new(self.app_secret.encode(), sts.encode(), hashlib.sha256).digest()
        ).decode()
    
    def _build_headers(self, content_md5: str, date_v: str, 
                       nonce: str, ts: str, signature: str) -> dict:
        """Construye headers para la petición"""
        return {
            "Accept": self.accept,
            "Content-Type": self.ctype,
            "Content-MD5": content_md5,
            "Date": date_v,
            "userId": self.user_id,
            "X-Ca-Key": self.app_key,
            "X-Ca-Nonce": nonce,
            "X-Ca-Timestamp": ts,
            "X-Ca-Signature-Headers": "userid,x-ca-key,x-ca-nonce,x-ca-timestamp",
            "X-Ca-Signature-Method": "HmacSHA256",
            "X-Ca-Signature": signature,
            "Connection": "close",
        }
    
    def post_signed(self, path: str, body: dict, timeout: int = 20) -> dict:
        """Realiza petición POST firmada"""
        body_json = json.dumps(body, separators=(",", ":"), ensure_ascii=False)
        ts = str(int(time.time() * 1000))
        nonce = str(uuid.uuid4())
        date_v = self._now_gmt()
        md5_v = self._md5_b64(body_json)
        
        headers_to_sign = "\n".join([
            f"userid:{self.user_id}",
            f"x-ca-key:{self.app_key}",
            f"x-ca-nonce:{nonce}",
            f"x-ca-timestamp:{ts}",
        ])
        
        sig = self._sign_post(self.accept, md5_v, self.ctype, date_v, headers_to_sign, path)
        headers = self._build_headers(md5_v, date_v, nonce, ts, sig)
        
        try:
            r = requests.post(
                self.base_url + path,
                headers=headers,
                data=body_json,
                verify=self.verify_ssl,
                timeout=timeout,
            )
            return r.json()
        except Exception as e:
            return {"code": "ERROR", "msg": str(e)}
    
    # === Métodos para Personas ===
    
    def add_person(self, person_data: dict) -> dict:
        """Agrega una persona a HikCentral"""
        path = "/artemis/api/resource/v1/person/single/add"
        return self.post_signed(path, person_data)
    
    def update_person(self, person_id: str, person_data: dict) -> dict:
        """Actualiza una persona en HikCentral"""
        path = "/artemis/api/resource/v1/person/single/update"
        person_data["personId"] = person_id
        return self.post_signed(path, person_data)
    
    def get_person_list(self, page_no: int = 1, page_size: int = 100) -> dict:
        """Lista personas con todos los campos incluyendo DNI"""
        path = "/artemis/api/resource/v1/person/personList"
        body = {
            "pageNo": page_no, 
            "pageSize": page_size
        }
        return self.post_signed(path, body)
    
    def get_person_by_code(self, person_code: str) -> dict:
        """Obtiene información de una persona por código"""
        path = "/artemis/api/resource/v1/person/personCode/personInfo"
        return self.post_signed(path, {"personCode": person_code})
    
    def add_custom_field(self, person_id: str, person_code: str, custom_field_name: str, custom_field_value: str) -> dict:
        """Agrega un campo personalizado a una persona"""
        path = f"/artemis/api/resource/v1/person/{person_id}/customFieldsUpdate"
        body = {
            "personId": person_id,
            "personCode": person_code,
            "list": [
                {
                    "id": "1",
                    "customFiledName": custom_field_name,  # Typo intencional según API
                    "customFieldType": 0,
                    "customFieldValue": custom_field_value
                }
            ]
        }
        return self.post_signed(path, body)
    
    # === Métodos para Access Levels ===
    
    def list_privilege_groups(self, page_no: int = 1, page_size: int = 100) -> dict:
        """Lista grupos de privilegios (access levels)"""
        path = "/artemis/api/acs/v1/privilege/group"
        body = {"pageNo": page_no, "pageSize": page_size, "type": 1}
        return self.post_signed(path, body)
    
    def assign_access_level(self, person_code: str, privilege_group_id: str) -> dict:
        """Asigna access level a una persona"""
        # Primero obtener personId
        person_info = self.get_person_by_code(person_code)
        if str(person_info.get("code")) != "0":
            return {"success": False, "message": "No se encontró la persona", "raw": person_info}
        
        data = person_info.get("data", {})
        person_id = data.get("personId")
        
        if not person_id:
            return {"success": False, "message": "No se pudo obtener personId"}
        
        # Asignar al grupo
        path = "/artemis/api/acs/v1/privilege/group/single/addPersons"
        body = {
            "privilegeGroupId": privilege_group_id,
            "type": 1,
            "list": [{"id": str(person_id)}]
        }
        
        response = self.post_signed(path, body)
        return {
            "success": str(response.get("code")) == "0",
            "message": response.get("msg", ""),
            "raw": response
        }
    
    # === Métodos para Organizaciones ===
    
    def list_organizations(self, page_no: int = 1, page_size: int = 500) -> dict:
        """Lista organizaciones"""
        path = "/artemis/api/resource/v1/org/advance/orgList"
        body = {"pageNo": page_no, "pageSize": page_size}
        return self.post_signed(path, body)
    
    # === Métodos para Vehículos ===
    
    def list_vehicles(self, page_no: int = 1, page_size: int = 200, vehicle_group_code: str = "2") -> dict:
        """Lista vehículos"""
        path = "/artemis/api/resource/v1/vehicle/vehicleList"
        body = {
            "pageNo": page_no,
            "pageSize": page_size,
            "vehicleGroupIndexCode": vehicle_group_code
        }
        return self.post_signed(path, body)
    
    def add_vehicle(self, vehicle_data: dict) -> dict:
        """
        Agrega un vehículo a HikCentral
        vehicle_data debe contener:
        - plateNo: str
        - personId: str
        - plateArea: int (opcional, default 0)
        - vehicleGroupIndexCode: str (opcional, default "2")
        - effectiveDate: str (formato ISO)
        - expiredDate: str (formato ISO)
        """
        path = "/artemis/api/resource/v1/vehicle/single/add"
        return self.post_signed(path, vehicle_data)
    
    def update_vehicle(self, vehicle_data: dict) -> dict:
        """
        Actualiza un vehículo en HikCentral
        vehicle_data debe contener:
        - plateNo: str (placa actual)
        - personName: str (nombre completo de la persona)
        - effectiveDate: str (formato ISO)
        - expiredDate: str (formato ISO)
        """
        path = "/artemis/api/resource/v1/vehicle/single/update"
        return self.post_signed(path, vehicle_data)
    
    def delete_vehicle(self, vehicle_ids: list) -> dict:
        """
        Elimina uno o más vehículos de HikCentral
        vehicle_ids: lista de IDs de vehículos a eliminar
        """
        path = "/artemis/api/resource/v1/vehicle/single/delete"
        # La API de HikCentral espera 'vehicleId' (singular) como string
        # aunque el endpoint permita eliminar múltiples, se envía uno a la vez
        body = {"vehicleId": str(vehicle_ids[0]) if vehicle_ids else ""}
        return self.post_signed(path, body)

# Instancia global
hik_api = HikCentralAPI()
