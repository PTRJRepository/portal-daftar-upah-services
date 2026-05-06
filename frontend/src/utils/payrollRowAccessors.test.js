import { describe, expect, it } from 'vitest';
import { buildEmployeeRowMap, buildPayslipEmployeeRowMap, buildSelectedEmployeeRowMap, getEmployeeRows, resolveJabatanRate, resolvePayslipEmployeeCodes } from './payrollRowAccessors';

const sampleRows = [
    { type: 'gang_header', gang_code: 'A1H' },
    { type: 'employee', emp_code: 'e001', nik: '1001', nama: 'Alpha' },
    { type: 'employee', emp_code: 'e002', nik: '1002', nama: 'Beta' },
    { type: 'gang_total', gang_code: 'A1H' },
    { type: 'employee', emp_code: 'e003', nik: '1003', nama: 'Gamma' }
];

describe('getEmployeeRows', () => {
    it('returns only employee rows from a mixed payroll row list', () => {
        expect(getEmployeeRows(sampleRows)).toEqual([
            { type: 'employee', emp_code: 'e001', nik: '1001', nama: 'Alpha' },
            { type: 'employee', emp_code: 'e002', nik: '1002', nama: 'Beta' },
            { type: 'employee', emp_code: 'e003', nik: '1003', nama: 'Gamma' }
        ]);
    });
});

describe('buildEmployeeRowMap', () => {
    it('builds an uppercase lookup map keyed by emp_code or nik', () => {
        expect(buildEmployeeRowMap(sampleRows)).toEqual({
            E001: { type: 'employee', emp_code: 'e001', nik: '1001', nama: 'Alpha' },
            E002: { type: 'employee', emp_code: 'e002', nik: '1002', nama: 'Beta' },
            E003: { type: 'employee', emp_code: 'e003', nik: '1003', nama: 'Gamma' }
        });
    });
});

describe('buildSelectedEmployeeRowMap', () => {
    it('keeps only selected employees without storing the whole table in parent state', () => {
        expect(buildSelectedEmployeeRowMap(sampleRows, ['e002', 'e003', 'missing'])).toEqual({
            E002: { type: 'employee', emp_code: 'e002', nik: '1002', nama: 'Beta' },
            E003: { type: 'employee', emp_code: 'e003', nik: '1003', nama: 'Gamma' }
        });
    });
});

describe('buildPayslipEmployeeRowMap', () => {
    it('uses the current edited display rows for selected payslip employees', () => {
        const rows = [
            { type: 'employee', emp_code: 'e001', gaji_pokok: 1000000, upah_bersih: 900000 },
            { type: 'employee', emp_code: 'e002', gaji_pokok: 2500000, upah_bersih: 2300000 },
            { type: 'gang_total', gaji_pokok: 3500000 }
        ];

        expect(buildPayslipEmployeeRowMap(rows, ['e002'])).toEqual({
            E002: { type: 'employee', emp_code: 'e002', gaji_pokok: 2500000, upah_bersih: 2300000 }
        });
    });

    it('falls back to all current display rows when printing all employees', () => {
        expect(buildPayslipEmployeeRowMap(sampleRows, [])).toEqual({
            E001: { type: 'employee', emp_code: 'e001', nik: '1001', nama: 'Alpha' },
            E002: { type: 'employee', emp_code: 'e002', nik: '1002', nama: 'Beta' },
            E003: { type: 'employee', emp_code: 'e003', nik: '1003', nama: 'Gamma' }
        });
    });
});

describe('resolvePayslipEmployeeCodes', () => {
    it('uses explicitly selected employees when present', () => {
        expect(resolvePayslipEmployeeCodes(['e002', 'e003'], sampleRows)).toEqual(['e002', 'e003']);
    });

    it('falls back to all displayed employee rows when nothing is selected', () => {
        expect(resolvePayslipEmployeeCodes([], sampleRows)).toEqual(['e001', 'e002', 'e003']);
    });

    it('deduplicates and prefers emp_code over nik for displayed rows', () => {
        expect(resolvePayslipEmployeeCodes([], [
            { type: 'employee', emp_code: 'e001', nik: '1001' },
            { type: 'employee', emp_code: 'e001', nik: '1001-duplicate' },
            { type: 'employee', emp_code: '', nik: '1002' },
            { type: 'gang_total', emp_code: 'total' }
        ])).toEqual(['e001', '1002']);
    });
});

describe('resolveJabatanRate', () => {
    it('uses existing jabatan_rate when available', () => {
        expect(resolveJabatanRate({
            jabatan_rate: 9000,
            jabatan_jumlah: 180000,
            jumlah_hk: 20
        })).toBe(9000);
    });

    it('calculates jabatan_rate from jabatan_jumlah / jumlah_hk when rate is missing', () => {
        expect(resolveJabatanRate({
            jabatan_rate: '',
            jabatan_jumlah: 180000,
            jumlah_hk: 20
        })).toBe(9000);
    });

    it('falls back to kehadiran when jumlah_hk is not present', () => {
        expect(resolveJabatanRate({
            jabatan_jumlah: 150000,
            kehadiran: 15
        })).toBe(10000);
    });

    it('returns null when attendance is missing or zero', () => {
        expect(resolveJabatanRate({
            jabatan_rate: null,
            jabatan_jumlah: 150000,
            jumlah_hk: 0
        })).toBeNull();
    });
});
