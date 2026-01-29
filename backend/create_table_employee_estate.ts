
import { Database } from "./src/db/client";
import { Config } from "./src/config";

async function createTable() {
    console.log("Initializing Extended Database...");
    const db = Database.getExtendedInstance();

    const sql = `
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'employee_estate')
    BEGIN
        CREATE TABLE employee_estate (
            empcode NVARCHAR(50) PRIMARY KEY,
            employee_name NVARCHAR(255),
            gang NVARCHAR(50),
            divisi_id NVARCHAR(50),
            jabatan NVARCHAR(50) DEFAULT 'Karyawan',
            updated_at DATETIME DEFAULT GETDATE()
        );
        PRINT 'Table employee_estate created successfully.';
    END
    ELSE
    BEGIN
        PRINT 'Table employee_estate already exists.';
    END
    `;

    try {
        await db.query(sql);
        console.log("Migration executed successfully.");
    } catch (error) {
        console.error("Migration failed:", error);
    }
}

createTable();
