SELECT SUM(LFLN.Amount) AS TotalAmount
FROM "PR_LOOSEFRUIT_ARC" LF
JOIN "PR_LOOSEFRUITLN_ARC" LFLN
  ON LF.ID = LFLN.MasterID
WHERE LFLN.EmpCode = ?
  AND LF.DocDate >= ?
  AND LF.DocDate < ?
  AND CHARINDEX('_', LF.DocDate) = 0  -- Filter out ID codes like LF50317375_01, only use real dates
