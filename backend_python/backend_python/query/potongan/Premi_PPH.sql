SELECT
    t.EmpCode,
    t.DocDesc,
    ln.TaskCode,
    mt.TaskDesc,
    ln.Amount
FROM [db_ptrj].[dbo].[PR_ADTRANS] AS t
JOIN [db_ptrj].[dbo].[PR_ADTRANSLN] AS ln
    ON t.ID = ln.MasterID
LEFT JOIN [db_ptrj].[dbo].[PR_TASKCODE] AS mt
    ON ln.TaskCode = mt.TaskCode
WHERE
    t.EmpCode = ?
    AND t.DocDate >= ?
    AND t.DocDate < ?
    AND (UPPER(t.DocDesc) LIKE '%PPH%' OR UPPER(mt.TaskDesc) LIKE '%PPH%');