/**
 * PAYROLL SYNC - GOOGLE APPS SCRIPT WEB APP
 * Version: 6.0 - Multi-Level Headers + Dynamic Columns + Auto Width
 *
 * SETUP INSTRUCTIONS:
 * 1. Open Google Spreadsheet > Extensions > Apps Script
 * 2. Copy this entire code into 'Code.gs'
 * 3. Go to Project Settings > Script Properties
 *    - Add property: 'API_SECRET' = 'your-secure-secret-here'
 * 4. Deploy > New deployment > Web app > Execute as: Me > Who has access: Anyone
 * 5. Copy Web app URL to backend .env as GOOGLE_SCRIPT_URL
 */

const PROPERTIES = PropertiesService.getScriptProperties();

// ============================================================================
// COLORS & STYLING CONSTANTS
// ============================================================================

const COLORS = {
    HEADER_BG: "#1F2937",
    HEADER_TEXT: "#FFFFFF",
    GANG_HEADER_BG: "#1E3A8A",
    GANG_HEADER_TEXT: "#FFFFFF",
    GANG_TOTAL_BG: "#E0F2FE",
    GANG_TOTAL_TEXT: "#000000",
    GRAND_TOTAL_BG: "#1E40AF",
    GRAND_TOTAL_TEXT: "#FFFFFF",
    ROW_EVEN: "#F8FAFB",
    ROW_ODD: "#FFFFFF",
    TITLE_BG: "#E6F4EA"
};

const FORMATS = {
    NUMBER: "#,##0",
    DECIMAL: "#,##0.##",
    CURRENCY: "#,##0",
    PERCENTAGE: "0.00%"
};

// ============================================================================
// REQUEST HANDLERS
// ============================================================================

function doPost(e) {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) {
        return jsonResponse({
            status: 'error',
            message: 'Server is busy, try again later'
        });
    }

    try {
        const payload = JSON.parse(e.postData.contents);
        if (!validateSecret(payload.secret)) {
            return jsonResponse({
                status: 'error',
                message: 'Unauthorized: Invalid Secret'
            });
        }

        const result = handleSyncRequest(payload);
        return jsonResponse({
            status: 'success',
            data: result
        });

    } catch (error) {
        console.error('Error in doPost:', error);
        return jsonResponse({
            status: 'error',
            message: error.toString(),
            stack: error.stack
        });

    } finally {
        lock.releaseLock();
    }
}

function doGet(e) {
    return jsonResponse({
        status: 'online',
        message: 'Payroll Sync Service is running',
        version: '6.0',
        timestamp: new Date().toISOString()
    });
}

// ============================================================================
// ROUTER & VALIDATION
// ============================================================================

function validateSecret(secret) {
    const configuredSecret = PROPERTIES.getProperty('API_SECRET');
    if (!configuredSecret) {
        throw new Error("API_SECRET is not configured");
    }
    return secret === configuredSecret;
}

function handleSyncRequest(payload) {
    const type = payload.type || payload.format || 'DAFTAR_UPAH';

    switch (type) {
        case 'DAFTAR_UPAH':
        case 'DAFTAR_UPAH_DYNAMIC':
        case 'DAFTAR_UPAH_MULTILEVEL':
            return syncDaftarUpah(payload);
        case 'DASHBOARD':
        case 'SUMMARY_WAGES':
            return syncDashboard(payload);
        default:
            return syncGenericData(payload);
    }
}

// ============================================================================
// DAFTAR UPAH SYNC
// ============================================================================

