/**
 * Script untuk scanning data bunches dari tabel-tabel harvest
 * Gunakan docDate untuk filter data
 */

import { Database } from "../db/client";
import { write } from "bun";

// Tabel-tabel yang akan di-scan untuk data bunches
const HARVEST_TABLES = [
    // Main payroll database
    { db: "default", table: "PR_HARVESTER", desc: "Harvester Master" },
    { db: "default", table: "PR_HARVESTER_ARC", desc: "Harvester Master Archive" },
    { db: "default", table: "PR_HARVESTERLN", desc: "Harvester Line (Detail per transaksi)" },
    { db: "default", table: "PR_HARVESTERLN_ARC", desc: "Harvester Line Archive" },
    { db: "default", table: "PR_HARVESTERLN_ACC", desc: "Harvester Line Accumulator" },
    { db: "default", table: "PR_HARVESTERLN_ACC_ARC", desc: "Harvester Line Accumulator Archive" },

    // FFB Driver tables (related to FFB transport)
    { db: "default", table: "PR_FFBDRIVER", desc: "FFB Driver Master" },
    { db: "default", table: "PR_FFBDRIVER_ARC", desc: "FFB Driver Master Archive" },
    { db: "default", table: "PR_FFBDRIVERLN", desc: "FFB Driver Line" },
    { db: "default", table: "PR_FFBDRIVERLN_ARC", desc: "FFB Driver Line Archive" },
    { db: "default", table: "PR_FFBDRIVERLN_SELECTED_HARVESTORLN", desc: "FFB Driver Selected Harvester" },
    { db: "default", table: "PR_FFBDRIVER_ACC", desc: "FFB Driver Accumulator" },
    { db: "default", table: "PR_FFBDRIVER_ACC_ARC", desc: "FFB Driver Accumulator Archive" },
];

// Mill database tables
const MILL_TABLES = [
    { db: "mill", table: "WM_TICKET", desc: "Mill Ticket (FFB Weight)" },
    { db: "mill", table: "WM_FFBASSESS", desc: "FFB Assessment" },
];

interface ScanResult {
    table: string;
    database: string;
    desc: string;
    exists: boolean;
    columns: string[];
    sampleRows: any[];
    rowCount: number;
    docDateColumn?: string;
    empCodeColumn?: string;
    bunchColumn?: string;
    notes?: string;
}

const results: ScanResult[] = [];

async function scanTable(dbInstance: Database, tableName: string, desc: string, dbType: string): Promise<ScanResult> {
    const result: ScanResult = {
        table: tableName,
        database: dbType,
        desc: desc,
        exists: false,
        columns: [],
        sampleRows: [],
        rowCount: 0,
    };

    try {
        // Cek apakah tabel ada dengan mengambil 1 row
        const checkSql = "SELECT TOP 1 * FROM " + tableName;
        const checkRows = await dbInstance.query<any>(checkSql);

        result.exists = true;

        if (checkRows.length > 0) {
            result.columns = Object.keys(checkRows[0]);
        }

        // Cari kolom yang relevan
        result.docDateColumn = result.columns.find(function(c) {
            const lower = c.toLowerCase();
            return lower.indexOf('docdate') >= 0 ||
                   lower.indexOf('date') >= 0 ||
                   lower.indexOf('trxdate') >= 0;
        });
        result.empCodeColumn = result.columns.find(function(c) {
            const lower = c.toLowerCase();
            return lower.indexOf('emp') >= 0 ||
                   lower.indexOf('harvester') >= 0 ||
                   lower.indexOf('driver') >= 0;
        });
        result.bunchColumn = result.columns.find(function(c) {
            const lower = c.toLowerCase();
            return lower.indexOf('bunch') >= 0 ||
                   lower.indexOf('bunches') >= 0 ||
                   lower.indexOf('qty') >= 0 ||
                   lower.indexOf('quantity') >= 0;
        });

        // Hitung total rows
        const countSql = "SELECT COUNT(*) as cnt FROM " + tableName;
        const countResult = await dbInstance.query<any>(countSql);
        if (countResult.length > 0) {
            result.rowCount = countResult[0].cnt || 0;
        }

        // Ambil sample rows (top 5)
        const orderByCol = result.docDateColumn || "1";
        const sampleSql = "SELECT TOP 5 * FROM " + tableName + " ORDER BY " + orderByCol + " DESC";
        result.sampleRows = await dbInstance.query<any>(sampleSql);

    } catch (error: any) {
        result.exists = false;
        result.notes = "Error: " + error.message;
    }

    return result;
}

