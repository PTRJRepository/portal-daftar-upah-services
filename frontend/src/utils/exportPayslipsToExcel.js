/**
 * exportPayslipsToExcel - Export payslip data to Excel format
 * Placeholder implementation - actual implementation needed
 */
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export async function exportPayslipsToExcel(payslipData, options = {}) {
  const { division, month, year, useHistory, snapshotVersion } = options;

  if (!payslipData || payslipData.length === 0) {
    throw new Error('No payslip data to export');
  }

  // Create workbook
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Payroll System';
  wb.created = new Date();

  const ws = wb.addWorksheet('Payslips');

  // Add header row
  ws.addRow([
    'No',
    'Employee Code',
    'Employee Name',
    'Division',
    'Gaji Pokok',
    'Tunjangan',
    'Upah Bruto',
    'Potongan',
    'Upah Netto',
    'Periode',
  ]);

  // Style header
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' },
  };
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Add data rows
  payslipData.forEach((payslip, index) => {
    ws.addRow([
      index + 1,
      payslip.emp_code || payslip.EmpCode || '',
      payslip.nama || payslip.Nama || payslip.emp_name || '',
      division || payslip.division || '',
      payslip.gaji_pokok || payslip.gaji_dasar || 0,
      payslip.tunjangan || payslip.tunjangan_jabatan || 0,
      payslip.upah_bruto || (payslip.gaji_pokok + (payslip.tunjangan || 0)),
      payslip.potongan || payslip.total_potongan || 0,
      payslip.upah_netto || payslip.gaji_bersih || 0,
      `${month}/${year}`,
    ]);
  });

  // Set column widths
  ws.columns = [
    { width: 5 },   // No
    { width: 15 },  // Employee Code
    { width: 25 },  // Employee Name
    { width: 10 },  // Division
    { width: 15 },  // Gaji Pokok
    { width: 15 },  // Tunjangan
    { width: 15 },  // Upah Bruto
    { width: 15 },  // Potongan
    { width: 15 },  // Upah Netto
    { width: 12 },  // Periode
  ];

  // Generate buffer and download
  const buffer = await wb.xlsx.writeBuffer();
  const filename = `Payslip_${division || 'ALL'}_${year}_${month}.xlsx`;
  saveAs(new Blob([buffer]), filename);

  return { success: true, filename, count: payslipData.length };
}
