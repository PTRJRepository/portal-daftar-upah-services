import * as ExcelJS from 'exceljs';
import { OtherIncomesService } from './otherIncomesService';

export class OtherIncomesExcelService {
    public static async generateExcel(year: number, month: number, divisionCode?: string, gangCode?: string, incomeType?: string): Promise<Buffer> {
        // ... (existing code)
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

        // Grouping logic
        const groupedData: Record<string, Record<string, any[]>> = {};
        incomes.forEach(item => {
            const asistensi = this.getAsistensi(item.gang_code || '');
            const gcode = item.gang_code || 'TANPA GANG';
            if (!groupedData[asistensi]) groupedData[asistensi] = {};
            if (!groupedData[asistensi][gcode]) groupedData[asistensi][gcode] = [];
            groupedData[asistensi][gcode].push(item);
        });

        const asistensiKeys = Object.keys(groupedData).sort();

        // Title & Header
        worksheet.mergeCells('A1', 'E1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = 'LIST PEMBAYARAN BANK - THR';
        titleCell.font = { bold: true, size: 14 };
        titleCell.alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2', 'E2');
        const subTitleCell = worksheet.getCell('A2');
        subTitleCell.value = `PERIODE: ${month}/${year} | UNIT: ${divisionCode || 'SEMUA'}`;
        subTitleCell.alignment = { horizontal: 'center' };

        const headerRow = worksheet.getRow(4);
        headerRow.values = ['NO', 'NAMA KARYAWAN / NIK / EMPCODE', 'NO REKENING', 'BANK', 'JUMLAH (Rp)'];
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
            cell.alignment = { horizontal: 'center' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        worksheet.columns = [
            { width: 8 },  // NO
            { width: 45 }, // NAME
            { width: 25 }, // ACCOUNT
            { width: 12 }, // BANK
            { width: 20 }, // AMOUNT
        ];

        let currentRow = 5;
        let totalAll = 0;

        for (const asistensi of asistensiKeys) {
            // Asistensi Header
            const asistRow = worksheet.getRow(currentRow++);
            asistRow.getCell(1).value = `GROUP ASISTENSI: ${asistensi}`;
            asistRow.getCell(1).font = { bold: true };
            asistRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
            worksheet.mergeCells(`A${currentRow - 1}`, `E${currentRow - 1}`);

            const gangs = groupedData[asistensi];
            const gangKeys = Object.keys(gangs).sort();
            let asistensiTotal = 0;

            for (const gcode of gangKeys) {
                // Gang Header
                const gangHeaderRow = worksheet.getRow(currentRow++);
                gangHeaderRow.getCell(1).value = `GANG: ${gcode}`;
                gangHeaderRow.getCell(1).font = { bold: true };
                gangHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                worksheet.mergeCells(`A${currentRow - 1}`, `E${currentRow - 1}`);

                const items = gangs[gcode];
                let gangTotal = 0;

                items.forEach((item, idx) => {
                    const row = worksheet.getRow(currentRow++);
                    row.getCell(1).value = idx + 1;
                    const empCode = item.emp_code || item.details?.variables?.EMP_CODE || '-';
                    row.getCell(2).value = `${item.emp_name}\n${item.nik} | ${empCode}`;
                    row.getCell(2).alignment = { wrapText: true };
                    row.getCell(3).value = item.bank_acc_no || item.details?.variables?.BANK_ACC_NO || '-';
                    row.getCell(4).value = item.bank_code || item.details?.variables?.BANK_CODE || 'BRI';
                    row.getCell(5).value = Number(item.amount);
                    row.getCell(5).numFmt = '#,##0';
                    gangTotal += Number(item.amount);

                    for (let i = 1; i <= 5; i++) {
                        row.getCell(i).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    }
                });

                // Gang Subtotal
                const gangSubRow = worksheet.getRow(currentRow++);
                gangSubRow.getCell(1).value = `SUBTOTAL GANG ${gcode}`;
                gangSubRow.getCell(5).value = gangTotal;
                gangSubRow.getCell(5).numFmt = '#,##0';
                gangSubRow.font = { bold: true, italic: true };
                gangSubRow.getCell(1).alignment = { horizontal: 'right' };
                worksheet.mergeCells(`A${currentRow - 1}`, `D${currentRow - 1}`);
                asistensiTotal += gangTotal;
            }

            // Asistensi Subtotal
            const asistSubRow = worksheet.getRow(currentRow++);
            asistSubRow.getCell(1).value = `SUBTOTAL GROUP ${asistensi}`;
            asistSubRow.getCell(5).value = asistensiTotal;
            asistSubRow.getCell(5).numFmt = '#,##0';
            asistSubRow.font = { bold: true };
            asistSubRow.getCell(1).alignment = { horizontal: 'right' };
            asistSubRow.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; });
            worksheet.mergeCells(`A${currentRow - 1}`, `D${currentRow - 1}`);
            totalAll += asistensiTotal;
        }

        // Grand Total
        const totalRow = worksheet.getRow(currentRow++);
        totalRow.getCell(1).value = 'TOTAL TRANSFER KESELURUHAN';
        totalRow.getCell(5).value = totalAll;
        totalRow.getCell(5).numFmt = '#,##0';
        totalRow.font = { bold: true };
        totalRow.getCell(1).alignment = { horizontal: 'right' };
        totalRow.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }; c.font = { color: { argb: 'FFFFFFFF' }, bold: true }; });
        worksheet.mergeCells(`A${currentRow - 1}`, `D${currentRow - 1}`);

        const buffer = await workbook.xlsx.writeBuffer();
        return buffer as any as Buffer;
    }
}
