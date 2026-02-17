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
        case 'DAFTAR_UPAH_MULTISHEET':
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
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Check if multi-sheet format (NEW)
    if (payload.sheets && Array.isArray(payload.sheets)) {
        console.log("Multi-sheet format detected: " + payload.sheets.length + " sheets");
        const results = [];

        payload.sheets.forEach((sheetData, index) => {
            console.log("Processing sheet " + (index + 1) + ": " + sheetData.name);
            const result = processSingleSheet(ss, sheetData, payload.month, payload.year);
            results.push({
                name: sheetData.name,
                rows_processed: result.rows_processed
            });
        });

        return {
            status: 'success',
            sheets: results,
            format: 'DAFTAR_UPAH_MULTISHEET'
        };
    }

    // Legacy single-sheet format (BACKWARD COMPATIBILITY)
    const { division, month, year, headers, rows } = payload;

    if (!rows) {
        throw new Error("Missing required field: rows");
    }

    const sheetName = division || 'Sheet1';

    // Delete existing sheet and create new one
    const existingSheet = ss.getSheetByName(sheetName);
    if (existingSheet) {
        ss.deleteSheet(existingSheet);
    }
    const sheet = ss.insertSheet(sheetName);

    // Process single sheet
    const result = processSheetData(sheet, {
        name: sheetName,
        title: `DAFTAR UPAH - ${division}`,
        headers: headers,
        rows: rows
    }, month, year);

    return {
        sheet: sheetName,
        rows_processed: result.rows_processed,
        format: 'DAFTAR_UPAH_DYNAMIC'
    };
}

/**
 * Process a single sheet from multi-sheet format
 */
function processSingleSheet(ss, sheetData, month, year) {
    const sheetName = sheetData.name;

    // Delete existing sheet and create new one
    const existingSheet = ss.getSheetByName(sheetName);
    if (existingSheet) {
        ss.deleteSheet(existingSheet);
    }
    const sheet = ss.insertSheet(sheetName);

    // Check if this is an analysis sheet (multi-section format)
    const isAnalysisSheet = sheetName.includes("ANALISIS") ||
                           (sheetData.title && sheetData.title.includes("ANALISIS"));

    if (isAnalysisSheet) {
        return processAnalysisSheet(sheet, sheetData, month, year);
    } else {
        return processSheetData(sheet, sheetData, month, year);
    }
}

/**
 * Process Analysis Sheet with multiple sections (Lembur, Premi, Upah Bersih)
 */
function processAnalysisSheet(sheet, sheetData, month, year) {
    const { title, rows } = sheetData;

    console.log("Processing ANALYSIS sheet: " + sheetData.name);
    console.log("Rows length: " + rows.length);

    // Add metadata at top
    const monthName = getMonthName(month);
    sheet.getRange(1, 1).setValue(title);
    sheet.getRange(1, 1, 1, 10).merge().setFontWeight("bold").setFontSize(16).setBackground("#1E40AF").setFontColor("#FFFFFF");

    sheet.getRange(2, 1).setValue(`BULAN: ${monthName} ${year}`);
    sheet.getRange(2, 1, 1, 10).merge().setFontWeight("bold").setFontSize(11);

    sheet.getRange(3, 1).setValue(`Last Sync: ${new Date().toLocaleString('id-ID')}`);
    sheet.getRange(3, 1, 1, 10).merge().setFontStyle("italic").setFontSize(9);

    // Write all rows (multi-section format with inline headers)
    if (rows && rows.length > 0) {
        const dataRange = sheet.getRange(5, 1, rows.length, rows[0].length);
        dataRange.setValues(rows);
        applyAnalysisFormatting(sheet, 5, rows);

        // Add charts for each section
        addAnalysisCharts(sheet, rows, 5);
    }

    // Auto-resize columns
    const numCols = rows[0]?.length || 10;
    for (let i = 1; i <= numCols; i++) {
        sheet.setColumnWidth(i, 100);
    }
    sheet.autoResizeColumns(1, numCols);

    // Set min/max column widths
    for (let i = 1; i <= numCols; i++) {
        const colWidth = sheet.getColumnWidth(i);
        if (colWidth < 50) sheet.setColumnWidth(i, 50);
        else if (colWidth > 400) sheet.setColumnWidth(i, 400);
    }

    return {
        rows_processed: rows.length
    };
}

/**
 * Add charts for each analysis section
 */
function addAnalysisCharts(sheet, rows, startRow) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let chartRow = startRow;

    // Find each section and add charts
    for (let section = 1; section <= 3; section++) {
        const sectionInfo = findSectionRange(rows, chartRow, section);
        if (!sectionInfo) continue;

        const { dataStart, dataEnd, title } = sectionInfo;
        chartRow = dataEnd + 3; // Move past this section

        // Skip if no data rows
        if (dataStart >= dataEnd) continue;

        // Calculate chart position (2 columns to the right of data)
        const chartCol = sectionInfo.numCols + 2;

        // Add chart based on section type
        if (section === 1) {
            // Lembur Analysis - Bar chart of hours by task
            addLemburChart(sheet, dataStart, dataEnd, chartCol, rows);
        } else if (section === 2) {
            // Premi Analysis - Stacked bar chart
            addPremiChart(sheet, dataStart, dataEnd, chartCol, rows);
        } else if (section === 3) {
            // Upah Bersih Analysis - Pie chart of total components
            addUpahBersihChart(sheet, dataStart, dataEnd, chartCol, rows);
        }
    }
}

/**
 * Find the range of a section in the rows
 */
