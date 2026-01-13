
import os
import csv
import pyodbc
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from db_connection import get_extend_db_connection

# Load .env
env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(env_path)

def to_int(val):
    if val is None or val == "NULL": return None
    try: return int(val)
    except: return None

def to_float(val):
    if val is None or val == "NULL": return None
    try: return float(val)
    except: return None

def to_str(val):
    if val is None or val == "NULL": return None
    return str(val)

def import_data():
    file_path = "database_agregasi.txt"
    
    # Matching the create_table.py schema exactly to avoid confusion
    # But order in DB doesn't dictate order here, only list matching matters
    db_columns = [
        "period_month", "period_year", "division_code", "gang_code", "gang_description",
        "total_employees", "total_hk", "total_hari_kerja",
        "total_cuti_tahunan", "total_cuti_sakit", "total_cuti_minggu", "total_cuti_nasional",
        "total_upah_dasar", "total_upah_pokok", "total_gaji_pokok",
        "total_beras", "total_jabatan", "total_masa_kerja", "total_lembur", "total_tunjangan",
        "total_premi_brondol", "total_premi_prunning", "total_premi",
        "total_potongan", "total_pph21", "total_bpjs_pekerja", "total_bpjs_majikan", "total_spsi",
        "total_upah_kotor", "total_upah_bersih", 
        "created_at", "updated_at", "source_endpoint",
        "dynamic_premi_data", "total_koreksi", "informasi_tambahan",
        "total_ffb_weight", "total_weight_tbs"
    ]
    
    print(f"Reading {file_path}...")
    
    with open(file_path, "r", encoding="utf-8") as f:
        first_line = f.readline()
        delimiter = "\t" if "\t" in first_line else ","
        print(f"Detected delimiter: {repr(delimiter)}")
        f.seek(0)
        
        reader = csv.DictReader(f, delimiter=delimiter)
        print(f"CSV Headers: {reader.fieldnames}")
        
        rows_to_insert = []
        for i, row in enumerate(reader):
            clean_row = []
            try:
                # Map using helpers
                clean_row.append(to_int(row.get("period_month")))
                clean_row.append(to_int(row.get("period_year")))
                clean_row.append(to_str(row.get("division_code")))
                clean_row.append(to_str(row.get("gang_code")))
                clean_row.append(to_str(row.get("gang_description")))
                
                clean_row.append(to_int(row.get("total_employees")))
                clean_row.append(to_float(row.get("total_hk")))
                clean_row.append(to_float(row.get("total_hari_kerja")))
                clean_row.append(to_float(row.get("total_cuti_tahunan")))
                clean_row.append(to_float(row.get("total_cuti_sakit")))
                clean_row.append(to_float(row.get("total_cuti_minggu")))
                clean_row.append(to_float(row.get("total_cuti_nasional")))
                
                clean_row.append(to_float(row.get("total_upah_dasar")))
                clean_row.append(to_float(row.get("total_upah_pokok")))
                clean_row.append(to_float(row.get("total_gaji_pokok")))
                clean_row.append(to_float(row.get("total_beras")))
                clean_row.append(to_float(row.get("total_jabatan")))
                clean_row.append(to_float(row.get("total_masa_kerja")))
                clean_row.append(to_float(row.get("total_lembur")))
                clean_row.append(to_float(row.get("total_tunjangan")))
                
                clean_row.append(to_float(row.get("total_premi_brondol")))
                clean_row.append(to_float(row.get("total_premi_prunning")))
                clean_row.append(to_float(row.get("total_premi")))
                clean_row.append(to_float(row.get("total_potongan")))
                clean_row.append(to_float(row.get("total_pph21")))
                clean_row.append(to_float(row.get("total_bpjs_pekerja")))
                clean_row.append(to_float(row.get("total_bpjs_majikan")))
                clean_row.append(to_float(row.get("total_spsi")))
                
                clean_row.append(to_float(row.get("total_upah_kotor")))
                clean_row.append(to_float(row.get("total_upah_bersih")))
                
                clean_row.append(to_str(row.get("created_at")))
                clean_row.append(to_str(row.get("updated_at")))
                clean_row.append(to_str(row.get("source_endpoint")))
                
                clean_row.append(to_str(row.get("dynamic_premi_data")))
                clean_row.append(to_float(row.get("total_koreksi")))
                clean_row.append(to_str(row.get("informasi_tambahan")))
                
                clean_row.append(to_float(row.get("total_ffb_weight")))
                clean_row.append(to_float(row.get("total_weight_tbs")))
                
                rows_to_insert.append(clean_row)
            except Exception as e:
                print(f"Error parsing row {i}: {e}")
                
    if not rows_to_insert:
        print("No data found to insert.")
        return

    print(f"Found {len(rows_to_insert)} rows. Connecting to database...")
    
    try:
        conn = get_extend_db_connection()
        cursor = conn.cursor()
        
        placeholders = ", ".join(["?"] * len(db_columns))
        columns_str = ", ".join(db_columns)
        sql = f"INSERT INTO dbo.daftar_upah_aggregation_history ({columns_str}) VALUES ({placeholders})"
        
        # print(f"Executing SQL: {sql}")
        print("Inserting records...")
        
        cursor.fast_executemany = True 
        cursor.executemany(sql, rows_to_insert)
        
        conn.commit()
        print(f"Successfully inserted {len(rows_to_insert)} rows.")
        conn.close()
        
    except Exception as e:
        print(f"Error inserting data: {e}")
        # Debug with first row
        try:
            print("Debugging: columns count:", len(db_columns))
            print("Debugging: row elements count:", len(rows_to_insert[0]))
        except: pass

if __name__ == "__main__":
    import_data()
