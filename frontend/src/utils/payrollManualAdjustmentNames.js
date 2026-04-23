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

  if (!adjustmentName || !fieldPrefix || !adjustmentType || !fieldSuffix || !nik || !gangCode) {
    return null;
  }

  return {
    fieldName: `${fieldPrefix}_${fieldSuffix}`,
    adjustmentType,
    adjustmentName,
    activeFieldBucket: groupLabel === 'PREMI' ? 'premi' : 'potongan',
    payload: {
      nik,
      emp_code: empCode,
      gang_code: gangCode,
      division_code: division,
      type: adjustmentType,
      name: adjustmentName,
    },
  };
}