function findSectionRange(rows, startSearchRow, sectionNum) {
    let sectionStart = -1;
    let headerRow = -1;
    let foundSection = 0;

    for (let i = startSearchRow; i < rows.length; i++) {
        const firstCol = rows[i][0] ? rows[i][0].toString() : "";

        // Found section title
        if (firstCol.includes("📊")) {
            foundSection++;
            if (foundSection === sectionNum) {
                sectionStart = i + 3; // Skip title, separator, and empty row
                headerRow = i + 2; // Header row is after title + separator + empty
                break;
            }
        }
    }

    if (sectionStart === -1) return null;

    // Find end of section (next section title or grand total)
    let sectionEnd = sectionStart;
    let numCols = rows[sectionStart]?.length || 7;

    for (let i = sectionStart; i < rows.length; i++) {
        const thirdCol = rows[i][2] ? rows[i][2].toString() : "";
        const firstCol = rows[i][0] ? rows[i][0].toString() : "";

        // Stop at next section or end
        if (firstCol.includes("═══") && i > sectionStart + 2) {
            break;
        }

        // Include grand total rows
        if (thirdCol.includes("TOTAL") || firstCol !== "") {
            sectionEnd = i;
        }
    }

    let title = "Unknown";
    if (sectionNum === 1) title = "ANALISIS LEMBUR";
    else if (sectionNum === 2) title = "ANALISIS PREMI";
    else if (sectionNum === 3) title = "ANALISIS UPAH BERSIH";

    return {
        dataStart: sectionStart,
        dataEnd: sectionEnd,
        numCols: numCols,
        title: title
    };
}

/**
 * Add Lembur Analysis Chart (Bar chart)
 */
function addLemburChart(sheet, dataStart, dataEnd, chartCol, allRows) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();

        // Extract data rows only (skip header, separator, total rows)
        const dataRows = [];
        const labels = [];
        const jamValues = [];
        const rupiahValues = [];

        for (let i = dataStart; i <= dataEnd; i++) {
            const row = allRows[i];
            const thirdCol = row[2] ? row[2].toString() : "";

            // Skip headers, separators, and total rows
            if (thirdCol.includes("TOTAL") ||
                row[0] === "────" ||
                row[0] === "NO" ||
                row[0].toString().includes("═══")) {
                continue;
            }

            // Data row
            const nama = row[2] || "";
            const task = row[4] || ""; // Task column
            const jam = parseFloat(row[5]) || 0;
            const rupiah = parseFloat(row[6]) || 0;

            if (jam > 0 || rupiah > 0) {
                labels.push(`${nama.toString().substring(0, 10)} - ${task.toString().substring(0, 15)}`);
                jamValues.push(jam);
                rupiahValues.push(rupiah);
            }
        }

        if (labels.length === 0) return;

        // Create a temporary range for chart data
        const tempData = [labels, jamValues, rupiahValues];
        const tempRange = sheet.getRange(dataStart, chartCol, 3, labels.length);
        tempRange.setValues(tempData);

        // Create bar chart for Lembur Jam
        const chartBuilder = ss.newChart();
        chartBuilder
            .addRange(tempRange)
            .setChartType(Charts.ChartType.BAR)
            .setOption('title', 'Analisis Lembur (Jam)')
            .setOption('hAxis.title', 'Jam')
            .setOption('vAxis.title', 'Karyawan - Task')
            .setOption('colors', ['#3B82F6'])
            .setPosition(sheet.getRange(dataStart, chartCol, 20, 3))
            .build();

        sheet.insertChart(chartBuilder.build());

        // Create pie chart for Lembur Rupiah distribution
        const pieRange = sheet.getRange(dataStart + 25, chartCol, 3, labels.length);
        pieRange.setValues(tempData);

        const pieChart = ss.newChart();
        pieChart
            .addRange(pieRange)
            .setChartType(Charts.ChartType.PIE)
            .setOption('title', 'Distribusi Lembur (Rupiah)')
            .setPosition(sheet.getRange(dataStart + 25, chartCol, 20, 3))
            .build();

        sheet.insertChart(pieChart);

    } catch (e) {
        console.log("Error creating lembur chart: " + e);
    }
}

/**
 * Add Premi Analysis Chart (Stacked bar chart)
 */
function addPremiChart(sheet, dataStart, dataEnd, chartCol, allRows) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();

        // Extract data
        const labels = [];
        const brondolValues = [];
        const pruningValues = [];
        const totalValues = [];

        for (let i = dataStart; i <= dataEnd; i++) {
            const row = allRows[i];
            const thirdCol = row[2] ? row[2].toString() : "";

            // Skip headers and totals
            if (thirdCol.includes("TOTAL") ||
                row[0] === "────" ||
                row[0] === "NO" ||
                row[0].toString().includes("═══")) {
                continue;
            }

            const nama = row[2] || "";
            const brondol = parseFloat(row[4]) || 0;
            const pruning = parseFloat(row[5]) || 0;
            const total = parseFloat(row[row.length - 2]) || 0; // Second to last column

            if (brondol > 0 || pruning > 0 || total > 0) {
                labels.push(nama.toString().substring(0, 15));
                brondolValues.push(brondol);
                pruningValues.push(pruning);
                totalValues.push(total);
            }
        }

        if (labels.length === 0) return;

        // Create temp range
        const tempData = [['', ...labels], ['Brondol', ...brondolValues], ['Pruning', ...pruningValues], ['Total', ...totalValues]];
        const tempRange = sheet.getRange(dataStart, chartCol, 4, labels.length + 1);
        tempRange.setValues(tempData);

        // Create stacked bar chart
        const chartBuilder = ss.newChart();
        chartBuilder
            .addRange(tempRange)
            .setChartType(Charts.ChartType.COLUMN)
            .setOption('title', 'Analisis Premi per Karyawan')
            .setOption('hAxis.title', 'Karyawan')
            .setOption('vAxis.title', 'Jumlah (Rp)')
            .setOption('isStacked', true)
            .setOption('colors', ['#10B981', '#F59E0B', '#6366F1'])
            .setPosition(sheet.getRange(dataStart, chartCol, 20, 4))
            .build();

        sheet.insertChart(chartBuilder.build());

    } catch (e) {
        console.log("Error creating premi chart: " + e);
    }
}

