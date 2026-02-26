import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Professional Color Palette
const COLORS = {
    // Elegant dark blue for headers
    headerBg: '0f172a',
    headerText: 'FFFFFF',

    // Column groups (subtle professional tints)
    absensi: 'f8fafc',
    upahDasar: 'f1f5f9',
    tunjangan: 'fdf8f6',
    premi: 'f0fdf4',
    potongan: 'fef2f2',

    // Totals
    gangHeader: 'e2e8f0',
    gangTotal: 'f1f5f9',
    grandTotal: '0f172a',
    grandTotalText: 'FFFFFF',

    border: 'cbd5e1',
    borderDark: '64748b'
};

const formatNumber = (value) => {
    if (value === null || value === undefined) return '-';
    const n = Number(value);
    return isNaN(n) ? '-' : Math.round(n);
};

function getColumnColor(field) {
    if (!field) return null;
    if (field.includes('hari_kerja') || field.includes('cuti') || field === 'jumlah_hk') return COLORS.absensi;
    if (field.includes('upah_dasar') || field.includes('gaji_pokok') || field === 'upah_pokok') return COLORS.upahDasar;
    if (field.startsWith('beras_') || field.startsWith('jabatan_') || field.startsWith('masa_kerja_') || field.startsWith('lembur_') || field === 'total_tunjangan') return COLORS.tunjangan;
    if (field.startsWith('premi') || field === 'total_premi') return COLORS.premi;
    if (field.startsWith('pot_') || field.includes('potongan')) return COLORS.potongan;
    return null;
}

