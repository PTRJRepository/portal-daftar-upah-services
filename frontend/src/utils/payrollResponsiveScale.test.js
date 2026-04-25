import { describe, expect, it } from 'vitest';
import {
    clampPayrollScale,
    getPayrollEffectiveScale,
    getPayrollResponsiveScaleForWidth
} from './payrollResponsiveScale';

describe('getPayrollResponsiveScaleForWidth', () => {
    it('maps desktop width bands to expected responsive scale', () => {
        expect(getPayrollResponsiveScaleForWidth(1200)).toBe(0.85);
        expect(getPayrollResponsiveScaleForWidth(1366)).toBe(0.9);
        expect(getPayrollResponsiveScaleForWidth(1600)).toBe(0.95);
        expect(getPayrollResponsiveScaleForWidth(1920)).toBe(1);
        expect(getPayrollResponsiveScaleForWidth(2560)).toBe(1);
    });

    it('uses the smallest desktop scale below 1200px', () => {
        expect(getPayrollResponsiveScaleForWidth(1199)).toBe(0.8);
        expect(getPayrollResponsiveScaleForWidth(0)).toBe(0.8);
    });
});

describe('clampPayrollScale', () => {
    it('clamps to min and max bounds', () => {
        expect(clampPayrollScale(0.4)).toBe(0.72);
        expect(clampPayrollScale(2.5)).toBe(1.2);
        expect(clampPayrollScale(1)).toBe(1);
    });
});

describe('getPayrollEffectiveScale', () => {
    it('combines responsive and manual scale with clamping', () => {
        expect(getPayrollEffectiveScale({ containerWidth: 1366, fontSize: 100 })).toBe(0.9);
        expect(getPayrollEffectiveScale({ containerWidth: 1366, fontSize: 120 })).toBe(1.08);
        expect(getPayrollEffectiveScale({ containerWidth: 1200, fontSize: 80 })).toBe(0.72);
        expect(getPayrollEffectiveScale({ containerWidth: 1920, fontSize: 150 })).toBe(1.2);
    });
});