/**
 * Add Upah Bersih Analysis Chart (Pie chart + Bar chart)
 */
function addUpahBersihChart(sheet, dataStart, dataEnd, chartCol, allRows) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();

        // Extract grand total for components
        let totalGajiPokok = 0;
        let totalTunjangan = 0;
        let totalPremi = 0;
        let totalPotongan = 0;
        let totalUpahBersih = 0;

        for (let i = dataStart; i <= dataEnd; i++) {
            const row = allRows[i];
            const thirdCol = row[2] ? row[2].toString() : "";

            // Only sum grand total row
            if (thirdCol === "GRAND TOTAL") {
                totalGajiPokok += parseFloat(row[5]) || 0;
                totalTunjangan += parseFloat(row[6]) || 0;
                totalPremi += parseFloat(row[7]) || 0;
                totalPotongan += parseFloat(row[8]) || 0;
                totalUpahBersih += parseFloat(row[9]) || 0;
                break;
            }
        }

        // Create pie chart data
        const pieData = [
            ['Komponen', 'Jumlah'],
            ['Gaji Pokok', totalGajiPokok],
            ['Tunjangan', totalTunjangan],
            ['Premi', totalPremi],
            ['Potongan', -totalPotongan], // Negative for visualization
            ['Upah Bersih', totalUpahBersih]
        ];

        const pieRange = sheet.getRange(dataStart, chartCol, pieData.length, 2);
        pieRange.setValues(pieData);

        // Create pie chart
        const pieChart = ss.newChart();
        pieChart
            .addRange(pieRange)
            .setChartType(Charts.ChartType.PIE)
            .setOption('title', 'Komposisi Upah (Grand Total)')
            .setOption('pieHole', 0.4)
            .setOption('colors', ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#6366F1'])
            .setPosition(sheet.getRange(dataStart, chartCol, 20, 3))
            .build();

        sheet.insertChart(pieChart);

        // Create bar chart for comparison
        const barData = [['Komponen', 'Jumlah'],
                        ['Gaji Pokok', totalGajiPokok],
                        ['Tunjangan', totalTunjangan],
                        ['Premi', totalPremi],
                        ['Potongan', totalPotongan],
                        ['Upah Bersih', totalUpahBersih]];

        const barRange = sheet.getRange(dataStart + 20, chartCol, barData.length, 2);
        barRange.setValues(barData);

        const barChart = ss.newChart();
        barChart
            .addRange(barRange)
            .setChartType(Charts.ChartType.COLUMN)
            .setOption('title', 'Perbandingan Komponen Upah')
            .setOption('hAxis.title', 'Komponen')
            .setOption('vAxis.title', 'Jumlah (Rp)')
            .setOption('colors', ['#3B82F6'])
            .setPosition(sheet.getRange(dataStart + 20, chartCol, 20, 3))
            .build();

        sheet.insertChart(barChart.build());

    } catch (e) {
        console.log("Error creating upah bersih chart: " + e);
    }
}

/**
 * Apply formatting to analysis sheet (multi-section)
 */
function applyAnalysisFormatting(sheet, startRow, rows) {
    const val = (v) => parseFloat(v) || 0;

    for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        const rowNum = startRow + idx;
        const firstCol = row[0] ? row[0].toString() : "";
        const thirdCol = row[2] ? row[2].toString() : "";

        // Section headers (═══ lines)
        if (firstCol.includes("═══")) {
            const range = sheet.getRange(rowNum, 1, 1, row.length);
            range.setBackground("#1E40AF")
                  .setFontColor("#FFFFFF")
                  .setFontWeight("bold")
                  .setFontSize(11);
        }
        // Section title (📊 ANALISIS...)
        else if (firstCol.includes("📊")) {
            const range = sheet.getRange(rowNum, 1, 1, row.length);
            range.setBackground("#3B82F6")
                  .setFontColor("#FFFFFF")
                  .setFontWeight("bold")
                  .setFontSize(12);
        }
        // Column headers (NO, NIK, NAMA, etc.)
        else if (firstCol === "NO" || firstCol === "────") {
            const range = sheet.getRange(rowNum, 1, 1, row.length);
            if (firstCol === "NO") {
                range.setBackground("#1F2937")
                      .setFontColor("#FFFFFF")
                      .setFontWeight("bold")
                      .setFontSize(10)
                      .setHorizontalAlignment("center");
            } else {
                range.setBackground("#374151")
                      .setFontColor("#FFFFFF")
                      .setFontSize(10);
            }
        }
        // Gang total rows
        else if (thirdCol.includes("TOTAL GANG")) {
            const range = sheet.getRange(rowNum, 1, 1, row.length);
            range.setBackground("#E0F2FE")
                  .setFontColor("#000000")
                  .setFontWeight("bold")
                  .setFontSize(10);
        }
        // Grand total rows
        else if (thirdCol === "GRAND TOTAL" || thirdCol === "TOTAL LEMBUR") {
            const range = sheet.getRange(rowNum, 1, 1, row.length);
            range.setBackground("#1E40AF")
                  .setFontColor("#FFFFFF")
                  .setFontWeight("bold")
                  .setFontSize(11);
        }
        // Data rows
        else if (!firstCol.includes("ANALISIS") && row.length > 4) {
            // Check if it's a data row (has numeric values)
            const hasData = row.some((cell, i) => i > 3 && typeof cell === 'number' && !isNaN(cell));
            if (hasData) {
                // Zebra striping
                if (idx % 2 === 0) {
                    sheet.getRange(rowNum, 1, 1, row.length).setBackground("#F8FAFB");
                } else {
                    sheet.getRange(rowNum, 1, 1, row.length).setBackground("#FFFFFF");
                }
                sheet.getRange(rowNum, 1, 1, row.length).setFontSize(10);

                // Number formatting for numeric columns
                for (let i = 5; i < row.length; i++) {
                    if (typeof row[i] === 'number') {
                        sheet.getRange(rowNum, i + 1).setNumberFormat(FORMATS.CURRENCY);
                    }
                }
            }
        }
    }

    // Add borders
    for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        const firstCol = row[0] ? row[0].toString() : "";
        const thirdCol = row[2] ? row[2].toString() : "";

        // Add borders to data rows (not section headers or separators)
        if (!firstCol.includes("═══") && !firstCol.includes("📊") && firstCol !== "" && firstCol !== "────") {
            const rowNum = startRow + idx;
            const range = sheet.getRange(rowNum, 1, 1, row.length);
            range.setBorder(true, true, true, true, false, false, "#E5E7EB", SpreadsheetApp.BorderStyle.SOLID);
        }
    }
}