// Helper to get Excel column letter (A, B, C... AA, AB...)
function getColLetter(colIndex) {
    let temp, letter = '';
    while (colIndex > 0) {
        temp = (colIndex - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        colIndex = (colIndex - temp - 1) / 26;
    }
    return letter;
}

// Flatten hierarchical columns to get the actual data columns
function getFlattenedColumns(colDefs) {
    let flatCols = [];
    colDefs.forEach(col => {
        if (col.children && col.children.length > 0) {
            flatCols = flatCols.concat(getFlattenedColumns(col.children));
        } else {
            flatCols.push(col);
        }
    });
    return flatCols;
}

/**
 * Export Payroll Data to Excel with Formulas and Signatures
 */
export async function exportReportToExcelPro(rows, colDefsOriginal, meta) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PT Rebinmas Jaya';
    workbook.created = new Date();

    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const periodStr = `${monthNames[meta.month - 1]} ${meta.year}`;
    const sheetName = `Upah ${meta.division} ${meta.gangCode}`.substring(0, 31);

    const worksheet = workbook.addWorksheet(sheetName, {
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });

    const flatCols = getFlattenedColumns(colDefsOriginal);

    // Filter out hidden or utility columns like frontend_no if needed, but we mostly keep them
    // Let's ensure headers are properly assigned.

    // 1. Report Title
    const titleRow = worksheet.addRow([`DAFTAR UPAH KARYAWAN - ${meta.division}`]);
    titleRow.height = 30;
    titleRow.getCell(1).font = { size: 16, bold: true, color: { argb: '0f172a' } };
    worksheet.mergeCells(1, 1, 1, flatCols.length);
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    const gangLabel = meta.gangCode === 'ALL' ? 'Semua Gang' : `Gang: ${meta.gangCode}`;
    const subTitleRow = worksheet.addRow([`Periode: ${periodStr} | ${gangLabel}`]);
    subTitleRow.height = 20;
    subTitleRow.getCell(1).font = { size: 12, italic: true, color: { argb: '475569' } };
    worksheet.mergeCells(2, 1, 2, flatCols.length);
    subTitleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.addRow([]); // Blank row

    // 2. Headers
    // Simple 1-row header for flatCols to keep it robust
    const headerRow = worksheet.addRow(flatCols.map(c => c.headerName || c.field));
    headerRow.height = 35;

    flatCols.forEach((col, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.font = { bold: true, size: 10, color: { argb: COLORS.headerText } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
            top: { style: 'medium', color: { argb: COLORS.borderDark } },
            bottom: { style: 'medium', color: { argb: COLORS.borderDark } },
            left: { style: 'thin', color: { argb: COLORS.border } },
            right: { style: 'thin', color: { argb: COLORS.border } }
        };
        // Set width based on likely content or ag-grid width
        worksheet.getColumn(idx + 1).width = col.width ? Math.max(col.width / 7, 10) : 12;
    });

    // We will track the row indices of gang totals to sum them up later for the Grand Total
    const gangTotalRowIndices = [];

    // 3. Data Rows
    let currentGangStartRow = -1;

    // Iterate through provided rows (they already include the isHeader and isTotal records from the optimized view)
    rows.forEach((row) => {
        if (row.isHeader) {
            // Gang Header
            const excelRow = worksheet.addRow(Array(flatCols.length).fill(''));
            excelRow.height = 24;
            worksheet.mergeCells(excelRow.number, 1, excelRow.number, flatCols.length);

            const cell = excelRow.getCell(1);
            cell.value = `🏭 DATA GANG: ${row.gang_code}`;
            cell.font = { bold: true, size: 11, color: { argb: '0f172a' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.gangHeader } };
            cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            cell.border = {
                top: { style: 'thin', color: { argb: COLORS.borderDark } },
                bottom: { style: 'thin', color: { argb: COLORS.borderDark } }
            };

            currentGangStartRow = excelRow.number + 1; // Content starts next row

        } else if (row.isTotal) {
            // Gang SubTotal
            const excelRow = worksheet.addRow(flatCols.map(() => '')); // Create empty first, we will apply formulas
            excelRow.height = 25;
            gangTotalRowIndices.push(excelRow.number);

            flatCols.forEach((col, idx) => {
                const cell = excelRow.getCell(idx + 1);
                const isNumeric = col.filter === 'agNumberColumnFilter' || col.type === 'rightAligned' || typeof row[col.field] === 'number';

                cell.font = { bold: true, size: 10, color: { argb: '0f172a' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.gangTotal } };
                cell.border = {
                    top: { style: 'medium', color: { argb: COLORS.borderDark } },
                    bottom: { style: 'thin', color: { argb: COLORS.borderDark } },
                    left: { style: 'thin', color: { argb: COLORS.border } },
                    right: { style: 'thin', color: { argb: COLORS.border } }
                };

                if (col.field === 'nama') {
                    cell.value = row.nama || 'TOTAL GANG';
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                } else if (isNumeric && currentGangStartRow !== -1 && currentGangStartRow < excelRow.number) {
                    // APPLY EXCEL FORMULA!
                    const letter = getColLetter(idx + 1);
                    cell.value = { formula: `SUM(${letter}${currentGangStartRow}:${letter}${excelRow.number - 1})` };
                    cell.numFmt = '#,##0';
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                } else {
                    cell.value = '';
                }
            });
            currentGangStartRow = -1; // Reset for next gang

        } else {
            // Normal Employee Row
            const rowData = flatCols.map((col) => {
                let val = row[col.field];
                if (col.field === 'lembur_jam') return isNaN(Number(val)) ? '-' : Number(val);
                if (typeof val === 'number') return val;

                // Try to parse strings that might be numbers for numeric columns
                if ((col.filter === 'agNumberColumnFilter' || col.type === 'rightAligned') && val) {
                    const parsed = Number(val);
                    if (!isNaN(parsed)) return parsed;
                }

                if (val === null || val === undefined) return '';
                return val;
            });

            const excelRow = worksheet.addRow(rowData);
            excelRow.height = 20;

            flatCols.forEach((col, idx) => {
                const cell = excelRow.getCell(idx + 1);
                const colColor = getColumnColor(col.field);

                cell.font = { size: 9 };
                cell.alignment = {
                    horizontal: (col.type === 'rightAligned' || col.filter === 'agNumberColumnFilter' || typeof cell.value === 'number') ? 'right' : 'left',
                    vertical: 'middle'
                };
                cell.border = {
                    top: { style: 'thin', color: { argb: COLORS.border } },
                    bottom: { style: 'thin', color: { argb: COLORS.border } },
                    left: { style: 'thin', color: { argb: COLORS.border } },
                    right: { style: 'thin', color: { argb: COLORS.border } }
                };

                if (typeof cell.value === 'number') {
                    cell.numFmt = col.field === 'lembur_jam' ? '#,##0.00' : '#,##0';
                }

                if (colColor) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colColor } };
                }
            });
        }
    });

    // 4. Grand Total Row with Formulas
    if (gangTotalRowIndices.length > 0) {
        worksheet.addRow([]); // Blank row
        const grandTotalRow = worksheet.addRow(flatCols.map(() => ''));
        grandTotalRow.height = 30;

        flatCols.forEach((col, idx) => {
            const cell = grandTotalRow.getCell(idx + 1);
            const isNumeric = col.filter === 'agNumberColumnFilter' || col.type === 'rightAligned' || col.className?.includes('text-right');

            cell.font = { bold: true, size: 11, color: { argb: COLORS.grandTotalText } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grandTotal } };
            cell.border = {
                top: { style: 'thick', color: { argb: '000000' } },
                bottom: { style: 'thick', color: { argb: '000000' } },
                left: { style: 'thin', color: { argb: '334155' } },
                right: { style: 'thin', color: { argb: '334155' } }
            };

            if (col.field === 'nama') {
                cell.value = 'GRAND TOTAL KESELURUHAN';
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
            } else if (isNumeric) {
                // Formula combining all gang total row cells!
                const letter = getColLetter(idx + 1);
                const sumParts = gangTotalRowIndices.map(rNum => `${letter}${rNum}`).join(',');

                // if there are too many total rows for simple A1,B1 syntax, we use SUM
                cell.value = { formula: `SUM(${sumParts})` };
                cell.numFmt = '#,##0';
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
            }
        });
    } else {
        // Single gang layout (no sub-totals, just sum the whole range)
        const grandTotalRow = worksheet.addRow(flatCols.map(() => ''));
        grandTotalRow.height = 30;

        // Data range is from headerRow + 1 to the row before this total
        const startRow = headerRow.number + 1;
        const endRow = grandTotalRow.number - 1;

        flatCols.forEach((col, idx) => {
            const cell = grandTotalRow.getCell(idx + 1);
            const isNumeric = col.filter === 'agNumberColumnFilter' || col.type === 'rightAligned' || col.className?.includes('text-right');

            cell.font = { bold: true, size: 11, color: { argb: COLORS.grandTotalText } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grandTotal } };
            cell.border = {
                top: { style: 'thick', color: { argb: '000000' } },
                bottom: { style: 'thick', color: { argb: '000000' } },
                left: { style: 'thin', color: { argb: '334155' } },
                right: { style: 'thin', color: { argb: '334155' } }
            };

            if (col.field === 'nama') {
                cell.value = 'GRAND TOTAL';
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
            } else if (isNumeric && startRow <= endRow) {
                const letter = getColLetter(idx + 1);
                cell.value = { formula: `SUM(${letter}${startRow}:${letter}${endRow})` };
                cell.numFmt = '#,##0';
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
            }
        });
    }

    // 5. Signature Block
    worksheet.addRow([]);
    worksheet.addRow([]);

    const printDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const sigRow1 = worksheet.addRow(['', '', '', `Dicetak pada: ${printDate}`]);
    sigRow1.getCell(4).font = { italic: true };

    worksheet.addRow([]);

    // Creating a layout for 3 signatures spreading cross the sheet
    // We'll place them roughly at col 2, col middle, col near end
    const colCount = flatCols.length;
    const midCol = Math.floor(colCount / 2);
    const endCol = colCount - 2 > midCol ? colCount - 2 : colCount;

    const titleSignRow = worksheet.addRow(Array(colCount).fill(''));
    titleSignRow.getCell(2).value = 'Dibuat Oleh,';
    titleSignRow.getCell(midCol).value = 'Diperiksa Oleh,';
    titleSignRow.getCell(endCol).value = 'Disetujui Oleh,';

    [2, midCol, endCol].forEach(c => {
        titleSignRow.getCell(c).font = { bold: true };
        titleSignRow.getCell(c).alignment = { horizontal: 'center' };
    });

    // 4 Empty rows for signature space
    for (let i = 0; i < 4; i++) worksheet.addRow([]);

    const nameSignRow = worksheet.addRow(Array(colCount).fill(''));
    nameSignRow.getCell(2).value = '( ...................................... )';
    nameSignRow.getCell(midCol).value = '( ...................................... )';
    nameSignRow.getCell(endCol).value = '( ...................................... )';

    [2, midCol, endCol].forEach(c => {
        nameSignRow.getCell(c).alignment = { horizontal: 'center' };
    });

    const roleSignRow = worksheet.addRow(Array(colCount).fill(''));
    roleSignRow.getCell(2).value = 'Clerk / Krani';
    roleSignRow.getCell(midCol).value = 'Ka. Tata Usaha';
    roleSignRow.getCell(endCol).value = 'Asisten Kepala / Manager';

    [2, midCol, endCol].forEach(c => {
        roleSignRow.getCell(c).font = { italic: true, size: 9 };
        roleSignRow.getCell(c).alignment = { horizontal: 'center' };
    });

    // 6. Freeze Panes
    // Freeze up to column 4 (usually nik, nama, etc) and first 4 header rows
    worksheet.views = [{
        state: 'frozen',
        xSplit: 4,
        ySplit: 4,
        topLeftCell: 'E5',
        activeCell: 'E5'
    }];

    // Export Action
    const fileName = `Daftar_Upah_${meta.division}_${meta.gangCode === 'ALL' ? 'AllGangs' : meta.gangCode}_${meta.year}${String(meta.month).padStart(2, '0')}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, fileName);

    return fileName;
}
