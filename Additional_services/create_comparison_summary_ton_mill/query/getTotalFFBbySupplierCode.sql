SELECT [WM_TICKET].[CustomerCode],
    min(S.[Name]) AS [SupplierName],
    SUM([WM_TICKET].[NetWeight]) / 1000.0 AS [TotalNetWeight_Ton] -- Dibagi 1000 untuk konversi ke Ton
,
    COUNT([WM_TICKET].[TicketNo]) AS [TotalTickets]
FROM [db_ptrj_mill].[dbo].[WM_TICKET]
    LEFT JOIN [db_ptrj_mill].[dbo].[PU_SUPPLIER] AS S ON [WM_TICKET].[CustomerCode] = S.[SupplierCode]
WHERE [WM_TICKET].[CustomerCode] LIKE 'PTRJ%'
    AND MONTH([WM_TICKET].[DateReceived]) = 11
    AND YEAR([WM_TICKET].[DateReceived]) = 2025
    AND [WM_TICKET].ProductCode = 'FFB'
GROUP BY [WM_TICKET].[CustomerCode]
ORDER BY [TotalNetWeight_Ton] DESC;