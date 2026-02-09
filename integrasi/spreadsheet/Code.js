/**
 * PAYROLL SYNC - GOOGLE APPS SCRIPT WEB APP
 *
 * Flexible spreadsheet synchronization for various report types:
 * - DAFTAR_UPAH: Detailed employee payroll with gang headers, gang totals, grand total
 * - DASHBOARD: Summary dashboard data
 * - Custom formats can be added
 *
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Spreadsheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Copy this entire code into 'Code.gs'.
 * 4. Go to Project Settings (Gear icon) > Script Properties.
 *    - Add property: 'API_SECRET' = 'your-secure-secret-here' (Must match backend .env)
 * 5. Click 'Deploy' > 'New deployment'.
 *    - Select type: 'Web app'.
 *    - Description: 'v2'.
 *    - Execute as: 'Me' (your email).
 *    - Who has access: 'Anyone'.
 * 6. Copy the 'Web app URL' and paste it into your backend .env file as GOOGLE_SCRIPT_URL.
 */

const PROPERTIES = PropertiesService.getScriptProperties();

// ============================================================================
// COLORS & STYLING CONSTANTS
// ============================================================================

const COLORS = {
    // Header colors
    HEADER_BG: "#1F2937",           // Dark gray/black
    HEADER_TEXT: "#FFFFFF",         // White

    // Gang header colors
    GANG_HEADER_BG: "#1E3A8A",      // Dark blue
    GANG_HEADER_TEXT: "#FFFFFF",    // White

    // Gang total colors
    GANG_TOTAL_BG: "#E0F2FE",       // Light blue
    GANG_TOTAL_TEXT: "#000000",     // Black

    // Grand total colors
    GRAND_TOTAL_BG: "#1E40AF",      // Medium blue
    GRAND_TOTAL_TEXT: "#FFFFFF",    // White

    // Zebra striping
    ROW_EVEN: "#F8FAFB",            // Very light gray
    ROW_ODD: "#FFFFFF",             // White

    // Section title
    TITLE_BG: "#E6F4EA",            // Light green
    SECTION_HIGHLIGHT: "#FEF3C7"   // Light yellow
};

const FORMATS = {
    NUMBER: "#,##0",               // Integer numbers
    DECIMAL: "#,##0.##",           // Decimal numbers (HK)
    CURRENCY: "#,##0",             // Currency without decimal
    PERCENTAGE: "0.00%"            // Percentage
};

// ============================================================================
// REQUEST HANDLERS
// ============================================================================

/**
 * Handle POST requests from the Backend
 */
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

        // 1. Authentication
        if (!validateSecret(payload.secret)) {
            return jsonResponse({
                status: 'error',
                message: 'Unauthorized: Invalid Secret'
            });
        }

        // 2. Route to appropriate handler based on type
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

/**
 * Handle GET requests (Health check)
 */
function doGet(e) {
    return jsonResponse({
        status: 'online',
        message: 'Payroll Sync Service is running',
        version: '2.0',
        timestamp: new Date().toISOString()
    });
}

// ============================================================================
// ROUTER & VALIDATION
// ============================================================================

/**
 * Validate API secret
 */
function validateSecret(secret) {
    const configuredSecret = PROPERTIES.getProperty('API_SECRET');
    if (!configuredSecret) {
        throw new Error("API_SECRET is not configured in Script Properties");
    }
    return secret === configuredSecret;
}

/**
 * Route request to appropriate handler based on type
 */
function handleSyncRequest(payload) {
    const type = payload.type || payload.format || 'DAFTAR_UPAH';

    switch (type) {
        case 'DAFTAR_UPAH':
        case 'DAFTAR_UPAH_DETAILED':
            return syncDaftarUpah(payload);

        case 'DASHBOARD':
        case 'SUMMARY_WAGES':
            return syncDashboard(payload);

        case 'RAW':
        default:
            return syncGenericData(payload);
    }
}

// ============================================================================
// DAFTAR UPAH SYNC
// ============================================================================

/**
 * Sync Daftar Upah format with gang headers, gang totals, and grand total
 */
