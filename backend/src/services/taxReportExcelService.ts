import ExcelJS from 'exceljs';
import { MonthlyTaxRow, DecemberTaxRow } from './taxReportService';

/**
 * Service to generate an Excel file containing detailed PPH21 Tax Calculations
 * with native Excel formulas embedded.
 */
export const generateMonthlyTaxExcel = async (
    data: { employees: MonthlyTaxRow[], period: { month: number; year: number; }; total_pph21: number; },
    year: number,
    month: number,
    division: string,
    gang: string
): Promise<Buffer> => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PT. Rebinmas Jaya - Auto Report System';
    workbook.created = new Date();

    const sheetName = `PPH21 - ${division} - ${gang || 'ALL'} - ${month}_${year}`;
    const sheet = workbook.addWorksheet(sheetName.substring(0, 31)); // Max 31 chars for sheet name

    // Helper for styling headers
    const applyHeaderStyle = (cell: ExcelJS.Cell, bgColor: string = '1E3A8A', color: string = 'FFFFFF') => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgColor }
        };
        cell.font = {
            color: { argb: color },
            bold: true,
            size: 10,
            name: 'Arial'
        };
        cell.alignment = {
            vertical: 'middle',
            horizontal: 'center',
            wrapText: true
        };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    };

    // --- ROW 1: Title ---
    sheet.mergeCells('A1:AC1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `DAFTAR RINCIAN KALKULASI PPH21 - DIVISI: ${division} | GANG: ${gang || 'ALL'} | PERIODE: ${month}/${year}`;
    titleCell.font = { size: 14, bold: true, name: 'Arial' };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // --- ROW 3 & 4: Headers ---
    // Defined columns structure
    const columns = [
        /* 1: A */ { header: 'NO', key: 'no', width: 5 },
        /* 2: B */ { header: 'NAMA', key: 'name', width: 25 },
        /* 3: C */ { header: 'NIK', key: 'nik', width: 16 },
        /* 4: D */ { header: 'L/P', key: 'gender', width: 5 },
        /* 5: E */ { header: 'STAT', key: 'status_ptkp', width: 8 },
        /* 6: F */ { header: 'GANG', key: 'gang', width: 10 },
        /* 7: G */ { header: 'KAT TER', key: 'kategori_ter', width: 8 },

        // Struktur Upah Group (H - L)
        /* 8: H */ { header: 'HK', key: 'hk', width: 6 },
        /* 9: I */ { header: 'UPAH DASAR', key: 'upah_dasar', width: 15 },
        /* 10: J */ { header: 'GP IDEAL', key: 'gp_ideal', width: 15 },
        /* 11: K */ { header: 'GP AKTUAL', key: 'gp_aktual', width: 15 },
        /* 12: L */ { header: 'KOREKSI', key: 'koreksi', width: 12 },

        // Tunjangan Group (M - Q)
        /* 13: M */ { header: 'BERAS', key: 'tj_beras', width: 12 },
        /* 14: N */ { header: 'JABATAN', key: 'tj_jabatan', width: 12 },
        /* 15: O */ { header: 'M KERJA', key: 'tj_masa', width: 12 },
        /* 16: P */ { header: 'LEMBUR', key: 'tj_lembur', width: 12 },
        /* 17: Q */ { header: 'TOTAL TUNJ', key: 'total_tunj', width: 15 },

        // Premi Group (R - T)
        /* 18: R */ { header: 'BRONDOL', key: 'pr_brondol', width: 12 },
        /* 19: S */ { header: 'PPH', key: 'pr_pph', width: 12 },
        /* 20: T */ { header: 'TOTAL PREMI', key: 'total_premi', width: 15 },

        // Potongan
        /* 21: U */ { header: 'POT KOREKSI', key: 'pot_koreksi', width: 15 },

        // Pend Tidak Teratur
        /* 22: V */ { header: 'THR', key: 'thr', width: 15 },
        /* 23: W */ { header: 'EXGRATIA', key: 'exgratia', width: 15 },

        // Jaminan Majikan (X - Y)
        /* 24: X */ { header: 'BPJS KES 4%', key: 'bpjs_kes_majikan', width: 15 },
        /* 25: Y */ { header: 'ASTEK 0.84%', key: 'astek_majikan', width: 15 },

        // Kalkulasi Summary (Z - AC)
        /* 26: Z */ { header: 'UPAH KOTOR', key: 'upah_kotor', width: 15 },
        /* 27: AA */ { header: 'PENGHASILAN BRUTO', key: 'bruto', width: 18 },
        /* 28: AB */ { header: 'TARIF TER (X%)', key: 'tarif_ter', width: 12 },
        /* 29: AC */ { header: 'PPH21', key: 'pph21', width: 15 }
    ];

    sheet.columns = columns.map(col => ({ key: col.key, width: col.width }));

    // Top Header Groupings (Row 3)
    sheet.getCell('A3').value = 'IDENTITAS'; sheet.mergeCells('A3:G3');
    applyHeaderStyle(sheet.getCell('A3'), '1E3A8A', 'FFFFFF');

    sheet.getCell('H3').value = 'STRUKTUR UPAH'; sheet.mergeCells('H3:L3');
    applyHeaderStyle(sheet.getCell('H3'), 'F1F5F9', '0F172A');

    sheet.getCell('M3').value = 'TUNJANGAN'; sheet.mergeCells('M3:Q3');
    applyHeaderStyle(sheet.getCell('M3'), 'E2E8F0', '0F172A');

    sheet.getCell('R3').value = 'PREMI (TIDAK TETAP)'; sheet.mergeCells('R3:T3');
    applyHeaderStyle(sheet.getCell('R3'), 'CBD5E1', '0F172A');

    sheet.getCell('U3').value = 'POTONGAN'; // No merge
    applyHeaderStyle(sheet.getCell('U3'), 'FCA5A5', '0F172A');

    sheet.getCell('V3').value = 'PEND. LAINNYA'; sheet.mergeCells('V3:W3');
    applyHeaderStyle(sheet.getCell('V3'), 'FEF3C7', '0F172A');

    sheet.getCell('X3').value = 'JAMINAN MAJIKAN'; sheet.mergeCells('X3:Y3');
    applyHeaderStyle(sheet.getCell('X3'), 'F1F5F9', '0F172A');

    sheet.getCell('Z3').value = 'KALKULASI PPH21'; sheet.mergeCells('Z3:AC3');
    applyHeaderStyle(sheet.getCell('Z3'), '1E293B', 'FFFFFF');

    // Sub Headers (Row 4)
    columns.forEach((col, index) => {
        const cell = sheet.getCell(4, index + 1);
        cell.value = col.header;

        let bgColor = '1E3A8A'; // default
        let fgColor = 'FFFFFF';

        if (index < 7) { bgColor = '1E3A8A'; fgColor = 'FFFFFF'; }
        else if (index < 12) { bgColor = 'F1F5F9'; fgColor = '0F172A'; }
        else if (index < 17) { bgColor = 'E2E8F0'; fgColor = '0F172A'; }
        else if (index < 20) { bgColor = 'CBD5E1'; fgColor = '0F172A'; }
        else if (index === 20) { bgColor = 'FCA5A5'; fgColor = '0F172A'; }
        else if (index < 23) { bgColor = 'FEF3C7'; fgColor = '0F172A'; }
        else if (index < 25) { bgColor = 'F1F5F9'; fgColor = '0F172A'; }
        else { bgColor = '0F172A'; fgColor = 'FFFFFF'; }

        applyHeaderStyle(cell, bgColor, fgColor);
    });

    sheet.getRow(4).height = 30;

    // --- Populate Data (Row 5 onwards) ---
    let currentRowIndex = 5;

    // Number format for accounting (Indonesian style: period for thousands)
    const numFormat = '#,##0';

    data.employees.forEach((emp, i) => {
        const row = sheet.getRow(currentRowIndex);

        // Static Data
        row.getCell('A').value = i + 1;
        row.getCell('B').value = emp.emp_name;
        row.getCell('C').value = emp.nik || '';
        row.getCell('D').value = emp.gender;
        row.getCell('E').value = emp.status_ptkp;
        row.getCell('F').value = emp.gang_code;
        row.getCell('G').value = emp.kategori_ter;

        row.getCell('H').value = emp.hk || 0;
        row.getCell('I').value = emp.upah_dasar || 0;

        // GP Ideal (J) = Upah Dasar (I) * HK (H)
        row.getCell('J').value = { formula: `I${currentRowIndex}*H${currentRowIndex}`, result: emp.gaji_pokok_ideal || 0 };

        row.getCell('K').value = emp.gaji_pokok_aktual || 0;

        // Koreksi (L) = GP Aktual (K) - GP Ideal (J)
        row.getCell('L').value = { formula: `K${currentRowIndex}-J${currentRowIndex}`, result: emp.koreksi_hk || 0 };

        row.getCell('M').value = emp.tunjangan_beras || 0;
        row.getCell('N').value = emp.tunjangan_jabatan || 0;
        row.getCell('O').value = emp.tunjangan_masa_kerja || 0;
        row.getCell('P').value = emp.tunjangan_lembur || 0;

        // TOTAL TUNJANGAN => SUM(M:P)
        row.getCell('Q').value = { formula: `SUM(M${currentRowIndex}:P${currentRowIndex})`, result: emp.total_tunjangan };

        row.getCell('R').value = emp.premi_brondol || 0;
        row.getCell('S').value = emp.premi_pph || 0;

        // TOTAL PREMI => SUM(R:S)
        row.getCell('T').value = { formula: `SUM(R${currentRowIndex}:S${currentRowIndex})`, result: emp.total_premi };

        row.getCell('U').value = emp.pot_koreksi || 0;

        row.getCell('V').value = emp.thr_amount || 0;
        row.getCell('W').value = emp.exgratia_amount || 0;

        // JAMINAN MAJIKAN BERDASARKAN UPAH DASAR * 30
        // BPJS Kes Majikan = ROUND((Upah Dasar * 30) * 4%, 0)
        row.getCell('X').value = { formula: `ROUND(I${currentRowIndex}*30*0.04, 0)`, result: emp.bpjs_kes_majikan || 0 };

        // Astek Majikan = ROUND((Upah Dasar * 30) * 0.84%, 0)
        row.getCell('Y').value = { formula: `ROUND(I${currentRowIndex}*30*0.0084, 0)`, result: emp.astek_jht_majikan || 0 };

        // UPAH KOTOR (Z) = GP Aktual (K) + Total Tunj (Q) + Total Premi (T) - Pot Koreksi (U)
        row.getCell('Z').value = { formula: `K${currentRowIndex}+Q${currentRowIndex}+T${currentRowIndex}-U${currentRowIndex}`, result: emp.upah_kotor };

        // PENGHASILAN BRUTO (AA) = Upah Kotor (Z) + BPJS (X) + ASTEK (Y) + THR (V) + EXGRATIA (W)
        row.getCell('AA').value = { formula: `Z${currentRowIndex}+X${currentRowIndex}+Y${currentRowIndex}+V${currentRowIndex}+W${currentRowIndex}`, result: emp.penghasilan_bruto };

        // TER Rate (Percentage format)
        row.getCell('AB').value = (emp.tarif_pajak_ter || 0) / 100; // Divide by 100 so Excel recognizes it as a percentage
        row.getCell('AB').numFmt = '0.00%';

        // PPH21 (AC) = Bruto (AA) * Tarif TER (AB) -- ROUND to 0 decimal places
        row.getCell('AC').value = { formula: `ROUND(AA${currentRowIndex}*AB${currentRowIndex}, 0)`, result: emp.pph21_ter };


        // Apply number formats
        ['H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AC'].forEach(colKey => {
            row.getCell(colKey).numFmt = numFormat;
        });

        // Add thin borders
        for (let c = 1; c <= 29; c++) {
            row.getCell(c).border = {
                top: { style: 'thin' }, left: { style: 'thin' },
                bottom: { style: 'thin' }, right: { style: 'thin' }
            };
        }

        currentRowIndex++;
    });

    // --- Footer Row (Totals) ---
    const footerRow = sheet.getRow(currentRowIndex);
    footerRow.getCell('A').value = 'GRAND TOTAL';
    sheet.mergeCells(`A${currentRowIndex}:G${currentRowIndex}`);
    footerRow.getCell('A').alignment = { horizontal: 'right', vertical: 'middle' };
    footerRow.getCell('A').font = { bold: true };

    // Sum formulas for total row
    ['H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AC'].forEach(col => {
        const cell = footerRow.getCell(col);
        cell.value = { formula: `SUM(${col}5:${col}${currentRowIndex - 1})` };
        cell.numFmt = numFormat;
        cell.font = { bold: true };
    });

    for (let c = 1; c <= 29; c++) {
        footerRow.getCell(c).border = {
            top: { style: 'medium' }, left: { style: 'thin' },
            bottom: { style: 'medium' }, right: { style: 'thin' }
        };
        footerRow.getCell(c).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'F1F5F9' } // Light slate for totals
        };
    }

    currentRowIndex += 3; // Space before signature

    // --- Signatures Block ---
    const ttdStartRow = currentRowIndex;

    // Labels
    sheet.getCell(`B${ttdStartRow}`).value = 'Dibuat Oleh:';
    sheet.getCell(`N${ttdStartRow}`).value = 'Diperiksa Oleh:';
    sheet.getCell(`AA${ttdStartRow}`).value = 'Disetujui Oleh:';

    // Alignment & Bold for Labels
    ['B', 'N', 'AA'].forEach(col => {
        const cell = sheet.getCell(`${col}${ttdStartRow}`);
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center' };
    });

    // Space for signature lines
    const ttdEndRow = ttdStartRow + 5;

    // Names
    sheet.getCell(`B${ttdEndRow}`).value = '(_____________________)';
    sheet.getCell(`N${ttdEndRow}`).value = '(_____________________)';
    sheet.getCell(`AA${ttdEndRow}`).value = '(_____________________)';

    // Titles
    sheet.getCell(`B${ttdEndRow + 1}`).value = 'Admin HR / Payroll';
    sheet.getCell(`N${ttdEndRow + 1}`).value = 'HR Manager';
    sheet.getCell(`AA${ttdEndRow + 1}`).value = 'General Manager';

    // Alignment for Names & Titles
    ['B', 'N', 'AA'].forEach(col => {
        const nameCell = sheet.getCell(`${col}${ttdEndRow}`);
        nameCell.alignment = { horizontal: 'center' };
        nameCell.font = { bold: true };

        const titleCell = sheet.getCell(`${col}${ttdEndRow + 1}`);
        titleCell.alignment = { horizontal: 'center' };
    });

    // Merge cells for proper alignment width
    sheet.mergeCells(`B${ttdStartRow}:D${ttdStartRow}`);
    sheet.mergeCells(`B${ttdEndRow}:D${ttdEndRow}`);
    sheet.mergeCells(`B${ttdEndRow + 1}:D${ttdEndRow + 1}`);

    sheet.mergeCells(`N${ttdStartRow}:P${ttdStartRow}`);
    sheet.mergeCells(`N${ttdEndRow}:P${ttdEndRow}`);
    sheet.mergeCells(`N${ttdEndRow + 1}:P${ttdEndRow + 1}`);

    sheet.mergeCells(`AA${ttdStartRow}:AC${ttdStartRow}`);
    sheet.mergeCells(`AA${ttdEndRow}:AC${ttdEndRow}`);
    sheet.mergeCells(`AA${ttdEndRow + 1}:AC${ttdEndRow + 1}`);

    // Return the buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
};