/**
 * Common sheet data processing logic (for main sheet)
 */
function processSheetData(sheet, sheetData, month, year) {
    const { title, headers, rows } = sheetData;

    // Debug: Log structure
    console.log("Sheet: " + sheetData.name);
    console.log("Rows length: " + rows.length);
    console.log("First row length: " + (rows[0] ? rows[0].length : "N/A"));

    // Determine number of columns FIRST
    let numCols = rows[0]?.length || 10;
    console.log("Initial numCols from rows: " + numCols);

    // Check if headers is multi-level
    if (headers && Array.isArray(headers) && headers.length > 0) {
        if (Array.isArray(headers[0])) {
            numCols = headers[0].length;
            console.log("Multi-level headers detected, numCols from headers: " + numCols);
        }
    }

    // Add metadata (use numCols for merge)
    const monthName = getMonthName(month);
    sheet.getRange(1, 1).setValue(title);
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
        rows_processed: rows.length
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
        // Lembur Detail Sub-Row (Comprehensive format)
        else if (thirdCol.startsWith("└─")) {
            const range = sheet.getRange(rowNum, 1, 1, numCols);
            range.setBackground("#f8fafc"); // Light gray background like comprehensive
            range.setFontSize(9);
            range.setFontStyle("italic");
        }
        // Lembur Summary Sub-Row
        else if (thirdCol.startsWith("✓")) {
            const range = sheet.getRange(rowNum, 1, 1, numCols);
            range.setBackground("#f1f5f9"); // Slightly darker background
            range.setFontSize(9);
            range.setFontWeight("bold");
        }
        // Employee Main Row
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

// ============================================================================
// FILTER SIDEBAR - Advanced Employee Filtering
// ============================================================================

/**
 * Create menu when spreadsheet opens
 */
function onOpen() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('📊 Payroll Tools')
        .addItem('🔍 Filter Data (New Sheet)', 'openFilterSidebar')
        .addItem('🗑️ Clear Filtered Sheets', 'clearFilteredSheets')
        .addSeparator()
        .addItem('📈 Refresh Charts', 'refreshCharts')
        .addSeparator()
        .addItem('❓ Help', 'showFilterHelp')
        .addToUi();

    // Also add legacy menu name for backward compatibility
    ui.createMenu('📊 Payroll Filter')
        .addItem('🔍 Open Filter Sidebar', 'openFilterSidebar')
        .addItem('🗑️ Clear Filtered Sheets', 'clearFilteredSheets')
        .addItem('❓ Help', 'showFilterHelp')
        .addToUi();
}

/**
 * Clear all filtered sheets
 */
function clearFilteredSheets() {
    const ui = SpreadsheetApp.getUi();
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const sheets = ss.getSheets();
    const filteredSheets = sheets.filter(s =>
        s.getName().includes(' - Filtered') ||
        s.getName().includes('- Filtered')
    );

    if (filteredSheets.length === 0) {
        ui.alert('No filtered sheets to clear.');
        return;
    }

    const result = ui.alert(
        'Clear Filtered Sheets',
        `Found ${filteredSheets.length} filtered sheet(s). Delete all?`,
        ui.ButtonSet.YES_NO
    );

    if (result === ui.Button.YES) {
        filteredSheets.forEach(sheet => {
            ss.deleteSheet(sheet);
        });
        ui.alert(`Deleted ${filteredSheets.length} filtered sheet(s).`);
    }
}

/**
 * Refresh charts on active sheet
 */
function refreshCharts() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();

    // Remove all charts
    const charts = sheet.getCharts();
    charts.forEach(chart => {
        sheet.removeChart(chart);
    });

    // Re-add charts if it's an analysis sheet
    const sheetName = sheet.getName();
    if (sheetName.includes('ANALISIS')) {
        const dataRange = sheet.getDataRange();
        const data = dataRange.getValues();

        // Find start row for data
        let startRow = 5;
        for (let i = 0; i < data.length; i++) {
            if (data[i][0] && data[i][0].toString().includes('📊')) {
                startRow = i + 1;
                break;
            }
        }

        addAnalysisCharts(sheet, data, startRow);

        SpreadsheetApp.getUi().alert('Charts refreshed successfully!');
    } else {
        SpreadsheetApp.getUi().alert('Chart refresh is only available for Analysis sheets.');
    }
}

/**
 * Open the filter sidebar
 */
