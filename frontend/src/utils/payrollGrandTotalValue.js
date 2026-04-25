const NUMERIC_FIELD_PATTERN = /^(jumlah_|total_|pot_|premi_|lembur_|gaji_|upah_|beras_|jabatan_|masa_|koreksi_|penghasilan_|pph21_|tarif_|astek_|bpjs_|thr_|bonus_|exgratia_|pendapatan_|hari_kerja|kehadiran|taxable_)/;
const DEDUCTION_SUFFIX = '_pengurang';

export function isPayrollNumericField(field = '') {
  return NUMERIC_FIELD_PATTERN.test(field);
}

export function resolveGrandTotalSourceField(field = '') {
  if (field === 'total_pendapatan_lainnya_pengurang') {
    return 'total_pendapatan_lainnya';
  }

  if (field.endsWith(DEDUCTION_SUFFIX)) {
    return field.slice(0, -DEDUCTION_SUFFIX.length);
  }

  if (field.startsWith('taxable_')) {
    return field.replace(/^taxable_/, '');
  }

  return field;
}

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isEmployeeRow = (row) => {
  if (!row || typeof row !== 'object') return false;
  if (row.type === 'employee') return true;
  if (row.type === 'gang_header' || row.type === 'gang_total') return false;
  if (row.isHeader || row.isTotal) return false;
  return true;
};

export function resolveGrandTotalNumericValue({ grandTotal = {}, rows = [], field = '', preferRows = false }) {
  const sourceField = resolveGrandTotalSourceField(field);
  const employeeRows = Array.isArray(rows) ? rows.filter(isEmployeeRow) : [];

  if (preferRows && employeeRows.length > 0) {
    return Math.round(
      employeeRows.reduce((sum, row) => sum + Number(row[sourceField] || 0), 0)
    );
  }

  const direct = toNumberOrNull(grandTotal[field]);
  if (direct !== null) return direct;

  const aliased = toNumberOrNull(grandTotal[sourceField]);
  if (aliased !== null) return aliased;

  if (employeeRows.length === 0) return 0;

  return Math.round(
    employeeRows.reduce((sum, row) => sum + Number(row[sourceField] || 0), 0)
  );
}
