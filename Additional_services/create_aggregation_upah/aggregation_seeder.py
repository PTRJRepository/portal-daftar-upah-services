"""
Aggregation Seeder for Daftar Upah
Fetches payroll data from backend API and saves grand totals to EXTEND_DB_PTRJ

Usage:
    python aggregation_seeder.py --division PG1A --gang A1H --month 11 --year 2025
    python aggregation_seeder.py --division PG1A --month 11 --year 2025  # All gangs in division
    python aggregation_seeder.py --month 11 --year 2025  # All gangs in all divisions
"""

import os
import argparse
import requests
from datetime import datetime
from typing import Dict, List, Any, Optional
from db_connection import get_extend_db_connection, get_all_gang_descriptions
from dotenv import load_dotenv
from pathlib import Path

# Load .env
env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(env_path)

# Backend configuration
BACKEND_HOST = os.getenv("BACKEND_HOST", "localhost")
BACKEND_PORT = os.getenv("BACKEND_PORT", "8002")
BASE_URL = f"http://{BACKEND_HOST}:{BACKEND_PORT}"

# Division mapping
# Division mapping - fetched dynamically now
DIVISIONS = []


def login(username: str = "admin", password: str = "admin") -> str:
    """Login to backend and return access token"""
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"username": username, "password": password},
        timeout=30
    )
    response.raise_for_status()
    return response.json()["access_token"]


def fetch_divisions(token: str) -> List[str]:
    """Fetch available divisions from backend"""
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response = requests.get(
            f"{BASE_URL}/payroll/divisions",
            headers=headers,
            timeout=30
        )
        response.raise_for_status()
        divs = response.json()
        # Append Mill_PKS to the list of divisions to process
        if "Mill_PKS" not in divs:
            divs.append("Mill_PKS")
        return divs
    except Exception as e:
        print(f"[WARN] Failed to fetch divisions: {e}")
        # Return default list + Mill_PKS
        return ["PG1A", "PG1B", "PG2A", "PG2B", "DME", "ARA", "ARB1", "ARB2", "INFRA", "AREC", "IJL", "Mill_PKS"]


def fetch_ffb_weight_for_division(division_code: str, month: int, year: int) -> float:
    """
    Fetch FFB (TBS) weight in tons for a specific division from WM_TICKET table.
    Maps division code to supplier code pattern: "P1A" -> "PTRJ - P1A%"
    Returns total weight in tons.
    """
    from db_connection import get_mill_db_connection
    
    try:
        conn = get_mill_db_connection()
        cursor = conn.cursor()
        
        # Map division code to supplier pattern
        # Pattern: "PTRJ - {DIVISION}%" e.g., "PTRJ - P1A%"
        supplier_pattern = f"PTRJ - {division_code}%"
        
        query = """
            SELECT SUM([NetWeight]) / 1000.0 AS TotalNetWeight_Ton
            FROM [dbo].[WM_TICKET]
            WHERE [CustomerCode] LIKE ?
              AND MONTH([DateReceived]) = ?
              AND YEAR([DateReceived]) = ?
              AND [ProductCode] = 'FFB'
        """
        
        cursor.execute(query, (supplier_pattern, month, year))
        result = cursor.fetchone()
        conn.close()
        
        if result and result[0]:
            weight = float(result[0])
            print(f"  [TBS] {division_code}: {weight:.2f} tons")
            return weight
        else:
            print(f"  [TBS] {division_code}: 0.00 tons (no data)")
            return 0.0
            
    except Exception as e:
        print(f"  [WARN] Failed to fetch TBS weight for {division_code}: {e}")
        return 0.0


