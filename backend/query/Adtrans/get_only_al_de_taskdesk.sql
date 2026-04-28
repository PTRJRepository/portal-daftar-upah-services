SELECT DISTINCT
    [TaskDesc]
FROM [db_ptrj].[dbo].[PR_TASKCODE]
WHERE [TaskDesc] LIKE '(AL)%'
   OR [TaskDesc] LIKE '(DE)%'
ORDER BY [TaskDesc];
