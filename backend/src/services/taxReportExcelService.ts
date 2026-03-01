import ExcelJS from 'exceljs';
import { MonthlyTaxRow, DecemberTaxRow } from './taxReportService';
import { CARUMAN_RATES } from './carumanDefinitions';

// Helper: convert column index (1-based) to Excel letter(s)
function colLetter(n: number): string {
    let letter = '';
    while (n > 0) {
        const rem = (n - 1) % 26;
        letter = String.fromCharCode(65 + rem) + letter;
        n = Math.floor((n - 1) / 26);
    }
    return letter;
}

/**
 * Service to generate an Excel file containing detailed PPH21 Tax Calculations
 * with native Excel formulas embedded.
 * Premi columns are DYNAMIC – one column per identified premi type.
 *
 * Includes:
 * - Sheet 1: Monthly PPH21 Calculation
 * - Sheet 2: Premi Breakdown (daftar lengkap premi yang diperhitungkan)
 */
export const generateMonthlyTaxExcel = async (
    data: { employees: MonthlyTaxRow[], period: { month: number; year: number; }, total_pph21: number; },
    year: number,
    month: number,
    division: string,
    gang: string,
    premiKeys?: string[]
): Promise<Buffer> => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PT. Rebinmas Jaya - Auto Report System';
    workbook.created = new Date();

    const sheetName = `PPH21 - ${division} - ${gang || 'ALL'} - ${month}_${year}`;
    const sheet = workbook.addWorksheet(sheetName.substring(0, 31));

    // --- Discover dynamic premi keys ---
    const discoveredPremiKeys = new Set<string>();
    for (const emp of data.employees) {
        if (emp.premi_detail) {
            for (const k of Object.keys(emp.premi_detail)) {
                discoveredPremiKeys.add(k);
            }
        }
    }
    // Sort: BRONDOL first, then alphabetical, LAINNYA last
    const allPremiKeys: string[] = premiKeys && premiKeys.length > 0
        ? premiKeys
        : Array.from(discoveredPremiKeys).sort((a, b) => {
            if (a === 'BRONDOL') return -1;
            if (b === 'BRONDOL') return 1;
            if (a === 'LAINNYA') return 1;
            if (b === 'LAINNYA') return -1;
            return a.localeCompare(b);
        });

    // If no premi data found, use a minimal default
    if (allPremiKeys.length === 0) allPremiKeys.push('BRONDOL');

    // Calculate premi totals for summary sheet
    const premiSummary: Record<string, { jumlah: number; karyawan: number; total: number }> = {};
    for (const key of allPremiKeys) {
        premiSummary[key] = { jumlah: 0, karyawan: 0, total: 0 };
    }
    for (const emp of data.employees) {
        if (emp.premi_detail) {
            for (const [key, value] of Object.entries(emp.premi_detail)) {
                if (premiSummary[key]) {
                    premiSummary[key].jumlah += (value || 0);
                    premiSummary[key].karyawan += (value || 0) > 0 ? 1 : 0;
                    premiSummary[key].total += 1; // count all employees
                }
            }
        }
    }

    // Helper for styling headers
    const applyHeaderStyle = (cell: ExcelJS.Cell, bgColor: string = '1E3A8A', color: string = 'FFFFFF') => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.font = { color: { argb: color }, bold: true, size: 10, name: 'Arial' };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
        };
    };

    // ─────────────────────────────────────────────────────────
    // Column layout (dynamic based on premi count)
    // ─────────────────────────────────────────────────────────
    // Fixed columns:
    //  1: NO, 2: NAMA, 3: NIK, 4: L/P, 5: STAT, 6: GANG, 7: KAT TER     → IDENTITAS
    //  8: HK, 9: UPAH DASAR, 10: GAJI STANDAR, 11: GP IDEAL, 12: GP AKTUAL, 13: KOREKSI → STRUKTUR UPAH
    //  14: BERAS, 15: JABATAN, 16: M KERJA, 17: LEMBUR, 18: TOTAL TUNJ  → TUNJANGAN
    // Dynamic premi cols (19 .. 18+N) → URAIAN PREMI
    //  18+N+1: TOTAL PREMI
    // Fixed after premi:
    //  POT KOREKSI, THR, EXGRATIA, BPJS KES 4%, ASTEK 0.84%, UPAH KOTOR, PENGHASILAN BRUTO, TARIF TER, PPH21

    const COL_NO = 1;
    const COL_NAMA = 2;
    const COL_NIK = 3;
    const COL_GENDER = 4;
    const COL_STAT = 5;
    const COL_GANG = 6;
    const COL_KAT = 7;
    const COL_HK = 8;
    const COL_UPAH_DASAR = 9;
    const COL_GAJI_STANDAR = 10;
    const COL_GP_IDEAL = 11;
    const COL_GP_AKTUAL = 12;
    const COL_KOREKSI = 13;
    const COL_BERAS = 14;
    const COL_JABATAN = 15;
    const COL_MASA_KERJA = 16;
    const COL_LEMBUR = 17;
    const COL_TOTAL_TUNJ = 18;

    // Dynamic premi columns
    const COL_PREMI_START = 19;
    const COL_PREMI_END = 18 + allPremiKeys.length;  // inclusive
    const COL_TOTAL_PREMI = COL_PREMI_END + 1;

    // Fixed after premi
    const COL_POT_KOREKSI = COL_TOTAL_PREMI + 1;
    const COL_THR = COL_POT_KOREKSI + 1;
    const COL_EXGRATIA = COL_THR + 1;
    const COL_BPJS_KES = COL_EXGRATIA + 1;
    const COL_ASTEK = COL_BPJS_KES + 1;
    const COL_UPAH_KOTOR = COL_ASTEK + 1;
    const COL_BRUTO = COL_UPAH_KOTOR + 1;
    const COL_TARIF_TER = COL_BRUTO + 1;
    const COL_PPH21 = COL_TARIF_TER + 1;
    const TOTAL_COLS = COL_PPH21;

    // Helper for column letter
    const L = colLetter;

    // Define column widths
    const colWidths: number[] = [];
    for (let i = 1; i <= TOTAL_COLS; i++) {
        if (i <= 7) colWidths.push(i === 2 ? 25 : i === 3 ? 16 : i <= 7 ? 8 : 5);
        else if (i <= 13) colWidths.push(15);
        else if (i <= 18) colWidths.push(12);
        else if (i < COL_TOTAL_PREMI) colWidths.push(13); // premi columns
        else if (i === COL_TOTAL_PREMI) colWidths.push(15);
        else if (i === COL_POT_KOREKSI) colWidths.push(15);
        else if (i <= COL_EXGRATIA) colWidths.push(15);
        else if (i <= COL_ASTEK) colWidths.push(15);
        else colWidths.push(18);
    }
    sheet.columns = colWidths.map((w, i) => ({ key: `col${i + 1}`, width: w }));

    // ─────────────────────────────────────────────────────────
    // ROW 1: Title
    // ─────────────────────────────────────────────────────────
    sheet.mergeCells(`A1:${L(TOTAL_COLS)}1`);
    const titleCell = sheet.getCell('A1');
    titleCell.value = `DAFTAR RINCIAN KALKULASI PPH21 - DIVISI: ${division} | GANG: ${gang || 'ALL'} | PERIODE: ${month}/${year}`;
    titleCell.font = { size: 14, bold: true, name: 'Arial' };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // ─────────────────────────────────────────────────────────
    // ROW 3: Group headers
    // ─────────────────────────────────────────────────────────
    const premiEndLetter = L(COL_PREMI_END);
    const premiStartLetter = L(COL_PREMI_START);
    const totalPremiLetter = L(COL_TOTAL_PREMI);

    // IDENTITAS
    sheet.mergeCells(`A3:${L(COL_KAT)}3`);
    sheet.getCell('A3').value = 'IDENTITAS';
    applyHeaderStyle(sheet.getCell('A3'), '1E3A8A', 'FFFFFF');

    // STRUKTUR UPAH
    sheet.mergeCells(`${L(COL_HK)}3:${L(COL_KOREKSI)}3`);
    sheet.getCell(`${L(COL_HK)}3`).value = 'STRUKTUR UPAH';
    applyHeaderStyle(sheet.getCell(`${L(COL_HK)}3`), 'F1F5F9', '0F172A');

    // TUNJANGAN
    sheet.mergeCells(`${L(COL_BERAS)}3:${L(COL_TOTAL_TUNJ)}3`);
    sheet.getCell(`${L(COL_BERAS)}3`).value = 'TUNJANGAN';
    applyHeaderStyle(sheet.getCell(`${L(COL_BERAS)}3`), 'E2E8F0', '0F172A');

    // URAIAN PREMI (spans all premi cols + total premi)
    const premiGroupEnd = L(COL_TOTAL_PREMI);
    if (COL_PREMI_START === COL_TOTAL_PREMI) {
        // only one column: no merge needed
        sheet.getCell(`${premiStartLetter}3`).value = 'Uraian Premi';
        applyHeaderStyle(sheet.getCell(`${premiStartLetter}3`), 'CBD5E1', '0F172A');
    } else {
        sheet.mergeCells(`${premiStartLetter}3:${premiGroupEnd}3`);
        sheet.getCell(`${premiStartLetter}3`).value = 'Uraian Premi';
        applyHeaderStyle(sheet.getCell(`${premiStartLetter}3`), 'CBD5E1', '0F172A');
    }

    // POTONGAN (single cell)
    sheet.getCell(`${L(COL_POT_KOREKSI)}3`).value = 'POTONGAN';
    applyHeaderStyle(sheet.getCell(`${L(COL_POT_KOREKSI)}3`), 'FCA5A5', '0F172A');

    // PEND. LAINNYA
    if (COL_THR !== COL_EXGRATIA) {
        sheet.mergeCells(`${L(COL_THR)}3:${L(COL_EXGRATIA)}3`);
    }
    sheet.getCell(`${L(COL_THR)}3`).value = 'PEND. LAINNYA';
    applyHeaderStyle(sheet.getCell(`${L(COL_THR)}3`), 'FEF3C7', '0F172A');

    // JAMINAN MAJIKAN
    sheet.mergeCells(`${L(COL_BPJS_KES)}3:${L(COL_ASTEK)}3`);
    sheet.getCell(`${L(COL_BPJS_KES)}3`).value = 'JAMINAN MAJIKAN';
    applyHeaderStyle(sheet.getCell(`${L(COL_BPJS_KES)}3`), 'F1F5F9', '0F172A');

    // KALKULASI PPH21
    sheet.mergeCells(`${L(COL_UPAH_KOTOR)}3:${L(COL_PPH21)}3`);
    sheet.getCell(`${L(COL_UPAH_KOTOR)}3`).value = 'KALKULASI PPH21';
    applyHeaderStyle(sheet.getCell(`${L(COL_UPAH_KOTOR)}3`), '1E293B', 'FFFFFF');

    // ─────────────────────────────────────────────────────────
    // ROW 4: Sub-headers
    // ─────────────────────────────────────────────────────────
    const subHeaders: { col: number; label: string; bg: string; fg: string }[] = [
        { col: COL_NO, label: 'NO', bg: '1E3A8A', fg: 'FFFFFF' },
        { col: COL_NAMA, label: 'NAMA', bg: '1E3A8A', fg: 'FFFFFF' },
        { col: COL_NIK, label: 'NIK', bg: '1E3A8A', fg: 'FFFFFF' },
        { col: COL_GENDER, label: 'L/P', bg: '1E3A8A', fg: 'FFFFFF' },
        { col: COL_STAT, label: 'STAT', bg: '1E3A8A', fg: 'FFFFFF' },
        { col: COL_GANG, label: 'GANG', bg: '1E3A8A', fg: 'FFFFFF' },
        { col: COL_KAT, label: 'KAT TER', bg: '1E3A8A', fg: 'FFFFFF' },
        { col: COL_HK, label: 'HK', bg: 'F1F5F9', fg: '0F172A' },
        { col: COL_UPAH_DASAR, label: 'UPAH DASAR', bg: 'F1F5F9', fg: '0F172A' },
        { col: COL_GAJI_STANDAR, label: 'GAJI STANDAR\n(×30)', bg: 'F1F5F9', fg: '0F172A' },
        { col: COL_GP_IDEAL, label: 'GP IDEAL\n(×HK)', bg: 'F1F5F9', fg: '0F172A' },
        { col: COL_GP_AKTUAL, label: 'GP AKTUAL', bg: 'F1F5F9', fg: '0F172A' },
        { col: COL_KOREKSI, label: 'KOREKSI\n(Aktual-Ideal)', bg: 'F1F5F9', fg: '0F172A' },
        { col: COL_BERAS, label: 'BERAS', bg: 'E2E8F0', fg: '0F172A' },
        { col: COL_JABATAN, label: 'JABATAN', bg: 'E2E8F0', fg: '0F172A' },
        { col: COL_MASA_KERJA, label: 'M KERJA', bg: 'E2E8F0', fg: '0F172A' },
        { col: COL_LEMBUR, label: 'LEMBUR', bg: 'E2E8F0', fg: '0F172A' },
        { col: COL_TOTAL_TUNJ, label: 'TOTAL TUNJ\n(SUM Tunjangan)', bg: 'E2E8F0', fg: '0F172A' },
    ];

    // Dynamic premi sub-headers
    for (let i = 0; i < allPremiKeys.length; i++) {
        subHeaders.push({ col: COL_PREMI_START + i, label: allPremiKeys[i], bg: 'CBD5E1', fg: '0F172A' });
    }
    subHeaders.push({ col: COL_TOTAL_PREMI, label: 'TOTAL PREMI\n(SUM Premi)', bg: 'CBD5E1', fg: '0F172A' });
    subHeaders.push({ col: COL_POT_KOREKSI, label: 'POT KOREKSI', bg: 'FCA5A5', fg: '0F172A' });
    subHeaders.push({ col: COL_THR, label: 'THR', bg: 'FEF3C7', fg: '0F172A' });
    subHeaders.push({ col: COL_EXGRATIA, label: 'EXGRATIA', bg: 'FEF3C7', fg: '0F172A' });
    subHeaders.push({ col: COL_BPJS_KES, label: `BPJS KES\n${(CARUMAN_RATES.BPJS_KES_MAJIKAN * 100).toFixed(0)}%\n(×GPStandar+MK)`, bg: 'F1F5F9', fg: '0F172A' });
    subHeaders.push({ col: COL_ASTEK, label: `ASTEK\n${(CARUMAN_RATES.ASTEK_MAJIKAN_JKK_JKM * 100).toFixed(2)}%\n(×GPStandar+MK)`, bg: 'F1F5F9', fg: '0F172A' });
    subHeaders.push({ col: COL_UPAH_KOTOR, label: 'UPAH KOTOR\n(Aktual+Tunj+Premi-Pot)', bg: '0F172A', fg: 'FFFFFF' });
    subHeaders.push({ col: COL_BRUTO, label: 'PENGHASILAN\nBRUTO\n(+BPJS+THR+Exgratia)', bg: '0F172A', fg: 'FFFFFF' });
    subHeaders.push({ col: COL_TARIF_TER, label: 'TARIF TER (%)', bg: '0F172A', fg: 'FFFFFF' });
    subHeaders.push({ col: COL_PPH21, label: 'PPH21\n(ROUND Bruto×Tarif)', bg: '0F172A', fg: 'FFFFFF' });

    subHeaders.forEach(({ col, label, bg, fg }) => {
        const cell = sheet.getCell(4, col);
        cell.value = label;
        applyHeaderStyle(cell, bg, fg);
    });
    sheet.getRow(4).height = 45;

    // ─────────────────────────────────────────────────────────
    // Data rows (row 5 onwards)
    // ─────────────────────────────────────────────────────────
    const numFormat = '#,##0';
    const DATA_START = 5;
    let currentRowIndex = DATA_START;

    data.employees.forEach((emp) => {
        const row = sheet.getRow(currentRowIndex);
        const r = currentRowIndex;

        // Identity
        row.getCell(COL_NO).value = emp.no || (currentRowIndex - DATA_START + 1);
        row.getCell(COL_NAMA).value = emp.emp_name;
        row.getCell(COL_NIK).value = emp.nik || '';
        row.getCell(COL_GENDER).value = emp.gender;
        row.getCell(COL_STAT).value = emp.status_ptkp;
        row.getCell(COL_GANG).value = emp.gang_code;
        row.getCell(COL_KAT).value = emp.kategori_ter;

        // Struktur Upah
        row.getCell(COL_HK).value = emp.hk || 0;
        row.getCell(COL_UPAH_DASAR).value = emp.upah_dasar || 0;

        // Gaji Standar = Upah Dasar × 30
        const lUD = L(COL_UPAH_DASAR);
        const lHK = L(COL_HK);
        const lGS = L(COL_GAJI_STANDAR);
        const lGI = L(COL_GP_IDEAL);
        const lGA = L(COL_GP_AKTUAL);
        const lKor = L(COL_KOREKSI);
        const lBeras = L(COL_BERAS);
        const lJab = L(COL_JABATAN);
        const lMK = L(COL_MASA_KERJA);
        const lLem = L(COL_LEMBUR);
        const lTunj = L(COL_TOTAL_TUNJ);
        const lTotalPremi = L(COL_TOTAL_PREMI);
        const lPremiStart = L(COL_PREMI_START);
        const lPremiEnd = L(COL_PREMI_END);
        const lPotKor = L(COL_POT_KOREKSI);
        const lTHR = L(COL_THR);
        const lExg = L(COL_EXGRATIA);
        const lBpjs = L(COL_BPJS_KES);
        const lAstek = L(COL_ASTEK);
        const lUK = L(COL_UPAH_KOTOR);
        const lBruto = L(COL_BRUTO);
        const lTarif = L(COL_TARIF_TER);
        const lPph = L(COL_PPH21);

        row.getCell(COL_GAJI_STANDAR).value = { formula: `${lUD}${r}*30`, result: (emp.upah_dasar || 0) * 30 };
        row.getCell(COL_GP_IDEAL).value = { formula: `${lUD}${r}*${lHK}${r}`, result: emp.gaji_pokok_ideal || 0 };
        row.getCell(COL_GP_AKTUAL).value = emp.gaji_pokok_aktual || 0;
        row.getCell(COL_KOREKSI).value = { formula: `${lGA}${r}-${lGI}${r}`, result: emp.koreksi_hk || 0 };

        // Tunjangan
        row.getCell(COL_BERAS).value = emp.tunjangan_beras || 0;
        row.getCell(COL_JABATAN).value = emp.tunjangan_jabatan || 0;
        row.getCell(COL_MASA_KERJA).value = emp.tunjangan_masa_kerja || 0;
        row.getCell(COL_LEMBUR).value = emp.tunjangan_lembur || 0;
        // Total Tunjangan = SUM(Beras:Lembur)
        row.getCell(COL_TOTAL_TUNJ).value = {
            formula: `SUM(${lBeras}${r}:${lLem}${r})`,
            result: emp.total_tunjangan || 0
        };

        // Dynamic Premi columns
        let totalPremiResult = 0;
        for (let i = 0; i < allPremiKeys.length; i++) {
            const colIdx = COL_PREMI_START + i;
            const keyName = allPremiKeys[i];
            const val = (emp.premi_detail && emp.premi_detail[keyName]) ? emp.premi_detail[keyName] : 0;
            row.getCell(colIdx).value = val;
            totalPremiResult += val;
        }

        // Total Premi = SUM(premi range)
        if (COL_PREMI_START === COL_PREMI_END) {
            row.getCell(COL_TOTAL_PREMI).value = {
                formula: `${lPremiStart}${r}`,
                result: emp.total_premi || 0
            };
        } else {
            row.getCell(COL_TOTAL_PREMI).value = {
                formula: `SUM(${lPremiStart}${r}:${lPremiEnd}${r})`,
                result: emp.total_premi || 0
            };
        }

        // Potongan Koreksi
        row.getCell(COL_POT_KOREKSI).value = emp.pot_koreksi || 0;

        // Pendapatan Lainnya
        row.getCell(COL_THR).value = emp.thr_amount || 0;
        row.getCell(COL_EXGRATIA).value = emp.exgratia_amount || 0;

        // Jaminan Majikan (based on Gaji Standar + Masa Kerja)
        // BPJS Kes Majikan = ROUND((GPStandar + MasaKerja) × 4%, 0)
        row.getCell(COL_BPJS_KES).value = {
            formula: `ROUND((${lGS}${r}+${lMK}${r})*${CARUMAN_RATES.BPJS_KES_MAJIKAN},0)`,
            result: emp.bpjs_kes_majikan || 0
        };
        // ASTEK = ROUND((GPStandar + MasaKerja) × 0.84%, 0)
        row.getCell(COL_ASTEK).value = {
            formula: `ROUND((${lGS}${r}+${lMK}${r})*${CARUMAN_RATES.ASTEK_MAJIKAN_JKK_JKM},0)`,
            result: emp.astek_jht_majikan || 0
        };

        // UPAH KOTOR = GP Aktual + Total Tunj + Total Premi - Pot Koreksi
        row.getCell(COL_UPAH_KOTOR).value = {
            formula: `${lGA}${r}+${lTunj}${r}+${lTotalPremi}${r}-${lPotKor}${r}`,
            result: emp.upah_kotor || 0
        };

        // PENGHASILAN BRUTO = Upah Kotor + BPJS + ASTEK + THR + Exgratia
        row.getCell(COL_BRUTO).value = {
            formula: `${lUK}${r}+${lBpjs}${r}+${lAstek}${r}+${lTHR}${r}+${lExg}${r}`,
            result: emp.penghasilan_bruto || 0
        };

        // TER Rate (percentage format)
        row.getCell(COL_TARIF_TER).value = (emp.tarif_pajak_ter || 0) / 100;
        row.getCell(COL_TARIF_TER).numFmt = '0.00%';

        // PPH21 = ROUND(Bruto × Tarif TER, 0)
        row.getCell(COL_PPH21).value = {
            formula: `ROUND(${lBruto}${r}*${lTarif}${r},0)`,
            result: emp.pph21_ter || 0
        };

        // Apply number formats
        for (let c = COL_HK; c <= TOTAL_COLS; c++) {
            if (c !== COL_TARIF_TER) row.getCell(c).numFmt = numFormat;
        }
        // Text columns
        [COL_GENDER, COL_STAT, COL_GANG, COL_KAT].forEach(c => {
            row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
        });

        // Borders
        for (let c = 1; c <= TOTAL_COLS; c++) {
            row.getCell(c).border = {
                top: { style: 'thin' }, left: { style: 'thin' },
                bottom: { style: 'thin' }, right: { style: 'thin' }
            };
        }

        currentRowIndex++;
    });

    // ─────────────────────────────────────────────────────────
    // Footer: Grand Total row
    // ─────────────────────────────────────────────────────────
    const footerRow = sheet.getRow(currentRowIndex);
    sheet.mergeCells(`A${currentRowIndex}:${L(COL_KAT)}${currentRowIndex}`);
    footerRow.getCell(1).value = 'GRAND TOTAL';
    footerRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
    footerRow.getCell(1).font = { bold: true };

    const numericCols = [
        COL_HK, COL_UPAH_DASAR, COL_GAJI_STANDAR, COL_GP_IDEAL, COL_GP_AKTUAL, COL_KOREKSI,
        COL_BERAS, COL_JABATAN, COL_MASA_KERJA, COL_LEMBUR, COL_TOTAL_TUNJ,
        ...Array.from({ length: allPremiKeys.length }, (_, i) => COL_PREMI_START + i),
        COL_TOTAL_PREMI, COL_POT_KOREKSI, COL_THR, COL_EXGRATIA,
        COL_BPJS_KES, COL_ASTEK, COL_UPAH_KOTOR, COL_BRUTO, COL_PPH21
    ];

    numericCols.forEach(c => {
        const cell = footerRow.getCell(c);
        cell.value = { formula: `SUM(${L(c)}${DATA_START}:${L(c)}${currentRowIndex - 1})` };
        cell.numFmt = numFormat;
        cell.font = { bold: true };
    });

    for (let c = 1; c <= TOTAL_COLS; c++) {
        footerRow.getCell(c).border = {
            top: { style: 'medium' }, left: { style: 'thin' },
            bottom: { style: 'medium' }, right: { style: 'thin' }
        };
        footerRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
    }

    currentRowIndex += 3;

    // ─────────────────────────────────────────────────────────
    // Signature block
    // ─────────────────────────────────────────────────────────
    const ttdStartRow = currentRowIndex;
    const ttdEndRow = ttdStartRow + 5;

    const sigCols = [
        { label: 'Dibuat Oleh:', title: 'Admin HR / Payroll', col: L(COL_NAMA) },
        { label: 'Diperiksa Oleh:', title: 'HR Manager', col: L(Math.floor(TOTAL_COLS / 2)) },
        { label: 'Disetujui Oleh:', title: 'General Manager', col: L(COL_UPAH_KOTOR) },
    ];

    sigCols.forEach(({ label, title, col }) => {
        const labelCell = sheet.getCell(`${col}${ttdStartRow}`);
        labelCell.value = label;
        labelCell.font = { bold: true };
        labelCell.alignment = { horizontal: 'center' };

        const nameCell = sheet.getCell(`${col}${ttdEndRow}`);
        nameCell.value = '(_____________________)';
        nameCell.alignment = { horizontal: 'center' };
        nameCell.font = { bold: true };

        const titleCell = sheet.getCell(`${col}${ttdEndRow + 1}`);
        titleCell.value = title;
        titleCell.alignment = { horizontal: 'center' };
    });

    // ─────────────────────────────────────────────────────────
    // SHEET 2: RINCIAN PREMI YANG DIPERHITUNGKAN DALAM PPH21
    // ─────────────────────────────────────────────────────────
    const summarySheetName = 'Rincian Premi';
    const summarySheet = workbook.addWorksheet(summarySheetName);

    // Header
    summarySheet.mergeCells('A1:E1');
    const summaryTitleCell = summarySheet.getCell('A1');
    summaryTitleCell.value = `DAFTAR LENGKAP PREMI YANG DIPERHITUNGKAN DALAM PPh21`;
    summaryTitleCell.font = { size: 14, bold: true, name: 'Arial', color: { argb: '1E3A8A' } };
    summaryTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    summarySheet.mergeCells('A2:E2');
    const summaryPeriodCell = summarySheet.getCell('A2');
    summaryPeriodCell.value = `DIVISI: ${division} | GANG: ${gang || 'ALL'} | PERIODE: ${month}/${year}`;
    summaryPeriodCell.font = { size: 11, bold: true, name: 'Arial' };
    summaryPeriodCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Empty row
    summarySheet.getRow(3).height = 15;

    // Column headers
    const summaryHeaders = [
        { col: 1, label: 'NO', width: 6 },
        { col: 2, label: 'JENIS PREMI', width: 35 },
        { col: 3, label: 'JUMLAH KARYAWAN', width: 18 },
        { col: 4, label: 'TOTAL (Rp)', width: 20 },
        { col: 5, label: 'RATA-RATA/KARYAWAN (Rp)', width: 22 }
    ];

    summarySheet.columns = summaryHeaders.map(h => ({ key: `col${h.col}`, width: h.width }));

    const headerRow = summarySheet.getRow(4);
    summaryHeaders.forEach(h => {
        const cell = headerRow.getCell(h.col);
        cell.value = h.label;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } };
        cell.font = { color: { argb: 'FFFFFF' }, bold: true, size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    headerRow.height = 30;

    // Data rows
    let summaryRowIdx = 5;
    let grandTotalPremi = 0;
    const totalEmployees = data.employees.length;

    allPremiKeys.forEach((key, idx) => {
        const row = summarySheet.getRow(summaryRowIdx);
        const summary = premiSummary[key];

        row.getCell(1).value = idx + 1;
        row.getCell(2).value = key;
        row.getCell(3).value = summary.karyawan;
        row.getCell(4).value = summary.jumlah;

        const avg = summary.karyawan > 0 ? summary.jumlah / summary.karyawan : 0;
        row.getCell(5).value = avg;

        // Format numbers
        row.getCell(3).numFmt = '#,##0';
        row.getCell(4).numFmt = '#,##0';
        row.getCell(5).numFmt = '#,##0';

        // Style
        for (let c = 1; c <= 5; c++) {
            const cell = row.getCell(c);
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { vertical: 'middle', horizontal: c === 2 ? 'left' : 'right' };
        }

        grandTotalPremi += summary.jumlah;
        summaryRowIdx++;
    });

    // Total row
    const totalRow = summarySheet.getRow(summaryRowIdx);
    totalRow.getCell(1).value = '';
    totalRow.getCell(2).value = 'GRAND TOTAL';
    totalRow.getCell(3).value = totalEmployees;
    totalRow.getCell(4).value = grandTotalPremi;
    totalRow.getCell(5).value = { formula: `D${summaryRowIdx}/C${summaryRowIdx}` };

    for (let c = 1; c <= 5; c++) {
        const cell = totalRow.getCell(c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1E7DD' } };
        cell.font = { bold: true, color: { argb: '0F5132' } };
        cell.border = { top: { style: 'medium' }, left: { style: 'thin' }, bottom: { style: 'medium' }, right: { style: 'thin' } };
        cell.alignment = { vertical: 'middle', horizontal: c === 2 ? 'left' : 'right' };
        cell.numFmt = c >= 3 ? '#,##0' : 'General';
    }

    // Add note below table
    summaryRowIdx += 2;
    const noteRow1 = summarySheet.getRow(summaryRowIdx);
    noteRow1.getCell(1).value = 'CATATAN:';
    noteRow1.getCell(1).font = { bold: true };
    summarySheet.mergeCells(`A${summaryRowIdx}:E${summaryRowIdx}`);

    summaryRowIdx++;
    const noteRow2 = summarySheet.getRow(summaryRowIdx);
    noteRow2.getCell(1).value = '1. Premi di atas merupakan premi yang diperhitungkan dalam Penghasilan Bruto untuk perhitungan PPh21.';
    summarySheet.mergeCells(`A${summaryRowIdx}:E${summaryRowIdx}`);

    summaryRowIdx++;
    const noteRow3 = summarySheet.getRow(summaryRowIdx);
    noteRow3.getCell(1).value = '2. JUMLAH KARYAWAN = karyawan yang menerima premi tersebut (nilai > 0).';
    summarySheet.mergeCells(`A${summaryRowIdx}:E${summaryRowIdx}`);

    summaryRowIdx++;
    const noteRow4 = summarySheet.getRow(summaryRowIdx);
    noteRow4.getCell(1).value = '3. TOTAL PREMI dihitung dari semua karyawan (termasuk yang nilainya 0).';
    summarySheet.mergeCells(`A${summaryRowIdx}:E${summaryRowIdx}`);

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

    mainSheet.mergeCells('A1:AG1');
    const titleCell = mainSheet.getCell('A1');
    titleCell.value = `TABULASI PAJAK DESEMBER - DIVISI: ${division} | GANG: ${gang || 'ALL'} | TAHUN: ${year}`;
    titleCell.font = { size: 14, bold: true, name: 'Arial' };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Row 3: Main Group Headers
    mainSheet.getCell('A3').value = 'IDENTITAS'; mainSheet.mergeCells('A3:F3');
    applyHeaderStyle(mainSheet.getCell('A3'), '1E293B');
    mainSheet.getCell('G3').value = 'STATUS KARYAWAN'; mainSheet.mergeCells('G3:I3');
    applyHeaderStyle(mainSheet.getCell('G3'), '1E293B');
    mainSheet.getCell('J3').value = 'DESEMBER'; mainSheet.mergeCells('J3:N3');
    applyHeaderStyle(mainSheet.getCell('J3'), '1E3A8A');
    mainSheet.getCell('O3').value = 'PENGHASILAN TIDAK TERATUR'; mainSheet.mergeCells('O3:Q3');
    applyHeaderStyle(mainSheet.getCell('O3'), 'B45309');
    mainSheet.getCell('R3').value = 'DISETAHUNKAN'; mainSheet.mergeCells('R3:X3');
    applyHeaderStyle(mainSheet.getCell('R3'), '0284C7');
    mainSheet.getCell('Y3').value = 'PENGURANG'; mainSheet.mergeCells('Y3:AA3');
    applyHeaderStyle(mainSheet.getCell('Y3'), 'B91C1C');
    mainSheet.getCell('AB3').value = 'KALKULASI PAJAK'; mainSheet.mergeCells('AB3:AG3');
    applyHeaderStyle(mainSheet.getCell('AB3'), '15803D');

    // Row 4: Sub Headers
    const mainCols = [
        /* A */ { header: 'NO', width: 5 },
        /* B */ { header: 'NAMA KARYAWAN', width: 25 },
        /* C */ { header: 'NIK / PASPOR', width: 18 },
        /* D */ { header: 'NPWP', width: 20 },
        /* E */ { header: 'ALAMAT', width: 25 },
        /* F */ { header: 'JABATAN', width: 15 },
        /* G */ { header: 'L/P', width: 5 },
        /* H */ { header: 'PTKP', width: 8 },
        /* I */ { header: 'TER', width: 8 },
        /* J */ { header: 'Gaji Pokok', width: 15, group: 'blue' },
        /* K */ { header: 'Total Tunjangan', width: 15, group: 'blue' },
        /* L */ { header: 'Premi Asuransi\n(BPJS+Astek)', width: 15, group: 'blue' },
        /* M */ { header: 'Tunjangan PPh', width: 15, group: 'blue' },
        /* N */ { header: 'Ph. Bruto Des\n(J+K+L+M)', width: 15, group: 'blue' },
        /* O */ { header: 'THR', width: 15, group: 'orange' },
        /* P */ { header: 'BONUS', width: 15, group: 'orange' },
        /* Q */ { header: 'TANTIEM', width: 15, group: 'orange' },
        /* R */ { header: 'Total Gaji Pokok\n(Setahun)', width: 15, group: 'lightblue' },
        /* S */ { header: 'Total Tunj.\nLainnya', width: 15, group: 'lightblue' },
        /* T */ { header: 'Total Premi\nAsuransi', width: 18, group: 'lightblue' },
        /* U */ { header: 'Total Tunj.\nPPh', width: 15, group: 'lightblue' },
        /* V */ { header: 'Total Natura', width: 15, group: 'lightblue' },
        /* W */ { header: 'Total THR/\nBonus', width: 15, group: 'lightblue' },
        /* X */ { header: 'Ph. Bruto\nSetahun\n(R+S+T+U+V+W)', width: 18, group: 'lightblue' },
        /* Y */ { header: 'Biaya Jabatan\n(5%×X, max 6jt)', width: 15, group: 'red' },
        /* Z */ { header: 'Total Iuran\nJHT/JP', width: 18, group: 'red' },
        /* AA */ { header: 'Ph. Netto\nSetahun\n(X-Y-Z)', width: 18, group: 'red' },
        /* AB */ { header: 'PTKP', width: 15, group: 'green' },
        /* AC */ { header: 'PKP\n(AA-AB)', width: 15, group: 'green' },
        /* AD */ { header: 'PPh 21\nSetahun', width: 18, group: 'green' },
        /* AE */ { header: 'PPh 21\nNon NPWP', width: 18, group: 'green' },
        /* AF */ { header: 'PPh 21\nJan S.D Nop', width: 18, group: 'green' },
        /* AG */ { header: 'PPh 21\nDesember\n(AD-AF)', width: 18, group: 'green' },
    ];

    mainSheet.columns = mainCols.map((col, idx) => ({ key: `col${idx}`, width: col.width }));

    mainCols.forEach((col, index) => {
        const cell = mainSheet.getCell(4, index + 1);
        cell.value = col.header;
        let bgColor = 'F8FAFC';
        let fgColor = '0F172A';
        if (col.group === 'blue') { bgColor = '1E3A8A'; fgColor = 'FFFFFF'; }
        else if (col.group === 'orange') { bgColor = 'B45309'; fgColor = 'FFFFFF'; }
        else if (col.group === 'lightblue') { bgColor = '0284C7'; fgColor = 'FFFFFF'; }
        else if (col.group === 'red') { bgColor = 'B91C1C'; fgColor = 'FFFFFF'; }
        else if (col.group === 'green') { bgColor = '15803D'; fgColor = 'FFFFFF'; }
        applyHeaderStyle(cell, bgColor, fgColor);
    });
    mainSheet.getRow(4).height = 45;

    let mainRowIdx = 5;
    data.employees.forEach((emp) => {
        const row = mainSheet.getRow(mainRowIdx);
        const r = mainRowIdx;

        // Static data (cols A-I: 1-9)
        row.getCell(1).value = emp.no;
        row.getCell(2).value = emp.emp_name;
        row.getCell(3).value = emp.nik;
        row.getCell(4).value = emp.npwp;
        row.getCell(5).value = emp.alamat;
        row.getCell(6).value = emp.jabatan;
        row.getCell(7).value = emp.gender;
        row.getCell(8).value = emp.status_ptkp;
        row.getCell(9).value = emp.kategori_ter;

        // Desember (J-N: cols 10-14)
        row.getCell(10).value = emp.gaji_pokok_des;   // J: Gaji Pokok Des
        row.getCell(11).value = emp.tunjangan_des;     // K: Total Tunjangan Des
        row.getCell(12).value = emp.premi_asuransi_des; // L: Premi Asuransi Des
        row.getCell(13).value = emp.tunjangan_pph_des;  // M: Tunjangan PPh Des
        // N: Ph Bruto Des = J + K + L + M
        row.getCell(14).value = { formula: `J${r}+K${r}+L${r}+M${r}`, result: emp.bruto_des };

        // Pendapatan Tidak Teratur (O-Q: cols 15-17)
        row.getCell(15).value = emp.thr;      // O
        row.getCell(16).value = emp.bonus;    // P
        row.getCell(17).value = emp.tantiem;  // Q

        // Disetahunkan (R-X: cols 18-24)
        row.getCell(18).value = emp.gaji_pokok_setahun;        // R
        row.getCell(19).value = emp.tunjangan_lainnya_setahun; // S
        row.getCell(20).value = emp.premi_asuransi_setahun;    // T
        row.getCell(21).value = emp.tunjangan_pph_setahun;     // U
        row.getCell(22).value = emp.natura_setahun;            // V
        row.getCell(23).value = emp.thr_bonus_tantiem_setahun; // W
        // X: Ph Bruto Setahun = R+S+T+U+V+W
        row.getCell(24).value = { formula: `R${r}+S${r}+T${r}+U${r}+V${r}+W${r}`, result: emp.bruto_setahun };

        // Pengurang (Y-AA: cols 25-27)
        // Y: Biaya Jabatan = MIN(X*5%, 6000000)
        row.getCell(25).value = { formula: `MIN(X${r}*0.05,6000000)`, result: emp.biaya_jabatan };
        row.getCell(26).value = emp.iuran_jht_jp_setahun;  // Z
        // AA: Netto = X - Y - Z
        row.getCell(27).value = { formula: `X${r}-Y${r}-Z${r}`, result: emp.netto_setahun };

        // Kalkulasi Pajak (AB-AG: cols 28-33)
        row.getCell(28).value = emp.ptkp;           // AB
        // AC: PKP = AA - AB (min 0)
        row.getCell(29).value = { formula: `MAX(AA${r}-AB${r},0)`, result: emp.pkp };
        row.getCell(30).value = emp.pph21_setahun;  // AD
        // AE: PPh21 Non NPWP = AD × 120%
        row.getCell(31).value = { formula: `AD${r}*1.2`, result: emp.pph21_setahun };
        row.getCell(32).value = emp.pph21_jan_nov;  // AF
        // AG: PPh21 Desember = AD - AF
        row.getCell(33).value = { formula: `AD${r}-AF${r}`, result: emp.pph21_desember };

        // Number formats
        for (let c = 10; c <= 33; c++) {
            row.getCell(c).numFmt = numFormat;
        }

        // Borders
        for (let c = 1; c <= 33; c++) {
            row.getCell(c).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        }

        // Highlight December PPh21
        row.getCell(33).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1E7DD' } };
        row.getCell(33).font = { color: { argb: '0F5132' }, bold: true };

        mainRowIdx++;
    });

    // Main Sheet Grand Total
    const mainFooter = mainSheet.getRow(mainRowIdx);
    mainSheet.mergeCells(`A${mainRowIdx}:I${mainRowIdx}`);
    mainFooter.getCell('A').value = 'GRAND TOTAL';
    mainFooter.getCell('A').alignment = { horizontal: 'right', vertical: 'middle' };
    mainFooter.getCell('A').font = { bold: true };
    mainFooter.getCell('A').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };

    for (let c = 10; c <= 33; c++) {
        const cell = mainFooter.getCell(c);
        cell.value = { formula: `SUM(${mainSheet.getColumn(c).letter}5:${mainSheet.getColumn(c).letter}${mainRowIdx - 1})` };
        cell.numFmt = numFormat;
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
        cell.border = { top: { style: 'medium' }, left: { style: 'thin' }, bottom: { style: 'medium' }, right: { style: 'thin' } };
    }
    mainFooter.getCell(33).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1E7DD' } };
    mainFooter.getCell(33).font = { color: { argb: '0F5132' }, bold: true };

    // ==========================================
    // SHEET 2: LAMPIRAN URAIAN BULANAN
    // ==========================================
    const detailSheetName = `Uraian Bulanan_Des_${year}`;
    const detailSheet = workbook.addWorksheet(detailSheetName.substring(0, 31));

    const detailCols = [
        { header: 'NO', width: 5 }, { header: 'NAMA KARYAWAN', width: 25 }, { header: 'NIK', width: 15 },
        { header: 'KOMPONEN', width: 22 },
        { header: 'JAN', width: 12 }, { header: 'FEB', width: 12 }, { header: 'MAR', width: 12 },
        { header: 'APR', width: 12 }, { header: 'MEI', width: 12 }, { header: 'JUN', width: 12 },
        { header: 'JUL', width: 12 }, { header: 'AGU', width: 12 }, { header: 'SEP', width: 12 },
        { header: 'OKT', width: 12 }, { header: 'NOV', width: 12 }, { header: 'DES', width: 12 },
        { header: 'TOTAL SETAHUN\n(SUM Jan-Des)', width: 16 }
    ];
    detailSheet.columns = detailCols.map((col, idx) => ({ key: `col${idx}`, width: col.width }));

    detailSheet.getRow(1).height = 35;
    detailCols.forEach((col, index) => {
        const cell = detailSheet.getCell(1, index + 1);
        cell.value = col.header;
        applyHeaderStyle(cell, '1E293B', 'FFFFFF');
    });

    let detailRowIdx = 2;
    const components = [
        { key: 'gaji_pokok', label: '1. Gaji Pokok' },
        { key: 'tunjangan', label: '2. Tunjangan' },
        { key: 'premi_asuransi', label: '3. Premi Asuransi\n(BPJS Kes 4%+Astek 0.84%)' },
        { key: 'iuran_pensiun', label: '4. Iuran Pensiun' },
        { key: 'pph21', label: '5. PPh 21' }
    ];

    data.employees.forEach((emp, i) => {
        components.forEach((comp, cIdx) => {
            const row = detailSheet.getRow(detailRowIdx);

            if (cIdx === 0) {
                row.getCell(1).value = i + 1;
                row.getCell(2).value = emp.emp_name;
                row.getCell(3).value = emp.nik;
            }

            row.getCell(4).value = comp.label;

            let firstCellAddr = '';
            let lastCellAddr = '';

            for (let m = 1; m <= 12; m++) {
                const key = comp.key as keyof typeof emp.monthly_breakdown;
                const val = emp.monthly_breakdown?.[key]?.[String(m)] || 0;
                const cell = row.getCell(4 + m);
                cell.value = val;
                cell.numFmt = numFormat;
                if (m === 1) firstCellAddr = cell.address;
                if (m === 12) lastCellAddr = cell.address;
            }

            // Total Column with SUM formula
            const totalCell = row.getCell(17);
            if (firstCellAddr && lastCellAddr) {
                totalCell.value = { formula: `SUM(${firstCellAddr}:${lastCellAddr})` };
            }
            totalCell.numFmt = numFormat;
            totalCell.font = { bold: true };

            // Borders
            for (let colId = 1; colId <= 17; colId++) {
                row.getCell(colId).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            }

            if (i % 2 !== 0) {
                for (let colId = 1; colId <= 17; colId++) {
                    const c = row.getCell(colId);
                    if (!c.fill || (c.fill as any).fgColor === undefined) {
                        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
                    }
                }
            }

            detailRowIdx++;
        });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
};
