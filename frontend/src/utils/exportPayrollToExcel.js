/**
 * Export Payroll Data to Excel with Styled Formatting
 * Matches the visual appearance of the CustomPayrollTable grid
 */
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { isPayrollNumericField, resolveGrandTotalNumericValue } from './payrollGrandTotalValue';

// Color palette matching ag-grid-professional.css and CustomPayrollTable.css
const COLORS = {
    // Header colors
    headerBg: 'F5F7FA',
    headerText: '212121',

    // Column group backgrounds
    absensi: 'F5F9FC',
    upahDasar: 'FAF5FC',
    tunjangan: 'FFFBF5',
    premi: 'F5FAF5',
    potongan: 'F8F8F8',

    // Highlight colors for totals
    totalHk: 'E3F2FD',
    totalHkText: '1565C0',
    totalTunjangan: 'FFF3E0',
    totalTunjanganText: 'E65100',
    totalPremi: 'E8F5E9',
    totalPremiText: '2E7D32',
    totalPotongan: 'FFEBEE',
    totalPotonganText: 'C62828',
    upahKotor: 'FFFDE7',
    upahKotorText: 'F57F17',
    upahBersih: 'E8F5E9',
    upahBersihText: '1B5E20',

    // Row colors
    gangHeader: 'E8F5E9',
    gangTotal: 'E3F2FD',
    grandTotal: '1a365d',
    grandTotalText: 'FFFFFF',

    // Border
    border: 'E0E0E0',
    borderDark: 'BDBDBD'
};

// Format number with Indonesian locale (dot as thousand separator)
const formatNumber = (value) => {
    if (value === null || value === undefined) return '-';
    const n = Number(value);
    if (isNaN(n)) return '-';
    return Math.round(n);
};

const formatDecimal = (value) => {
    if (value === null || value === undefined) return '-';
    const n = Number(value);
    if (isNaN(n)) return '-';
    return n;
};

const NEGATIVE_TOTAL_EXPORT_FIELDS = new Set([
    'potongan_upah_kotor_total',
    'total_potongan',
    'total_potongan_bersih'
]);

function formatPayrollExportNumber(field, value) {
    const formatted = formatNumber(value);
    if (formatted === '-') return formatted;
    return NEGATIVE_TOTAL_EXPORT_FIELDS.has(field) ? -Math.abs(formatted) : formatted;
}

/**
 * Get column background color based on field name
 */
function getColumnColor(field) {
    // Attendance columns
    if (field.includes('hari_kerja') || field.includes('cuti') || field === 'jumlah_hk') {
        return COLORS.absensi;
    }
    // Upah Dasar
    if (field.includes('upah_dasar') || field.includes('gaji_pokok') || field === 'upah_pokok') {
        return COLORS.upahDasar;
    }
    // Tunjangan
    if (field.startsWith('beras_') || field.startsWith('jabatan_') ||
        field.startsWith('masa_kerja_') || field.startsWith('lembur_') ||
        field === 'total_tunjangan') {
        return COLORS.tunjangan;
    }
    // Premi
    if (field.startsWith('premi') || field === 'total_premi') {
        return COLORS.premi;
    }
    // Potongan
    if (field.startsWith('pot_') || field.includes('potongan')) {
        return COLORS.potongan;
    }
    return null;
}

/**
 * Get special highlight styling for total columns
 */
function getTotalColumnStyle(field) {
    if (field === 'jumlah_hk') {
        return { fill: COLORS.totalHk, font: COLORS.totalHkText, bold: true };
    }
    if (field === 'total_tunjangan') {
        return { fill: COLORS.totalTunjangan, font: COLORS.totalTunjanganText, bold: true };
    }
    if (field === 'total_premi') {
        return { fill: COLORS.totalPremi, font: COLORS.totalPremiText, bold: true };
    }
    if (field === 'total_potongan' || field === 'total_potongan_bersih') {
        return { fill: COLORS.totalPotongan, font: COLORS.totalPotonganText, bold: true };
    }
    if (field === 'jumlah_upah_kotor' || field === 'potongan_upah_kotor_total') {
        return { fill: COLORS.upahKotor, font: COLORS.upahKotorText, bold: true };
    }
    if (field === 'upah_bersih') {
        return { fill: COLORS.upahBersih, font: COLORS.upahBersihText, bold: true };
    }
    return null;
}

