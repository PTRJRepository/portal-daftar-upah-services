import ExcelJS from 'exceljs';
import { CARUMAN_RATES, calculateAllCaruman } from './carumanDefinitions';

/**
 * Helper: convert 1-based column index to Excel letter(s)
 * e.g. 1→A, 26→Z, 27→AA
 */
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
 * Discover all unique premi key names from a list of employee records.
 * Scans emp.premi (an object) and also top-level premi_* fields.
 * Returns sorted array: BRONDOL first, then alpha, LAINNYA last.
 */
function discoverPremiKeys(records: any[]): string[] {
    const keys = new Set<string>();
    for (const emp of records) {
        // emp.premi is an object like { brondol: 100, pruning: 200 }
        if (emp.premi && typeof emp.premi === 'object') {
            for (const k of Object.keys(emp.premi)) {
                if (k !== 'koreksi') keys.add(k.toUpperCase());
            }
        }
        // Also scan top-level premi_* keys (from dataExtractor format)
        for (const k of Object.keys(emp)) {
            if (k.startsWith('premi_') && k !== 'premi_pph' && k !== 'premi_pph21' && Number(emp[k]) > 0) {
                const label = k.replace(/^premi_/, '').replace(/_/g, ' ').toUpperCase();
                keys.add(label);
            }
        }
    }
    return Array.from(keys).sort((a, b) => {
        if (a === 'BRONDOL') return -1;
        if (b === 'BRONDOL') return 1;
        if (a === 'LAINNYA') return 1;
        if (b === 'LAINNYA') return -1;
        return a.localeCompare(b);
    });
}

/**
 * Get the value of a premi key from an employee record
 */
function getPremiValue(emp: any, keyName: string): number {
    // First check emp.premi object (reportService format)
    if (emp.premi && typeof emp.premi === 'object') {
        const lower = keyName.toLowerCase();
        if (emp.premi[lower] !== undefined) return Number(emp.premi[lower]) || 0;
    }
    // Then check top-level premi_* field
    const fieldKey = 'premi_' + keyName.toLowerCase().replace(/\s+/g, '_');
    return Number(emp[fieldKey]) || 0;
}

/**
 * Generate a comprehensive Daftar Upah Excel file with:
 * - Dynamic premi columns (one per premi type)
 * - "Uraian Premi" section header
 * - Excel formulas embedded for all calculated values
 */
