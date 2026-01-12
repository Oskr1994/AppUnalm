import sys
import os
import time
import pandas as pd

# Añadir el directorio actual al path para poder importar los módulos de app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from app.hikcentral import hik_api
except ImportError as e:
    print("Error importando módulos de la aplicación. Asegúrate de ejecutar esto desde la carpeta 'backend'.")
    print(f"Detalle: {e}")
    sys.exit(1)

def get_all_persons():
    """
    Descarga la lista completa de personas desde HikCentral
    """
    print("--- Iniciando descarga de personas desde HikCentral ---")
    all_persons = []
    page = 1
    page_size = 200 # Tamaño de página seguro
    
    while True:
        print(f"Descargando página {page}...", end="\r")
        try:
            response = hik_api.get_person_list(page_no=page, page_size=page_size)
            if str(response.get("code")) != "0":
                print(f"\nError en página {page}: {response.get('msg')}")
                break
                
            data = response.get("data", {})
            persons = data.get("list", [])
            total = data.get("total", 0)
            
            if not persons:
                break
                
            all_persons.extend(persons)
            
            # Si ya recuperamos todos, terminamos
            if len(all_persons) >= total:
                print(f"\nDescarga completada: {total} personas recuperadas.")
                break
                
            page += 1
            # Pequeña pausa para no saturar
            time.sleep(0.1)
            
        except Exception as e:
            print(f"\nExcepción al obtener página {page}: {e}")
            break
            
    return all_persons

def extract_dni(person):
    """
    Extrae el valor del campo custom 'DNI' de una persona
    """
    custom_fields = person.get("customFieldList", [])
    if not custom_fields:
        return None
    
    for field in custom_fields:
        name = field.get("customFieldName") or field.get("customFiledName") # Manejar posible typo API
        if name and str(name).strip().lower() == "dni":
            val = field.get("customFieldValue")
            return str(val).strip() if val else None
    return None

def main():
    # Rutas relativas asumiendo que el script corre en 'backend/'
    excel_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../BD-PLACAS.xlsx"))
    output_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../BD-PLACAS-UPDATED.xlsx"))
    
    print(f"Buscando archivo Excel en: {excel_path}")
    
    if not os.path.exists(excel_path):
        print(f"ERROR: No se encuentra el archivo: {excel_path}")
        return

    # Verificar dependencias
    try:
        import pandas
        import openpyxl
    except ImportError:
        print("ERROR FALTAN LIBRERIAS: Para ejecutar este script necesitas instalar pandas y openpyxl.")
        print("Ejecuta: pip install pandas openpyxl")
        return

    # 1. Obtener todas las personas
    persons = get_all_persons()
    if not persons:
        print("No se recuperaron personas. Abortando.")
        return
    
    # 2. Indexar por DNI para búsqueda rápida
    print("\nIndexando personas por DNI...")
    dni_map = {} # { dni: personCode }
    
    count_valid = 0
    for p in persons:
        dni = extract_dni(p)
        person_code = p.get("personCode")
        
        if dni and person_code:
            dni_map[dni] = person_code
            count_valid += 1
            
    print(f"Se indexaron {count_valid} personas que tienen DNI y PersonCode.")
    
    # 3. Leer Excel
    print(f"Leyendo archivo Excel...")
    try:
        df = pd.read_excel(excel_path)
    except Exception as e:
        print(f"Error al leer el Excel: {e}")
        return

    col_doc = "DOCUMENTO"
    if col_doc not in df.columns:
        print(f"Error: El Excel no tiene la columna '{col_doc}'. Columnas disponibles: {df.columns.tolist()}")
        return

    # 4. Procesar cruce de datos
    print("Procesando cruce de datos...")
    
    def get_code(doc_val):
        if pd.isna(doc_val):
            return None
        # Convertir a string y limpiar
        doc_str = str(doc_val).strip()
        # Manejar caso de float convertidos a string (ej: "12345678.0")
        if doc_str.endswith(".0"):
            doc_str = doc_str[:-2]
            
        # Intento 1: DNI exacto
        code = dni_map.get(doc_str)
        if code:
            return code
            
        # Intento 2: Con un 0 adelante
        code = dni_map.get("0" + doc_str)
        if code:
            return code
            
        # Intento 3: Con dos 0 adelante
        code = dni_map.get("00" + doc_str)
        return code

    # Crear columna personCode
    df["personCode"] = df[col_doc].apply(get_code)
    
    # Estadísticas
    found = df["personCode"].notna().sum()
    total_rows = len(df)
    
    print(f"--- RESULTADOS ---")
    print(f"Total registros en Excel: {total_rows}")
    print(f"Coincidencias encontradas: {found}")
    print(f"Sin coincidencia: {total_rows - found}")
    
    # 5. Guardar
    print(f"Guardando nuevo archivo en: {output_path}")
    df.to_excel(output_path, index=False)
    print("¡Proceso terminado exitosamente!")

if __name__ == "__main__":
    main()
