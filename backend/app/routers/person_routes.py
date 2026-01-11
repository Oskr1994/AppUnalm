from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from sqlalchemy.orm import Session
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor
import time
from datetime import datetime, timedelta

from .. import models, schemas, auth
from ..database import get_db
from ..hikcentral import hik_api

router = APIRouter(prefix="/api/persons", tags=["Personas"])

# Cache de vehículos en memoria
_vehicles_cache = {
    "data": {},  # {person_name: [plates]}
    "expires_at": None
}

@router.post("/add", response_model=schemas.MessageResponse)
async def add_person(
    person: schemas.PersonCreate,
    current_user: models.User = Depends(auth.require_role(["admin", "operador", "personal_seguridad"]))
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
    
    if person.position:
        person_data["position"] = person.position
    
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
    current_user: models.User = Depends(auth.require_role(["admin", "operador", "personal_seguridad"]))
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
    current_user: models.User = Depends(auth.require_role(["admin", "operador", "personal_seguridad"]))
):
    """Actualiza una persona existente en HikCentral (requiere rol admin, operador o personal_seguridad)"""
    
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
        
        # PASO 2: Si hay DNI, actualizarlo usando customFieldsUpdate
        if person.certificateNumber and person.certificateNumber.strip():
            print(f"Actualizando DNI a '{person.certificateNumber.strip()}'")
            try:
                # Obtener el personCode de la persona
                import time
                time.sleep(0.3)
                
                list_response = hik_api.get_person_list(page_no=1, page_size=100)
                person_code_real = None
                
                if str(list_response.get("code")) == "0":
                    persons = list_response.get("data", {}).get("list", [])
                    for p in persons:
                        if str(p.get("personId")) == str(person_id):
                            person_code_real = p.get("personCode")
                            print(f"PersonCode encontrado: {person_code_real}")
                            break
                
                if not person_code_real:
                    print(f"No se pudo obtener personCode, usando el proporcionado")
                    person_code_real = person.personCode
                
                if person_code_real:
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
        
        # PASO 3: Si hay plateNo, actualizar el vehículo
        if person.plateNo and person.plateNo.strip():
            print(f"Procesando actualización de vehículo con placa '{person.plateNo.strip()}'")
            try:
                from datetime import datetime, timedelta
                
                # Construir personName completo (añadir espacio al final como HikCentral lo guarda)
                person_name_with_space = f"{person.personGivenName} {person.personFamilyName} "
                person_name_clean = f"{person.personGivenName} {person.personFamilyName}".strip()
                
                # Buscar el vehículo existente de esta persona para obtener vehicleId
                print(f"Buscando vehicleId para personName: '{person_name_clean}'")
                
                vehicle_id = None
                page = 1
                while True:
                    vehicles_response = hik_api.list_vehicles(page_no=page, page_size=200, vehicle_group_code="2")
                    
                    if str(vehicles_response.get("code")) != "0":
                        print(f"Error al buscar vehículos: {vehicles_response.get('msg')}")
                        break
                    
                    vehicles_data = vehicles_response.get("data", {})
                    vehicles_list = vehicles_data.get("list", [])
                    
                    if not vehicles_list:
                        break
                    
                    # Buscar el vehículo de esta persona
                    for vehicle in vehicles_list:
                        vehicle_person_name = vehicle.get("personName", "").strip()
                        # Debug: mostrar todos los nombres para encontrar coincidencias
                        if page == 1 and len(vehicles_list) < 10:  # Solo primeras 10 para no saturar logs
                            print(f"  - VehicleId {vehicle.get('vehicleId')}: personName='{vehicle_person_name}'")
                        
                        # Comparar sin espacios finales
                        if vehicle_person_name == person_name_clean or vehicle_person_name == person_name_clean.strip():
                            vehicle_id = vehicle.get("vehicleId")
                            print(f"✓ VehicleId encontrado: {vehicle_id} (personName en DB: '{vehicle.get('personName', '')}')")
                            break
                    
                    if vehicle_id:
                        break
                    
                    # Verificar si hay más páginas
                    total = vehicles_data.get("total", 0)
                    if page * 200 >= total:
                        break
                    page += 1
                
                if not vehicle_id:
                    print(f"No se encontró vehículo existente para '{person_name_clean}'")
                    print(f"Creando nuevo vehículo con placa '{person.plateNo.strip()}'")
                    
                    # Crear nuevo vehículo usando personId
                    if person.effectiveDate:
                        effective_date = person.effectiveDate
                    else:
                        effective_date = datetime.now().strftime("%Y-%m-%dT00:00:00-05:00")
                    
                    if person.expiredDate:
                        expired_date = person.expiredDate
                    else:
                        expired_date = (datetime.now() + timedelta(days=730)).strftime("%Y-%m-%dT23:59:59-05:00")
                    
                    new_vehicle_data = {
                        "plateNo": person.plateNo.strip(),
                        "personId": str(person_id),
                        "plateArea": 0,
                        "vehicleGroupIndexCode": "2",
                        "effectiveDate": effective_date,
                        "expiredDate": expired_date
                    }
                    
                    print(f"Body VEHICLE CREATE: {json.dumps(new_vehicle_data, indent=2)}")
                    
                    create_response = hik_api.add_vehicle(new_vehicle_data)
                    print(f"Respuesta vehicle create: {create_response}")
                    
                    if str(create_response.get("code")) != "0":
                        error_msg = create_response.get('msg', 'Error desconocido')
                        print(f"Error al crear vehículo: {error_msg}")
                    else:
                        print(f"✓ Nuevo vehículo creado exitosamente")
                        _vehicles_cache["expires_at"] = None
                else:
                    # Estrategia: eliminar el vehículo viejo y crear uno nuevo
                    # Esto es más confiable que el endpoint update
                    print(f"Eliminando vehículo antiguo (ID: {vehicle_id})")
                    
                    delete_response = hik_api.delete_vehicle([vehicle_id])
                    print(f"Respuesta delete: {delete_response}")
                    
                    if str(delete_response.get("code")) != "0":
                        print(f"Error al eliminar vehículo: {delete_response.get('msg')}")
                    else:
                        print(f"✓ Vehículo eliminado exitosamente")
                        
                        # Ahora crear el nuevo vehículo con la nueva placa
                        print(f"Creando nuevo vehículo con placa '{person.plateNo.strip()}'")
                        
                        # Fechas de vigencia
                        if person.effectiveDate:
                            effective_date = person.effectiveDate
                        else:
                            effective_date = datetime.now().strftime("%Y-%m-%dT00:00:00-05:00")
                        
                        if person.expiredDate:
                            expired_date = person.expiredDate
                        else:
                            expired_date = (datetime.now() + timedelta(days=730)).strftime("%Y-%m-%dT23:59:59-05:00")
                        
                        # Crear nuevo vehículo usando personId
                        new_vehicle_data = {
                            "plateNo": person.plateNo.strip(),
                            "personId": str(person_id),
                            "plateArea": 0,
                            "vehicleGroupIndexCode": "2",
                            "effectiveDate": effective_date,
                            "expiredDate": expired_date
                        }
                        
                        print(f"Body VEHICLE CREATE: {json.dumps(new_vehicle_data, indent=2)}")
                        
                        create_response = hik_api.add_vehicle(new_vehicle_data)
                        print(f"Respuesta vehicle create: {create_response}")
                        
                        if str(create_response.get("code")) != "0":
                            error_msg = create_response.get('msg', 'Error desconocido')
                            print(f"Error al crear nuevo vehículo: {error_msg}")
                        else:
                            print(f"✓ Nuevo vehículo creado exitosamente")
                            # Invalidar cache de vehículos
                            _vehicles_cache["expires_at"] = None
            except Exception as e:
                print(f"Error al actualizar vehículo: {str(e)}")
        
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
        """Obtiene el mapeo de vehículos desde cache o API"""
        now = datetime.now()
        
        # Si el cache es válido, usarlo
        if _vehicles_cache["expires_at"] and now < _vehicles_cache["expires_at"]:
            print(f"Usando cache de vehículos (válido por {(_vehicles_cache['expires_at'] - now).seconds}s)")
            return _vehicles_cache["data"]
        
        # Si no, obtener desde API y cachear
        print("Cache expirado, obteniendo vehículos desde API...")
        start = time.time()
        vehicles_map = {}
        
        try:
            # Obtener todas las páginas de vehículos
            all_vehicles = []
            page = 1
            while True:
                vehicles_response = hik_api.list_vehicles(page_no=page, page_size=200, vehicle_group_code="2")
                
                if str(vehicles_response.get("code")) != "0":
                    print(f"Error al obtener vehículos página {page}: {vehicles_response.get('msg')}")
                    break
                
                vehicles_data = vehicles_response.get("data", {})
                vehicles_list = vehicles_data.get("list", [])
                
                if not vehicles_list:
                    break
                
                all_vehicles.extend(vehicles_list)
                
                total = vehicles_data.get("total", 0)
                if page * 200 >= total:
                    break
                
                page += 1
            
            print(f"Total vehículos obtenidos: {len(all_vehicles)}")
            
            # Crear mapeo de personName a placas
            for vehicle in all_vehicles:
                person_name = vehicle.get("personName", "").strip()
                plate_no = vehicle.get("plateNo", "").strip()
                if person_name and plate_no:
                    if person_name not in vehicles_map:
                        vehicles_map[person_name] = []
                    vehicles_map[person_name].append(plate_no)
            
            print(f"Mapeo creado con {len(vehicles_map)} personas")
            
            # Guardar en cache por 60 segundos
            _vehicles_cache["data"] = vehicles_map
            _vehicles_cache["expires_at"] = now + timedelta(seconds=60)
            
        except Exception as e:
            print(f"Error al obtener vehículos: {str(e)}")
        
        print(f"Tiempo de carga de vehículos: {time.time() - start:.2f}s")
        return vehicles_map
    
    def process_persons(persons_list: list, vehicles_map: dict) -> list:
        """Procesa la lista de personas agregando el DNI y las placas"""
        for person in persons_list:
            dni = extract_dni(person)
            person["certificateNumber"] = dni
            
            # Asignar placas desde el mapeo
            person_name = person.get("personName", "").strip()
            plates = vehicles_map.get(person_name, [])
            person["plateNo"] = ", ".join(plates) if plates else ""
        
        return persons_list
    
    # Si hay búsqueda, obtener todas las páginas y filtrar
    if search:
        all_persons = []
        current_page = 1
        total = 0
        search_lower = search.lower()
        
        while True:
            response = hik_api.get_person_list(current_page, page_size)
            
            if str(response.get("code")) != "0":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Error al obtener lista: {response.get('msg', 'Error desconocido')}"
                )
            
            data = response.get("data", {})
            persons = data.get("list", [])
            
            if current_page == 1:
                total = data.get("total", 0)
            
            # Primero extraer solo DNI sin buscar vehículos
            for person in persons:
                dni = extract_dni(person)
                person["certificateNumber"] = dni
            
            # Filtrar personas que coincidan con la búsqueda
            filtered = [
                p for p in persons 
                if search_lower in p.get("personName", "").lower() or 
                   search_lower in p.get("personCode", "").lower() or 
                   search_lower in p.get("certificateNumber", "").lower()
            ]
            all_persons.extend(filtered)
            
            # Si no hay más personas o ya tenemos todas, salir
            if not persons or len(all_persons) + (current_page * page_size - len(all_persons)) >= total:
                if not persons:
                    break
            
            current_page += 1
            if current_page > (total // page_size) + 1:
                break
        
        # Obtener mapeo de vehículos y asignar placas
        vehicles_map = get_vehicles_map()
        all_persons = process_persons(all_persons, vehicles_map)
        
        return {
            "message": "Búsqueda completada exitosamente",
            "success": True,
            "data": {
                "persons": all_persons,
                "total": len(all_persons),
                "page": 1,
                "pageSize": len(all_persons),
                "isSearch": True
            }
        }
    
    # Sin búsqueda, retornar solo la página solicitada
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
    current_user: models.User = Depends(auth.require_role(["admin", "operador"]))
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
