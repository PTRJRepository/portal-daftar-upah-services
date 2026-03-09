import * as ExcelJS from 'exceljs';
import { OtherIncomesService } from './otherIncomesService';

export class OtherIncomesExcelService {
    public static async generateExcel(year: number, month: number, divisionCode?: string, gangCode?: string, incomeType?: string): Promise<Buffer> {
        throw new Error("Method not implemented. THR Excel uses generateBankListExcel.");
    }

    private static getAsistensi(gangCode: string): string {
        if (!gangCode) return "1";
        const gc = gangCode.trim().toUpperCase();
        if (gc.startsWith('K2')) return "1";
        const match = gc.match(/\d+/);
        return match ? match[0] : "1";
    }

    public static async generateBankListExcel(year: number, month: number, divisionCode?: string, gangCode?: string): Promise<Buffer> {
        let incomes = await OtherIncomesService.getIncomesWithDetails(year, month, divisionCode, gangCode, 'THR');

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Bank List THR');

        // Determine mode: single division or all divisions
        const isSingleDivision = !!divisionCode && divisionCode !== 'ALL';

        // Title & Header
        worksheet.mergeCells('A1', 'F1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = 'LIST PEMBAYARAN BANK - THR';
        titleCell.font = { bold: true, size: 14 };
        titleCell.alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2', 'F2');
        const subTitleCell = worksheet.getCell('A2');
        subTitleCell.value = `PERIODE: ${month}/${year} | UNIT: ${divisionCode || 'SEMUA'}`;
        subTitleCell.alignment = { horizontal: 'center' };

        const headerRow = worksheet.getRow(4);
        headerRow.values = ['NO', 'EMPCODE', 'NAMA REKENING', 'NO REKENING', 'BANK', 'JUMLAH (Rp)'];
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
            cell.alignment = { horizontal: 'center' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        worksheet.columns = [
            { width: 8 },  // NO
            { width: 15 }, // EMPCODE
            { width: 45 }, // NAMA REKENING
            { width: 25 }, // ACCOUNT
            { width: 12 }, // BANK
            { width: 20 }, // AMOUNT
        ];

        let currentRow = 5;
        let totalAll = 0;

        if (isSingleDivision) {
            // ===== SINGLE DIVISION MODE: Group by gang only, subtotal per gang =====
            const gangGrouped: Record<string, any[]> = {};
            incomes.forEach(item => {
                const gcode = item.gang_code || 'TANPA GANG';
                if (!gangGrouped[gcode]) gangGrouped[gcode] = [];
                gangGrouped[gcode].push(item);
            });

            const gangKeys = Object.keys(gangGrouped).sort();

            for (const gcode of gangKeys) {
                // Gang Header
                const gangHeaderRow = worksheet.getRow(currentRow++);
                gangHeaderRow.getCell(1).value = `GANG: ${gcode}`;
                gangHeaderRow.getCell(1).font = { bold: true };
                gangHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
                worksheet.mergeCells(`A${currentRow - 1}`, `F${currentRow - 1}`);

                const items = gangGrouped[gcode];
                let gangTotal = 0;

                items.forEach((item, idx) => {
                    const row = worksheet.getRow(currentRow++);
                    this.writeItemRow(row, item, idx);
                    gangTotal += Number(item.amount);
                    for (let i = 1; i <= 6; i++) {
                        row.getCell(i).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    }
                });

                // Gang Subtotal
                const gangSubRow = worksheet.getRow(currentRow++);
                gangSubRow.getCell(1).value = `SUBTOTAL GANG ${gcode} (${items.length} orang)`;
                gangSubRow.getCell(6).value = gangTotal;
                gangSubRow.getCell(6).numFmt = '#,##0';
                gangSubRow.font = { bold: true, italic: true };
                gangSubRow.getCell(1).alignment = { horizontal: 'right' };
                gangSubRow.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; });
                worksheet.mergeCells(`A${currentRow - 1}`, `E${currentRow - 1}`);
                totalAll += gangTotal;
            }
        } else {
            // ===== ALL DIVISIONS MODE: Group by division → gang, subtotals for both =====
            // Group: division_code → gang_code → items
            const divGrouped: Record<string, Record<string, any[]>> = {};
            incomes.forEach(item => {
                const divCode = item.division_code || 'TANPA DIVISI';
                const gcode = item.gang_code || 'TANPA GANG';
                if (!divGrouped[divCode]) divGrouped[divCode] = {};
                if (!divGrouped[divCode][gcode]) divGrouped[divCode][gcode] = [];
                divGrouped[divCode][gcode].push(item);
            });

            const divKeys = Object.keys(divGrouped).sort();

            for (const divKey of divKeys) {
                // Division Header
                const divHeaderRow = worksheet.getRow(currentRow++);
                divHeaderRow.getCell(1).value = `DIVISI: ${divKey}`;
                divHeaderRow.getCell(1).font = { bold: true, size: 12 };
                divHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D5DB' } };
                worksheet.mergeCells(`A${currentRow - 1}`, `F${currentRow - 1}`);

                const gangs = divGrouped[divKey];
                const gangKeys = Object.keys(gangs).sort();
                let divisionTotal = 0;
                let divisionCount = 0;

                for (const gcode of gangKeys) {
                    // Gang Header
                    const gangHeaderRow = worksheet.getRow(currentRow++);
                    gangHeaderRow.getCell(1).value = `  GANG: ${gcode}`;
                    gangHeaderRow.getCell(1).font = { bold: true };
                    gangHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                    worksheet.mergeCells(`A${currentRow - 1}`, `F${currentRow - 1}`);

                    const items = gangs[gcode];
                    let gangTotal = 0;

                    items.forEach((item, idx) => {
                        const row = worksheet.getRow(currentRow++);
                        this.writeItemRow(row, item, idx);
                        gangTotal += Number(item.amount);
                        for (let i = 1; i <= 6; i++) {
                            row.getCell(i).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                        }
                    });

                    // Gang Subtotal
                    const gangSubRow = worksheet.getRow(currentRow++);
                    gangSubRow.getCell(1).value = `SUBTOTAL GANG ${gcode} (${items.length} orang)`;
                    gangSubRow.getCell(6).value = gangTotal;
                    gangSubRow.getCell(6).numFmt = '#,##0';
                    gangSubRow.font = { bold: true, italic: true };
                    gangSubRow.getCell(1).alignment = { horizontal: 'right' };
                    worksheet.mergeCells(`A${currentRow - 1}`, `E${currentRow - 1}`);
                    divisionTotal += gangTotal;
                    divisionCount += items.length;
                }

                // Division Subtotal
                const divSubRow = worksheet.getRow(currentRow++);
                divSubRow.getCell(1).value = `SUBTOTAL DIVISI ${divKey} (${divisionCount} orang)`;
                divSubRow.getCell(6).value = divisionTotal;
                divSubRow.getCell(6).numFmt = '#,##0';
                divSubRow.font = { bold: true };
                divSubRow.getCell(1).alignment = { horizontal: 'right' };
                divSubRow.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; });
                worksheet.mergeCells(`A${currentRow - 1}`, `E${currentRow - 1}`);
                totalAll += divisionTotal;
            }
        }

        // Grand Total
        const totalRow = worksheet.getRow(currentRow++);
        totalRow.getCell(1).value = `TOTAL TRANSFER KESELURUHAN (${incomes.length} orang)`;
        totalRow.getCell(6).value = totalAll;
        totalRow.getCell(6).numFmt = '#,##0';
        totalRow.font = { bold: true };
        totalRow.getCell(1).alignment = { horizontal: 'right' };
        totalRow.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }; c.font = { color: { argb: 'FFFFFFFF' }, bold: true }; });
        worksheet.mergeCells(`A${currentRow - 1}`, `E${currentRow - 1}`);

        // Signatures
        currentRow += 2; // Add some empty rows before signature

        const titleSignRow = worksheet.getRow(currentRow++);
        titleSignRow.getCell(2).value = 'Dibuat Oleh,';
        titleSignRow.getCell(3).value = 'Diperiksa Oleh,';
        titleSignRow.getCell(4).value = 'Mengetahui,';
        titleSignRow.getCell(5).value = 'Disetujui Oleh,';

        [2, 3, 4, 5].forEach(col => {
            titleSignRow.getCell(col).alignment = { horizontal: 'center' };
            titleSignRow.getCell(col).font = { bold: true };
        });

        // Add 3 empty rows for signature space
        currentRow += 3;

        const spaceSignRow = worksheet.getRow(currentRow++);
        spaceSignRow.getCell(2).value = '( ...................................... )';
        spaceSignRow.getCell(3).value = '( ...................................... )';
        spaceSignRow.getCell(4).value = '( ...................................... )';
        spaceSignRow.getCell(5).value = '( ...................................... )';

        [2, 3, 4, 5].forEach(col => {
            spaceSignRow.getCell(col).alignment = { horizontal: 'center' };
            spaceSignRow.getCell(col).font = { bold: true };
        });

        const roleSignRow = worksheet.getRow(currentRow++);
        roleSignRow.getCell(2).value = 'KTU / Kerani';
        roleSignRow.getCell(3).value = 'Asisten';
        roleSignRow.getCell(4).value = 'Estate Manager';
        roleSignRow.getCell(5).value = 'Senior Manager';

        [2, 3, 4, 5].forEach(col => {
            roleSignRow.getCell(col).alignment = { horizontal: 'center' };
            roleSignRow.getCell(col).font = { size: 11, bold: true };
        });

        const buffer = await workbook.xlsx.writeBuffer();
        return buffer as any as Buffer;
    }

    /**
     * Helper: write a single employee item row
     */
    private static writeItemRow(row: ExcelJS.Row, item: any, idx: number) {
        row.getCell(1).value = idx + 1;
        const empCode = item.emp_code || item.details?.variables?.EMP_CODE || '-';
        const cleanedName = (item.emp_name || '').split('(')[0].trim();
        row.getCell(2).value = empCode;
        row.getCell(2).alignment = { horizontal: 'center' };
        row.getCell(3).value = cleanedName;
        // Validate bank_acc_no: must be numeric, min 5 digits, no dates
        const rawBankAccNo = (item.bank_acc_no || '').trim();
        const bankDigits = rawBankAccNo.replace(/[-\s]/g, '');
        const bankAccNo = rawBankAccNo && /^\d{5,}$/.test(bankDigits) ? rawBankAccNo : '-';
        row.getCell(4).value = bankAccNo;
        row.getCell(4).alignment = { horizontal: 'center' };
        const bankCode = item.bank_code && item.bank_code !== '0' ? item.bank_code : 'BRI';
        row.getCell(5).value = bankCode;
        row.getCell(5).alignment = { horizontal: 'center' };
        row.getCell(6).value = Number(item.amount);
        row.getCell(6).numFmt = '#,##0';
    }
}
