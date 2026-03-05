import * as ExcelJS from 'exceljs';
import { OtherIncomesService } from './otherIncomesService';

export class OtherIncomesExcelService {
    public static async generateExcel(year: number, month: number, divisionCode?: string, gangCode?: string, incomeType?: string): Promise<Buffer> {
        let incomes = await OtherIncomesService.getIncomesWithDetails(year, month, divisionCode, gangCode, incomeType);

        const isTHR = incomeType === 'THR';

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
        const headers = ['No', 'NIK', 'ID Karyawan', 'Nama Karyawan', 'Gang', 'Tipe', 'Deskripsi', 'Jumlah (Rp)', 'Masuk THP?', 'Kena Pajak?'];
        if (isTHR) {
            headers.push('Formula', 'Upah Dasar (Rp)', 'Tunj Beras (Rp)', 'Masa Kerja (Rp)', 'Lama Kerja (Thn)', 'Masa Kerja (Bulan)', 'Faktor Proporsi', 'HK');
        }
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
            { width: 15 }, // ID Karyawan
            { width: 30 }, // Nama Karyawan
            { width: 10 }, // Gang
            { width: 15 }, // Tipe
            { width: 30 }, // Deskripsi
            { width: 20 }, // Jumlah (Rp)
            { width: 15 }, // Masuk THP?
            { width: 15 }, // Kena Pajak?
        ];
        if (isTHR) {
            worksheet.columns = worksheet.columns.concat([
                { width: 40 }, // Formula
                { width: 15 }, // Upah Dasar
                { width: 15 }, // Tunj Beras
                { width: 15 }, // Masa Kerja (Rp)
                { width: 15 }, // Lama Kerja (Thn)
                { width: 15 }, // Masa Kerja (Bulan)
                { width: 15 }, // Faktor Proporsi
                { width: 10 }  // HK
            ]);
        }

        // Data
        incomes.forEach((income, idx) => {
            const rowNumber = idx + 5;
            const row = worksheet.getRow(rowNumber);

            row.getCell(1).value = idx + 1;
            row.getCell(2).value = income.nik || '';
            row.getCell(3).value = (income as any).emp_code || income.details?.variables?.EMP_CODE || '';
            row.getCell(4).value = income.emp_name || '';
            row.getCell(5).value = income.gang_code || '';
            row.getCell(6).value = income.income_type || '';
            row.getCell(7).value = income.income_name || '';

            const amountCell = row.getCell(8);
            amountCell.value = income.amount || 0;
            amountCell.numFmt = '#,##0.00; (#,##0.00); -';

            row.getCell(9).value = income.is_paid_in_thp ? 'Ya' : 'Tidak';
            row.getCell(10).value = income.is_taxable ? 'Ya' : 'Tidak';

            if (isTHR && income.details) {
                row.getCell(11).value = income.details.formula || '-';
                row.getCell(12).value = income.details.variables?.UPAH_DASAR || 0;
                row.getCell(13).value = income.details.variables?.BERAS_RATE || 0;
                row.getCell(14).value = income.details.variables?.MASA_KERJA_JUMLAH || 0;
                row.getCell(15).value = income.details.variables?.MASA_KERJA_TAHUN || 0;
                row.getCell(16).value = income.details.variables?.WORKING_MONTHS || 12;
                row.getCell(17).value = income.details.variables?.PROPORTION_FACTOR || "12/12";
                row.getCell(18).value = income.details.variables?.HK || 0;
            }

            // Apply borders to all data cells
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                if (colNumber <= (isTHR ? 18 : 10)) {
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
        return buffer as any as Buffer;
    }
}