function resolveValuePriorityModeLabel(mode) {
    const normalized = String(mode || '').trim().toLowerCase();
    if (normalized === 'db_ptrj_only') return 'DB PTRJ Saja';
    return 'Non DB_PTRJ (Auto Buffer + Manual Adjustment)';
}

/**
 * Build merged header cells from column definitions
 * Returns: Array of { row, col, rowSpan, colSpan, label }
 */
function buildHeaderMerges(enhancedColumnDefs) {
    const numRows = 4;
    const numCols = enhancedColumnDefs.length;
    const grid = Array(numRows).fill(null).map(() => Array(numCols).fill(null));

    // Process each column's headers
    enhancedColumnDefs.forEach((col, colIdx) => {
        const headers = col.headers;

        for (let row = 0; row < numRows; row++) {
            if (grid[row][colIdx] !== null) continue;

            const label = headers[row];
            if (label !== null) {
                let rowSpan = 1;
                for (let r = row + 1; r < numRows; r++) {
                    if (headers[r] === null) rowSpan++;
                    else break;
                }
                for (let r = row; r < row + rowSpan; r++) {
                    grid[r][colIdx] = { label, rowSpan, colSpan: 1, startRow: row, startCol: colIdx };
                }
            }
        }
    });

    // Merge adjacent cells with same label in same row
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            const cell = grid[row][col];
            if (!cell || cell.merged) continue;

            let colspan = 1;
            for (let c = col + 1; c < numCols; c++) {
                const nextCell = grid[row][c];
                if (nextCell && nextCell.label === cell.label &&
                    nextCell.startRow === cell.startRow &&
                    nextCell.rowSpan === cell.rowSpan) {
                    colspan++;
                    nextCell.merged = true;
                } else {
                    break;
                }
            }
            cell.colSpan = colspan;
        }
    }

    // Collect merge instructions
    const merges = [];
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            const cell = grid[row][col];
            if (!cell || cell.merged) continue;
            if (cell.startRow !== row) continue;

            merges.push({
                row: row + 1, // Excel is 1-indexed
                col: col + 1,
                rowSpan: cell.rowSpan,
                colSpan: cell.colSpan,
                label: cell.label || ''
            });
        }
    }

    return merges;
}

/**
 * Main export function
 * @param {Array} rows - Data rows from CustomPayrollTable
 * @param {Array} columnDefs - Column definitions with headers and field names
 * @param {Object} grandTotal - Grand total row data
 * @param {Object} meta - Metadata: { division, gangCode, month, year }
 */
