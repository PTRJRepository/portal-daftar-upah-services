import pandas as pd
import json
import traceback

file_path = r"d:\Gawean Rebinmas\Monitoring Database\Plantware_Auto_Report\Daftar_Upah_baru\payroll_daftar_upah\refactor_production\Additional_services\pajak_kalkulator\PERHITUNGAN PAJAK 2A JANUARI 2026\PERHITUNGAN PPH 21 2025-INFRA.R.xlsx"

try:
    xls = pd.ExcelFile(file_path)
    sheets = xls.sheet_names
    
    result = {"sheets": sheets, "content": {}}
    for s in sheets:
        df = pd.read_excel(xls, sheet_name=s, nrows=10, header=None) # Read without header first to get raw rows
        result["content"][s] = {"rows": df.head(10).fillna("").astype(str).to_dict(orient="records")}
        
    with open(r"d:\Gawean Rebinmas\Monitoring Database\Plantware_Auto_Report\Daftar_Upah_baru\payroll_daftar_upah\refactor_production\_dev_utils\scripts\tax_report_structure.json", "w") as f:
        json.dump(result, f, indent=2)
except Exception as e:
    with open(r"d:\Gawean Rebinmas\Monitoring Database\Plantware_Auto_Report\Daftar_Upah_baru\payroll_daftar_upah\refactor_production\_dev_utils\scripts\tax_report_structure.json", "w") as f:
        json.dump({"error": str(e), "traceback": traceback.format_exc()}, f)
