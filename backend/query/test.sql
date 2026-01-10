SELECT 
    Total_Data_Karyawan,
    Total_Data_Karyawan * DaysInMonth AS Kapasitas_Maksimal_Hari,
    Total_Mangkir,
    (Total_Data_Karyawan * DaysInMonth) - Total_Mangkir AS Hari_Kerja_Setelah_Mangkir
FROM (
    SELECT 
        COUNT([EmployeeID]) AS Total_Data_Karyawan,
        SUM([TAAbsence]) AS Total_Mangkir,
        DAY(EOMONTH(CAST(SUBSTRING(MAX([PYNumber]), 10, 6) + '01' AS DATE))) AS DaysInMonth
    FROM [VenusHR14].[dbo].[HR_T_PYWeekly_M]
    WHERE [PYNumber] LIKE 'PYW/PTRJ/202511%'
) AS Subquery;