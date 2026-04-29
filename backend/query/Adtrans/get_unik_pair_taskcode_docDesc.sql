SELECT DISTINCT
    H.DocDesc,
    LEFT(L.TaskCode, LEN(L.TaskCode) - 3) AS BaseTaskCode,
    T.TaskDesc
FROM db_ptrj.dbo.PR_ADTRANS_ARC H
INNER JOIN db_ptrj.dbo.PR_ADTRANSLN_ARC L
    ON L.MasterID = H.ID
INNER JOIN db_ptrj.dbo.PR_TASKCODE T
    ON T.TaskCode = L.TaskCode
WHERE
    H.AccYear = 2026
    AND H.AccMonth BETWEEN 1 AND 3
ORDER BY
    H.DocDesc,
    BaseTaskCode;
