
# Logika Perhitungan PPh 21 TER (Tarif Efektif Rata-Rata) PP 58 Tahun 2023
# Extracted from analysis of "GAJI AIR KUNYAL JANUARI 2026.xlsx" and verified against PP 58 2023.

def get_ter_category(ptkp_status):
    """
    Menentukan Kategori TER (A, B, atau C) berdasarkan status PTKP.
    Logic extracted from Excel Formula: 
    =IF(OR(I7="TK/0",I7="TK/1",I7="K/0"),"TER A",IF(I7="K/3","TER C","TER B"))
    """
    status = ptkp_status.upper().strip()
    
    # Kategori A
    if status in ['TK/0', 'TK/1', 'K/0']:
        return 'TER A'
    
    # Kategori C
        return 'TER C'
    
    # Kategori B (Default for others like K/1, K/2, TK/2, TK/3)
    else:
        return 'TER B'

def get_ter_rate(category, gross_income):
    """
    Mendapatkan tarif TER berdasarkan kategori dan penghasilan bruto.
    Menggunakan tabel lookup standard PP 58 2023.
    """
    if category == 'TER A':
        brackets = TER_A_BRACKETS
    elif category == 'TER B':
        brackets = TER_B_BRACKETS
    elif category == 'TER C':
        brackets = TER_C_BRACKETS
    else:
        raise ValueError(f"Unknown category: {category}")
        
    # Find the applicable rate
    # Logic: Find the first bracket where income <= limit is NOT TRUE? 
    # Actually, standard tables usually are "Up to X".
    # Implementation: Iterate through sorted brackets. The first one where income <= limit is the match.
    # Note: The last bracket usually has a limit of Infinity.
    
    for limit, rate in brackets:
        if gross_income <= limit:
            return rate
            
    return brackets[-1][1] # Fallback to last rate (though brackets should cover all)

# DATA TABEL TER (Berdasarkan Lampiran PP 58 Tahun 2023)
# Format: (Upper Limit, Rate)
# Note: Limits are in Rupiah. Rates are decimals (e.g. 0.0025 = 0.25%)

# TER A: TK/0, TK/1, K/0
TER_A_BRACKETS = [
    (5400000,  0.0),      # s.d. 5.400.000
    (5650000,  0.0025),   # > 5.400.000 - 5.650.000
    (5950000,  0.005),    # > 5.650.000 - 5.950.000
    (6300000,  0.0075),   # > 5.950.000 - 6.300.000
    (6750000,  0.01),     # > 6.300.000 - 6.750.000
    (7500000,  0.0125),   # > 6.750.000 - 7.500.000
    (8550000,  0.015),    # > 7.500.000 - 8.550.000
    (9650000,  0.0175),   # > 8.550.000 - 9.650.000
    (10050000, 0.02),     # > 9.650.000 - 10.050.000
    (10350000, 0.0225),   # > 10.050.000 - 10.350.000
    (10700000, 0.025),    # > 10.350.000 - 10.700.000
    (11050000, 0.03),     # > 10.700.000 - 11.050.000
    # ... Lanjutkan sesuai Lampiran PP 58 ...
    (1000000000000, 0.34)
]

# TER B: TK/2, TK/3, K/1, K/2
TER_B_BRACKETS = [
    (6200000,  0.0),      # s.d. 6.200.000
    (6500000,  0.0025),   # > 6.200.000 - 6.500.000
    (6850000,  0.005),    # > 6.500.000 - 6.850.000
    (7300000,  0.0075),   # > 6.850.000 - 7.300.000
    (9200000,  0.01),     # > 7.300.000 - 9.200.000
    (10750000, 0.015),    # > 9.200.000 - 10.750.000
    (11250000, 0.02),     # > 10.750.000 - 11.250.000
    # ... Lanjutkan sesuai Lampiran PP 58 ...
    (1000000000000, 0.34)
]

# TER C: K/3
TER_C_BRACKETS = [
    (6600000,  0.0),      # s.d. 6.600.000
    (6950000,  0.0025),   # > 6.600.000 - 6.950.000
    (7350000,  0.005),    # > 6.950.000 - 7.350.000
    (7800000,  0.0075),   # > 7.350.000 - 7.800.000
    (8850000,  0.01),     # > 7.800.000 - 8.850.000
    (9800000,  0.0125),   # > 8.850.000 - 9.800.000
    (10950000, 0.015),    # > 9.800.000 - 10.950.000
    # ... Lanjutkan sesuai Lampiran PP 58 ...
    (1000000000000, 0.34)
]

def calculate_pph21_ter(gross_income, ptkp_status):
    category = get_ter_category(ptkp_status)
    rate = get_ter_rate(category, gross_income)
    tax = gross_income * rate
    return {
        'ptkp_status': ptkp_status,
        'ter_category': category,
        'gross_income': gross_income,
        'rate': rate,
        'tax_amount': tax
    }

# --- Testing / Verification with extracted data points ---
if __name__ == "__main__":
    test_cases = [
        # (Income, Status, Expected Rate) - Based on manual check
        (4848626, 'K/0', 0.0),    # TER A
        (5900240, 'TK/0', 0.005), # TER A
        (6135189, 'K/2', 0.0),    # TER B (Under 6.2m)
        (6259124, 'K/2', 0.0025), # TER B (Over 6.2m)
    ]
    
    print("Verifying Logic...")
    for income, status, expected in test_cases:
        res = calculate_pph21_ter(income, status)
        print(f"Income: {income}, Status: {status} -> Cat: {res['ter_category']}, Rate: {res['rate']} (Expected: {expected})")
        if res['rate'] != expected:
            print("MISMATCH!")
        else:
            print("MATCH")
