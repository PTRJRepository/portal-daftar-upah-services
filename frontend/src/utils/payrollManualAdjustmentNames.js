const CANONICAL_PREFIX = {
  PREMI: 'PREMI',
  'POTONGAN UPAH KOTOR': 'KOREKSI',
  'POTONGAN UPAH BERSIH': 'POTONGAN LAINNYA',
};

const FIELD_PREFIX_BY_GROUP = {
  PREMI: 'premi',
  'POTONGAN UPAH KOTOR': 'koreksi',
  'POTONGAN UPAH BERSIH': 'potongan_lainnya',
};

const TYPE_BY_GROUP = {
  PREMI: 'PREMI',
  'POTONGAN UPAH KOTOR': 'POTONGAN_KOTOR',
  'POTONGAN UPAH BERSIH': 'POTONGAN_BERSIH',
};

function escapeRegExp(input) {
  return String(input || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeCanonicalPrefix(name, canonicalPrefix) {
  if (!name || !canonicalPrefix) return '';
  return String(name)
    .replace(new RegExp(`^${escapeRegExp(canonicalPrefix)}(?:\\s+|$)`, 'i'), '')
    .trim();
}

function normalizeIdentity(input) {
  return String(input ?? '').trim();
}

export function sanitizeManualAdjustmentLabel(input) {
  return String(input || '')
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildCanonicalManualAdjustmentName(groupLabel, rawName) {
  const canonicalPrefix = CANONICAL_PREFIX[groupLabel];
  const cleanedName = sanitizeManualAdjustmentLabel(rawName).toUpperCase();

  if (!canonicalPrefix || !cleanedName) return '';

  const suffix = removeCanonicalPrefix(cleanedName, canonicalPrefix);
  if (!suffix) return canonicalPrefix;
  return `${canonicalPrefix} ${suffix}`.trim();
}

function toSnakeCase(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function buildPendingManualColumn({ groupLabel, rawName, division, firstEmployee }) {
  const canonicalPrefix = CANONICAL_PREFIX[groupLabel];
  const adjustmentName = buildCanonicalManualAdjustmentName(groupLabel, rawName);
  const fieldPrefix = FIELD_PREFIX_BY_GROUP[groupLabel];
  const adjustmentType = TYPE_BY_GROUP[groupLabel];
  const fieldSuffix = toSnakeCase(removeCanonicalPrefix(adjustmentName, canonicalPrefix));
  const nik = normalizeIdentity(firstEmployee?.nik);
  const gangCode = normalizeIdentity(firstEmployee?.gang_code);
  const empCode = normalizeIdentity(firstEmployee?.emp_code) || nik;
  const empName = normalizeIdentity(firstEmployee?.nama) || normalizeIdentity(firstEmployee?.emp_name);

  if (!adjustmentName || !fieldPrefix || !adjustmentType || !fieldSuffix || !nik || !gangCode) {
    return null;
  }

  const payload = {
    division_code: division,
    type: adjustmentType,
    name: adjustmentName,
  };

  if (nik) payload.nik = nik;
  if (empCode) payload.emp_code = empCode;
  if (empName) payload.emp_name = empName;
  if (gangCode) payload.gang_code = gangCode;

  return {
    fieldName: `${fieldPrefix}_${fieldSuffix}`,
    adjustmentType,
    adjustmentName,
    activeFieldBucket: groupLabel === 'PREMI' ? 'premi' : 'potongan',
    payload,
  };
}

function resolveColumnCode(column, key) {
  return normalizeIdentity(column?.[key]);
}

function buildPlaceholderRemarks(column) {
  const name = normalizeIdentity(column?.name);
  const adCode = resolveColumnCode(column, 'ad_code')
    || resolveColumnCode(column, 'base_task_code')
    || resolveColumnCode(column, 'task_code');
  const taskDesc = normalizeIdentity(column?.task_desc);
  const adCodePart = adCode ? `${adCode}${taskDesc ? ` - ${taskDesc}` : ''}` : 'MANUAL EDIT';

  return `${name} | ${adCodePart} | 0 | sync:MISS | match:MISMATCH | INIT_COLUMN`;
}

export function buildManualColumnPlaceholderPayload({ month, year, division, column }) {
  const empCode = normalizeIdentity(column?.emp_code) || normalizeIdentity(column?.nik);
  const nik = normalizeIdentity(column?.nik);
  const gangCode = normalizeIdentity(column?.gang_code);
  const adjustmentType = normalizeIdentity(column?.type);
  const adjustmentName = normalizeIdentity(column?.name);

  if (!month || !year || !empCode || !nik || !gangCode || !adjustmentType || !adjustmentName) {
    return null;
  }

  const adCode = resolveColumnCode(column, 'ad_code');
  const taskCode = resolveColumnCode(column, 'task_code');
  const baseTaskCode = resolveColumnCode(column, 'base_task_code');
  const taskDesc = normalizeIdentity(column?.task_desc);

  return {
    period_month: Number(month),
    period_year: Number(year),
    nik,
    emp_code: empCode,
    emp_name: normalizeIdentity(column?.emp_name) || null,
    gang_code: gangCode,
    division_code: division,
    adjustment_type: adjustmentType,
    adjustment_name: adjustmentName,
    amount: 0,
    remarks: normalizeIdentity(column?.remarks) || buildPlaceholderRemarks(column),
    ad_code: adCode || undefined,
    task_code: taskCode || undefined,
    base_task_code: baseTaskCode || undefined,
    task_desc: taskDesc || undefined,
  };
}