function openFilterSidebar() {
    const html = getFilterSidebarHtml();
    SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Apply filter based on sidebar parameters - Creates NEW sheet with filtered results
 * This allows ALL users (including view-only) to see filtered data
 */
function applyFilter(filterParams) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = ss.getActiveSheet();
    const sheetName = sourceSheet.getName();

    // Check if this is an analysis sheet or main sheet
    const isAnalysisSheet = sheetName.includes("ANALISIS");

    const dataRange = sourceSheet.getDataRange();
    const data = dataRange.getValues();

    // For analysis sheets, filter works differently
    if (isAnalysisSheet) {
        return applyFilterToAnalysisSheet(ss, sourceSheet, filterParams, data);
    }

    // Find header row (row 5-9 for multi-level headers, row 10 is data start)
    let headerRowIndex = 9; // Row 10 is data start (0-indexed = 9)
    let headers = [];

    // Get column names from last header row (row 9, 0-indexed)
    if (data.length > headerRowIndex) {
        headers = data[headerRowIndex];
    }

    // Build column index map
    const colIndex = {};
    headers.forEach((h, i) => {
        colIndex[h.toString().toLowerCase()] = i;
    });

    // Find data start row (after metadata and headers)
    let dataStartRow = 10; // 1-indexed for getRange()
    let filteredRows = [];

    // Copy metadata and headers
    for (let i = 0; i < dataStartRow - 1; i++) {
        filteredRows.push(data[i]);
    }

    // Scan all data rows and apply filter
    let filteredCount = 0;
    for (let i = dataStartRow - 1; i < data.length; i++) {
        const row = data[i];
        const thirdCol = row[2] ? row[2].toString() : "";

        // Keep gang headers and totals
        if (thirdCol.startsWith("GANG") || thirdCol.includes("TOTAL")) {
            filteredRows.push(row);
            continue;
        }

        // Skip lembur sub-rows (will be included if parent passes)
        if (thirdCol.startsWith("└─") || thirdCol.startsWith("✓")) {
            continue;
        }

        // Apply filters to employee main row
        if (passesFilters(row, filterParams, colIndex)) {
            filteredRows.push(row);
            filteredCount++;

            // Also include related sub-rows
            if (i + 1 < data.length) {
                let j = i + 1;
                while (j < data.length) {
                    const subRow = data[j];
                    const subThirdCol = subRow[2] ? subRow[2].toString() : "";
                    if (subThirdCol.startsWith("└─") || subThirdCol.startsWith("✓")) {
                        filteredRows.push(subRow);
                        j++;
                    } else {
                        break;
                    }
                }
            }
        }
    }

    // Create NEW sheet with filtered results
    if (filteredRows.length > 0) {
        const newSheetName = createFilteredSheetName(sheetName);
        const newSheet = ss.insertSheet(newSheetName);

        // Copy all data to new sheet
        const targetRange = newSheet.getRange(1, 1, filteredRows.length, filteredRows[0].length);
        targetRange.setValues(filteredRows);

        // Apply formatting
        if (isAnalysisSheet) {
            applyAnalysisFormatting(newSheet, 5, filteredRows.slice(4));
        } else {
            applyFormatting(newSheet, 10, filteredRows.slice(9), filteredRows[0].length);
        }

        // Auto-resize columns
        newSheet.autoResizeColumns(1, filteredRows[0].length);

        // Show success and switch to new sheet
        ss.setActiveSheet(newSheet);

        SpreadsheetApp.getUi().alert(
            "Filter Applied",
            `Created new sheet "${newSheetName}" with ${filteredCount} filtered rows.\n\nOriginal data is preserved in "${sheetName}".`,
            SpreadsheetApp.getUi().ButtonSet.OK
        );
    } else {
        SpreadsheetApp.getUi().alert(
            "No Results",
            "No rows match the filter criteria.",
            SpreadsheetApp.getUi().ButtonSet.OK
        );
    }

    return {
        success: true,
        filteredCount: filteredCount,
        newSheetCreated: true
    };
}

/**
 * Apply filter to Analysis Sheet (multi-section format)
 */
function applyFilterToAnalysisSheet(ss, sourceSheet, filterParams, data) {
    let filteredRows = [];
    let totalFiltered = 0;

    // Copy metadata (first 4 rows)
    for (let i = 0; i < 4 && i < data.length; i++) {
        filteredRows.push(data[i]);
    }

    let currentSection = 0;
    let sectionStart = 4;
    let inDataSection = false;

    // Process each section
    for (let i = 4; i < data.length; i++) {
        const firstCol = data[i][0] ? data[i][0].toString() : "";
        const thirdCol = data[i][2] ? data[i][2].toString() : "";

        // Section header
        if (firstCol.includes("📊")) {
            currentSection++;
            inDataSection = false;
            filteredRows.push(data[i]);
            continue;
        }

        // Section separator
        if (firstCol.includes("═══")) {
            filteredRows.push(data[i]);
            continue;
        }

        // Empty row after section header
        if (firstCol === "" && thirdCol === "") {
            if (!inDataSection && i > 4) {
                sectionStart = i + 1;
            }
            filteredRows.push(data[i]);
            continue;
        }

        // Column headers
        if (firstCol === "NO" || firstCol === "────") {
            inDataSection = true;
            sectionStart = i;
            filteredRows.push(data[i]);
            continue;
        }

        // Data rows - apply filter
        if (inDataSection && firstCol !== "" && !thirdCol.includes("TOTAL")) {
            // Check if row passes filter
            if (passesFiltersForAnalysis(data[i], filterParams, currentSection)) {
                filteredRows.push(data[i]);
                totalFiltered++;
            }
        }
        // Keep total rows
        else if (thirdCol.includes("TOTAL")) {
            filteredRows.push(data[i]);
        }
    }

    // Create new sheet with filtered data
    const sourceSheetName = sourceSheet.getName();
    const newSheetName = createFilteredSheetName(sourceSheetName);
    const newSheet = ss.insertSheet(newSheetName);

    // Copy filtered data
    if (filteredRows.length > 0) {
        const targetRange = newSheet.getRange(1, 1, filteredRows.length, filteredRows[0].length);
        targetRange.setValues(filteredRows);
        applyAnalysisFormatting(newSheet, 5, filteredRows.slice(4));
        newSheet.autoResizeColumns(1, filteredRows[0].length);

        ss.setActiveSheet(newSheet);

        SpreadsheetApp.getUi().alert(
            "Filter Applied",
            `Created new sheet "${newSheetName}" with ${totalFiltered} filtered rows.\n\nOriginal data is preserved in "${sourceSheetName}".`,
            SpreadsheetApp.getUi().ButtonSet.OK
        );
    }

    return {
        success: true,
        filteredCount: totalFiltered,
        newSheetCreated: true
    };
}

