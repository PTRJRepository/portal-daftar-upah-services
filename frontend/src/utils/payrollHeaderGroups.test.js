import { describe, expect, it } from 'vitest';
import {
    PAYROLL_HEADER_GROUPS,
    getPayrollHeaderGroup,
    isPayrollGroupToggleable,
    normalizePayrollHeaderGroup
} from './payrollHeaderGroups';

describe('normalizePayrollHeaderGroup', () => {
    it('normalizes legacy aliases to canonical labels', () => {
        expect(normalizePayrollHeaderGroup('pot kotor')).toBe(PAYROLL_HEADER_GROUPS.POTONGAN_UPAH_KOTOR);
        expect(normalizePayrollHeaderGroup('POT BERSIH')).toBe(PAYROLL_HEADER_GROUPS.POTONGAN_UPAH_BERSIH);
        expect(normalizePayrollHeaderGroup('inc. lain')).toBe(PAYROLL_HEADER_GROUPS.PENDAPATAN_LAINNYA);
    });

    it('keeps canonical labels unchanged', () => {
        expect(normalizePayrollHeaderGroup('PAJAK')).toBe(PAYROLL_HEADER_GROUPS.PAJAK);
        expect(normalizePayrollHeaderGroup('PENGGAJIAN')).toBe(PAYROLL_HEADER_GROUPS.PENGGAJIAN);
    });

    it('returns null for unknown labels', () => {
        expect(normalizePayrollHeaderGroup('FOO')).toBeNull();
        expect(normalizePayrollHeaderGroup(null)).toBeNull();
    });
});

describe('getPayrollHeaderGroup', () => {
    it('maps header labels used in column definitions to the canonical top group', () => {
        expect(getPayrollHeaderGroup('POTONGAN UPAH KOTOR')).toBe(PAYROLL_HEADER_GROUPS.POTONGAN_UPAH_KOTOR);
        expect(getPayrollHeaderGroup('POT KOTOR')).toBe(PAYROLL_HEADER_GROUPS.POTONGAN_UPAH_KOTOR);
        expect(getPayrollHeaderGroup('PENDAPATAN LAINNYA')).toBe(PAYROLL_HEADER_GROUPS.PENDAPATAN_LAINNYA);
        expect(getPayrollHeaderGroup('INC. LAIN')).toBe(PAYROLL_HEADER_GROUPS.PENDAPATAN_LAINNYA);
    });
});

describe('isPayrollGroupToggleable', () => {
    it('keeps only pajak toggleable', () => {
        expect(isPayrollGroupToggleable('PAJAK')).toBe(true);
        expect(isPayrollGroupToggleable('ABSENSI')).toBe(false);
        expect(isPayrollGroupToggleable('TUNJANGAN')).toBe(false);
        expect(isPayrollGroupToggleable('PENDAPATAN LAINNYA')).toBe(false);
        expect(isPayrollGroupToggleable('PREMI')).toBe(false);
        expect(isPayrollGroupToggleable('POTONGAN UPAH BERSIH')).toBe(false);
    });

    it('does not treat identity columns as toggle groups', () => {
        expect(isPayrollGroupToggleable('IDENTITAS')).toBe(false);
    });
});
