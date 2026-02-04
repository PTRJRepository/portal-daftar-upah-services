import { Database } from "../db/client";

async function run() {
    console.log("Connecting to Extended DB...");
    const db = Database.getExtendedInstance();
    try {
        console.log("Checking and adding column total_premi_kinerja...");
        await db.query(`
            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID('dbo.daftar_upah_aggregation_history') 
                AND name = 'total_premi_kinerja'
            )
            BEGIN
                ALTER TABLE dbo.daftar_upah_aggregation_history
                ADD total_premi_kinerja DECIMAL(18, 2) DEFAULT 0;
                PRINT 'Column total_premi_kinerja added.';
            END
            ELSE
            BEGIN
                PRINT 'Column total_premi_kinerja already exists.';
            END

            -- Also ensure total_premi_insentif exists (just in case)
            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID('dbo.daftar_upah_aggregation_history') 
                AND name = 'total_premi_insentif'
            )
            BEGIN
                ALTER TABLE dbo.daftar_upah_aggregation_history
                ADD total_premi_insentif DECIMAL(18, 2) DEFAULT 0;
                PRINT 'Column total_premi_insentif added.';
            END
        `);
        console.log("Migration completed.");
    } catch (e) {
        console.error("Migration failed:", e);
    }
}

run();
