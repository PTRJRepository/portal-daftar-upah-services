import { describe, expect, it } from 'vitest';
import { buildDbPtrjCompareReport } from './payrollDbPtrjCompareReport';

describe('buildDbPtrjCompareReport', () => {
    it('returns mismatch rows with both active and db_ptrj values', () => {
        const report = buildDbPtrjCompareReport([
            { type: 'gang_header', gang_code: 'A1' },
            {
                type: 'employee',
                emp_code: 'A0001',
                nik: '1901',
                nama: 'BUDI',
                gang_code: 'A1',
                value_source_compare: {
                    pot_spsi: { active: 4000, db_ptrj: 400 },
                    jabatan_jumlah: { active: 0, db_ptrj: 0 }
                }
            }
        ]);

        expect(report.comparedCount).toBe(2);
        expect(report.matchCount).toBe(1);
        expect(report.mismatchCount).toBe(1);
        expect(report.mismatches).toEqual([
            {
                emp_code: 'A0001',
                nik: '1901',
                nama: 'BUDI',
                gang_code: 'A1',
                field: 'pot_spsi',
                label: 'SPSI',
                active: 4000,
                db_ptrj: 400,
                diff: 3600
            }
        ]);
    });

    it('treats numeric strings with the same value as matches', () => {
        const report = buildDbPtrjCompareReport([
            {
                type: 'employee',
                emp_code: 'A0002',
                nama: 'ANI',
                value_source_compare: {
                    masa_kerja_jumlah: { active: '4000', db_ptrj: 4000 }
                }
            }
        ]);

        expect(report.comparedCount).toBe(1);
        expect(report.matchCount).toBe(1);
        expect(report.mismatchCount).toBe(0);
        expect(report.mismatches).toEqual([]);
    });
});