function syncDaftarUpah(payload) {
    const { division, month, year, headers, rows } = payload;

    if (!rows) {
        throw new Error("Missing required field: rows");
    }

    const sheetName = division || 'Sheet1';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);

    // Create sheet if not exists
    if (!sheet) {
        sheet = ss.insertSheet(sheetName);
    }

    // Clear sheet
    sheet.clear();

    // Determine row types
    const rowTypes = analyzeRowTypes(rows);

    // Add metadata section (title, period, timestamp)
    const metadataRows = addMetadataSection(sheet, division, month, year);

    // Write headers
    let currentRow = metadataRows + 2; // +2 for spacing
    if (headers && headers.length > 0) {
        writeHeaders(sheet, currentRow, headers);
        currentRow++;
    }

    // Write data rows with special formatting
    if (rows && rows.length > 0) {
        writeDataRows(sheet, currentRow, rows, rowTypes);
    }

    // Auto-resize columns
    sheet.autoResizeColumns(1, headers ? headers.length : 10);

    // Freeze header rows and first 3 columns (No, NIK, Nama)
    sheet.setFrozenRows(metadataRows + 3);
    sheet.setFrozenColumns(3);

    return {
        sheet: sheetName,
        rows_processed: rows.length,
        gang_count: rowTypes.gangHeaders,
        employee_count: rowTypes.employees,
        format: 'DAFTAR_UPAH'
    };
}

/**
 * Analyze rows to determine their types (gang header, employee, gang total, grand total)
 */
function analyzeRowTypes(rows) {
    const types = {
        gangHeaders: 0,
        gangTotals: 0,
        employees: 0,
        grandTotal: false
    };

    rows.forEach(row => {
        const thirdCol = row[2] ? row[2].toString() : "";

        if (thirdCol.startsWith("GANG:")) {
            types.gangHeaders++;
        } else if (thirdCol === "TOTAL GANG") {
            types.gangTotals++;
        } else if (thirdCol === "GRAND TOTAL") {
            types.grandTotal = true;
        } else {
            types.employees++;
        }
    });

    return types;
}

/**
 * Write headers with multi-level support
 */
function writeHeaders(sheet, startRow, headers) {
    // Check if headers is multi-level (array of arrays)
    if (Array.isArray(headers[0])) {
        // Multi-level headers
        headers.forEach((headerRow, index) => {
            const range = sheet.getRange(startRow + index, 1, 1, headerRow.length);
            range.setValues([headerRow]);
            range.setBackground(COLORS.HEADER_BG);
            range.setFontColor(COLORS.HEADER_TEXT);
            range.setFontWeight("bold");
            range.setHorizontalAlignment("center");
            range.setVerticalAlignment("middle");
        });
    } else {
        // Single row headers
        const range = sheet.getRange(startRow, 1, 1, headers.length);
        range.setValues([headers]);
        range.setBackground(COLORS.HEADER_BG);
        range.setFontColor(COLORS.HEADER_TEXT);
        range.setFontWeight("bold");
        range.setHorizontalAlignment("center");
    }
}

/**
 * Write data rows with special formatting for gang headers, totals, etc.
 */
function writeDataRows(sheet, startRow, rows, rowTypes) {
    if (rows.length === 0) return;

    const numCols = rows[0].length;

    // Write all data at once for performance
    const dataRange = sheet.getRange(startRow, 1, rows.length, numCols);
    dataRange.setValues(rows);

    // Apply formatting based on row types
    let rowIndex = 0;
    rows.forEach((row, idx) => {
        const rowNum = startRow + idx;
        const thirdCol = row[2] ? row[2].toString() : "";

        if (thirdCol.startsWith("GANG:")) {
            // Gang Header Row
            formatGangHeaderRow(sheet, rowNum, numCols);
        } else if (thirdCol === "TOTAL GANG") {
            // Gang Total Row
            formatGangTotalRow(sheet, rowNum, numCols);
        } else if (thirdCol === "GRAND TOTAL") {
            // Grand Total Row
            formatGrandTotalRow(sheet, rowNum, numCols);
        } else {
            // Employee Row
            formatEmployeeRow(sheet, rowNum, numCols, idx);
        }
    });

    // Apply borders to entire data section
    const fullRange = sheet.getRange(startRow, 1, rows.length, numCols);
    fullRange.setBorder(true, true, true, true, true, true, "#CCCCCC", SpreadsheetApp.BorderStyle.SOLID);

    // Apply number formatting
    applyNumberFormatting(sheet, startRow, rows, numCols);
}

/**
 * Format gang header row
 */
function formatGangHeaderRow(sheet, rowNum, numCols) {
    const range = sheet.getRange(rowNum, 1, 1, numCols);
    range.setBackground(COLORS.GANG_HEADER_BG);
    range.setFontColor(COLORS.GANG_HEADER_TEXT);
    range.setFontWeight("bold");
    range.setFontSize(11);

    // Merge first few cells for gang label
    sheet.getRange(rowNum, 1, 1, numCols).merge();
}