def fetch_ffb_weight_for_mill(month: int, year: int) -> float:
    """
    Fetch total FFB weight for all PTRJ suppliers (Mill total).
    Returns total weight in tons.
    """
    from db_connection import get_mill_db_connection
    
    try:
        conn = get_mill_db_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT SUM([NetWeight]) / 1000.0 AS TotalNetWeight_Ton
            FROM [dbo].[WM_TICKET]
            WHERE [CustomerCode] LIKE 'PTRJ%'
              AND MONTH([DateReceived]) = ?
              AND YEAR([DateReceived]) = ?
              AND [ProductCode] = 'FFB'
        """
        
        cursor.execute(query, (month, year))
        result = cursor.fetchone()
        conn.close()
        
        if result and result[0]:
            weight = float(result[0])
            print(f"  [TBS] MILL Total: {weight:.2f} tons")
            return weight
        else:
            print(f"  [TBS] MILL Total: 0.00 tons (no data)")
            return 0.0
            
    except Exception as e:
        print(f"  [WARN] Failed to fetch TBS weight for MILL: {e}")
        return 0.0


def fetch_mill_data(token: str, month: int, year: int) -> Dict[str, Any]:
    """
    Fetch Mill PKS data from backend API.
    """
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response = requests.get(
            f"{BASE_URL}/payroll/summary/mill-totals",
            params={"month": month, "year": year},
            headers=headers,
            timeout=60
        )
        response.raise_for_status()
        result = response.json()
        if result.get("success"):
            return result.get("data", {})
        else:
            print(f"  [WARN] API returned error: {result.get('error')}")
            return {}
    except Exception as e:
        print(f"  [ERROR] Failed to fetch Mill data: {e}")
        return {}


def seed_mill_division(token: str, month: int, year: int):
    """Seed aggregations for MILL division"""
    print(f"\n[DIV] Processing division: Mill_PKS ({month}/{year})")
    
    try:
        # Fetch data from backend
        data = fetch_mill_data(token, month, year)
        
        if not data:
            print("  [WARN] No Mill data returned")
            return
        
        # Calculate total_hk for Mill using the EXTERNAL SQL file
        total_hk = 0
        try:
            from db_connection import get_venushr14_connection
            
            conn = get_venushr14_connection()
            cursor = conn.cursor()
            
            # Resolve path to SQL file
            current_dir = Path(__file__).resolve().parent
            sql_path = current_dir.parent / "create_comparison_summary_ton_mill" / "getTotalHKMill.sql"
            
            if sql_path.exists():
                with open(sql_path, "r") as f:
                    query_template = f.read()
                
                # Format the query with parameters
                # The SQL file uses {year} and {month:02d} placeholders
                query = query_template.format(year=year, month=month)
                
                cursor.execute(query)
                result = cursor.fetchone()
                
                if result:
                    # The query now returns only 1 column: total_HK
                    total_hk = result[0] if result[0] is not None else 0
                    print(f"  [INFO] Mill HK Calculation (from SQL file): {total_hk} HK")
                else:
                    print(f"  [WARN] No result returned from HK query")
            else:
                print(f"  [WARN] SQL file not found: {sql_path}")
            
            conn.close()
            
        except Exception as e:
            print(f"  [WARN] Could not calculate Mill HK from file: {e}")
            total_hk = 0

        # Calculate total_lembur for Mill using the EXTERNAL SQL file
        total_lembur = 0
        try:
            from db_connection import get_venushr14_connection
            
            conn = get_venushr14_connection()
            cursor = conn.cursor()
            
            # Resolve path to SQL file
            current_dir = Path(__file__).resolve().parent
            sql_path = current_dir.parent / "create_comparison_summary_ton_mill" / "query" / "getTotalAmountOvertimeByPeriod.sql"
            
            if sql_path.exists():
                with open(sql_path, "r") as f:
                    query_template = f.read()
                
                # Format the query with parameters
                query = query_template.format(year=year, month=month)
                
                cursor.execute(query)
                result = cursor.fetchone()
                
                if result:
                    # Returns Count_PYCompName, Total_CompAmount
                    total_lembur = float(result[1]) if result[1] is not None else 0
                    print(f"  [INFO] Mill Lembur Calculation (from SQL file): {total_lembur}")
                else:
                    print(f"  [WARN] No result returned from Lembur query")
            else:
                print(f"  [WARN] SQL file not found: {sql_path}")
            
            conn.close()
            
        except Exception as e:
            print(f"  [WARN] Could not calculate Mill Lembur from file: {e}")
            total_lembur = data.get("total_lembur", 0)

        # Fetch TBS weight for Mill
        print(f"  [INFO] Fetching TBS weight for MILL...")
        total_tbs_weight = fetch_ffb_weight_for_mill(month, year)

        # Map backend Mill data to aggregation structure
        # Backend returns: total_employees, total_upah_bersih, total_pph21, total_spsi, total_lembur
        agg = {
            "gang_code": "MILL",
            "gang_description": "MILL PKS",
            "total_employees": data.get("total_employees", 0),
            "total_hk": total_hk,  # Use calculated HK instead of 0
            "total_hari_kerja": 0,  # Not tracked for Mill
            "total_cuti_tahunan": 0,
            "total_cuti_sakit": 0,
            "total_cuti_minggu": 0,
            "total_cuti_nasional": 0,
            "total_upah_dasar": 0,
            "total_upah_pokok": 0,
            "total_gaji_pokok": 0,
            "total_beras": 0,
            "total_jabatan": 0,
            "total_masa_kerja": 0,
            "total_lembur": total_lembur, # Use calculated Lembur
            "total_tunjangan": 0,
            "total_premi_brondol": 0,
            "total_premi_prunning": 0,
            "total_premi": data.get("total_premi", 0),
            "total_potongan": 0,  # Sum of deductions if needed, or leave 0 if calculated elsewhere
            "total_pph21": data.get("total_pph21", 0),
            "total_bpjs_pekerja": 0,
            "total_bpjs_majikan": 0,
            "total_spsi": data.get("total_spsi", 0),
            "total_upah_kotor": 0,  # Or calculate from clean + deductions if desired
            "total_upah_bersih": data.get("total_upah_bersih", 0),
            "total_ffb_weight": total_tbs_weight,  # TBS/FFB weight in tons
        }
        
        # Source endpoint for Mill is the summary endpoint
        source_endpoint = f"{BASE_URL}/payroll/summary/mill-totals?month={month}&year={year}"
        
        # Save to database using division "MILL"
        save_aggregation(agg, "MILL", month, year, source_endpoint)
        
        print(f"[OK] Division MILL completed")
        
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] API Error for MILL: {e}")
    except Exception as e:
        print(f"[ERROR] Error processing MILL: {e}")


def fetch_raw_tree(token: str, division: str, month: int, year: int) -> Dict[str, Any]:
    """Fetch raw tree data from backend API"""
    headers = {"Authorization": f"Bearer {token}"}
    
    # Try locked endpoint first (requires proper auth)
    response = requests.get(
        f"{BASE_URL}/payroll/locked/report/division-raw-tree",
        params={"division_code": division, "month": month, "year": year},
        headers=headers,
        timeout=120
    )
    response.raise_for_status()
    return response.json()



def delete_existing_aggregation(division: str, month: int, year: int) -> bool:
    """
    Delete existing aggregation data for a specific month/year.
    If division is 'ALL', deletes all data for that month/year.
    If division is specific, deletes only that division's data.
    """
    conn = get_extend_db_connection()
    cursor = conn.cursor()
    
    try:
        if division == "ALL":
            print(f"[DELETE] Deleting ALL existing data for {month}/{year}...")
            cursor.execute("""
                DELETE FROM dbo.daftar_upah_aggregation_history 
                WHERE period_month = ? AND period_year = ?
            """, (month, year))
        else:
            print(f"[DELETE] Deleting existing data for {division} ({month}/{year})...")
            cursor.execute("""
                DELETE FROM dbo.daftar_upah_aggregation_history 
                WHERE period_month = ? AND period_year = ? AND division_code = ?
            """, (month, year, division))
            
        rows_deleted = cursor.rowcount
        conn.commit()
        print(f"[DELETE] Deleted {rows_deleted} rows.")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to delete existing data: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def calculate_gang_aggregation(employees: List[Dict], gang_code: str, gang_desc: str = "") -> Dict[str, Any]:
    """Calculate grand total for a gang (same logic as AG Grid)"""
    
    # Count original employees
    original_count = len(employees)
    
    # Filter employees: only include those with HK > 0
    # "jika ditemukan saat agregasi total HK nya dari tiap karyawn itu nol, maka tidak usah dithiung"
    active_employees = []
    for emp in employees:
        hk_val = emp.get("jumlah_hk")
        try:
            hk = float(hk_val) if hk_val is not None else 0
        except (ValueError, TypeError):
            hk = 0
        
        if hk > 0:
            active_employees.append(emp)
    
    # Log the filter result
    filtered_count = len(active_employees)
    if original_count != filtered_count:
        print(f"  [FILTER] {gang_code}: {original_count} -> {filtered_count} employees (filtered {original_count - filtered_count} with HK=0)")
    
    # Use the filtered list for all subsequent calculations
    employees = active_employees

    def safe_sum(field: str) -> float:
        """Sum a numeric field across all employees"""
        total = 0.0
        for emp in employees:
            val = emp.get(field)
            if val is not None:
                try:
                    total += float(val)
                except (ValueError, TypeError):
                    pass
        return total
    
    def safe_sum_premi(field_name: str) -> float:
        """
        Sum a specific premi field across all employees.
        Checks nested premi dict first, then falls back to flat field.
        Avoids double counting by only taking from one source per employee.
        """
        total = 0.0
        for emp in employees:
            value_added = False
            
            # Priority 1: Check nested premi dict
            premi_dict = emp.get("premi", {})
            if isinstance(premi_dict, dict) and field_name in premi_dict:
                val = premi_dict.get(field_name)
                if val is not None:
                    try:
                        total += float(val)
                        value_added = True
                    except (ValueError, TypeError):
                        pass
            
            # Priority 2: Fall back to flat field (only if not found in nested)
            if not value_added:
                val = emp.get(field_name)
                if val is not None:
                    try:
                        total += float(val)
                    except (ValueError, TypeError):
                        pass
        return total
    
    def extract_dynamic_premi() -> tuple:
        """
        Extract and aggregate ALL premi fields including dynamic headers.
        Returns: (dynamic_premi_data_json, total_premi_calculated, premi_brondol, premi_prunning)
        """
        premi_brondol = 0.0
        premi_prunning = 0.0
        dynamic_premi = {}  # header -> total
        total_premi_calculated = 0.0  # Sum excluding prunning, insentif panen, tiket
        
        # Patterns to EXCLUDE from total_premi calculation
        exclude_patterns = ['prun', 'pruning', 'prunning', 'insentif panen', 'insentif_panen', 'panen', 'tiket', 'koreksi']
        
        for emp in employees:
            # Use nested 'premi' object as SINGLE SOURCE OF TRUTH
            premi_obj = emp.get('premi', {})
            
            if isinstance(premi_obj, dict) and premi_obj:
                # Process from nested premi object ONLY
                for key, value in premi_obj.items():
                    val = float(value or 0) if value else 0
                    if val <= 0:
                        continue
                    
                    key_lower = key.lower()
                    
                    # Track brondol and prunning separately
                    if 'brondol' in key_lower:
                        premi_brondol += val
                    elif any(p in key_lower for p in ['prun', 'pruning', 'prunning']):
                        premi_prunning += val
                    
                    # Add ALL premi to dynamic (including brondol/prunning)
                    header_name = key.replace('premi_', '').replace('PREMI ', '').strip().upper()
                    
                    # Normalize: Any 'PANEN' keyword should become 'INSENTIF PANEN'
                    if 'PANEN' in header_name and 'INSENTIF' not in header_name:
                        header_name = 'INSENTIF PANEN'
                    
                    if header_name:
                        if header_name not in dynamic_premi:
                            dynamic_premi[header_name] = 0.0
                        dynamic_premi[header_name] += val
                    
                    # Calculate total_premi EXCLUDING specific patterns
                    should_exclude = any(pattern in key_lower for pattern in exclude_patterns)
                    if not should_exclude:
                        total_premi_calculated += val
            else:
                # FALLBACK: If no nested premi object exists, scan for flat premi_ keys
                for key, value in emp.items():
                    if key.startswith('premi_') and key != 'total_premi':
                        val = float(value or 0) if value else 0
                        if val <= 0:
                            continue
                        
                        key_lower = key.lower()
                        
                        # Track brondol and prunning separately
                        if 'brondol' in key_lower:
                            premi_brondol += val
                        elif any(p in key_lower for p in ['prun', 'pruning', 'prunning']):
                            premi_prunning += val
                        
                        # Add ALL premi to dynamic (including brondol/prunning)
                        header_name = key.replace('premi_', '').replace('PREMI ', '').strip().upper()
                        
                        # Normalize: Any 'PANEN' keyword should become 'INSENTIF PANEN'
                        if 'PANEN' in header_name and 'INSENTIF' not in header_name:
                            header_name = 'INSENTIF PANEN'
                        
                        if header_name:
                            if header_name not in dynamic_premi:
                                dynamic_premi[header_name] = 0.0
                            dynamic_premi[header_name] += val
                        
                        # Calculate total_premi EXCLUDING specific patterns
                        should_exclude = any(pattern in key_lower for pattern in exclude_patterns)
                        if not should_exclude:
                            total_premi_calculated += val
        
        # Convert to list format for JSON storage
        dynamic_premi_list = [
            {"header": header, "total": round(total, 2)}
            for header, total in sorted(dynamic_premi.items())
            if total > 0
        ]
        
        import json
        return (
            json.dumps(dynamic_premi_list, ensure_ascii=False),
            total_premi_calculated,
            premi_brondol,
            premi_prunning
        )
    
    # Extract dynamic premi
    dynamic_premi_json, total_premi_calc, total_brondol, total_prunning = extract_dynamic_premi()
    
    return {
        "gang_code": gang_code,
        "gang_description": gang_desc,
        "total_employees": len(employees),  # Count of active employees (HK > 0)
        "total_hk": safe_sum("jumlah_hk"),
        "total_hari_kerja": safe_sum("hari_kerja"),
        "total_cuti_tahunan": safe_sum("cuti_tahunan_hari"),
        "total_cuti_sakit": safe_sum("cuti_sakit_haid_hari"),
        "total_cuti_minggu": safe_sum("cuti_minggu_hari"),
        "total_cuti_nasional": safe_sum("cuti_nasional_hari"),
        "total_upah_dasar": safe_sum("upah_dasar"),
        "total_upah_pokok": safe_sum("upah_pokok"),
        "total_gaji_pokok": safe_sum("gaji_pokok"),
        "total_beras": safe_sum("beras_jumlah"),
        "total_jabatan": safe_sum("jabatan_jumlah"),
        "total_masa_kerja": safe_sum("masa_kerja_jumlah") or safe_sum("masa_kerja_amount"),
        "total_lembur": safe_sum("lembur_jumlah"),
        "total_tunjangan": safe_sum("total_tunjangan"),
        "total_premi_brondol": total_brondol,
        "total_premi_prunning": total_prunning,
        "total_premi": total_premi_calc,  # Uses calculated total (excludes prunning, insentif panen, tiket)
        "dynamic_premi_data": dynamic_premi_json,  # NEW: JSON string of all dynamic premi
        "total_potongan": safe_sum("total_potongan"),
        "total_pph21": safe_sum("pot_pph21"),
        "total_bpjs_pekerja": safe_sum("pot_bpjs_kesehatan_pekerja") + safe_sum("pot_bpjs_pensiun_pekerja"),
        "total_bpjs_majikan": safe_sum("pot_bpjs_kesehatan_majikan") + safe_sum("pot_bpjs_pensiun_majikan"),
        "total_spsi": safe_sum("pot_spsi"),
        "total_upah_kotor": safe_sum("jumlah_upah_kotor"),
        "total_upah_bersih": safe_sum("upah_bersih"),
    }



def save_aggregation(agg: Dict[str, Any], division: str, month: int, year: int, source_endpoint: str) -> bool:
    """Save or update aggregation record to database"""
    conn = get_extend_db_connection()
    cursor = conn.cursor()
    
    try:
        # Check if record exists
        cursor.execute("""
            SELECT id FROM dbo.daftar_upah_aggregation_history 
            WHERE gang_code = ? AND period_month = ? AND period_year = ?
        """, (agg["gang_code"], month, year))
        
        existing = cursor.fetchone()
        
        if existing:
            # Update existing record
            cursor.execute("""
                UPDATE dbo.daftar_upah_aggregation_history SET
                    division_code = ?,
                    gang_description = ?,
                    total_employees = ?,
                    total_hk = ?,
                    total_hari_kerja = ?,
                    total_cuti_tahunan = ?,
                    total_cuti_sakit = ?,
                    total_cuti_minggu = ?,
                    total_cuti_nasional = ?,
                    total_upah_dasar = ?,
                    total_upah_pokok = ?,
                    total_gaji_pokok = ?,
                    total_beras = ?,
                    total_jabatan = ?,
                    total_masa_kerja = ?,
                    total_lembur = ?,
                    total_tunjangan = ?,
                    total_premi_brondol = ?,
                    total_premi_prunning = ?,
                    total_premi = ?,
                    total_potongan = ?,
                    total_pph21 = ?,
                    total_bpjs_pekerja = ?,
                    total_bpjs_majikan = ?,
                    total_spsi = ?,
                    total_upah_kotor = ?,
                    total_upah_bersih = ?,
                    total_ffb_weight = ?,
                    updated_at = GETDATE(),
                    source_endpoint = ?
                WHERE gang_code = ? AND period_month = ? AND period_year = ?
            """, (
                division, agg["gang_description"], agg["total_employees"],
                agg["total_hk"], agg["total_hari_kerja"],
                agg["total_cuti_tahunan"], agg["total_cuti_sakit"],
                agg["total_cuti_minggu"], agg["total_cuti_nasional"],
                agg["total_upah_dasar"], agg["total_upah_pokok"], agg["total_gaji_pokok"],
                agg["total_beras"], agg["total_jabatan"], agg["total_masa_kerja"], agg["total_lembur"],
                agg["total_tunjangan"], agg["total_premi_brondol"], agg["total_premi_prunning"],
                agg["total_premi"], agg["total_potongan"], agg["total_pph21"],
                agg["total_bpjs_pekerja"], agg["total_bpjs_majikan"], agg["total_spsi"],
                agg["total_upah_kotor"], agg["total_upah_bersih"],
                agg.get("total_ffb_weight", 0),  # Default to 0 if not provided
                source_endpoint, agg["gang_code"], month, year
            ))
            print(f"  [OK] Updated: {agg['gang_code']}")
        else:
            # Insert new record
            cursor.execute("""
                INSERT INTO dbo.daftar_upah_aggregation_history (
                    period_month, period_year, division_code, gang_code, gang_description,
                    total_employees, total_hk, total_hari_kerja,
                    total_cuti_tahunan, total_cuti_sakit, total_cuti_minggu, total_cuti_nasional,
                    total_upah_dasar, total_upah_pokok, total_gaji_pokok,
                    total_beras, total_jabatan, total_masa_kerja, total_lembur, total_tunjangan,
                    total_premi_brondol, total_premi_prunning, total_premi,
                    total_potongan, total_pph21, total_bpjs_pekerja, total_bpjs_majikan, total_spsi,
                    total_upah_kotor, total_upah_bersih, total_ffb_weight,
                    created_at, updated_at, source_endpoint
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE(), ?)
            """, (
                month, year, division, agg["gang_code"], agg["gang_description"],
                agg["total_employees"], agg["total_hk"], agg["total_hari_kerja"],
                agg["total_cuti_tahunan"], agg["total_cuti_sakit"],
                agg["total_cuti_minggu"], agg["total_cuti_nasional"],
                agg["total_upah_dasar"], agg["total_upah_pokok"], agg["total_gaji_pokok"],
                agg["total_beras"], agg["total_jabatan"], agg["total_masa_kerja"], agg["total_lembur"],
                agg["total_tunjangan"], agg["total_premi_brondol"], agg["total_premi_prunning"],
                agg["total_premi"], agg["total_potongan"], agg["total_pph21"],
                agg["total_bpjs_pekerja"], agg["total_bpjs_majikan"], agg["total_spsi"],
                agg["total_upah_kotor"], agg["total_upah_bersih"],
                agg.get("total_ffb_weight", 0),  # Default to 0 if not provided
                source_endpoint
            ))
            print(f"  [OK] Inserted: {agg['gang_code']}")
        
        conn.commit()
        return True
    except Exception as e:
        print(f"  [ERROR] Error saving {agg['gang_code']}: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def seed_division(token: str, division: str, month: int, year: int, target_gang: Optional[str] = None):
    """Seed aggregations for a division (or specific gang)"""
    
    # Special handling for MILL division
    if division.upper() == "MILL":
        seed_mill_division(token, month, year)
        return
    
    print(f"\n[DIV] Processing division: {division} ({month}/{year})")
    
    try:
        data = fetch_raw_tree(token, division, month, year)
        gangs = data.get("gangs", [])
        
        # Debug logging
        print(f"  [INFO] API returned {len(gangs)} gangs")
        if target_gang:
            print(f"  [FILTER] Filtering for gang: {target_gang}")
        if gangs:
            gang_codes = [g.get("gang_code", "?") for g in gangs[:10]]
            print(f"  [GANGS] First 10 gang codes: {gang_codes}")
        
        # Fetch TBS weight for this division
        print(f"  [INFO] Fetching TBS weight for {division}...")
        division_tbs_weight = fetch_ffb_weight_for_division(division, month, year)
        
        source_endpoint = f"{BASE_URL}/payroll/locked/report/raw-tree?div={division}&month={month}&year={year}"
        
        # Load gang descriptions from HR_GANG table (READ from db_ptrj)
        print(f"  [INFO] Loading gang descriptions from HR_GANG...")
        gang_descriptions = get_all_gang_descriptions()
        print(f"  [INFO] Loaded {len(gang_descriptions)} gang descriptions")
        
        for gang_data in gangs:
            gang_code = gang_data.get("gang_code", "").strip()  # Strip trailing spaces
            gang_description = gang_descriptions.get(gang_code, "")  # Get from HR_GANG table

            # If target gang specified, skip others
            if target_gang and gang_code.upper() != target_gang.strip().upper():
                continue

            employees = gang_data.get("employees", [])
            if not employees:
                print(f"  - Skipping {gang_code}: No employees")
                continue

            # Calculate aggregation
            agg = calculate_gang_aggregation(employees, gang_code, gang_description)
            
            # Add TBS/FFB weight to aggregation (single division value for all gangs in that division)
            agg["total_ffb_weight"] = division_tbs_weight
            
            # Save to database
            save_aggregation(agg, division, month, year, source_endpoint)
        
        print(f"[OK] Division {division} completed")
        
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] API Error for {division}: {e}")
    except Exception as e:
        print(f"[ERROR] Error processing {division}: {e}")


def main():
    parser = argparse.ArgumentParser(description="Seed payroll aggregations to database")
    parser.add_argument("--division", "-d", help="Division code (e.g., PG1A)")
    parser.add_argument("--gang", "-g", help="Specific gang code (e.g., A1H)")
    parser.add_argument("--month", "-m", type=int, required=True, help="Month (1-12)")
    parser.add_argument("--year", "-y", type=int, required=True, help="Year (e.g., 2025)")
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("[START] Payroll Aggregation Seeder")
    print("=" * 60)
    print(f"Backend: {BASE_URL}")
    print(f"Period: {args.month}/{args.year}")
    
    # Login
    print("\n[AUTH] Logging in...")
    try:
        token = login()
        print("[OK] Login successful")
    except Exception as e:
        print(f"[ERROR] Login failed: {e}")
        return
    
    # Determine which divisions to process
    if args.division:
        divisions = [args.division]
        # Delete data for specific division
        delete_existing_aggregation(args.division, args.month, args.year)
    else:
        # Fetch from backend
        divisions = fetch_divisions(token)
        print(f"[INFO] Fetched {len(divisions)} divisions from backend: {divisions}")
        # Delete data for ALL divisions
        delete_existing_aggregation("ALL", args.month, args.year)
    
    # Process each division
    for division in divisions:
        seed_division(token, division, args.month, args.year, args.gang)
    
    print("\n" + "=" * 60)
    print("[DONE] Seeding complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
