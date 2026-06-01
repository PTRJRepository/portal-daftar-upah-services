import { Database } from '../db/client';
import { Config } from '../config';

async function createTable() {
    console.log("Starting table creation for payroll_manual_adjustments in " + Config.DB_EXTEND_DATABASE);
    try {
        const db = Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);

        await db.query(`
            IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='payroll_manual_adjustments' AND TABLE_SCHEMA='dbo')
            BEGIN
                CREATE TABLE dbo.payroll_manual_adjustments (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    period_month INT NOT NULL,
                    period_year INT NOT NULL,
                    emp_code VARCHAR(50) NOT NULL,
                    nik VARCHAR(50) NULL,
                    emp_name VARCHAR(150) NULL,
                    gang_code VARCHAR(50) NOT NULL,
                    division_code VARCHAR(50) NULL,
                    adjustment_type VARCHAR(20) NOT NULL, -- PREMI, POTONGAN_KOTOR, POTONGAN_BERSIH
                    adjustment_name VARCHAR(100) NOT NULL, -- e.g., 'Kasbon', 'Bonus Target'
                    amount DECIMAL(18,2) NOT NULL DEFAULT 0,
                    remarks VARCHAR(255) NULL,
                    metadata_json NVARCHAR(MAX) NULL,
                    created_at DATETIME DEFAULT GETDATE(),
                    created_by VARCHAR(50) NULL,
                    updated_at DATETIME DEFAULT GETDATE(),
                    updated_by VARCHAR(50) NULL
                );

                CREATE INDEX IX_payroll_manual_adjustments_period ON dbo.payroll_manual_adjustments (period_year, period_month);
                CREATE INDEX IX_payroll_manual_adjustments_emp ON dbo.payroll_manual_adjustments (emp_code);
                CREATE INDEX IX_payroll_manual_adjustments_nik ON dbo.payroll_manual_adjustments (nik, period_year, period_month);
                
                PRINT 'Table payroll_manual_adjustments created successfully.'
            END ELSE BEGIN
                PRINT 'Table payroll_manual_adjustments already exists.'
            END

            IF COL_LENGTH('dbo.payroll_manual_adjustments', 'nik') IS NULL
            BEGIN
                ALTER TABLE dbo.payroll_manual_adjustments ADD nik VARCHAR(50) NULL;
            END

            IF COL_LENGTH('dbo.payroll_manual_adjustments', 'emp_name') IS NULL
            BEGIN
                ALTER TABLE dbo.payroll_manual_adjustments ADD emp_name VARCHAR(150) NULL;
            END

            IF COL_LENGTH('dbo.payroll_manual_adjustments', 'metadata_json') IS NULL
            BEGIN
                ALTER TABLE dbo.payroll_manual_adjustments ADD metadata_json NVARCHAR(MAX) NULL;
            END

            IF NOT EXISTS (
                SELECT 1 FROM sys.indexes
                WHERE name = 'IX_payroll_manual_adjustments_nik'
                  AND object_id = OBJECT_ID('dbo.payroll_manual_adjustments')
            )
            BEGIN
                CREATE INDEX IX_payroll_manual_adjustments_nik
                    ON dbo.payroll_manual_adjustments (nik, period_year, period_month);
            END
        `);

        console.log("Script executed successfully.");
    } catch (e: any) {
        console.error("Error creating table:", e.message);
    }
}

createTable();
