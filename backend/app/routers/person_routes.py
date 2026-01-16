from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from sqlalchemy.orm import Session
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor
import time
from datetime import datetime, timedelta
import difflib

from .. import models, schemas, auth
from ..database import get_db
from ..hikcentral import hik_api
from .. import audit

router = APIRouter(prefix="/api/persons", tags=["Personas"])

# Cache de vehículos en memoria
_vehicles_cache = {
    "data": {},  # {person_name: [plates]}
    "expires_at": None
}

@router.post("/add", response_model=schemas.MessageResponse)
async def add_person(
    person: schemas.PersonCreate,
    current_user: models.User = Depends(auth.require_role(["admin", "gestion_vehicular", "gestion_peatonal", "postulante"]))
):
    """Agrega una persona a HikCentral (requiere rol admin, operador o personal_seguridad)"""
    # Preparar datos básicos de la persona SIN el DNI
    person_data = {
        "personGivenName": person.personGivenName,
        "personFamilyName": person.personFamilyName,
        "personCode": person.personCode,
        "gender": person.gender,
        "orgIndexCode": person.orgIndexCode,
    }
    
    # Audit Log
    db = Session.object_session(current_user)
    audit.create_audit_log(
        db, 
        current_user.id, 
        "CREATE", 
        "PERSONAS", 
        f"Creación de persona: {person.personGivenName} {person.personFamilyName} (Code: {person.personCode})"
    )
    
    if person.position:
        person_data["position"] = person.position
    if person.email:
        person_data["email"] = person.email
    if person.phoneNo:
        person_data["phoneNo"] = person.phoneNo
    
    # PASO 1: Crear la persona primero
    print(f"DEBUG PASO 1: Creando persona con datos: {person_data}")
    
    try:
        response = hik_api.add_person(person_data)
        print(f"DEBUG: Respuesta creación persona (tipo: {type(response)}): {response}")
        
        # Validar que response sea un diccionario
        if not isinstance(response, dict):
            print(f"ERROR: La respuesta no es un diccionario, es: {type(response)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error en respuesta de HikCentral: formato inválido"
            )
        
        if str(response.get("code")) != "0":
            error_msg = response.get('msg', 'Error desconocido')
            print(f"ERROR: No se pudo crear persona: {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error al agregar persona: {error_msg}"
            )
        
        print(f"✓ Persona creada exitosamente")
        
        # Extraer personId de la respuesta
        data = response.get("data")
        
        # La API devuelve data como string directo con el personId
        if isinstance(data, str):
            person_id = data
        elif isinstance(data, dict):
            person_id = data.get("personId")
        else:
            person_id = None
        
        # Determinar personCode real para operaciones subsiguientes (DNI, Foto, etc)
        person_code_real = person.personCode
        
        # Si no vino en el request, debemos buscarlo en HikCentral usando el personId
        if not person_code_real and person_id:
             print(f"PersonCode no proporcionado. Buscando en HikCentral para ID: {person_id}")
             try:
                # Dar un momento para que HikCentral indexe
                import time
                time.sleep(1.0) 
                
                # Buscar en todas las páginas hasta encontrarlo
                page = 1
                found = False
                while not found:
                    print(f"Buscando personCode en página {page}...")
                    list_response = hik_api.get_person_list(page_no=page, page_size=200) # Usar página grande para ir rápido
                    
                    if str(list_response.get("code")) != "0":
                        print(f"Error al listar personas: {list_response.get('msg')}")
                        break
                        
                    data_list = list_response.get("data", {})
                    persons_list = data_list.get("list", [])
                    total = data_list.get("total", 0)
                    
                    if not persons_list:
                        break
                        
                    for p in persons_list:
                        if str(p.get("personId")) == str(person_id):
                            person_code_real = p.get("personCode")
                            print(f"✓ PersonCode RECUPERADO de HikCentral: {person_code_real}")
                            found = True
                            break
                    
                    if found:
                        break
                        
                    # Verificar si hay más páginas
                    if page * 200 >= total:
                        break
                    page += 1
                
                if not person_code_real:
                    print("ADVERTENCIA: No se pudo encontrar el personCode después de buscar en todas las páginas")
                    
             except Exception as e:
                print(f"Advertencia: Excepción al recuperar personCode: {e}")

        # PASO 2: Si hay DNI, agregarlo usando customFieldsUpdate
        if person.certificateNumber and person.certificateNumber.strip() and person_id:
                print(f"Agregando DNI '{person.certificateNumber.strip()}' a persona")
                try:
                    if not person_code_real:
                        print(f"No se pudo obtener personCode para personId {person_id}, saltando carga de DNI")
                    else:
                        # Usar el endpoint correcto - ruta fija, todo en el body
                        # IMPORTANTE: Solo enviar personCode, NO personId
                        path = "/artemis/api/resource/v1/person/personId/customFieldsUpdate"
                        
                        update_data = {
                            "personCode": person_code_real,
                            "list": [
                                {
                                    "id": "1",
                                    "customFiledName": "DNI",
                                    "customFieldType": 0,
                                    "customFieldValue": person.certificateNumber.strip()
                                }
                            ]
                        }
                        
                        print(f"Body UPDATE: {json.dumps(update_data, indent=2)}")
                        
                        update_response = hik_api.post_signed(path, update_data)
                        print(f"Respuesta update: {update_response}")
                        
                        if str(update_response.get("code")) != "0":
                            error_msg = update_response.get('msg', 'Error desconocido')
                            print(f"Error al agregar DNI: {error_msg}")
                        else:
                            print(f"✓ DNI agregado exitosamente")
                except Exception as e:
                    print(f"Error al agregar DNI: {str(e)}")

        # PASO 2.5: Si vino foto en el payload, subirla a HikCentral usando personCode
        try:
            if getattr(person, "photo", None) and person_id:
                if not person_code_real:
                     print("No se tiene personCode, no se puede subir foto.")
                else:
                    photo_val = getattr(person, "photo")
                    # extraer base64 si viene como data URL
                    if isinstance(photo_val, str) and photo_val.startswith("data:"):
                        try:
                            face_b64 = photo_val.split(",", 1)[1]
                        except Exception:
                            face_b64 = photo_val
                    else:
                        face_b64 = photo_val

                    print("Subiendo foto a HikCentral para personCode:", person_code_real)
                    path_face = "/artemis/api/resource/v1/person/face/update"
                    body_face = {"personCode": person_code_real, "faceData": face_b64}
                    face_resp = hik_api.post_signed(path_face, body_face)
                    print("Respuesta subida foto:", face_resp)
        except Exception as e:
            print(f"Error al subir foto de persona: {e}")
        
        # PASO 3: Si hay plateNo, crear el vehículo
        if person.plateNo and person.plateNo.strip() and person_id:
            print(f"Creando vehículo con placa '{person.plateNo.strip()}' para persona {person_id}")
            try:
                from datetime import datetime, timedelta
                
                # Fechas de vigencia (usar las proporcionadas o por defecto)
                if person.effectiveDate:
                    effective_date = person.effectiveDate
                else:
                    effective_date = datetime.now().strftime("%Y-%m-%dT00:00:00-05:00")
                
                if person.expiredDate:
                    expired_date = person.expiredDate
                else:
                    expired_date = (datetime.now() + timedelta(days=730)).strftime("%Y-%m-%dT23:59:59-05:00")
                
                vehicle_data = {
                    "plateNo": person.plateNo.strip(),
                    "personId": str(person_id),
                    "plateArea": 0,
                    "vehicleGroupIndexCode": "2",
                    "effectiveDate": effective_date,
                    "expiredDate": expired_date
                }
                
                print(f"Body VEHICLE: {json.dumps(vehicle_data, indent=2)}")
                
                vehicle_response = hik_api.add_vehicle(vehicle_data)
                print(f"Respuesta vehículo: {vehicle_response}")
                
                if str(vehicle_response.get("code")) != "0":
                    error_msg = vehicle_response.get('msg', 'Error desconocido')
                    print(f"Error al crear vehículo: {error_msg}")
                else:
                    print(f"✓ Vehículo creado exitosamente")
                    # Invalidar cache de vehículos
                    _vehicles_cache["expires_at"] = None
            except Exception as e:
                print(f"Error al crear vehículo: {str(e)}")
        
        # Inject personCode into response data for frontend usage
        if isinstance(response, dict):
            response["personCode"] = person_code_real
            response["personId"] = person_id

        return {
            "message": "Persona agregada exitosamente",
            "success": True,
            "data": response
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR inesperado: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno: {str(e)}"
        )