async function main() {
    console.log("=".repeat(80));
    console.log("SCANNING DATA BUNCHES - TABLE HARVEST TERKAIT");
    console.log("=".repeat(80));
    console.log("");

    // Scan main payroll database tables
    console.log("Scanning Main Database (db_ptrj)...");
    const mainDb = Database.getInstance();

    const defaultTables = HARVEST_TABLES.filter(function(t) { return t.db === "default"; });
    for (const t of defaultTables) {
        console.log("  Checking " + t.table + "...");
        const result = await scanTable(mainDb, t.table, t.desc, "db_ptrj");
        results.push(result);
        const status = result.exists ? "EXISTS (" + result.rowCount + " rows)" : "NOT FOUND";
        console.log("    Status: " + status);
        if (result.exists) {
            const cols = result.columns.slice(0, 10).join(", ");
            const more = result.columns.length > 10 ? "..." : "";
            console.log("    Columns: " + cols + more);
        }
    }

    // Scan mill database tables
    console.log("\nScanning Mill Database (db_ptrj_mill)...");
    const millDb = Database.getMillInstance();

    for (const t of MILL_TABLES) {
        console.log("  Checking " + t.table + "...");
        const result = await scanTable(millDb, t.table, t.desc, "db_ptrj_mill");
        results.push(result);
        const status = result.exists ? "EXISTS (" + result.rowCount + " rows)" : "NOT FOUND";
        console.log("    Status: " + status);
        if (result.exists) {
            const cols = result.columns.slice(0, 10).join(", ");
            const more = result.columns.length > 10 ? "..." : "";
            console.log("    Columns: " + cols + more);
        }
    }

    // Generate report
    console.log("\n" + "=".repeat(80));
    console.log("SCAN RESULT SUMMARY");
    console.log("=".repeat(80));

    const existingTables = results.filter(function(r) { return r.exists; });
    const tablesWithBunchColumn = existingTables.filter(function(r) { return r.bunchColumn; });
    const tablesWithEmpColumn = existingTables.filter(function(r) { return r.empCodeColumn; });
    const tablesWithDateColumn = existingTables.filter(function(r) { return r.docDateColumn; });

    console.log("\nTotal Tables Scanned: " + results.length);
    console.log("Tables Found: " + existingTables.length);
    console.log("Tables with Bunch Column: " + tablesWithBunchColumn.length);
    console.log("Tables with Employee/Harvester Column: " + tablesWithEmpColumn.length);
    console.log("Tables with Date Column: " + tablesWithDateColumn.length);

    // Detail untuk tabel yang memiliki bunch column
    if (tablesWithBunchColumn.length > 0) {
        console.log("\n" + "-".repeat(80));
        console.log("PROMISING TABLES (HAVE BUNCH/QUANTITY COLUMN):");
        console.log("-".repeat(80));

        for (const t of tablesWithBunchColumn) {
            console.log("\n[" + t.table + "] " + t.desc);
            console.log("  Database: " + t.database);
            console.log("  Total Rows: " + t.rowCount);
            console.log("  Bunch Column: " + (t.bunchColumn || "N/A"));
            console.log("  Employee Column: " + (t.empCodeColumn || "N/A"));
            console.log("  Date Column: " + (t.docDateColumn || "N/A"));
            console.log("  All Columns: " + t.columns.join(", "));

            if (t.sampleRows.length > 0) {
                console.log("  Sample Data:");
                const jsonStr = JSON.stringify(t.sampleRows[0], null, 2);
                console.log("    " + jsonStr.split("\n").join("\n    "));
            }
        }
    } else {
        console.log("\n" + "=".repeat(80));
        console.log("NO TABLES FOUND WITH BUNCH/QUANTITY COLUMN");
        console.log("=".repeat(80));
    }

    // Detail untuk tabel harvest yang ada
    console.log("\n" + "-".repeat(80));
    console.log("ALL EXISTING HARVEST-RELATED TABLES:");
    console.log("-".repeat(80));

    for (const t of existingTables) {
        console.log("\n[" + t.table + "] " + t.desc);
        console.log("  Database: " + t.database);
        console.log("  Total Rows: " + t.rowCount);
        console.log("  Columns: " + t.columns.join(", "));
    }

    // Tabel yang tidak ditemukan
    const missingTables = results.filter(function(r) { return !r.exists; });
    if (missingTables.length > 0) {
        console.log("\n" + "-".repeat(80));
        console.log("TABLES NOT FOUND:");
        console.log("-".repeat(80));
        for (const t of missingTables) {
            console.log("  " + t.table + ": " + (t.notes || "Unknown error"));
        }
    }

    // Save detailed report to file
    const reportPath = "harvest_bunches_scan_report.json";
    const missingSummary = missingTables.map(function(t) {
        return { table: t.table, reason: t.notes };
    });
    await write(reportPath, JSON.stringify({
        scanDate: new Date().toISOString(),
        summary: {
            totalScanned: results.length,
            tablesFound: existingTables.length,
            tablesWithBunchColumn: tablesWithBunchColumn.length,
            tablesWithEmpColumn: tablesWithEmpColumn.length,
            tablesWithDateColumn: tablesWithDateColumn.length,
        },
        results: results,
        promisingTables: tablesWithBunchColumn,
        allExistingTables: existingTables,
        missingTables: missingSummary,
    }, null, 2));

    console.log("\nDetailed report saved to: " + reportPath);
    console.log("\n" + "=".repeat(80));
}

main().catch(console.error);
