SELECT SUM([CompAmount]) AS [totalCount]
  FROM [VenusHR14].[dbo].[HR_T_PYWeekly_DComponent]
  WHERE [PYNumber] LIKE 'PYW/PTRJ/202602/%'
    AND [PYCompCode] LIKE '#POT_spsi%'