/**
 * Check if analysis row passes filters (section-specific)
 */
function passesFiltersForAnalysis(row, params, section) {
    const val = (v) => parseFloat(v) || 0;
    const thirdCol = row[2] ? row[2].toString() : "";

    // Skip non-data rows
    if (thirdCol.includes("TOTAL") || row[0] === "────" || row[0] === "NO") {
        return true;
    }

    // Search filter applies to all sections
    if (params.searchName && params.searchName.trim() !== '') {
        const search = params.searchName.toLowerCase();
        const nik = (row[1] || '').toString().toLowerCase();
        const nama = (row[2] || '').toString().toLowerCase();
        if (!nik.includes(search) && !nama.includes(search)) {
            return false;
        }
    }

    // Section 1: Lembur (columns 5=JAM, 6=RUPIAH)
    if (section === 1) {
        const jam = val(row[5]);
        const rupiah = val(row[6]);

        if (params.minLemburJam && jam < val(params.minLemburJam)) return false;
        if (params.maxLemburJam && jam > val(params.maxLemburJam)) return false;
        if (params.minLemburRupiah && rupiah < val(params.minLemburRupiah)) return false;
        if (params.maxLemburRupiah && rupiah > val(params.maxLemburRupiah)) return false;
    }

    // Section 2: Premi (BRONDOL=4, PRUNING=5, TOTAL=last-1)
    if (section === 2) {
        const totalPremi = val(row[row.length - 2]);
        if (params.minPremi && totalPremi < val(params.minPremi)) return false;
        if (params.maxPremi && totalPremi > val(params.maxPremi)) return false;
    }

    // Section 3: Upah Bersih (HK=4, GAJI=5, TUNJANGAN=6, PREMI=7, POTONGAN=8, BERSIH=9)
    if (section === 3) {
        const hk = val(row[4]);
        const upahBersih = val(row[9]);

        if (params.minHk && hk < val(params.minHk)) return false;
        if (params.maxHk && hk > val(params.maxHk)) return false;
        if (params.minUpahBersih && upahBersih < val(params.minUpahBersih)) return false;
        if (params.maxUpahBersih && upahBersih > val(params.maxUpahBersih)) return false;
    }

    return true;
}

/**
 * Generate unique name for filtered sheet
 */
function createFilteredSheetName(originalName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let counter = 1;
    let newName = `${originalName} - Filtered`;

    // Find unique name
    while (ss.getSheetByName(newName)) {
        counter++;
        newName = `${originalName} - Filtered ${counter}`;
    }

    return newName;
}

/**
 * Check if a row passes all filters
 */
function passesFilters(row, params, colIndex) {
    const parseFloatSafe = (val) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            const cleaned = val.replace(/[Rp.,\s]/g, '');
            return parseFloat(cleaned) || 0;
        }
        return 0;
    };

    // Filter by NIK/Name
    if (params.searchName && params.searchName.trim() !== '') {
        const search = params.searchName.toLowerCase();
        const nik = (row[colIndex['nik']] || '').toString().toLowerCase();
        const nama = (row[colIndex['nama']] || '').toString().toLowerCase();
        if (!nik.includes(search) && !nama.includes(search)) {
            return false;
        }
    }

    // Filter by HK (Jumlah HK) - Column index varies, find by header
    if ((params.minHk !== '' && params.minHk !== null) || (params.maxHk !== '' && params.maxHk !== null)) {
        const hkIndex = colIndex['jumlah hk'] || colIndex['jumlah_hk'] || 5;
        const hk = parseFloatSafe(row[hkIndex]);
        const minHk = parseFloatSafe(params.minHk) || 0;
        const maxHk = parseFloatSafe(params.maxHk) || Infinity;
        if (hk < minHk || hk > maxHk) return false;
    }

    // Filter by Gaji Pokok
    if ((params.minGajiPokok !== '' && params.minGajiPokok !== null) || (params.maxGajiPokok !== '' && params.maxGajiPokok !== null)) {
        const gajiIndex = colIndex['jumlah'] || 10;
        const gaji = parseFloatSafe(row[gajiIndex]);
        const minGaji = parseFloatSafe(params.minGajiPokok) || 0;
        const maxGaji = parseFloatSafe(params.maxGajiPokok) || Infinity;
        if (gaji < minGaji || gaji > maxGaji) return false;
    }

    // Filter by Upah Bersih
    if ((params.minUpahBersih !== '' && params.minUpahBersih !== null) || (params.maxUpahBersih !== '' && params.maxUpahBersih !== null)) {
        const upahBersihIndex = colIndex['bersih'] || row.length - 1;
        const upahBersih = parseFloatSafe(row[upahBersihIndex]);
        const minUpah = parseFloatSafe(params.minUpahBersih) || 0;
        const maxUpah = parseFloatSafe(params.maxUpahBersih) || Infinity;
        if (upahBersih < minUpah || upahBersih > maxUpah) return false;
    }

    // Filter by Lembur Jam
    if ((params.minLemburJam !== '' && params.minLemburJam !== null) || (params.maxLemburJam !== '' && params.maxLemburJam !== null)) {
        const lemburJamIndex = colIndex['jam'] || row.length - 2;
        const lemburJam = parseFloatSafe(row[lemburJamIndex]);
        const minJam = parseFloatSafe(params.minLemburJam) || 0;
        const maxJam = parseFloatSafe(params.maxLemburJam) || Infinity;
        if (lemburJam < minJam || lemburJam > maxJam) return false;
    }

    // Filter by Lembur Rupiah
    if ((params.minLemburRupiah !== '' && params.minLemburRupiah !== null) || (params.maxLemburRupiah !== '' && params.maxLemburRupiah !== null)) {
        const lemburRupiahIndex = colIndex['rupiah'] || row.length - 1;
        const lemburRupiah = parseFloatSafe(row[lemburRupiahIndex]);
        const minRupiah = parseFloatSafe(params.minLemburRupiah) || 0;
        const maxRupiah = parseFloatSafe(params.maxLemburRupiah) || Infinity;
        if (lemburRupiah < minRupiah || lemburRupiah > maxRupiah) return false;
    }

    // Filter by Premi Total
    if ((params.minPremi !== '' && params.minPremi !== null) || (params.maxPremi !== '' && params.maxPremi !== null)) {
        const premiTotalIndex = colIndex['total'] || findColumnIndex(row, 'total');
        if (premiTotalIndex !== -1) {
            const premi = parseFloatSafe(row[premiTotalIndex]);
            const minPremi = parseFloatSafe(params.minPremi) || 0;
            const maxPremi = parseFloatSafe(params.maxPremi) || Infinity;
            if (premi < minPremi || premi > maxPremi) return false;
        }
    }

    return true;
}

