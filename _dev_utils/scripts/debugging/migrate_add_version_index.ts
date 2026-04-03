/**
 * Migration Script: Add version_index to history tables
 *
 * IMPORTANT: Data Append-Only Pattern
 *
 * This migration adds a `version_index` column to enable immutable/append-only
 * data storage. The column tracks the version of each record for a given
 * period-key combination. The latest version is always obtained by:
 *   ORDER BY version_index DESC
 *
 * Tables affected:
 * 1. daftar_upah_aggregation_history  - version per (gang_code, period_month, period_year)
 * 2. payroll_history_header          - version per (gang_code, period_month, period_year)
 *
 * How it works:
 * - INSERT always adds a new record (never UPDATE existing)
 * - version_index = MAX(existing version) + 1 for the same period-key
 * - READ latest: SELECT ... WHERE ... ORDER BY version_index DESC
 * - NIK is NEVER updated - if NIK exists, skip INSERT, don't replace
 */

import { Database } from "../db/client";

async function run() {
    console.log("Starting migration: add version_index columns...\n");
    Database.getInstance();
    const db = Database.getExtendedInstance();

    const migrations = [
        {
            name: "daftar_upah_aggregation_history",
            check: "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'daftar_upah_aggregation_history' AND COLUMN_NAME = 'version_index'",
            alter: `ALTER TABLE dbo.daftar_upah_aggregation_history ADD version_index INT NOT NULL DEFAULT 1`,
            backfill: `UPDATE dbo.daftar_upah_aggregation_history SET version_index = 1 WHERE version_index IS NULL`,
            constraint: `ALTER TABLE dbo.daftar_upah_aggregation_history ADD CONSTRAINT DF_daftar_upah_agg_history_ver DEFAULT 1 FOR version_index`,
            addNotNull: `ALTER TABLE dbo.daftar_upah_aggregation_history ALTER COLUMN version_index INT NOT NULL`,
        },
        {
            name: "payroll_history_header",
            check: "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'payroll_history_header' AND COLUMN_NAME = 'version_index'",
            alter: `ALTER TABLE dbo.payroll_history_header ADD version_index INT NOT NULL DEFAULT 1`,
            backfill: `UPDATE dbo.payroll_history_header SET version_index = 1 WHERE version_index IS NULL`,
            addNotNull: `ALTER TABLE dbo.payroll_history_header ALTER COLUMN version_index INT NOT NULL`,
        },
    ];

    for (const m of migrations) {
        console.log(`\n--- Processing: ${m.name} ---`);

        try {
            // Check if column exists
            const check = await db.query<{ col: number }[]>(m.check);
            if (check && check.length > 0) {
                console.log(`  [SKIP] version_index column already exists in ${m.name}`);
                continue;
            }

            // Add column (allows NULL initially for backfill)
            console.log(`  [ADD] Adding version_index column...`);
            await db.query(m.alter);

            // Set default value for existing rows
            console.log(`  [BACKFILL] Setting version_index = 1 for existing rows...`);
            await db.query(m.backfill);

            // Make NOT NULL
            console.log(`  [CONSTRAINT] Making column NOT NULL...`);
            if (m.constraint) {
                try {
                    await db.query(m.constraint);
                } catch {
                    await db.query(m.addNotNull);
                }
            } else {
                await db.query(m.addNotNull);
            }

            console.log(`  [OK] version_index column added to ${m.name}`);
        } catch (error: any) {
            console.error(`  [ERROR] ${m.name}: ${error.message}`);
        }
    }

    // Verify
    console.log("\n--- Verification ---");
    for (const m of migrations) {
        try {
            const check = await db.query<{ count: number }[]>(
                `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${m.name}' AND COLUMN_NAME = 'version_index'`
            );
            const exists = check && check.length > 0 && check[0].count > 0;
            console.log(`  ${m.name}: ${exists ? 'OK - version_index exists' : 'MISSING - version_index not found'}`);
        } catch (error: any) {
            console.error(`  ${m.name}: Error checking - ${error.message}`);
        }
    }

    console.log("\nMigration complete.");
}

run().catch(console.error);