/**
 * Format gang total row
 */
function formatGangTotalRow(sheet, rowNum, numCols) {
    const range = sheet.getRange(rowNum, 1, 1, numCols);
    range.setBackground(COLORS.GANG_TOTAL_BG);
    range.setFontColor(COLORS.GANG_TOTAL_TEXT);
    range.setFontWeight("bold");
    range.setFontSize(10);
    range.setBorder(null, true, true, true, null, null, "#0284C7", SpreadsheetApp.BorderStyle.MEDIUM);
}

/**
 * Format grand total row
 */
function formatGrandTotalRow(sheet, rowNum, numCols) {
    const range = sheet.getRange(rowNum, 1, 1, numCols);
    range.setBackground(COLORS.GRAND_TOTAL_BG);
    range.setFontColor(COLORS.GRAND_TOTAL_TEXT);
    range.setFontWeight("bold");
    range.setFontSize(12);
    range.setBorder(null, null, null, true, null, null, "#1E3A8A", SpreadsheetApp.BorderStyle.THICK);
}

/**
 * Format employee row
 */
function formatEmployeeRow(sheet, rowNum, numCols, rowIdx) {
    // Zebra striping
    if (rowIdx % 2 === 0) {
        sheet.getRange(rowNum, 1, 1, numCols).setBackground(COLORS.ROW_EVEN);
    } else {
        sheet.getRange(rowNum, 1, 1, numCols).setBackground(COLORS.ROW_ODD);
    }

    // Font size
    sheet.getRange(rowNum, 1, 1, numCols).setFontSize(10);
}

/**
 * Apply number formatting based on column index
 */
function applyNumberFormatting(sheet, startRow, rows, numCols) {
    // Skip formatting for non-data rows (will be overridden by special formatting)
    for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        const thirdCol = row[2] ? row[2].toString() : "";

        // Skip special rows
        if (thirdCol.startsWith("GANG:") || thirdCol.includes("TOTAL")) {
            continue;
        }

        const rowNum = startRow + idx;

        // Column-specific formatting (adjust indices based on actual column order)
        // HK columns (usually columns 6-11): Decimal format
        sheet.getRange(rowNum, 6, 1, 6).setNumberFormat(FORMATS.DECIMAL);

        // Currency columns (column 14 onwards): Currency format
        if (numCols > 14) {
            sheet.getRange(rowNum, 14, 1, numCols - 13).setNumberFormat(FORMATS.CURRENCY);
        }
    }
}

// ============================================================================
// DASHBOARD SYNC
// ============================================================================

/**
 * Sync dashboard/summary data
 */
function syncDashboard(payload) {
    const { division, month, year, data } = payload;

    const sheetName = division || 'DASHBOARD';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
        sheet = ss.insertSheet(sheetName);
    }

    sheet.clear();

    // Add metadata
    const metadataRows = addMetadataSection(sheet, division, month, year, "DASHBOARD");

    // Process dashboard data based on structure
    if (data && data.kpi) {
        writeKPIData(sheet, metadataRows + 2, data.kpi);
    }

    if (data && data.comparisons) {
        writeComparisonData(sheet, sheet.getLastRow() + 2, data.comparisons);
    }

    sheet.autoResizeColumns(1, 20);

    return {
        sheet: sheetName,
        format: 'DASHBOARD'
    };
}

/**
 * Write KPI data
 */
function writeKPIData(sheet, startRow, kpiData) {
    const headers = [["KPI", "Value", "Previous", "Change", "Change %"]];
    sheet.getRange(startRow, 1, 1, headers[0].length).setValues([headers]);

    // Format headers
    const headerRange = sheet.getRange(startRow, 1, 1, headers[0].length);
    headerRange.setBackground(COLORS.HEADER_BG);
    headerRange.setFontColor(COLORS.HEADER_TEXT);
    headerRange.setFontWeight("bold");

    // Write KPI rows
    const rows = [];
    if (kpiData.total_employees !== undefined) {
        rows.push(["Total Karyawan", kpiData.total_employees]);
    }
    if (kpiData.total_hk !== undefined) {
        rows.push(["Total HK", kpiData.total_hk]);
    }
    if (kpiData.total_upah_bersih !== undefined) {
        rows.push(["Total Upah Bersih", kpiData.total_upah_bersih]);
    }

    if (rows.length > 0) {
        sheet.getRange(startRow + 1, 1, rows.length, rows[0].length).setValues(rows);
    }
}

/**
 * Write comparison data
 */
