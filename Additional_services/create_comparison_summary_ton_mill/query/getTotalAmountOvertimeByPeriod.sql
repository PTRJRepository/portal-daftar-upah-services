SELECT 
    COUNT([PYCompName]) AS Count_PYCompName,
    SUM([CompAmount]) AS Total_CompAmount
FROM [VenusHR14].[dbo].[HR_T_PYWeekly_DComponent]
WHERE [PYNumber] LIKE 'PYW/PTRJ/202602%'
  AND [PYCompCode] LIKE '%#OT%%'
