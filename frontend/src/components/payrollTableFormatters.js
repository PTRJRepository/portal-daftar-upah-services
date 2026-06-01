/**
 * payrollTableFormatters.js
 * Pure formatting helpers extracted from CustomPayrollTable.jsx
 * No React, no state, no side effects.
 */
import { toFinitePayrollNumber } from '../utils/payrollNumericValues';

export const formatNumber = (value) => {
    if (value === null || value === undefined) return '-';
    const n = Number(value);
    if (isNaN(n)) return '-';
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n));
};

export const formatDecimal = (value) => {
    if (value === null || value === undefined) return '-';
    const n = Number(value);
    if (isNaN(n)) return '-';
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);
};

export const NEGATIVE_TOTAL_DISPLAY_FIELDS = new Set([
    'potongan_upah_kotor_total',
    'total_potongan',
    'total_potongan_bersih'
]);

export const formatNegativeTotalNumber = (value) => {
    const n = Number(value) || 0;
    if (n === 0) return '-';
    return `-${formatNumber(Math.abs(n))}`;
};

export const toFiniteNumber = toFinitePayrollNumber;

export const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const clampNumber = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

export const formatSourceCompareValue = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak';
    const n = Number(value);
    if (!Number.isNaN(n) && String(value).trim() !== '') return formatNumber(n);
    return String(value);
};

export const normalizeFieldKey = (value) => String(value || '').trim().toLowerCase();
export const normalizeHeaderLabel = (value) => String(value || '').trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').toUpperCase();
export const normalizeValuePriorityMode = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'db_ptrj_only') return 'db_ptrj_only';
    return 'non_db_ptrj';
};

export const MANUAL_CELL_DELETE_MARKER = 'DELETE_CELL';
export const buildManualCellDeleteRemarks = (name) => `${name || 'MANUAL ADJUSTMENT'} | ${MANUAL_CELL_DELETE_MARKER} | 0`;
export const isManualCellDeleteEdit = (edit) => Boolean(edit?.delete_cell)
    || (Number(edit?.value || 0) === 0 && String(edit?.remarks || '').toUpperCase().includes(MANUAL_CELL_DELETE_MARKER));

export const parseMetadataObjectValue = (value) => {
    if (!value) return null;
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch { return null; }
};
