/**
 * DAFTAR UPAH SYNC - GOOGLE APPS SCRIPT WEB APP
 * 
 * This script receives payroll data from the backend and updates the Google Spreadsheet.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Spreadsheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Copy this entire code into 'Code.gs'.
 * 4. Go to Project Settings (Gear icon) > Script Properties.
 *    - Add property: 'API_SECRET' = 'your-secure-secret-here' (Must match backend .env)
 * 5. Click 'Deploy' > 'New deployment'.
 *    - Select type: 'Web app'.
 *    - Description: 'v1'.
 *    - Execute as: 'Me' (your email).
 *    - Who has access: 'Anyone'.
 * 6. Copy the 'Web app URL' and paste it into your backend .env file as GOOGLE_SCRIPT_URL.
 */

const PROPERTIES = PropertiesService.getScriptProperties();

/**
 * Handle POST requests from the Backend
 */
function doPost(e) {
    const lock = LockService.getScriptLock();

    // Wait for up to 30 seconds for other processes to finish.
    if (!lock.tryLock(30000)) {
        return ContentService.createTextOutput(JSON.stringify({
            status: 'error',
            message: 'Server is busy, try again later'
        })).setMimeType(ContentService.MimeType.JSON);
    }

    try {
        // 1. Authentication
        const params = e.parameter; // Query params
        const authHeader = params.secret || ""; // Simple query param auth for simplicity or header if possible? 
        // Note: e.postData.contents is the body. 
        // e.parameter is query string.

        // Better: Expect secret in the JSON body for security (avoid logs)
        const payload = JSON.parse(e.postData.contents);

        const configuredSecret = PROPERTIES.getProperty('API_SECRET');
        if (!configuredSecret) {
            throw new Error("API_SECRET is not configured in Script Properties");
        }

        if (payload.secret !== configuredSecret) {
            return ContentService.createTextOutput(JSON.stringify({
                status: 'error',
                message: 'Unauthorized: Invalid Secret'
            })).setMimeType(ContentService.MimeType.JSON);
        }

        // 2. Process Data
        const result = syncDivisionData(payload);

        return ContentService.createTextOutput(JSON.stringify({
            status: 'success',
            data: result
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
            status: 'error',
            message: error.toString(),
            stack: error.stack
        })).setMimeType(ContentService.MimeType.JSON);

    } finally {
        lock.releaseLock();
    }
}

/**
 * Handle GET requests (Health check)
 */
function doGet(e) {
    return ContentService.createTextOutput(JSON.stringify({
        status: 'online',
        message: 'Daftar Upah Sync Service is running'
    })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Main Logic: Sync Division Data to Sheet
 */
function syncDivisionData(payload) {
    const { division, month, year, headers, rows } = payload;

    if (!division || !rows) {
        throw new Error("Missing required fields: division, rows");
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = `${division}`;

    let sheet = ss.getSheetByName(sheetName);

    // Create sheet if not exists
    if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        // Delete default columns/rows to clean up
        if (sheet.getMaxColumns() > 26) sheet.deleteColumns(27, sheet.getMaxColumns() - 26);
        if (sheet.getMaxRows() > 100) sheet.deleteRows(101, sheet.getMaxRows() - 100);
    }

    // Clear valid content
    sheet.clear();

    // Metadata / Title Section
    const titleColor = "#E6F4EA"; // Light Green

    // Row 1: Report Title
    sheet.getRange("A1").setValue(`DAFTAR UPAH - ${division}`);
    sheet.getRange("A1:H1").merge().setFontWeight("bold").setFontSize(14);

    // Row 2: Period
    const monthName = getMonthName(month);
    sheet.getRange("A2").setValue(`PERIODE: ${monthName} ${year}`);
    sheet.getRange("A2:H2").merge().setFontWeight("bold");

    // Row 3: Timestamp
    sheet.getRange("A3").setValue(`Last Updated: ${new Date().toLocaleString('id-ID')}`);
    sheet.getRange("A3:H3").merge().setFontStyle("italic").setFontSize(9);

    const startRow = 5;

    // Write Headers
    if (headers && headers.length > 0) {
        const headerRange = sheet.getRange(startRow, 1, 1, headers.length);
        headerRange.setValues([headers]);
        headerRange.setBackground("#1F2937"); // Dark Gray/Black like current UI
        headerRange.setFontColor("#FFFFFF");
        headerRange.setFontWeight("bold");
        headerRange.setHorizontalAlignment("center");
        headerRange.setWrap(true);
    }

    // Write Data Rows
    if (rows && rows.length > 0) {
        const dataRange = sheet.getRange(startRow + 1, 1, rows.length, rows[0].length);
        dataRange.setValues(rows);

        // Formatting
        formatTable(sheet, startRow, rows.length, headers.length);
    }

    // Auto-resize columns
    sheet.autoResizeColumns(1, headers.length);

    return {
        sheet: sheetName,
        rows_processed: rows.length
    };
}

/**
 * Apply styling and formatting
 */
function formatTable(sheet, startRow, numRows, numCols) {
    const fullRange = sheet.getRange(startRow, 1, numRows + 1, numCols);

    // Borders
    fullRange.setBorder(true, true, true, true, true, true, "black", SpreadsheetApp.BorderStyle.SOLID);

    // Alternating Colors (Zebra Striping)
    for (let i = 1; i <= numRows; i++) {
        if (i % 2 === 0) {
            sheet.getRange(startRow + i, 1, 1, numCols).setBackground("#F9FAFB");
        }
    }

    // Number Formats
    // Assuming strict column order based on typical aggregation report
    // 1: No
    // 2: Gang Code
    // 3: Description
    // 4: Emp
    // 5: HK (Decimal)
    // 6+: Currency (IDR)

    // Column 5 (HK): Number optional decimal
    sheet.getRange(startRow + 1, 5, numRows, 1).setNumberFormat("#,##0.##");

    // Columns 6 to End (Currency)
    const currencyCols = numCols - 5;
    if (currencyCols > 0) {
        sheet.getRange(startRow + 1, 6, numRows, currencyCols).setNumberFormat("#,##0");
    }
}

function getMonthName(monthIndex) {
    const months = [
        "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    return months[monthIndex] || monthIndex;
}
