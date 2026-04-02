-- ==========================================
-- PAYROLL PERFORMANCE OPTIMIZATION INDEXES
-- ==========================================
-- These indexes are designed to optimize the massive queries in dataExtractorService.ts
-- when pulling division-level payroll reports. 

-- 1. Index on HR_EMPLOYEE for extracting active employees
-- The query joins employee history and filters by JoinDate/ResignDate
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_HR_EMPLOYEE_EmpCode_JoinDate' AND object_id = OBJECT_ID('HR_EMPLOYEE'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_HR_EMPLOYEE_EmpCode_JoinDate] ON [dbo].[HR_EMPLOYEE]
    (
        [EmpCode] ASC,
        [JoinDate] ASC,
        [ResignDate] ASC
    )
    INCLUDE([NIK], [EmpName], [GangCode], [DesignationCode], [DateOfBirth], [DateOfHire])
    WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
END
GO

-- 2. Index on PR_TASKREGLN for Attendance & Lembur
-- The query extracts attendance and lembur by TrxDate, DivisionCode, and EmpCode.
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PR_TASKREGLN_TrxDate_EmpCode' AND object_id = OBJECT_ID('PR_TASKREGLN'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PR_TASKREGLN_TrxDate_EmpCode] ON [dbo].[PR_TASKREGLN]
    (
        [TrxDate] ASC,
        [DivisionCode] ASC,
        [EmpCode] ASC
    )
    INCLUDE([HK], [LineAmount], [LineTaskCode], [RefDocNo])
    WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
END
GO

-- 3. Index on PR_ADTRANS for Premi & Potongan
-- Very heavy query based on DocDate and TargetCode
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PR_ADTRANS_DocDate_TargetCode' AND object_id = OBJECT_ID('PR_ADTRANS'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PR_ADTRANS_DocDate_TargetCode] ON [dbo].[PR_ADTRANS]
    (
        [DocDate] ASC,
        [TargetCode] ASC,  -- This is usually the EmpCode
        [AdcCode] ASC
    )
    INCLUDE([Amount], [TaskCode], [TaskDesc])
    WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
END
GO

-- 4. Index on BUNCHES table for harvesting production
-- Very slow if unindexed since it hits millions of rows
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_BUNCHES_TransDate_EmpCode' AND object_id = OBJECT_ID('BUNCHES'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_BUNCHES_TransDate_EmpCode] ON [dbo].[BUNCHES]
    (
        [TransDate] ASC,
        [EmpCode] ASC
    )
    INCLUDE([JobTitle], [LocationCode], [Quantity])
    WITH (STATISTICS_NORECOMPUTE = OFF, DROP_EXISTING = OFF, ONLINE = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
END
GO