/**
 * Find column index by partial name match
 */
function findColumnIndex(row, searchTerm) {
    const search = searchTerm.toLowerCase();
    for (let i = 0; i < row.length; i++) {
        if (row[i] && row[i].toString().toLowerCase().includes(search)) {
            return i;
        }
    }
    return -1;
}

/**
 * Reset all filters - reload original data
 */
function resetAllFilters() {
    const ui = SpreadsheetApp.getUi();
    const result = ui.alert(
        'Reset Filters',
        'This will reload all original data. Continue?',
        ui.ButtonSet.YES_NO
    );

    if (result === ui.Button.YES) {
        // Need to reload from backend or keep backup
        ui.alert('To reset filters, please sync the data again from the portal.');
    }
}

/**
 * Show help dialog
 */
function showFilterHelp() {
    const html = `
        <div style="padding: 20px; font-family: Arial, sans-serif;">
            <h2>📊 Payroll Filter Help</h2>

            <h3>Filter Parameters:</h3>
            <ul>
                <li><b>Search NIK/Nama:</b> Filter by employee ID or name (partial match)</li>
                <li><b>Range HK:</b> Filter by total work days</li>
                <li><b>Range Gaji Pokok:</b> Filter by base salary</li>
                <li><b>Range Upah Bersih:</b> Filter by net salary</li>
                <li><b>Range Lembur Jam:</b> Filter by overtime hours</li>
                <li><b>Range Lembur Rupiah:</b> Filter by overtime amount</li>
                <li><b>Range Premi:</b> Filter by total premium</li>
            </ul>

            <h3>Tips:</h3>
            <ul>
                <li>Leave fields empty for no filtering</li>
                <li>Use minimum value only for "greater than or equal" filter</li>
                <li>Use both min and max for range filter</li>
                <li>Filters are case-insensitive</li>
            </ul>

            <p><i>Note: To restore all data, sync again from the portal.</i></p>
        </div>
    `;

    SpreadsheetApp.getUi().showModalDialog(
        HtmlService.createHtmlOutput(html).setWidth(500).setHeight(400),
        'Filter Help'
    );
}

/**
 * Generate filter sidebar HTML
 */
