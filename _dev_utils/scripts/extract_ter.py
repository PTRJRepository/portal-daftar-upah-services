import pandas as pd
import json

file_path = r"d:\Gawean Rebinmas\Monitoring Database\Plantware_Auto_Report\Daftar_Upah_baru\payroll_daftar_upah\refactor_production\Additional_services\pajak_kalkulator\PERHITUNGAN PAJAK 2A JANUARI 2026\PERHITUNGAN PPH 21 2025-INFRA.R.xlsx"

try:
    df = pd.read_excel(file_path, sheet_name="TARIF", skiprows=2, header=None)
    # The columns:
    # TER A: Col 1(min), 3(max), 4(tarif)
    # TER B: Col 7(min), 9(max), 10(tarif)
    # TER C: Col 13(min), 15(max), 16(tarif)
    
    ter_data = {"A": [], "B": [], "C": []}
    
    for i, row in df.iterrows():
        # TER A
        if pd.notna(row[1]) and pd.notna(row[3]) and pd.notna(row[4]) and str(row[1]) != "s.d":
            try:
                vmin = float(str(row[1]).replace(',', ''))
                vmax = float(str(row[3]).replace(',', ''))
                tarif = float(str(row[4]).replace(',', ''))
                ter_data["A"].append({"min": vmin, "max": vmax, "tarif": tarif})
            except:
                pass
                
        # TER B
        if len(row) > 10 and pd.notna(row[7]) and pd.notna(row[9]) and pd.notna(row[10]) and str(row[7]) != "s.d":
            try:
                vmin = float(str(row[7]).replace(',', ''))
                vmax = float(str(row[9]).replace(',', ''))
                tarif = float(str(row[10]).replace(',', ''))
                ter_data["B"].append({"min": vmin, "max": vmax, "tarif": tarif})
            except:
                pass
                
        # TER C
        if len(row) > 16 and pd.notna(row[13]) and pd.notna(row[15]) and pd.notna(row[16]) and str(row[13]) != "s.d":
            try:
                vmin = float(str(row[13]).replace(',', ''))
                vmax = float(str(row[15]).replace(',', ''))
                tarif = float(str(row[16]).replace(',', ''))
                ter_data["C"].append({"min": vmin, "max": vmax, "tarif": tarif})
            except:
                pass

    with open(r"d:\Gawean Rebinmas\Monitoring Database\Plantware_Auto_Report\Daftar_Upah_baru\payroll_daftar_upah\refactor_production\Additional_services\pajak_kalkulator\data_statis\infra\TER.json", "w") as f:
        json.dump(ter_data, f, indent=2)
    print("Success. Saved to TER.json")
except Exception as e:
    import traceback
    print(traceback.format_exc())