function syncDaftarUpah(payload) {
    const { division, month, year, headers, rows } = payload;

    if (!rows) {
        throw new Error("Missing required field: rows");
    }

    const sheetName = division || 'Sheet1';
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Delete existing sheet and create new one
    const existingSheet = ss.getSheetByName(sheetName);
    if (existingSheet) {
        ss.deleteSheet(existingSheet);
    }
    const sheet = ss.insertSheet(sheetName);

    // Debug: Log structure
    console.log("Rows length: " + rows.length);
    console.log("First row length: " + (rows[0] ? rows[0].length : "N/A"));
    console.log("Headers: " + JSON.stringify(headers).substring(0, 200));

    // Determine number of columns FIRST
    let numCols = rows[0]?.length || 10;
    console.log("Initial numCols from rows: " + numCols);

    // Check if headers is multi-level
    let isMultiLevel = false;
    if (headers && Array.isArray(headers) && headers.length > 0) {
        if (Array.isArray(headers[0])) {
            isMultiLevel = true;
            numCols = headers[0].length;
            console.log("Multi-level headers detected, numCols from headers: " + numCols);
        }
    }

    // Add metadata (use numCols for merge)
    const monthName = getMonthName(month);
    sheet.getRange(1, 1).setValue(`DAFTAR UPAH - ${division}`);
    sheet.getRange(1, 1, 1, Math.min(10, numCols)).merge().setFontWeight("bold").setFontSize(14).setBackground(COLORS.TITLE_BG);

    sheet.getRange(2, 1).setValue(`BULAN: ${monthName} ${year}`);
    sheet.getRange(2, 1, 1, Math.min(10, numCols)).merge().setFontWeight("bold");

    sheet.getRange(3, 1).setValue(`Last Sync: ${new Date().toLocaleString('id-ID')}`);
    sheet.getRange(3, 1, 1, Math.min(10, numCols)).merge().setFontStyle("italic").setFontSize(9);

    // Write headers (handle both single row and multi-level)
    if (headers && headers.length > 0) {
        writeHeaders(sheet, 5, headers);
    }

    console.log("Final numCols for data: " + numCols);

    // Write data rows
    if (rows && rows.length > 0) {
        const dataRange = sheet.getRange(10, 1, rows.length, numCols);
        dataRange.setValues(rows);
        applyFormatting(sheet, 10, rows, numCols);
    }

    // Set column widths - auto resize with minimum width
    for (let i = 1; i <= numCols; i++) {
        sheet.setColumnWidth(i, 100); // Set initial width
    }
    sheet.autoResizeColumns(1, numCols);

    // Set column widths to prevent overflow
    for (let i = 1; i <= numCols; i++) {
        const colWidth = sheet.getColumnWidth(i);
        if (colWidth < 50) {
            sheet.setColumnWidth(i, 50);
        } else if (colWidth > 400) {
            sheet.setColumnWidth(i, 400);
        }
    }

    return {
        sheet: sheetName,
        rows_processed: rows.length,
        format: 'DAFTAR_UPAH_DYNAMIC'
    };
}

/**
 * Write headers - supports single row or multi-level
 */
function writeHeaders(sheet, startRow, headers) {
    console.log("writeHeaders called - startRow: " + startRow);
    console.log("Headers structure check:");
    console.log("- Is array: " + Array.isArray(headers));
    console.log("- Length: " + (Array.isArray(headers) ? headers.length : "N/A"));
    console.log("- First element type: " + (Array.isArray(headers) && headers.length > 0 ? typeof headers[0] : "N/A"));
    console.log("- First element is array: " + (Array.isArray(headers) && headers.length > 0 && Array.isArray(headers[0])));

    // Check if multi-level (array of arrays)
    if (Array.isArray(headers) && headers.length > 0 && Array.isArray(headers[0])) {
        console.log("Multi-level headers CONFIRMED!");
        // Multi-level headers
        const numLevels = headers.length;
        const numCols = headers[0].length;

        console.log("numLevels: " + numLevels + ", numCols: " + numCols);
        console.log("Level 0 preview: " + headers[0].slice(0, 5).join(" | "));
        console.log("Level 1 preview: " + headers[1].slice(0, 5).join(" | "));

        // Write each level
        for (let level = 0; level < numLevels; level++) {
            const rowNum = startRow + level;
            const range = sheet.getRange(rowNum, 1, 1, numCols);
            range.setValues([headers[level]]);
            range.setBackground(COLORS.HEADER_BG);
            range.setFontColor(COLORS.HEADER_TEXT);
            range.setFontWeight("bold");
            range.setHorizontalAlignment("center");
            range.setVerticalAlignment("middle");
            console.log("Level " + level + " written to row " + rowNum + " with " + headers[level].length + " columns");
        }

        // Apply horizontal spanning for multi-level
        console.log("Applying cell merging...");
        for (let level = 0; level < numLevels; level++) {
            let spanStart = 0;
            let spanValue = headers[level][0];
            let mergeCount = 0;

            for (let col = 1; col <= numCols; col++) {
                const cellValue = col < numCols ? headers[level][col] : null;

                if (col === numCols || cellValue !== spanValue) {
                    const spanLength = col - spanStart;

                    if (spanLength > 1 && spanValue && spanValue !== "") {
                        try {
                            sheet.getRange(startRow + level, spanStart + 1, 1, spanLength).merge();
                            mergeCount++;
                            console.log("Merged level " + level + " cols " + (spanStart + 1) + "-" + col + " ('" + spanValue + "')");
                        } catch (e) {
                            console.log("Merge error at level " + level + ": " + e);
                        }
                    }

                    spanStart = col;
                    spanValue = cellValue;
                }
            }
            console.log("Level " + level + ": " + mergeCount + " merges applied");
        }
    } else {
        console.log("Single row headers");
        // Single row headers
        const numCols = headers.length;
        const range = sheet.getRange(startRow, 1, 1, numCols);
        range.setValues([headers]);
        range.setBackground(COLORS.HEADER_BG);
        range.setFontColor(COLORS.HEADER_TEXT);
        range.setFontWeight("bold");
        range.setHorizontalAlignment("center");
    }
}