@router.post("/upload-photo")
async def upload_photo_endpoint(
    payload: dict,
    current_user: models.User = Depends(auth.require_role(["admin", "gestion_vehicular", "gestion_peatonal", "postulante"]))
):
    """Recibe una foto en base64 y la sube a HikCentral usando el endpoint
    /artemis/api/resource/v1/person/face/update

    Espera JSON: { "personCode": "CODE", "faceData": "data:image/jpeg;base64,..." }
    o { "personCode": "CODE", "photo": "<BASE64>" }
    """
    try:
        person_code = payload.get("personCode")
        face = payload.get("faceData") or payload.get("photo")
        if not person_code or not face:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="personCode y faceData/photo son requeridos")

        # Audit Log
        db = Session.object_session(current_user)
        audit.create_audit_log(
            db, 
            current_user.id, 
            "UPDATE", 
            "PERSONAS", 
            f"Subida de foto para persona Code: {person_code}"
        )

        # Si la imagen viene como data URL, extraer la parte base64
        if isinstance(face, str) and face.startswith("data:"):
            try:
                face_b64 = face.split(",", 1)[1]
            except Exception:
                face_b64 = face
        else:
            face_b64 = face

        path = "/artemis/api/resource/v1/person/face/update"
        body = {"personCode": person_code, "faceData": face_b64}

        resp = hik_api.post_signed(path, body)
        # Devolver la respuesta cruda de HikCentral para depuración
        return resp
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error upload photo: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.put("/update/{person_id}")
async def update_person_endpoint(
    person_id: str,
    person: schemas.PersonCreate,
    current_user: models.User = Depends(auth.require_role(["admin", "gestion_vehicular", "gestion_peatonal", "postulante"]))
):
    """Actualiza una persona existente en HikCentral (requiere rol admin, operador o personal_seguridad)"""
    
    # Audit Log
    db = Session.object_session(current_user)
    audit.create_audit_log(
        db, 
        current_user.id, 
        "UPDATE", 
        "PERSONAS", 
        f"Actualización de persona ID: {person_id} ({person.personGivenName} {person.personFamilyName})"
    )
    
    try:
        # Preparar datos base de la persona
        person_data = {
            "personId": person_id,
            "personGivenName": person.personGivenName,
            "personFamilyName": person.personFamilyName,
            "gender": int(person.gender) if person.gender else 0,
            "orgIndexCode": person.orgIndexCode
        }
        
        # Agregar campos opcionales si están presentes
        if person.phoneNo:
            person_data["phoneNo"] = person.phoneNo
        if person.email:
            person_data["email"] = person.email
        if person.personCode:
            person_data["personCode"] = person.personCode
        
        print(f"Actualizando persona {person_id}")
        
        # PASO 1: Actualizar datos básicos de la persona
        response = hik_api.update_person(person_id, person_data)
        
        if str(response.get("code")) != "0":
            error_msg = response.get('msg', 'Error desconocido')
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error al actualizar persona: {error_msg}"
            )
        
        print(f"✓ Persona actualizada exitosamente")
        
        # Recuperar personCode para operaciones avanzadas (DNI, Foto)
        person_code_real = person.personCode
        if not person_code_real:
             # Intentar recuperarlo de HikCentral
             try:
                import time
                time.sleep(0.3)
                list_response = hik_api.get_person_list(page_no=1, page_size=100)
                if str(list_response.get("code")) == "0":
                    persons_list = list_response.get("data", {}).get("list", [])
                    for p in persons_list:
                        if str(p.get("personId")) == str(person_id):
                            person_code_real = p.get("personCode")
                            print(f"PersonCode encontrado: {person_code_real}")
                            break
             except Exception as e:
                 print(f"Error buscando personCode: {e}")

        # PASO 2: Si hay DNI, actualizarlo usando customFieldsUpdate
        if person.certificateNumber and person.certificateNumber.strip():
            print(f"Actualizando DNI a '{person.certificateNumber.strip()}'")
            try:
                if not person_code_real:
                    print(f"No se pudo obtener personCode, saltando update de DNI")
                else:
                    path = "/artemis/api/resource/v1/person/personId/customFieldsUpdate"
                    
                    update_data = {
                        "personCode": person_code_real,
                        "list": [
                            {
                                "id": "1",
                                "customFiledName": "DNI",
                                "customFieldType": 0,
                                "customFieldValue": person.certificateNumber.strip()
                            }
                        ]
                    }
                    
                    update_response = hik_api.post_signed(path, update_data)
                    
                    if str(update_response.get("code")) != "0":
                        error_msg = update_response.get('msg', 'Error desconocido')
                        print(f"Advertencia al actualizar DNI: {error_msg}")
                    else:
                        print(f"✓ DNI actualizado exitosamente")
            except Exception as e:
                print(f"Error al actualizar DNI: {str(e)}")

        # PASO 2.5: Si hay Foto, actualizarla
        if getattr(person, "photo", None):
            print(f"Procesando actualización de foto")
            try:
                if not person_code_real:
                    print("No se pudo obtener personCode, saltando update de Foto")
                else:
                    photo_val = getattr(person, "photo")
                    # extraer base64 si viene como data URL
                    if isinstance(photo_val, str) and photo_val.startswith("data:"):
                        try:
                            face_b64 = photo_val.split(",", 1)[1]
                        except Exception:
                            face_b64 = photo_val
                    else:
                        face_b64 = photo_val

                    print("Subiendo foto a HikCentral para personCode:", person_code_real)
                    path_face = "/artemis/api/resource/v1/person/face/update"
                    body_face = {"personCode": person_code_real, "faceData": face_b64}
                    face_resp = hik_api.post_signed(path_face, body_face)
                    
                    if str(face_resp.get("code")) != "0":
                         print(f"Error al subir foto: {face_resp.get('msg')}")
                    else:
                         print(f"✓ Foto actualizada exitosamente")
            except Exception as e:
                print(f"Error al actualizar foto: {e}")
        
        # PASO 3: Gestión Inteligente de Vehículos (Soporte Multi-Vehículo con Fechas)
        # Parsear la lista de vehículos
        incoming_vehicles_map = {} # {plate: vehicle_obj}
        
        if person.vehicles:
            for v in person.vehicles:
                if v.plateNo and v.plateNo.strip():
                     incoming_vehicles_map[v.plateNo.strip().upper()] = v
        # Backward compatibility: si no hay vehicles pero hay plateNo (CSV)
        elif person.plateNo:
             plates = {p.strip().upper() for p in person.plateNo.split(',') if p.strip()}
             for p in plates:
                 # Usar fechas globales o defaults
                 incoming_vehicles_map[p] = schemas.VehicleData(
                     plateNo=p,
                     effectiveDate=person.effectiveDate,
                     expiredDate=person.expiredDate
                 )
            
        print(f"Procesando actualización de vehículos. Placas solicitadas: {list(incoming_vehicles_map.keys())}")
        
        try:
            from datetime import datetime, timedelta
            
            # Construir personName completo para búsqueda
            person_name_clean = f"{person.personGivenName} {person.personFamilyName}".strip()
            
            # 1. Obtener vehículos existentes de esta persona desde HikCentral
            print(f"Obteniendo vehículos actuales para '{person_name_clean}'...")
            
            current_vehicles = {} # {plateNo: vehicleId}
            page = 1
            
            # Buscar en todas las páginas (limitado por seguridad)
            while page <= 10: 
                vehicles_response = hik_api.list_vehicles(page_no=page, page_size=200, vehicle_group_code="2")
                
                if str(vehicles_response.get("code")) != "0":
                    print(f"Error al buscar vehículos: {vehicles_response.get('msg')}")
                    break
                
                vehicles_data = vehicles_response.get("data", {})
                vehicles_list = vehicles_data.get("list", [])
                
                if not vehicles_list:
                    break
                
                for vehicle in vehicles_list:
                    v_person_name = vehicle.get("personName", "").strip()
                    v_plate = vehicle.get("plateNo", "").strip().upper()
                    v_id = vehicle.get("vehicleId")
                    
                    # Verificar si pertenece a la persona actual
                    if v_person_name == person_name_clean and v_plate:
                        current_vehicles[v_plate] = v_id
                
                total = vehicles_data.get("total", 0)
                if page * 200 >= total:
                    break
                page += 1
            
            print(f"Vehículos actuales en sistema: {list(current_vehicles.keys())}")
            
            # 2. Calcular diferencias
            existing_plates = set(current_vehicles.keys())
            incoming_plates = set(incoming_vehicles_map.keys())
            
            plates_to_add = incoming_plates - existing_plates
            plates_to_delete = existing_plates - incoming_plates
            
            print(f"Placas a AGREGAR: {plates_to_add}")
            print(f"Placas a ELIMINAR: {plates_to_delete}")
            
            # 3. Eliminar vehículos excedentes
            if plates_to_delete:
                ids_to_delete = [current_vehicles[p] for p in plates_to_delete]
                print(f"Eliminando {len(ids_to_delete)} vehículos obsoletos...")
                delete_response = hik_api.delete_vehicle(ids_to_delete)
                
                if str(delete_response.get("code")) != "0":
                    print(f"Error al eliminar vehículos: {delete_response.get('msg')}")
                else:
                    print("✓ Vehículos eliminados correctamente")
            
            # 4. Agregar nuevos vehículos con sus fechas específicas
            if plates_to_add:
                print(f"Creando {len(plates_to_add)} nuevos vehículos...")
                
                for plate in plates_to_add:
                    v_data = incoming_vehicles_map[plate]
                    
                    # Usar fecha específica del vehículo, o la global, o default
                    eff_date = v_data.effectiveDate if v_data.effectiveDate else (person.effectiveDate if person.effectiveDate else datetime.now().strftime("%Y-%m-%dT00:00:00-05:00"))
                    
                    exp_date = v_data.expiredDate if v_data.expiredDate else (person.expiredDate if person.expiredDate else (datetime.now() + timedelta(days=730)).strftime("%Y-%m-%dT23:59:59-05:00"))
                    
                    new_vehicle_data = {
                        "plateNo": plate,
                        "personId": str(person_id),
                        "plateArea": 0,
                        "vehicleGroupIndexCode": "2",
                        "effectiveDate": eff_date,
                        "expiredDate": exp_date
                    }
                    
                    print(f"Creando vehículo placa '{plate}' con fechas {eff_date} - {exp_date}...")
                    create_response = hik_api.add_vehicle(new_vehicle_data)
                    
                    if str(create_response.get("code")) != "0":
                        print(f"Error al crear vehículo {plate}: {create_response.get('msg')}")
                    else:
                        print(f"✓ Vehículo {plate} creado exitosamente")
            
            # Invalidar cache
            if plates_to_add or plates_to_delete:
                _vehicles_cache["expires_at"] = None
                
        except Exception as e:
            print(f"Error en la gestión de vehículos: {str(e)}")
            import traceback
            traceback.print_exc()
        
        return {
            "message": "Persona actualizada exitosamente",
            "success": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error inesperado: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno: {str(e)}"
        )

