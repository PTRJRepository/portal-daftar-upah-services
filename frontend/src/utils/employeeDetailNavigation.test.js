import { describe, expect, it, vi } from 'vitest';
import {
    buildEmployeeDetailPath,
    openEmployeeDetailPage,
    resolveEmployeeDetailIdentifier
} from './employeeDetailNavigation';

describe('employee detail navigation', () => {
    it('prefers Plantware emp_code over KTP nik', () => {
        expect(resolveEmployeeDetailIdentifier({
            emp_code: ' B001 ',
            nik: '1234567890123456'
        })).toEqual({
            empCode: 'B001',
            nik: '1234567890123456'
        });
    });

    it('builds detail path with explicit emp_code query param', () => {
        const path = buildEmployeeDetailPath({
            employeeData: { emp_code: 'B001', nik: '1234567890123456' },
            month: 4,
            year: 2026,
            division: 'INFRA',
            buildPath: (value) => `/upah${value}`
        });

        expect(path).toBe('/upah/employee/detail?emp_code=B001&nik=1234567890123456&month=4&year=2026&division=INFRA');
    });

    it('opens detail path and falls back to location href when popup is blocked', () => {
        const locationRef = { href: '' };
        const openFn = vi.fn(() => null);

        const path = openEmployeeDetailPage({
            employeeData: { emp_code: 'B001' },
            month: 4,
            year: 2026,
            division: 'PG1A',
            buildPath: (value) => value
        }, openFn, locationRef);

        expect(path).toBe('/employee/detail?emp_code=B001&month=4&year=2026&division=PG1A');
        expect(openFn).toHaveBeenCalledWith(path, '_blank', 'noopener,noreferrer');
        expect(locationRef.href).toBe(path);
    });
});