function applyFormatting(sheet, startRow, rows, numCols) {
    for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        const rowNum = startRow + idx;
        const thirdCol = row[2] ? row[2].toString() : "";

        // Gang Header Row
        if (thirdCol.startsWith("GANG:")) {
            const range = sheet.getRange(rowNum, 1, 1, numCols);
            range.setBackground(COLORS.GANG_HEADER_BG);
            range.setFontColor(COLORS.GANG_HEADER_TEXT);
            range.setFontWeight("bold");
            range.setFontSize(11);
        }
        // Gang/Grand Total Row
        else if (thirdCol.includes("TOTAL")) {
            if (thirdCol === "GRAND TOTAL") {
                const range = sheet.getRange(rowNum, 1, 1, numCols);
                range.setBackground(COLORS.GRAND_TOTAL_BG);
                range.setFontColor(COLORS.GRAND_TOTAL_TEXT);
                range.setFontWeight("bold");
                range.setFontSize(12);
            } else {
                const range = sheet.getRange(rowNum, 1, 1, numCols);
                range.setBackground(COLORS.GANG_TOTAL_BG);
                range.setFontColor(COLORS.GANG_TOTAL_TEXT);
                range.setFontWeight("bold");
                range.setFontSize(10);
            }
        }
        // Employee Row
        else {
            // Zebra striping
            if (idx % 2 === 0) {
                sheet.getRange(rowNum, 1, 1, numCols).setBackground(COLORS.ROW_EVEN);
            } else {
                sheet.getRange(rowNum, 1, 1, numCols).setBackground(COLORS.ROW_ODD);
            }
            sheet.getRange(rowNum, 1, 1, numCols).setFontSize(10);

            // Number formatting - ABSENSI (columns 5-10)
            sheet.getRange(rowNum, 5, 1, 6).setNumberFormat(FORMATS.DECIMAL);

            // Currency formatting (columns 11 onwards)
            if (numCols > 10) {
                sheet.getRange(rowNum, 11, 1, numCols - 10).setNumberFormat(FORMATS.CURRENCY);
            }
        }
    }

    // Borders
    const fullRange = sheet.getRange(startRow, 1, rows.length, numCols);
    fullRange.setBorder(true, true, true, true, true, true, "#CCCCCC", SpreadsheetApp.BorderStyle.SOLID);
}

// ============================================================================
// DASHBOARD SYNC
// ============================================================================

function syncDashboard(payload) {
    const { division, month, year, data } = payload;
    const sheetName = division || 'DASHBOARD';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);
    sheet.clear();

    sheet.getRange(1, 1).setValue(`LAPORAN DASHBOARD - ${division}`);
    sheet.getRange(1, 1, 1, 5).merge().setFontWeight("bold").setFontSize(14).setBackground(COLORS.TITLE_BG);

    if (data && data.kpi) {
        writeKPIData(sheet, 3, data.kpi);
    }

    sheet.autoResizeColumns(1, 20);
    return { sheet: sheetName, format: 'DASHBOARD' };
}

function writeKPIData(sheet, startRow, kpiData) {
    const headers = [["KPI", "Value"]];
    sheet.getRange(startRow, 1, 1, headers[0].length).setValues([headers]);
    sheet.getRange(startRow, 1, 1, headers[0].length).setBackground(COLORS.HEADER_BG)
        .setFontColor(COLORS.HEADER_TEXT).setFontWeight("bold");

    const rows = [];
    if (kpiData.total_employees !== undefined) rows.push(["Total Karyawan", kpiData.total_employees]);
    if (kpiData.total_hk !== undefined) rows.push(["Total HK", kpiData.total_hk]);
    if (kpiData.total_upah_bersih !== undefined) rows.push(["Total Upah Bersih", kpiData.total_upah_bersih]);

    if (rows.length > 0) {
        sheet.getRange(startRow + 1, 1, rows.length, rows[0].length).setValues(rows);
    }
}

// ============================================================================
// GENERIC SYNC (Fallback)
// ============================================================================

function syncGenericData(payload) {
    const { division, month, year, headers, rows } = payload;
    const sheetName = division || 'Sheet1';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);
    sheet.clear();

    sheet.getRange(1, 1).setValue(`REPORT: ${division || 'Generic'}`);
    sheet.getRange(1, 1, 1, 5).setFontWeight("bold").setFontSize(14);

    if (headers && headers.length > 0) {
        const headerRange = sheet.getRange(3, 1, 1, headers.length);
        headerRange.setValues([headers]);
        headerRange.setBackground(COLORS.HEADER_BG);
        headerRange.setFontColor(COLORS.HEADER_TEXT);
        headerRange.setFontWeight("bold");
    }

    if (rows && rows.length > 0) {
        sheet.getRange(4, 1, rows.length, rows[0].length).setValues(rows);
    }

    sheet.autoResizeColumns(1, 20);
    return { sheet: sheetName, rows_processed: rows ? rows.length : 0 };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getMonthName(monthIndex) {
    const months = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    return months[monthIndex] || monthIndex;
}

function jsonResponse(data) {
    return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}