export async function generateDaftarUpahExcel(
    records: any[],
    month: number,
    year: number,
    division: string,
    gang: string
): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PT. Rebinmas Jaya - Auto Report System';
    workbook.created = new Date();

    const sheetName = `Daftar Upah ${division} ${month}_${year}`.substring(0, 31);
    const sheet = workbook.addWorksheet(sheetName);
    const numFormat = '#,##0';
    const L = colLetter;

    // ─────────────────────────────────────────────
    // Discover dynamic premi keys
    // ─────────────────────────────────────────────
    const allPremiKeys = discoverPremiKeys(records);
    if (allPremiKeys.length === 0) allPremiKeys.push('BRONDOL');

    // ─────────────────────────────────────────────
    // Column definitions (fixed + dynamic)
    // ─────────────────────────────────────────────
    // IDENTITAS
    const COL_NO = 1;
    const COL_NIK = 2;
    const COL_NAMA = 3;
    const COL_JABATAN = 4;

    // ABSENSI
    const COL_HK = 5;       // AN (Hari Normal/Kerja)
    const COL_CUTI = 6;
    const COL_SAKIT = 7;
    const COL_MINGGU = 8;
    const COL_NASIONAL = 9;
    const COL_JML_HK = 10;  // Jumlah HK (total)

    // GAJI POKOK
    const COL_GP_STANDAR = 11;  // Upah Dasar × 30
    const COL_GP_IDEAL = 12;    // Upah Dasar × JML_HK
    const COL_GP_AKTUAL = 13;   // Actual from DB

    // TUNJANGAN
    const COL_BERAS = 14;
    const COL_JABATAN_TUNJ = 15;
    const COL_MASA_KERJA = 16;
    const COL_LEMBUR = 17;
    const COL_TOTAL_TUNJ = 18;

    // PREMI (dynamic)
    const COL_PREMI_START = 19;
    const COL_PREMI_END = 18 + allPremiKeys.length;
    const COL_TOTAL_PREMI = COL_PREMI_END + 1;

    // POTONGAN (dynamic but track static ones too)
    const COL_POT_ASTEK = COL_TOTAL_PREMI + 1;
    const COL_POT_BPJS = COL_POT_ASTEK + 1;
    const COL_POT_SPSI = COL_POT_BPJS + 1;
    const COL_POT_PPH21 = COL_POT_SPSI + 1;
    const COL_TOTAL_POT = COL_POT_PPH21 + 1;

    // UPAH FINAL
    const COL_UPAH_KOTOR = COL_TOTAL_POT + 1;
    const COL_UPAH_BERSIH = COL_UPAH_KOTOR + 1;

    const TOTAL_COLS = COL_UPAH_BERSIH;

    // ─────────────────────────────────────────────
    // Column widths
    // ─────────────────────────────────────────────
    const widths: number[] = [];
    for (let i = 1; i <= TOTAL_COLS; i++) {
        if (i === COL_NO) widths.push(5);
        else if (i === COL_NIK) widths.push(18);
        else if (i === COL_NAMA) widths.push(25);
        else if (i === COL_JABATAN) widths.push(15);
        else if (i >= COL_GP_STANDAR && i <= COL_GP_AKTUAL) widths.push(16);
        else if (i >= COL_BERAS && i <= COL_TOTAL_TUNJ) widths.push(13);
        else if (i >= COL_PREMI_START && i <= COL_TOTAL_PREMI) widths.push(13);
        else if (i >= COL_POT_ASTEK && i <= COL_TOTAL_POT) widths.push(14);
        else if (i >= COL_UPAH_KOTOR) widths.push(16);
        else widths.push(10);
    }
    sheet.columns = widths.map((w, i) => ({ key: `col${i + 1}`, width: w }));

    // ─────────────────────────────────────────────
    // Style helpers
    // ─────────────────────────────────────────────
    const applyHeader = (cell: ExcelJS.Cell, bg: string, fg: string = 'FFFFFF') => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.font = { color: { argb: fg }, bold: true, size: 9, name: 'Arial' };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    };

    const applyBorder = (cell: ExcelJS.Cell) => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    };

    // ─────────────────────────────────────────────
    // ROW 1: Title
    // ─────────────────────────────────────────────
    const TITLE_ROW = 1;
    sheet.mergeCells(`A${TITLE_ROW}:${L(TOTAL_COLS)}${TITLE_ROW}`);
    const titleCell = sheet.getCell(`A${TITLE_ROW}`);
    titleCell.value = `DAFTAR UPAH - DIVISI: ${division} | GANG: ${gang || 'ALL'} | PERIODE: ${month}/${year}`;
    titleCell.font = { size: 14, bold: true, name: 'Arial' };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(TITLE_ROW).height = 30;

    // ─────────────────────────────────────────────
    // ROW 2: Subtitle (formula explanations)
    // ─────────────────────────────────────────────
    sheet.mergeCells(`A2:${L(TOTAL_COLS)}2`);
    const subtitleCell = sheet.getCell('A2');
    subtitleCell.value = `GP Standar=UpahDasar×30 | GP Ideal=UpahDasar×HK | Total Tunjangan=SUM(Beras,Jabatan,MasaKerja,Lembur) | Total Premi=SUM(Premi) | Upah Kotor=GP+Tunj+Premi | Upah Bersih=Kotor-Potongan | Base BPJS/Astek=(GP_Standar+MasaKerja)`;
    subtitleCell.font = { size: 8, italic: true, color: { argb: '6B7280' } };
    subtitleCell.alignment = { horizontal: 'center' };

    // ─────────────────────────────────────────────
    // ROW 3: Group headers
    // ─────────────────────────────────────────────
    const GROUP_ROW = 3;
    const mergeAndHeader = (startCol: number, endCol: number, label: string, bg: string, fg = 'FFFFFF') => {
        if (startCol === endCol) {
            const cell = sheet.getCell(GROUP_ROW, startCol);
            cell.value = label;
            applyHeader(cell, bg, fg);
        } else {
            sheet.mergeCells(GROUP_ROW, startCol, GROUP_ROW, endCol);
            const cell = sheet.getCell(GROUP_ROW, startCol);
            cell.value = label;
            applyHeader(cell, bg, fg);
        }
    };

    mergeAndHeader(COL_NO, COL_JABATAN, 'IDENTITAS', '1E3A8A');
    mergeAndHeader(COL_HK, COL_JML_HK, 'ABSENSI', '374151', 'FFFFFF');
    mergeAndHeader(COL_GP_STANDAR, COL_GP_AKTUAL, 'GAJI POKOK', '1D4ED8');
    mergeAndHeader(COL_BERAS, COL_TOTAL_TUNJ, 'TUNJANGAN', '047857');
    mergeAndHeader(COL_PREMI_START, COL_TOTAL_PREMI, 'Uraian Premi', '7C3AED');
    mergeAndHeader(COL_POT_ASTEK, COL_TOTAL_POT, 'POTONGAN', 'B91C1C');
    mergeAndHeader(COL_UPAH_KOTOR, COL_UPAH_BERSIH, 'UPAH', '0F172A');

    // ─────────────────────────────────────────────
    // ROW 4: Sub-headers
    // ─────────────────────────────────────────────
    const SUB_ROW = 4;
    const subHdrs: [number, string, string][] = [
        [COL_NO, 'NO', '1E3A8A'],
        [COL_NIK, 'NIK', '1E3A8A'],
        [COL_NAMA, 'NAMA KARYAWAN', '1E3A8A'],
        [COL_JABATAN, 'JABATAN', '1E3A8A'],
        [COL_HK, 'AN\n(Hari Kerja Normal)', '4B5563'],
        [COL_CUTI, 'CUTI', '4B5563'],
        [COL_SAKIT, 'SAKIT/HAID', '4B5563'],
        [COL_MINGGU, 'MINGGU', '4B5563'],
        [COL_NASIONAL, 'NASIONAL', '4B5563'],
        [COL_JML_HK, 'JUMLAH HK', '4B5563'],
        [COL_GP_STANDAR, 'GP STANDAR\n(UpahDasar×30)', '1D4ED8'],
        [COL_GP_IDEAL, 'GP IDEAL\n(UpahDasar×HK)', '1D4ED8'],
        [COL_GP_AKTUAL, 'GP AKTUAL', '1D4ED8'],
        [COL_BERAS, 'BERAS\n(BerasRate×HK)', '047857'],
        [COL_JABATAN_TUNJ, 'JABATAN', '047857'],
        [COL_MASA_KERJA, 'MASA KERJA', '047857'],
        [COL_LEMBUR, 'LEMBUR', '047857'],
        [COL_TOTAL_TUNJ, 'TOTAL\nTUNJANGAN', '047857'],
        ...allPremiKeys.map((k, i): [number, string, string] => [COL_PREMI_START + i, k, '7C3AED']),
        [COL_TOTAL_PREMI, 'TOTAL\nPREMI', '7C3AED'],
        [COL_POT_ASTEK, `ASTEK\n(${(CARUMAN_RATES.ASTEK_PEKERJA_JHT * 100).toFixed(0)}%×Base)`, 'B91C1C'],
        [COL_POT_BPJS, `BPJS KES\n(${(CARUMAN_RATES.BPJS_KES_PEKERJA * 100).toFixed(0)}%×Base)`, 'B91C1C'],
        [COL_POT_SPSI, 'SPSI', 'B91C1C'],
        [COL_POT_PPH21, 'PPH21', 'B91C1C'],
        [COL_TOTAL_POT, 'TOTAL\nPOTONGAN', 'B91C1C'],
        [COL_UPAH_KOTOR, 'UPAH KOTOR\n(GP+Tunj+Premi)', '0F172A'],
        [COL_UPAH_BERSIH, 'UPAH BERSIH\n(Kotor-Potongan)', '0F172A'],
    ];

    subHdrs.forEach(([col, label, bg]) => {
        const cell = sheet.getCell(SUB_ROW, col);
        cell.value = label;
        applyHeader(cell, bg);
    });
    sheet.getRow(SUB_ROW).height = 50;

    // ─────────────────────────────────────────────
    // Data rows (from row 5)
    // ─────────────────────────────────────────────
    const DATA_START = 5;
    let rowIdx = DATA_START;
    let empNo = 1;

    // Sort records by gang then NIK
    const sortedRecords = [...records].sort((a, b) => {
        const gangA = (a.gang_code || a.gang || '').toString();
        const gangB = (b.gang_code || b.gang || '').toString();
        if (gangA !== gangB) return gangA.localeCompare(gangB);
        return (String(a.nik || '')).localeCompare(String(b.nik || ''));
    });

    let currentGang = '';
    const gangStartRows: { gang: string; startRow: number; }[] = [];

    for (const emp of sortedRecords) {
        const gangCode = emp.gang_code || emp.gang || '';

        // Gang separator row
        if (gangCode !== currentGang) {
            if (currentGang !== '') {
                // Insert an empty separator
                rowIdx++;
            }
            currentGang = gangCode;
            gangStartRows.push({ gang: gangCode, startRow: rowIdx });

            // Gang header
            sheet.mergeCells(`A${rowIdx}:${L(TOTAL_COLS)}${rowIdx}`);
            const gh = sheet.getCell(`A${rowIdx}`);
            gh.value = `GANG: ${gangCode}`;
            gh.font = { bold: true, size: 11, color: { argb: '1E3A8A' } };
            gh.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DBEAFE' } };
            gh.alignment = { horizontal: 'left', vertical: 'middle' };
            sheet.getRow(rowIdx).height = 20;
            rowIdx++;
        }

        const r = rowIdx;
        const row = sheet.getRow(r);

        // Gather base values for formula calculation
        const upahDasar = Number(emp.upah_dasar || 0);
        const hk = Number(emp.jumlah_hk || emp.hk || 0);
        const lHK = L(COL_JML_HK);
        const lUD = L(COL_GP_STANDAR); // We'll use GP_STANDAR for Upah Dasar reference in formulas

        // Column letter shortcuts
        const lGS = L(COL_GP_STANDAR);
        const lGI = L(COL_GP_IDEAL);
        const lGA = L(COL_GP_AKTUAL);
        const lBeras = L(COL_BERAS);
        const lJabT = L(COL_JABATAN_TUNJ);
        const lMK = L(COL_MASA_KERJA);
        const lLem = L(COL_LEMBUR);
        const lTunj = L(COL_TOTAL_TUNJ);
        const lPremiStart = L(COL_PREMI_START);
        const lPremiEnd = L(COL_PREMI_END);
        const lTotalPremi = L(COL_TOTAL_PREMI);
        const lPotAstek = L(COL_POT_ASTEK);
        const lPotBpjs = L(COL_POT_BPJS);
        const lPotSpsi = L(COL_POT_SPSI);
        const lPotPph = L(COL_POT_PPH21);
        const lTotalPot = L(COL_TOTAL_POT);
        const lUK = L(COL_UPAH_KOTOR);
        const lUB = L(COL_UPAH_BERSIH);

        // Identity
        row.getCell(COL_NO).value = empNo++;
        row.getCell(COL_NIK).value = emp.nik || '';
        row.getCell(COL_NAMA).value = emp.nama || emp.emp_name || '';
        row.getCell(COL_JABATAN).value = emp.jabatan || emp.position || '';

        // Absensi  
        row.getCell(COL_HK).value = Number(emp.hari_kerja || emp.jumlah_hk || hk || 0);
        row.getCell(COL_CUTI).value = Number(emp.cuti_tahunan_hari || 0);
        row.getCell(COL_SAKIT).value = Number(emp.cuti_sakit_haid_hari || 0);
        row.getCell(COL_MINGGU).value = Number(emp.cuti_minggu_hari || 0);
        row.getCell(COL_NASIONAL).value = Number(emp.cuti_nasional_hari || 0);
        // Jumlah HK = HK normal field or sum calculation
        row.getCell(COL_JML_HK).value = hk;

        // Gaji Pokok
        // GP Standar = Upah Dasar × 30  (we put Upah Dasar value, then formula references itself)
        // Note: we store Upah Dasar as a separate hidden value by using a formula with literal
        const gpStandar = upahDasar * 30;
        const gpIdeal = upahDasar * hk;
        const gpAktual = Number(emp.gaji_pokok_aktual || emp.gaji_pokok || 0);

        row.getCell(COL_GP_STANDAR).value = { formula: `${upahDasar}*30`, result: gpStandar };
        row.getCell(COL_GP_IDEAL).value = { formula: `${upahDasar}*${lHK}${r}`, result: gpIdeal };
        row.getCell(COL_GP_AKTUAL).value = gpAktual;

        // Tunjangan
        const beras = Number(emp.beras_jumlah || 0);
        const jabatan = Number(emp.jabatan_jumlah || 0);
        const masaKerja = Number(emp.masa_kerja_jumlah || emp.masa_kerja_amount || 0);
        const lembur = Number(emp.lembur_jumlah || 0);
        const totalTunj = beras + jabatan + masaKerja + lembur;

        row.getCell(COL_BERAS).value = beras;
        row.getCell(COL_JABATAN_TUNJ).value = jabatan;
        row.getCell(COL_MASA_KERJA).value = masaKerja;
        row.getCell(COL_LEMBUR).value = lembur;
        row.getCell(COL_TOTAL_TUNJ).value = {
            formula: `SUM(${lBeras}${r}:${lLem}${r})`,
            result: totalTunj
        };

        // Premi (dynamic)
        let totalPremi = 0;
        for (let i = 0; i < allPremiKeys.length; i++) {
            const val = getPremiValue(emp, allPremiKeys[i]);
            row.getCell(COL_PREMI_START + i).value = val;
            totalPremi += val;
        }
        // Use emp.total_premi if available (more accurate)
        const totalPremiResult = Number(emp.total_premi || totalPremi || 0);
        if (COL_PREMI_START === COL_PREMI_END) {
            row.getCell(COL_TOTAL_PREMI).value = { formula: `${lPremiStart}${r}`, result: totalPremiResult };
        } else {
            row.getCell(COL_TOTAL_PREMI).value = {
                formula: `SUM(${lPremiStart}${r}:${lPremiEnd}${r})`,
                result: totalPremiResult
            };
        }

        // Potongan
        // ASTEK pekerja = ROUND((GP_Standar + Masa_Kerja) × 2%, 0)
        const carumanBase = gpStandar + masaKerja;
        const astekPek = Math.round(carumanBase * CARUMAN_RATES.ASTEK_PEKERJA_JHT);
        const bpjsKesPek = Math.round(carumanBase * CARUMAN_RATES.BPJS_KES_PEKERJA);
        const potSpsi = Number(emp.pot_spsi || 0);
        const potPph21 = Number(emp.pot_pph21 || 0);
        const totalPot = Number(emp.total_potongan_bersih || (astekPek + bpjsKesPek + potSpsi + potPph21));

        row.getCell(COL_POT_ASTEK).value = {
            formula: `ROUND((${lGS}${r}+${lMK}${r})*${CARUMAN_RATES.ASTEK_PEKERJA_JHT},0)`,
            result: astekPek
        };
        row.getCell(COL_POT_BPJS).value = {
            formula: `ROUND((${lGS}${r}+${lMK}${r})*${CARUMAN_RATES.BPJS_KES_PEKERJA},0)`,
            result: bpjsKesPek
        };
        row.getCell(COL_POT_SPSI).value = potSpsi;
        row.getCell(COL_POT_PPH21).value = potPph21;
        row.getCell(COL_TOTAL_POT).value = {
            formula: `SUM(${lPotAstek}${r}:${lPotPph}${r})`,
            result: totalPot
        };

        // Upah Kotor = GP_Aktual + Total_Tunjangan + Total_Premi
        const upahKotor = Number(emp.jumlah_upah_kotor || emp.upah_kotor || (gpAktual + totalTunj + totalPremiResult));
        row.getCell(COL_UPAH_KOTOR).value = {
            formula: `${lGA}${r}+${lTunj}${r}+${lTotalPremi}${r}`,
            result: upahKotor
        };

        // Upah Bersih = Upah Kotor - Total Potongan
        const upahBersih = Number(emp.upah_bersih || (upahKotor - totalPot));
        row.getCell(COL_UPAH_BERSIH).value = {
            formula: `${lUK}${r}-${lTotalPot}${r}`,
            result: upahBersih
        };

        // Number formats
        for (let c = COL_GP_STANDAR; c <= TOTAL_COLS; c++) {
            row.getCell(c).numFmt = numFormat;
        }
        // Integer for HK columns
        for (let c = COL_HK; c <= COL_JML_HK; c++) {
            row.getCell(c).numFmt = '0';
        }

        // Borders for all cells
        for (let c = 1; c <= TOTAL_COLS; c++) {
            applyBorder(row.getCell(c));
        }

        // Alternating row shading
        if ((empNo - 1) % 2 === 0) {
            for (let c = 1; c <= TOTAL_COLS; c++) {
                const cell = row.getCell(c);
                if (!(cell.fill as any)?.fgColor) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F9FAFB' } };
                }
            }
        }

        rowIdx++;
    }

    // ─────────────────────────────────────────────
    // Grand Total Row
    // ─────────────────────────────────────────────
    const totalRow = rowIdx;
    const footerRow = sheet.getRow(totalRow);
    sheet.mergeCells(`A${totalRow}:${L(COL_JML_HK)}${totalRow}`);
    footerRow.getCell(1).value = 'GRAND TOTAL';
    footerRow.getCell(1).font = { bold: true, size: 11 };
    footerRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };

    const sumCols = [
        COL_HK, COL_CUTI, COL_SAKIT, COL_MINGGU, COL_NASIONAL, COL_JML_HK,
        COL_GP_STANDAR, COL_GP_IDEAL, COL_GP_AKTUAL,
        COL_BERAS, COL_JABATAN_TUNJ, COL_MASA_KERJA, COL_LEMBUR, COL_TOTAL_TUNJ,
        ...Array.from({ length: allPremiKeys.length }, (_, i) => COL_PREMI_START + i),
        COL_TOTAL_PREMI,
        COL_POT_ASTEK, COL_POT_BPJS, COL_POT_SPSI, COL_POT_PPH21, COL_TOTAL_POT,
        COL_UPAH_KOTOR, COL_UPAH_BERSIH,
    ];

    sumCols.forEach(c => {
        const cell = footerRow.getCell(c);
        cell.value = { formula: `SUM(${L(c)}${DATA_START}:${L(c)}${totalRow - 1})` };
        cell.numFmt = numFormat;
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DBEAFE' } };
    });

    for (let c = 1; c <= TOTAL_COLS; c++) {
        footerRow.getCell(c).border = {
            top: { style: 'medium' }, left: { style: 'thin' },
            bottom: { style: 'medium' }, right: { style: 'thin' }
        };
    }

    // ─────────────────────────────────────────────
    // Signature block
    // ─────────────────────────────────────────────
    const ttdRow = totalRow + 3;
    const ttdEndRow = ttdRow + 5;
    const midCol = L(Math.ceil(TOTAL_COLS / 2));
    const lastCols = [L(COL_NAMA), midCol, L(COL_UPAH_BERSIH - 1)];
    const titles = ['Dibuat Oleh:', 'Diperiksa Oleh:', 'Disetujui Oleh:'];
    const roles = ['Admin HR / Payroll', 'HR Manager', 'General Manager'];

    lastCols.forEach((col, i) => {
        const lc = sheet.getCell(`${col}${ttdRow}`);
        lc.value = titles[i];
        lc.font = { bold: true };
        lc.alignment = { horizontal: 'center' };

        const nc = sheet.getCell(`${col}${ttdEndRow}`);
        nc.value = '(_____________________)';
        nc.font = { bold: true };
        nc.alignment = { horizontal: 'center' };

        const tc = sheet.getCell(`${col}${ttdEndRow + 1}`);
        tc.value = roles[i];
        tc.alignment = { horizontal: 'center' };
    });

    // ─────────────────────────────────────────────
    // Freeze panes at row 5 col 4 (after headers + identitas)
    // ─────────────────────────────────────────────
    sheet.views = [{ state: 'frozen', xSplit: 4, ySplit: 4 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}