@router.get("/list")
async def list_persons(
    page_no: int = 1,
    page_size: int = 100,
    search: Optional[str] = None,
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Lista personas de HikCentral con paginación del servidor y búsqueda global"""
    
    def extract_dni(person: dict) -> str:
        """Extrae el DNI desde customFieldList"""
        custom_fields = person.get("customFieldList", [])
        if not custom_fields:
            return ""
        
        for campo in custom_fields:
            # Manejar tanto customFieldName como customFiledName (typo en la API)
            name = campo.get("customFieldName") or campo.get("customFiledName") or ""
            if isinstance(name, str):
                name = name.strip().lower()
            
            # Buscar el campo DNI
            if name == "dni":
                value = campo.get("customFieldValue")
                if value and isinstance(value, str):
                    return value.strip()
                elif value:
                    return str(value)
        
        return ""
    
    def get_vehicles_map():
        """Obtiene el mapeo de vehículos desde cache o API (en paralelo)"""
        now = datetime.now()
        
        # Si el cache es válido, usarlo
        if _vehicles_cache["expires_at"] and now < _vehicles_cache["expires_at"]:
            print(f"Usando cache de vehículos (válido por {(_vehicles_cache['expires_at'] - now).seconds}s)")
            return _vehicles_cache["data"]
        
        # Si no, obtener desde API y cachear
        print("Cache expirado, obteniendo vehículos desde API...")
        start = time.time()
        vehicles_map = {} # {personName: [ {plate, start, end} ]}
        
        try:
            # Obtener primera página para saber el total
            print("Obteniendo página 1 de vehículos...")
            first_response = hik_api.list_vehicles(page_no=1, page_size=200, vehicle_group_code="2")
            
            if str(first_response.get("code")) != "0":
                print(f"Error al obtener vehículos página 1: {first_response.get('msg')}")
                return {}
            
            vehicles_data = first_response.get("data", {})
            vehicles_list = vehicles_data.get("list", [])
            total_vehicles = vehicles_data.get("total", 0)
            
            all_vehicles = vehicles_list
            
            # Calcular páginas restantes
            import math
            total_pages = math.ceil(total_vehicles / 200)
            
            if total_pages > 1:
                print(f"Total vehículos: {total_vehicles}. Obteniendo {total_pages - 1} páginas restantes en paralelo...")
                
                # Función helper para el thread pool
                def fetch_vehicle_page(p_num):
                    try:
                        resp = hik_api.list_vehicles(page_no=p_num, page_size=200, vehicle_group_code="2")
                        if str(resp.get("code")) == "0":
                            return resp.get("data", {}).get("list", [])
                        return []
                    except Exception as e:
                        print(f"Error fetching vehicle page {p_num}: {e}")
                        return []

                # Ejecutar peticiones en paralelo
                with ThreadPoolExecutor(max_workers=10) as executor:
                    from concurrent.futures import as_completed
                    futures = [executor.submit(fetch_vehicle_page, p) for p in range(2, total_pages + 1)]
                    
                    for future in as_completed(futures):
                        page_vehicles = future.result()
                        if page_vehicles:
                            all_vehicles.extend(page_vehicles)
            
            print(f"Total vehículos obtenidos: {len(all_vehicles)}")
            
            # Crear mapeo de personName a objetos vehículo
            for vehicle in all_vehicles:
                person_name = vehicle.get("personName", "").strip()
                plate_no = vehicle.get("plateNo", "").strip()
                if person_name and plate_no:
                    if person_name not in vehicles_map:
                        vehicles_map[person_name] = []
                    
                    # Guardar objeto completo
                    vehicles_map[person_name].append({
                        "plateNo": plate_no,
                        "effectiveDate": vehicle.get("effectiveDate"),
                        "expiredDate": vehicle.get("expiredDate"),
                        "vehicleId": vehicle.get("vehicleId")
                    })
            
            print(f"Mapeo creado con {len(vehicles_map)} personas")
            
            # Guardar en cache por 60 segundos
            _vehicles_cache["data"] = vehicles_map
            _vehicles_cache["expires_at"] = now + timedelta(seconds=60)
            
        except Exception as e:
            print(f"Error al obtener vehículos: {str(e)}")
            import traceback
            traceback.print_exc()
        
        print(f"Tiempo de carga de vehículos: {time.time() - start:.2f}s")
        return vehicles_map
    
    def process_persons(persons_list: list, vehicles_map: dict) -> list:
        """Procesa la lista de personas agregando el DNI y las placas"""
        processed = []
        for person in persons_list:
            if not person: continue
            
            # Crear copia para no modificar el original si fuera necesario
            p = person.copy()
            
            dni = extract_dni(p)
            p["certificateNumber"] = dni
            
            # Asignar placas y vehículos desde el mapeo
            person_name = p.get("personName", "").strip()
            vehicles = vehicles_map.get(person_name, [])
            
            # Campo legacy: string de placas separadas por coma
            p["plateNo"] = ", ".join([v["plateNo"] for v in vehicles]) if vehicles else ""
            
            # Nuevo campo: lista de objetos vehículo
            p["vehicles"] = vehicles
            
            processed.append(p)
        
        return processed
    
    # Si hay búsqueda, obtener TODAS las páginas en paralelo y filtrar en memoria
    if search and search.strip():
        search = search.strip()
        print(f"Iniciando búsqueda optimizada para: '{search}'")
        search_start = time.time()
        
        all_persons = []
        search_lower = search.lower()
        
        try:
            # 1. Obtener primera página para saber el total
            print("Obteniendo página 1 de personas...")
            first_response = hik_api.get_person_list(page_no=1, page_size=page_size)
            
            if str(first_response.get("code")) != "0":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Error al obtener lista: {first_response.get('msg', 'Error desconocido')}"
                )
            
            data = first_response.get("data", {})
            total_persons = data.get("total", 0)
            persons_p1 = data.get("list", [])
            
            all_persons.extend(persons_p1)
            
            # 2. Calcular páginas
            import math
            total_pages = math.ceil(total_persons / page_size)
            print(f"Total personas: {total_persons}. Páginas totales: {total_pages}")
            
            # 3. Obtener el resto en paralelo
            if total_pages > 1:
                print(f"Obteniendo {total_pages - 1} páginas de personas en paralelo...")
                
                def fetch_person_page(p_num):
                    try:
                        resp = hik_api.get_person_list(page_no=p_num, page_size=page_size)
                        if str(resp.get("code")) == "0":
                            return resp.get("data", {}).get("list", [])
                        return []
                    except Exception as e:
                        print(f"Error fetching person page {p_num}: {e}")
                        return []

                with ThreadPoolExecutor(max_workers=20) as executor:  # Mayor concurrencia para búsqueda
                    from concurrent.futures import as_completed
                    # Lanzar todas las tareas
                    futures = [executor.submit(fetch_person_page, p) for p in range(2, total_pages + 1)]
                    
                    # Recolectar resultados conforme llegan
                    for future in as_completed(futures):
                        page_persons = future.result()
                        if page_persons:
                            all_persons.extend(page_persons)
            
            print(f"Total personas recuperadas: {len(all_persons)}. Tiempo descarga: {time.time() - search_start:.2f}s")
            
            # 4. Filtrar en memoria
            filtered_persons = []
            for p in all_persons:
                if not p: continue
                # Pre-procesar para tener DNI disponible para búsqueda
                dni = extract_dni(p)
                p["certificateNumber"] = dni  # Asignar temporalmente para filtro
                
                # Calcular similitud
                person_name = p.get("personName", "").lower()
                person_code = p.get("personCode", "").lower()
                dni_val = dni.lower()
                
                # Check simple (contiene)
                match_name = search_lower in person_name
                match_code = search_lower in person_code
                match_dni = search_lower in dni_val
                
                if match_name or match_code or match_dni:
                     # Calcular score para ordenamiento
                     score = 0
                     if match_name:
                         score = max(score, difflib.SequenceMatcher(None, search_lower, person_name).ratio())
                     if match_code:
                         score = max(score, difflib.SequenceMatcher(None, search_lower, person_code).ratio())
                     if match_dni:
                         score = max(score, difflib.SequenceMatcher(None, search_lower, dni_val).ratio())
                     
                     p["_search_score"] = score
                     filtered_persons.append(p)
            
            # Ordenar por score descendente
            filtered_persons.sort(key=lambda x: x.get("_search_score", 0), reverse=True)
            
            # Limitar a top 30
            filtered_persons = filtered_persons[:30]
            
            print(f"Personas tras filtrado y límite: {len(filtered_persons)}")
            
            # 5. Enriquecer con vehículos (solo a los filtrados para ahorrar tiempo)
            vehicles_map = get_vehicles_map()
            final_persons = process_persons(filtered_persons, vehicles_map)
            
            return {
                "message": "Búsqueda completada exitosamente",
                "success": True,
                "data": {
                    "persons": final_persons,
                    "total": len(final_persons),
                    "page": 1,
                    "pageSize": len(final_persons),
                    "isSearch": True
                }
            }
            
        except Exception as e:
            print(f"Error en búsqueda: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=str(e))
    
    # Sin búsqueda: comportamiento normal (solo 1 página)
    response = hik_api.get_person_list(page_no, page_size)
    
    if str(response.get("code")) != "0":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al obtener lista: {response.get('msg', 'Error desconocido')}"
        )
    
    data = response.get("data", {})
    persons = data.get("list", [])
    total = data.get("total", 0)
    
    # Obtener mapeo de vehículos y procesar personas
    vehicles_map = get_vehicles_map()
    persons = process_persons(persons, vehicles_map)
    
    return {
        "message": "Lista obtenida exitosamente",
        "success": True,
        "data": {
            "persons": persons,
            "total": total,
            "page": page_no,
            "pageSize": page_size,
            "isSearch": False
        }
    }

@router.get("/{person_code}")
async def get_person(
    person_code: str,
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Obtiene información de una persona por código"""
    response = hik_api.get_person_by_code(person_code)
    
    if str(response.get("code")) == "0":
        return {
            "message": "Persona encontrada",
            "success": True,
            "data": response.get("data")
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Persona no encontrada: {response.get('msg', 'Error desconocido')}"
        )

@router.post("/assign-access-level", response_model=schemas.MessageResponse)
async def assign_access_level(
    assignment: schemas.AccessLevelAssign,
    current_user: models.User = Depends(auth.require_role(["admin", "gestion_vehicular", "gestion_peatonal", "postulante"]))
):
    """Asigna un access level a una persona"""
    result = hik_api.assign_access_level(
        assignment.personCode,
        assignment.privilegeGroupId
    )
    
    if result.get("success"):
        return {
            "message": "Access level asignado exitosamente",
            "success": True,
            "data": result
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("message", "Error al asignar access level")
        )

@router.get("/access-levels/list")
async def list_access_levels(
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Lista todos los grupos de acceso (access levels)"""
    response = hik_api.list_privilege_groups()
    
    if str(response.get("code")) == "0":
        data = response.get("data", {})
        groups = data.get("list", [])
        
        return {
            "message": "Lista obtenida exitosamente",
            "success": True,
            "data": {"groups": groups}
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al obtener lista: {response.get('msg', 'Error desconocido')}"
        )

@router.get("/organizations/list")
async def list_organizations(
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Lista todas las organizaciones"""
    response = hik_api.list_organizations()
    
    if str(response.get("code")) == "0":
        data = response.get("data", {})
        orgs = data.get("list", [])
        
        return {
            "message": "Lista obtenida exitosamente",
            "success": True,
            "data": {"organizations": orgs}
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al obtener lista: {response.get('msg', 'Error desconocido')}"
        )