function writeComparisonData(sheet, startRow, comparisons) {
    // Implementation for comparison/division data
    if (Array.isArray(comparisons)) {
        const headers = [["Division", "Employees", "HK", "Upah Bersih", "FFB/Employee"]];
        sheet.getRange(startRow, 1, 1, headers[0].length).setValues([headers]);

        const rows = comparisons.map(div => [
            div.division || div.code,
            div.employee_count || 0,
            div.total_hk || 0,
            div.upah_bersih || 0,
            div.yield || 0
        ]);

        if (rows.length > 0) {
            sheet.getRange(startRow + 1, 1, rows.length, rows[0].length).setValues(rows);
        }
    }
}

// ============================================================================
// GENERIC SYNC (Fallback)
// ============================================================================

/**
 * Generic sync for unknown formats
 */
function syncGenericData(payload) {
    const { division, month, year, headers, rows } = payload;

    const sheetName = division || 'Sheet1';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
        sheet = ss.insertSheet(sheetName);
    }

    sheet.clear();

    let currentRow = 1;

    // Add metadata
    sheet.getRange(currentRow, 1).setValue(`REPORT: ${division || 'Generic'}`);
    sheet.getRange(currentRow, 1, 1, 5).merge().setFontWeight("bold").setFontSize(14);
    currentRow += 2;

    // Write headers
    if (headers && headers.length > 0) {
        const headerRange = sheet.getRange(currentRow, 1, 1, headers.length);
        headerRange.setValues([headers]);
        headerRange.setBackground(COLORS.HEADER_BG);
        headerRange.setFontColor(COLORS.HEADER_TEXT);
        headerRange.setFontWeight("bold");
        currentRow++;
    }

    // Write data
    if (rows && rows.length > 0) {
        const dataRange = sheet.getRange(currentRow, 1, rows.length, rows[0].length);
        dataRange.setValues(rows);

        // Basic formatting
        dataRange.setBorder(true, true, true, true, true, true, "#CCCCCC", SpreadsheetApp.BorderStyle.SOLID);
    }

    sheet.autoResizeColumns(1, 20);

    return {
        sheet: sheetName,
        rows_processed: rows ? rows.length : 0,
        format: 'GENERIC'
    };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Add metadata section (title, period, timestamp)
 */
function addMetadataSection(sheet, division, month, year, type = "DAFTAR_UPAH") {
    // Row 1: Report Title
    const title = type === "DASHBOARD"
        ? `LAPORAN DASHBOARD - ${division}`
        : `DAFTAR UPAH - ${division}`;

    sheet.getRange(1, 1).setValue(title);
    sheet.getRange(1, 1, 1, 8).merge()
        .setFontWeight("bold")
        .setFontSize(14)
        .setBackground(COLORS.TITLE_BG);

    // Row 2: Period
    const monthName = getMonthName(month);
    const periodText = type === "DASHBOARD"
        ? `PERIODE: ${monthName} ${year}`
        : `BULAN: ${monthName} ${year}`;

    sheet.getRange(2, 1).setValue(periodText);
    sheet.getRange(2, 1, 1, 8).merge().setFontWeight("bold");

    // Row 3: Timestamp
    sheet.getRange(3, 1).setValue(`Last Sync: ${new Date().toLocaleString('id-ID')}`);
    sheet.getRange(3, 1, 1, 8).merge().setFontStyle("italic").setFontSize(9);

    return 3; // Number of metadata rows
}

/**
 * Get Indonesian month name
 */
function getMonthName(monthIndex) {
    const months = [
        "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    return months[monthIndex] || monthIndex;
}

/**
 * Create JSON response
 */
function jsonResponse(data) {
    return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// TESTING FUNCTIONS (Optional)
// ============================================================================

/**
 * Test function - can be run manually from Apps Script editor
 */
function testSync() {
    const testPayload = {
        secret: PROPERTIES.getProperty('API_SECRET'),
        division: 'TEST',
        month: 1,
        year: 2026,
        format: 'DAFTAR_UPAH',
        headers: ["No", "NIK", "Nama", "Jabatan", "HK", "Upah"],
        rows: [
            ["", "", "GANG: H1H"],
            [1, "001", "Employee 1", "Worker", 26, 5000000],
            [2, "002", "Employee 2", "Worker", 26, 5000000],
            ["", "", "TOTAL GANG", "", 52, 10000000],
            ["", "", "GRAND TOTAL", "", 52, 10000000]
        ]
    };

    return handleSyncRequest(testPayload);
}
