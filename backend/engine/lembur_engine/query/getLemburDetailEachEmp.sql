SELECT TOP (1000) trl.[ID],
    trl.[MasterID],
    trl.[TaskCode],
    trl.[TaskRtnVal],
    trl.[EmpCode],
    trl.[EmpName],
    trl.[OT],
    trl.[ShiftCode],
    trl.[Hours],
    trl.[Unit],
    trl.[Rate],
    trl.[Amount],
    trl.[Status],
    trl.[CreatedBy],
    trl.[CreatedDate],
    trl.[UpdatedBy],
    trl.[UpdatedDate],
    trl.[ImpFlag],
    trl.[TrxDate],
    trl.[ChargeTo],
    trl.[NormalDay],
    trl.[TappingType]
FROM [db_ptrj].[dbo].[PR_TASKREGLN] trl
    JOIN [PR_TASKREG] t ON trl.MasterID = t.ID
WHERE trl.[OT] = 1
    AND trl.[EmpCode] = 'B0497'
    AND trl.[TrxDate] >= '2025-12-01'
    AND trl.[TrxDate] < '2026-01-01'