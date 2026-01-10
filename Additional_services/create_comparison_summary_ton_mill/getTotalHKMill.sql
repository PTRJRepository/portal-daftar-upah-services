SELECT 
    
    (Total_Data_Karyawan * DaysInMonth) - (Total_Mangkir + Total_Unpaid_Leave + Total_Sakit_With_Note) AS total_HK
FROM (
    SELECT 
        COUNT([EmployeeID]) AS Total_Data_Karyawan,
        SUM(ISNULL([TAAbsence], 0)) AS Total_Mangkir,
        SUM(ISNULL([UnpaidLeave], 0)) AS Total_Unpaid_Leave,
        SUM(ISNULL([TASick], 0)) AS Total_Sakit_With_Note,
        DAY(EOMONTH(CAST(SUBSTRING(MAX([PYNumber]), 10, 6) + '01' AS DATE))) AS DaysInMonth
    FROM [VenusHR14].[dbo].[HR_T_PYWeekly_M]
    -- Pastikan filter {year}{month} sesuai dengan periode yang diinginkan
    WHERE [PYNumber] LIKE 'PYW/PTRJ/{year}{month:02d}%' 
) AS Subquery;