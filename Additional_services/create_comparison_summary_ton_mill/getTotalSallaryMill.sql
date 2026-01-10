SELECT CAST(SUM([CompAmount]) AS BIGINT) AS TotalCompAmount
  FROM [VenusHR14].[dbo].[HR_T_PYWeekly_DComponent]
 WHERE [PYNumber] LIKE 'PYW/PTRJ/202511%'
   AND [IsTakeHomePay] = 1