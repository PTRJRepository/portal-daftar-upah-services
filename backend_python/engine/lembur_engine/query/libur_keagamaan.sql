SELECT TOP (1000) [GPHCode],
    [Description],
    [HolidayDate],
    [Status],
    [CreateDate],
    [UpdateDate],
    [UpdateID],
    [IsRegionPH]
FROM [db_ptrj].[dbo].[HR_GPH]
WHERE [IsRegionPH] = 1