/**
 * Service to generate an Excel file containing December Tax Calculations
 * with a secondary sheet for Monthly Breakdown details.
 */
export const generateDecemberTaxExcel = async (
    data: { employees: DecemberTaxRow[] },
    year: number,
    division: string,
    gang: string
): Promise<Buffer> => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PT. Rebinmas Jaya - Auto Report System';
    workbook.created = new Date();

    const applyHeaderStyle = (cell: ExcelJS.Cell, bgColor: string, color: string = 'FFFFFF') => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.font = { color: { argb: color }, bold: true, size: 10, name: 'Arial' };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    };

    const numFormat = '#,##0';

    // ==========================================
    // SHEET 1: PAJAK DESEMBER
    // ==========================================
    const mainSheetName = `Pajak Des - ${division} - ${gang || 'ALL'}`;
    const mainSheet = workbook.addWorksheet(mainSheetName.substring(0, 31));

    // Format matches frontend exactly.
    // Row 1: Title
    mainSheet.mergeCells('A1:AC1');
    const titleCell = mainSheet.getCell('A1');
    titleCell.value = `TABULASI PAJAK DESEMBER - DIVISI: ${division} | GANG: ${gang || 'ALL'} | TAHUN: ${year}`;
    titleCell.font = { size: 14, bold: true, name: 'Arial' };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Row 3: Main Group Headers
    mainSheet.getCell('A3').value = 'IDENTITAS'; mainSheet.mergeCells('A3:F3');
    applyHeaderStyle(mainSheet.getCell('A3'), '1E293B'); // Dark Slate
    mainSheet.getCell('G3').value = 'STATUS KARYAWAN'; mainSheet.mergeCells('G3:I3');
    applyHeaderStyle(mainSheet.getCell('G3'), '1E293B');
    mainSheet.getCell('J3').value = 'DESEMBER'; mainSheet.mergeCells('J3:N3');
    applyHeaderStyle(mainSheet.getCell('J3'), '1E3A8A'); // Blue
    mainSheet.getCell('O3').value = 'PENGHASILAN TIDAK TERATUR'; mainSheet.mergeCells('O3:Q3');
    applyHeaderStyle(mainSheet.getCell('O3'), 'B45309'); // Amber/Orange
    mainSheet.getCell('R3').value = 'DISETAHUNKAN'; mainSheet.mergeCells('R3:X3');
    applyHeaderStyle(mainSheet.getCell('R3'), '0284C7'); // Light Blue
    mainSheet.getCell('Y3').value = 'PENGURANG'; mainSheet.mergeCells('Y3:AA3');
    applyHeaderStyle(mainSheet.getCell('Y3'), 'B91C1C'); // Red
    mainSheet.getCell('AB3').value = 'KALKULASI PAJAK'; mainSheet.mergeCells('AB3:AG3');
    applyHeaderStyle(mainSheet.getCell('AB3'), '15803D'); // Green

    // Row 4: Sub Headers
    const mainCols = [
        /* A */ { header: 'NO', width: 5 }, /* B */ { header: 'NAMA KARYAWAN', width: 25 },
        /* C */ { header: 'NIK / PASPOR', width: 18 }, /* D */ { header: 'NPWP', width: 20 },
        /* E */ { header: 'ALAMAT', width: 25 }, /* F */ { header: 'JABATAN', width: 15 },
        /* G */ { header: 'L/P', width: 5 }, /* H */ { header: 'PTKP', width: 8 },
        /* I */ { header: 'TER', width: 8 },
        /* J */ { header: 'Gaji Pokok', width: 15, group: 'blue' }, /* K */ { header: 'Total Tunjangan', width: 15, group: 'blue' },
        /* L */ { header: 'Premi JKK/JKM/Kes', width: 15, group: 'blue' }, /* M */ { header: 'Tunjangan PPh', width: 15, group: 'blue' },
        /* N */ { header: 'Ph. Bruto Des', width: 15, group: 'blue' },
        /* O */ { header: 'THR', width: 15, group: 'orange' }, /* P */ { header: 'BONUS', width: 15, group: 'orange' },
        /* Q */ { header: 'TANTIEM', width: 15, group: 'orange' },
        /* R */ { header: 'Total Gaji Pokok', width: 15, group: 'lightblue' }, /* S */ { header: 'Total Tunj. Lainnya', width: 15, group: 'lightblue' },
        /* T */ { header: 'Total Premi Asuransi', width: 18, group: 'lightblue' }, /* U */ { header: 'Total Tunj. PPh', width: 15, group: 'lightblue' },
        /* V */ { header: 'Total Natura', width: 15, group: 'lightblue' }, /* W */ { header: 'Total THR/Bonus', width: 15, group: 'lightblue' },
        /* X */ { header: 'Ph. Bruto Setahun', width: 18, group: 'lightblue' },
        /* Y */ { header: 'Biaya Jabatan', width: 15, group: 'red' }, /* Z */ { header: 'Total Iuran JHT/JP', width: 18, group: 'red' },
        /* AA */ { header: 'Ph. Netto Setahun', width: 18, group: 'red' },
        /* AB */ { header: 'PTKP', width: 15, group: 'green' }, /* AC */ { header: 'PKP', width: 15, group: 'green' },
        /* AD */ { header: 'PPh 21 Setahun', width: 18, group: 'green' }, /* AE */ { header: 'PPh 21 Non NPWP', width: 18, group: 'green' },
        /* AF */ { header: 'PPh 21 Jan S.D Nop', width: 18, group: 'green' }, /* AG */ { header: 'PPh 21 Desember', width: 18, group: 'green' }
    ];

    mainSheet.columns = mainCols.map((col, idx) => ({ key: `col${idx}`, width: col.width }));

    mainCols.forEach((col, index) => {
        const cell = mainSheet.getCell(4, index + 1);
        cell.value = col.header;

        let bgColor = 'F8FAFC'; // Default gray
        let fgColor = '0F172A';

        if (col.group === 'blue') { bgColor = '1E3A8A'; fgColor = 'FFFFFF'; }
        else if (col.group === 'orange') { bgColor = 'B45309'; fgColor = 'FFFFFF'; }
        else if (col.group === 'lightblue') { bgColor = '0284C7'; fgColor = 'FFFFFF'; }
        else if (col.group === 'red') { bgColor = 'B91C1C'; fgColor = 'FFFFFF'; }
        else if (col.group === 'green') { bgColor = '15803D'; fgColor = 'FFFFFF'; }

        applyHeaderStyle(cell, bgColor, fgColor);
    });
    mainSheet.getRow(4).height = 35;

    let mainRowIdx = 5;
    data.employees.forEach((emp, i) => {
        const row = mainSheet.getRow(mainRowIdx);
        const rowData = [
            emp.no, emp.emp_name, emp.nik, emp.npwp, emp.alamat, emp.jabatan,
            emp.gender, emp.status_ptkp, emp.kategori_ter,
            emp.gaji_pokok_des, emp.tunjangan_des, emp.premi_asuransi_des, emp.tunjangan_pph_des, emp.bruto_des, // J-N
            emp.thr, emp.bonus, emp.tantiem, // O-Q
            emp.gaji_pokok_setahun, emp.tunjangan_lainnya_setahun, emp.premi_asuransi_setahun, emp.tunjangan_pph_setahun, emp.natura_setahun, emp.thr_bonus_tantiem_setahun, emp.bruto_setahun, // R-X
            emp.biaya_jabatan, emp.iuran_jht_jp_setahun, emp.netto_setahun, // Y-AA
            emp.ptkp, emp.pkp, emp.pph21_setahun, emp.pph21_setahun, emp.pph21_jan_nov, emp.pph21_desember // AB-AG
        ];

        rowData.forEach((val, idx) => {
            const cell = row.getCell(idx + 1);
            cell.value = val !== undefined && val !== null ? val : 0;
            // First 9 cols are strings/text, rest are numbers
            if (idx >= 9) {
                cell.numFmt = numFormat;
            }
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        // Highlight December cell
        row.getCell(33).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1E7DD' } };
        row.getCell(33).font = { color: { argb: '0F5132' }, bold: true };

        mainRowIdx++;
    });

    // Main Sheet Footer Totals
    const mainFooter = mainSheet.getRow(mainRowIdx);
    mainSheet.mergeCells(`A${mainRowIdx}:I${mainRowIdx}`);
    mainFooter.getCell('A').value = 'GRAND TOTAL';
    mainFooter.getCell('A').alignment = { horizontal: 'right', vertical: 'middle' };
    mainFooter.getCell('A').font = { bold: true };
    mainFooter.getCell('A').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };

    for (let c = 10; c <= 33; c++) {
        const cell = mainFooter.getCell(c);
        if (c !== 28) { // Skip PTKP total if doesn't make sense, but frontend does it so let's match frontend SUMs
            cell.value = { formula: `SUM(${mainSheet.getColumn(c).letter}5:${mainSheet.getColumn(c).letter}${mainRowIdx - 1})` };
        }
        cell.numFmt = numFormat;
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
        cell.border = { top: { style: 'medium' }, left: { style: 'thin' }, bottom: { style: 'medium' }, right: { style: 'thin' } };
    }
    // Set PPh21 Des Total highlight
    mainFooter.getCell(33).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1E7DD' } };
    mainFooter.getCell(33).font = { color: { argb: '0F5132' }, bold: true };


    // ==========================================
    // SHEET 2: LAMPIRAN URAIAN BULANAN
    // ==========================================
    const detailSheetName = `Uraian Bulanan_Des_${year}`;
    const detailSheet = workbook.addWorksheet(detailSheetName.substring(0, 31));

    const detailCols = [
        { header: 'NO', width: 5 }, { header: 'NAMA KARYAWAN', width: 25 }, { header: 'NIK', width: 15 },
        { header: 'KOMPONEN', width: 20 },
        { header: 'JAN', width: 12 }, { header: 'FEB', width: 12 }, { header: 'MAR', width: 12 },
        { header: 'APR', width: 12 }, { header: 'MEI', width: 12 }, { header: 'JUN', width: 12 },
        { header: 'JUL', width: 12 }, { header: 'AGU', width: 12 }, { header: 'SEP', width: 12 },
        { header: 'OKT', width: 12 }, { header: 'NOV', width: 12 }, { header: 'DES', width: 12 },
        { header: 'TOTAL SEMUA', width: 15 }
    ];
    detailSheet.columns = detailCols.map((col, idx) => ({ key: `col${idx}`, width: col.width }));

    // Headers
    detailSheet.getRow(1).height = 30;
    detailCols.forEach((col, index) => {
        const cell = detailSheet.getCell(1, index + 1);
        cell.value = col.header;
        applyHeaderStyle(cell, '1E293B', 'FFFFFF');
    });

    let detailRowIdx = 2;
    const components = [
        { key: 'gaji_pokok', label: '1. Gaji Pokok' },
        { key: 'tunjangan', label: '2. Tunjangan' },
        { key: 'premi_asuransi', label: '3. Premi Asuransi' },
        { key: 'iuran_pensiun', label: '4. Iuran Pensiun' },
        { key: 'pph21', label: '5. PPh 21' }
    ];

    data.employees.forEach((emp, i) => {
        components.forEach((comp, cIdx) => {
            const row = detailSheet.getRow(detailRowIdx);

            // Employee info only on first row of their block, or merge
            if (cIdx === 0) {
                row.getCell(1).value = i + 1;
                row.getCell(2).value = emp.emp_name;
                row.getCell(3).value = emp.nik;
            }

            row.getCell(4).value = comp.label;

            let rowTotalFormulaStr = '=SUM(';
            // Monthly values
            for (let m = 1; m <= 12; m++) {
                const key = comp.key as keyof typeof emp.monthly_breakdown;
                const val = emp.monthly_breakdown?.[key]?.[String(m)] || 0;
                const cell = row.getCell(4 + m);
                cell.value = val;
                cell.numFmt = numFormat;
                if (m === 1) rowTotalFormulaStr += `${cell.address}:`;
                if (m === 12) rowTotalFormulaStr += `${cell.address})`;
            }

            // Total Column
            const totalCell = row.getCell(17);
            totalCell.value = { formula: rowTotalFormulaStr };
            totalCell.numFmt = numFormat;
            totalCell.font = { bold: true };

            // Borders for all cells in row
            for (let colId = 1; colId <= 17; colId++) {
                row.getCell(colId).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            }

            // Alternating employee background color for readability
            if (i % 2 !== 0) {
                for (let colId = 1; colId <= 17; colId++) {
                    if (!row.getCell(colId).fill) {
                        row.getCell(colId).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
                    }
                }
            }

            detailRowIdx++;
        });

        // Add a thin empty row separator (optional but nice)
        // detailRowIdx++; (not adding to save space, standard formatting is compact)
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
};
