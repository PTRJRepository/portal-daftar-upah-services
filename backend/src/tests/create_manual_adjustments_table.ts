import { Database } from '../db/client';
import { Config } from '../config';

async function createTable() {
    console.log("Starting table creation for payroll_manual_adjustments in " + Config.DB_EXTEND_DATABASE);
    try {
        const db = Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);

        await db.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='payroll_manual_adjustments' AND xtype='U')
            BEGIN
                CREATE TABLE dbo.payroll_manual_adjustments (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    period_month INT NOT NULL,
                    period_year INT NOT NULL,
                    emp_code VARCHAR(50) NOT NULL,
                    gang_code VARCHAR(50) NOT NULL,
                    division_code VARCHAR(50) NULL,
                    adjustment_type VARCHAR(20) NOT NULL, -- PREMI, POTONGAN_KOTOR, POTONGAN_BERSIH
                    adjustment_name VARCHAR(100) NOT NULL, -- e.g., 'Kasbon', 'Bonus Target'
                    amount DECIMAL(18,2) NOT NULL DEFAULT 0,
                    remarks VARCHAR(255) NULL,
                    created_at DATETIME DEFAULT GETDATE(),
                    created_by VARCHAR(50) NULL,
                    updated_at DATETIME DEFAULT GETDATE(),
                    updated_by VARCHAR(50) NULL
                );

                CREATE INDEX IX_payroll_manual_adjustments_period ON dbo.payroll_manual_adjustments (period_year, period_month);
                CREATE INDEX IX_payroll_manual_adjustments_emp ON dbo.payroll_manual_adjustments (emp_code);
                
                PRINT 'Table payroll_manual_adjustments created successfully.'
            } ELSE {
                PRINT 'Table payroll_manual_adjustments already exists.'
            }
        `);

        console.log("Script executed successfully.");
    } catch (e: any) {
        console.error("Error creating table:", e.message);
    }
}

createTable();