export async function exportPayrollToExcel(rows, columnDefs, grandTotal, meta) {
    // === ENSURE ALL FIELDS FROM ROWS ARE INCLUDED IN EXPORT ===
    // Collect all unique fields from rows data
    const allFieldsInData = new Set();
    rows.forEach(row => {
        if (row.type === 'employee') {
            Object.keys(row).forEach(key => {
                // Skip internal/react keys
                if (!key.startsWith('_') && key !== 'type' && key !== 'id') {
                    allFieldsInData.add(key);
                }
            });
        }
    });

    // Get fields already in columnDefs (original parameter, not enhanced yet)
    const fieldsInColumnDefs = new Set(columnDefs.map(col => col.field));

    // Find missing fields
    const missingFields = [...allFieldsInData].filter(f => !fieldsInColumnDefs.has(f));

    // Add missing fields to columnDefs with generic headers
    const enhancedColumnDefs = [
        ...columnDefs,
        ...missingFields.map(field => ({
            field,
            headers: ['DATA TAMBAHAN', null, null, field.toUpperCase().replace(/_/g, ' ')],
            w: 90,
            className: 'text-right',
            render: (row) => {
                const val = row[field];
                if (val === null || val === undefined || val === '') return '-';
                if (typeof val === 'number') return Math.round(val);
                return val;
            }
        }))
    ];

    console.log(`[Export] Added ${missingFields.length} missing fields to export:`, missingFields);

    let workbook = new ExcelJS.Workbook();
    workbook.creator = 'PT Rebinmas Jaya - Payroll System';
    workbook.created = new Date();

    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const periodStr = `${monthNames[meta.month - 1]} ${meta.year}`;
    const sheetName = `Daftar Upah ${meta.division}`;
    const sourceModeLabel = resolveValuePriorityModeLabel(meta?.valuePriorityMode);

    const worksheet = workbook.addWorksheet(sheetName.substring(0, 31), {
        pageSetup: {
            paperSize: 9, // A4
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0
        }
    });

    // === TITLE ROW ===
    const titleRow = worksheet.addRow([`DAFTAR UPAH - ${meta.division} - ${periodStr}`]);
    titleRow.height = 30;
    titleRow.getCell(1).font = { size: 16, bold: true, color: { argb: '1a365d' } };
    worksheet.mergeCells(1, 1, 1, enhancedColumnDefs.length);
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // === SUB TITLE ROW ===
    const gangLabel = meta.gangCode === 'ALL' ? 'Semua Gang' : `Gang: ${meta.gangCode}`;
    const subTitleRow = worksheet.addRow([`${gangLabel} | Sumber Nilai: ${sourceModeLabel}`]);
    subTitleRow.height = 20;
    subTitleRow.getCell(1).font = { size: 12, italic: true, color: { argb: '666666' } };
    worksheet.mergeCells(2, 1, 2, enhancedColumnDefs.length);
    subTitleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Empty row
    worksheet.addRow([]);

    // === HEADERS (4 rows) ===
    const headerStartRow = 4;
    const headerMerges = buildHeaderMerges(enhancedColumnDefs);

    // Add 4 empty header rows first
    for (let i = 0; i < 4; i++) {
        const row = worksheet.addRow(Array(enhancedColumnDefs.length).fill(''));
        row.height = 22;
    }

    // Apply header labels and merges
    headerMerges.forEach(merge => {
        const excelRow = headerStartRow + merge.row - 1;
        const excelCol = merge.col;

        const cell = worksheet.getCell(excelRow, excelCol);
        cell.value = merge.label;
        cell.font = { bold: true, size: 10, color: { argb: COLORS.headerText } };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: COLORS.headerBg }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
            top: { style: 'thin', color: { argb: COLORS.border } },
            bottom: { style: 'thin', color: { argb: COLORS.border } },
            left: { style: 'thin', color: { argb: COLORS.border } },
            right: { style: 'thin', color: { argb: COLORS.border } }
        };

        // Merge cells if needed
        if (merge.rowSpan > 1 || merge.colSpan > 1) {
            const endRow = excelRow + merge.rowSpan - 1;
            const endCol = excelCol + merge.colSpan - 1;
            worksheet.mergeCells(excelRow, excelCol, endRow, endCol);
        }
    });

    // === SET COLUMN WIDTHS ===
    enhancedColumnDefs.forEach((col, idx) => {
        worksheet.getColumn(idx + 1).width = Math.max(col.w / 7, 8);
    });

    // === DATA ROWS ===
    const dataStartRow = headerStartRow + 4; // After 4 header rows

    rows.forEach((row) => {
        if (row.type === 'gang_header') {
            // Gang header row - full width merge
            const excelRow = worksheet.addRow(Array(enhancedColumnDefs.length).fill(''));
            excelRow.height = 24;

            const startRowNum = excelRow.number;
            worksheet.mergeCells(startRowNum, 1, startRowNum, enhancedColumnDefs.length);

            const cell = excelRow.getCell(1);
            cell.value = `🏭 GANG: ${row.gang_code}`;
            cell.font = { bold: true, size: 11, color: { argb: '1B5E20' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: COLORS.gangHeader }
            };
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
            cell.border = {
                top: { style: 'medium', color: { argb: COLORS.borderDark } },
                bottom: { style: 'medium', color: { argb: COLORS.borderDark } }
            };
        } else {
            // Data row (employee or gang_total)
            const rowData = enhancedColumnDefs.map((col) => {
                let val = row[col.field];
                if (col.field === 'lembur_jam') {
                    return formatDecimal(val);
                } else if (typeof val === 'number') {
                    return formatPayrollExportNumber(col.field, val);
                }
                return val ?? '-';
            });

            const excelRow = worksheet.addRow(rowData);
            excelRow.height = 22;

            // Apply cell styles
            enhancedColumnDefs.forEach((col, idx) => {
                const cell = excelRow.getCell(idx + 1);
                const colColor = getColumnColor(col.field);
                const totalStyle = getTotalColumnStyle(col.field);

                // Base styling
                cell.alignment = {
                    horizontal: col.className?.includes('text-right') ? 'right' :
                        col.className?.includes('text-center') ? 'center' : 'left',
                    vertical: 'middle'
                };
                cell.font = { size: 10 };
                cell.border = {
                    top: { style: 'thin', color: { argb: COLORS.border } },
                    bottom: { style: 'thin', color: { argb: COLORS.border } },
                    left: { style: 'thin', color: { argb: COLORS.border } },
                    right: { style: 'thin', color: { argb: COLORS.border } }
                };

                // Number format for numeric cells
                if (typeof cell.value === 'number') {
                    cell.numFmt = '#,##0';
                }

                // Apply column background color
                if (totalStyle) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: totalStyle.fill }
                    };
                    cell.font = { size: 10, bold: totalStyle.bold, color: { argb: totalStyle.font } };
                } else if (colColor) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: colColor }
                    };
                }

                // Gang total row special styling
                if (row.type === 'gang_total') {
                    cell.font = { ...cell.font, bold: true };
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: COLORS.gangTotal }
                    };
                }
            });
        }
    });

    // === GRAND TOTAL ROW ===
    if (grandTotal) {
        const employeeCount = rows.filter((row) => row?.type === 'employee').length;
        const gtRowData = enhancedColumnDefs.map((col) => {
            if (col.field === 'nama') return 'GRAND TOTAL';
            if (col.field === 'no') return '';
            if (col.field === 'emp_code') return `${employeeCount} KARYAWAN`;

            let val = grandTotal[col.field];
            if (isPayrollNumericField(col.field)) {
                const numericValue = resolveGrandTotalNumericValue({
                    grandTotal,
                    rows,
                    field: col.field
                });
                return formatPayrollExportNumber(col.field, numericValue);
            }

            if (val !== undefined && val !== null && val !== '') return val;
            return '-';
        });

        const gtRow = worksheet.addRow(gtRowData);
        gtRow.height = 28;

        enhancedColumnDefs.forEach((col, idx) => {
            const cell = gtRow.getCell(idx + 1);
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: COLORS.grandTotal }
            };
            cell.font = { bold: true, size: 11, color: { argb: COLORS.grandTotalText } };
            cell.alignment = {
                horizontal: col.className?.includes('text-right') ? 'right' :
                    col.className?.includes('text-center') ? 'center' : 'left',
                vertical: 'middle'
            };
            cell.border = {
                top: { style: 'medium', color: { argb: '0d1b2a' } },
                bottom: { style: 'medium', color: { argb: '0d1b2a' } },
                left: { style: 'thin', color: { argb: '2d4a6f' } },
                right: { style: 'thin', color: { argb: '2d4a6f' } }
            };

            if (typeof cell.value === 'number') {
                cell.numFmt = '#,##0';
            }
        });
    }

    // === FREEZE PANES ===
    worksheet.views = [{
        state: 'frozen',
        xSplit: 2, // Freeze first 2 columns (NO, NAMA)
        ySplit: headerStartRow + 3, // Freeze header rows
        topLeftCell: 'C' + (headerStartRow + 4),
        activeCell: 'C' + (headerStartRow + 4)
    }];

    // === GENERATE FILE ===
    const sourceModeToken = String(meta?.valuePriorityMode || 'non_db_ptrj').trim().toLowerCase() || 'non_db_ptrj';
    const fileName = `Daftar_Upah_${meta.division}_${meta.gangCode === 'ALL' ? 'AllGang' : meta.gangCode}_${meta.year}${String(meta.month).padStart(2, '0')}_SRC-${sourceModeToken}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, fileName);

    // Memory Cleaner Frontend: Hapus referensi dari sheet dan workbook yang memakan banyak memori Chrome
    worksheet.spliceRows(1, worksheet.rowCount);
    workbook.removeWorksheet(worksheet.id);
    // @ts-ignore
    workbook = null;

    return fileName;
}

export default exportPayrollToExcel;
