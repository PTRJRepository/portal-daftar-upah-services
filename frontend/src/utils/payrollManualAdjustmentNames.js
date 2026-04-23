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
  return `${canonicalPrefix} ${cleanedName}`.trim();
}

function toSnakeCase(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function buildPendingManualColumn({ groupLabel, rawName, division, firstEmployee }) {
  const adjustmentName = buildCanonicalManualAdjustmentName(groupLabel, rawName);
  const fieldPrefix = FIELD_PREFIX_BY_GROUP[groupLabel];
  const adjustmentType = TYPE_BY_GROUP[groupLabel];
  const fieldSuffix = toSnakeCase(sanitizeManualAdjustmentLabel(rawName));

  if (!adjustmentName || !firstEmployee || !fieldPrefix || !adjustmentType || !fieldSuffix) {
    return null;
  }

  return {
    fieldName: `${fieldPrefix}_${fieldSuffix}`,
    adjustmentType,
    adjustmentName,
    activeFieldBucket: groupLabel === 'PREMI' ? 'premi' : 'potongan',
    payload: {
      nik: firstEmployee.nik,
      emp_code: firstEmployee.emp_code || firstEmployee.nik,
      gang_code: firstEmployee.gang_code,
      division_code: division,
      type: adjustmentType,
      name: adjustmentName,
    },
  };
}