function getFilterSidebarHtml() {
    const html = HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html>
        <head>
            <base target="_top">
            <style>
                * { box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    margin: 0;
                    padding: 15px;
                    background: #f8f9fa;
                }
                h2 {
                    margin: 0 0 15px 0;
                    color: #1e40af;
                    font-size: 18px;
                    border-bottom: 2px solid #1e40af;
                    padding-bottom: 8px;
                }
                .filter-section {
                    background: white;
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 12px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                .filter-section h3 {
                    margin: 0 0 10px 0;
                    font-size: 13px;
                    color: #4b5563;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .input-group {
                    margin-bottom: 10px;
                }
                .input-group label {
                    display: block;
                    font-size: 11px;
                    color: #6b7280;
                    margin-bottom: 4px;
                }
                .input-row {
                    display: flex;
                    gap: 8px;
                }
                .input-row input {
                    flex: 1;
                }
                input[type="text"], input[type="number"] {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 12px;
                }
                input:focus {
                    outline: none;
                    border-color: #1e40af;
                    box-shadow: 0 0 0 2px rgba(30, 64, 175, 0.1);
                }
                .btn-group {
                    display: flex;
                    gap: 8px;
                    margin-top: 15px;
                }
                button {
                    flex: 1;
                    padding: 10px;
                    border: none;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-apply {
                    background: #1e40af;
                    color: white;
                }
                .btn-apply:hover {
                    background: #1e3a8a;
                }
                .btn-reset {
                    background: #ef4444;
                    color: white;
                }
                .btn-reset:hover {
                    background: #dc2626;
                }
                .btn-clear {
                    background: #6b7280;
                    color: white;
                }
                .btn-clear:hover {
                    background: #4b5563;
                }
                .info-box {
                    background: #fef3c7;
                    border-left: 3px solid #f59e0b;
                    padding: 10px;
                    border-radius: 4px;
                    font-size: 11px;
                    color: #92400e;
                    margin-top: 10px;
                }
                .status {
                    margin-top: 10px;
                    padding: 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    text-align: center;
                    display: none;
                }
                .status.success { background: #d1fae5; color: #065f46; display: block; }
                .status.error { background: #fee2e2; color: #991b1b; display: block; }
            </style>
        </head>
        <body>
            <h2>🔍 Payroll Filter</h2>

            <div class="filter-section">
                <h3>Search Employee</h3>
                <div class="input-group">
                    <label>NIK / Nama</label>
                    <input type="text" id="searchName" placeholder="Cari nama atau NIK...">
                </div>
            </div>

            <div class="filter-section">
                <h3>Hari Kerja (HK)</h3>
                <div class="input-row">
                    <div class="input-group">
                        <label>Min</label>
                        <input type="number" id="minHk" placeholder="0">
                    </div>
                    <div class="input-group">
                        <label>Max</label>
                        <input type="number" id="maxHk" placeholder="30">
                    </div>
                </div>
            </div>

            <div class="filter-section">
                <h3>Gaji Pokok</h3>
                <div class="input-row">
                    <div class="input-group">
                        <label>Min</label>
                        <input type="number" id="minGajiPokok" placeholder="0">
                    </div>
                    <div class="input-group">
                        <label>Max</label>
                        <input type="number" id="maxGajiPokok" placeholder="5000000">
                    </div>
                </div>
            </div>

            <div class="filter-section">
                <h3>Upah Bersih</h3>
                <div class="input-row">
                    <div class="input-group">
                        <label>Min</label>
                        <input type="number" id="minUpahBersih" placeholder="0">
                    </div>
                    <div class="input-group">
                        <label>Max</label>
                        <input type="number" id="maxUpahBersih" placeholder="10000000">
                    </div>
                </div>
            </div>

            <div class="filter-section">
                <h3>Lembur (Jam)</h3>
                <div class="input-row">
                    <div class="input-group">
                        <label>Min</label>
                        <input type="number" id="minLemburJam" placeholder="0">
                    </div>
                    <div class="input-group">
                        <label>Max</label>
                        <input type="number" id="maxLemburJam" placeholder="100">
                    </div>
                </div>
            </div>

            <div class="filter-section">
                <h3>Lembur (Rupiah)</h3>
                <div class="input-row">
                    <div class="input-group">
                        <label>Min</label>
                        <input type="number" id="minLemburRupiah" placeholder="0">
                    </div>
                    <div class="input-group">
                        <label>Max</label>
                        <input type="number" id="maxLemburRupiah" placeholder="5000000">
                    </div>
                </div>
            </div>

            <div class="filter-section">
                <h3>Premi Total</h3>
                <div class="input-row">
                    <div class="input-group">
                        <label>Min</label>
                        <input type="number" id="minPremi" placeholder="0">
                    </div>
                    <div class="input-group">
                        <label>Max</label>
                        <input type="number" id="maxPremi" placeholder="10000000">
                    </div>
                </div>
            </div>

            <div class="btn-group">
                <button class="btn-clear" onclick="clearFilters()">🗑️ Clear</button>
                <button class="btn-reset" onclick="resetFilters()">🔄 Reset</button>
                <button class="btn-apply" onclick="applyFilters()">✅ Apply</button>
            </div>

            <div id="status" class="status"></div>

            <div class="info-box">
                💡 <b>Tip:</b> Biarkan kosong field yang tidak ingin difilter.
                <br>Gunakan sync ulang dari portal untuk mereset data.
            </div>

            <script>
                function clearFilters() {
                    document.querySelectorAll('input').forEach(input => input.value = '');
                    showStatus('Filters cleared', 'success');
                }

                function resetFilters() {
                    google.script.run.withSuccessHandler(function() {
                        showStatus('Please sync from portal to reset data', 'success');
                    }).resetAllFilters();
                }

                function applyFilters() {
                    const filterParams = {
                        searchName: document.getElementById('searchName').value,
                        minHk: document.getElementById('minHk').value,
                        maxHk: document.getElementById('maxHk').value,
                        minGajiPokok: document.getElementById('minGajiPokok').value,
                        maxGajiPokok: document.getElementById('maxGajiPokok').value,
                        minUpahBersih: document.getElementById('minUpahBersih').value,
                        maxUpahBersih: document.getElementById('maxUpahBersih').value,
                        minLemburJam: document.getElementById('minLemburJam').value,
                        maxLemburJam: document.getElementById('maxLemburJam').value,
                        minLemburRupiah: document.getElementById('minLemburRupiah').value,
                        maxLemburRupiah: document.getElementById('maxLemburRupiah').value,
                        minPremi: document.getElementById('minPremi').value,
                        maxPremi: document.getElementById('maxPremi').value
                    };

                    showStatus('Applying filter...', 'success');

                    google.script.run
                        .withSuccessHandler(function(result) {
                            showStatus('Found ' + result.filteredCount + ' rows', 'success');
                        })
                        .withFailureHandler(function(error) {
                            showStatus('Error: ' + error.message, 'error');
                        })
                        .applyFilter(filterParams);
                }

                function showStatus(message, type) {
                    const status = document.getElementById('status');
                    status.textContent = message;
                    status.className = 'status ' + type;
                    setTimeout(function() {
                        status.className = 'status';
                    }, 3000);
                }
            </script>
        </body>
        </html>
    `)
    .setTitle('Payroll Filter')
    .setWidth(280);

    return html;
}
