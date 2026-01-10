"""Detailed test of Mill HK Calculation to match expected result of 4853"""
from db_connection import get_venushr14_connection
from calendar import monthrange

month = 11
year = 2025

try:
    conn = get_venushr14_connection()
    cursor = conn.cursor()
    
    # Calculate days in month
    days_in_month = monthrange(year, month)[1]
    
    # Build period pattern: PYW/PTRJ/YYYYMM%
    period_pattern = f"PYW/PTRJ/{year}{str(month).zfill(2)}%"
    
    print(f"=== Testing Mill HK for {month}/{year} ===")
    print(f"Period pattern: {period_pattern}")
    print(f"Days in month: {days_in_month}\n")
    
    # Query 1: Check sample PYNumbers to verify pattern
    print("Sample PYNumbers from HR_T_PYWeekly_M:")
    cursor.execute("""
        SELECT TOP 5 [PYNumber], [EmployeeID], [TAAbsence]
        FROM [VenusHR14].[dbo].[HR_T_PYWeekly_M]
        WHERE [PYNumber] LIKE ?
        ORDER BY [PYNumber]
    """, (period_pattern,))
    samples = cursor.fetchall()
    for sample in samples:
        print(f"  {sample[0]} | Employee: {sample[1]} | Absence: {sample[2]}")
    
    # Query 2: Original calculation
    print("\n=== Original Calculation (from aggregation_seeder.py) ===")
    cursor.execute("""
        SELECT 
            COUNT([EmployeeID]) AS Total_Data_Karyawan,
            SUM([TAAbsence]) AS Total_Mangkir
        FROM [VenusHR14].[dbo].[HR_T_PYWeekly_M]
        WHERE [PYNumber] LIKE ?
    """, (period_pattern,))
    result = cursor.fetchone()
    
    if result:
        total_employees = result[0] or 0
        total_absences = result[1] or 0
        total_hk = (total_employees * days_in_month) - total_absences
        
        print(f"Total Employee Records: {total_employees}")
        print(f"Total Absences (TAAbsence sum): {total_absences}")
        print(f"Formula: ({total_employees} × {days_in_month}) - {total_absences}")
        print(f"Calculated HK: {total_hk}\n")
    
    # Query 3: Try using COUNT(DISTINCT EmployeeID) instead
    print("=== Alternative: Using DISTINCT Employee Count ===")
    cursor.execute("""
        SELECT 
            COUNT(DISTINCT [EmployeeID]) AS Total_Data_Karyawan,
            SUM([TAAbsence]) AS Total_Mangkir
        FROM [VenusHR14].[dbo].[HR_T_PYWeekly_M]
        WHERE [PYNumber] LIKE ?
    """, (period_pattern,))
    result2 = cursor.fetchone()
    
    if result2:
        distinct_employees = result2[0] or 0
        total_absences2 = result2[1] or 0
        total_hk2 = (distinct_employees * days_in_month) - total_absences2
        
        print(f"Distinct Employees: {distinct_employees}")
        print(f"Total Absences: {total_absences2}")
        print(f"Formula: ({distinct_employees} × {days_in_month}) - {total_absences2}")
        print(f"Calculated HK: {total_hk2}\n")
    
    # Query 4: Check from HR_T_TAMachine_Summary (user's original query)
    print("=== From HR_T_TAMachine_Summary (User's filter test) ===")
    cursor.execute("""
        SELECT COUNT(*) 
        FROM [VenusHR14].[dbo].[HR_T_TAMachine_Summary]
        WHERE MONTH([TADate]) = ? AND YEAR([TADate]) = ?
    """, (month, year))
    ta_count = cursor.fetchone()[0]
    print(f"Total records from TAMachine_Summary: {ta_count}")
    print(f"Expected: 4853\n")
    
    conn.close()
    print("✓ Test completed successfully!")

except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()
