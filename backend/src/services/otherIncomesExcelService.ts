import * as ExcelJS from 'exceljs';
import { OtherIncomesService } from './otherIncomesService';

export class OtherIncomesExcelService {
    public static async generateExcel(year: number, month: number, divisionCode?: string, gangCode?: string, incomeType?: string): Promise<Buffer> {
        let incomes = await OtherIncomesService.getIncomes(year, month, divisionCode, gangCode);

        if (incomeType && incomeType !== 'TOTAL') {
            incomes = incomes.filter(inc => inc.income_type === incomeType);
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Other Incomes');

        // Title
        worksheet.mergeCells('A1', 'I1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = `Laporan Pendapatan Tidak Tetap (${incomeType && incomeType !== 'TOTAL' ? incomeType : 'Semua Tipe'}) - ${month}/${year}`;
        titleCell.font = { bold: true, size: 14 };
        titleCell.alignment = { horizontal: 'center' };

        if (divisionCode && divisionCode !== 'ALL') {
            worksheet.mergeCells('A2', 'I2');
            const subTitleCell = worksheet.getCell('A2');
            subTitleCell.value = `Divisi: ${divisionCode} | Gang: ${gangCode || 'Semua'}`;
            subTitleCell.alignment = { horizontal: 'center' };
        }

        // Headers
        const headerRow = worksheet.getRow(4);
        const headers = ['No', 'NIK', 'Nama Karyawan', 'Gang', 'Tipe', 'Deskripsi', 'Jumlah (Rp)', 'Masuk THP?', 'Kena Pajak?'];
        headerRow.values = headers;

        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4F81BD' }
            };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        // Set column widths
        worksheet.columns = [
            { width: 5 },  // No
            { width: 20 }, // NIK
            { width: 30 }, // Nama Karyawan
            { width: 10 }, // Gang
            { width: 15 }, // Tipe
            { width: 30 }, // Deskripsi
            { width: 20 }, // Jumlah (Rp)
            { width: 15 }, // Masuk THP?
            { width: 15 }  // Kena Pajak?
        ];

        // Data
        incomes.forEach((income, idx) => {
            const rowNumber = idx + 5;
            const row = worksheet.getRow(rowNumber);

            row.getCell(1).value = idx + 1;
            row.getCell(2).value = income.nik || '';
            row.getCell(3).value = income.emp_name || '';
            row.getCell(4).value = income.gang_code || '';
            row.getCell(5).value = income.income_type || '';
            row.getCell(6).value = income.income_name || '';

            const amountCell = row.getCell(7);
            amountCell.value = income.amount || 0;
            amountCell.numFmt = '#,##0.00; (#,##0.00); -';

            row.getCell(8).value = income.is_paid_in_thp ? 'Ya' : 'Tidak';
            row.getCell(9).value = income.is_taxable ? 'Ya' : 'Tidak';

            // Apply borders to all data cells
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                if (colNumber <= 9) {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                }
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        return buffer as Buffer;
    }
}
