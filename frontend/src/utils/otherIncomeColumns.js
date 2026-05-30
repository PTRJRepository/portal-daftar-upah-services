const TOTAL_OTHER_INCOME_FIELD = 'pendapatan_lainnya';
const MANUAL_KONTAN_FIELD = 'pendapatan_kontan';

const EDITABLE_OTHER_INCOME_CONFIG = {
  pendapatan_kontan: { type: 'KONTAN', name: 'KONTAN' },
  pendapatan_bonus: { type: 'BONUS', name: 'BONUS' },
  pendapatan_exgratia: { type: 'EXGRATIA', name: 'EXGRATIA' },
};

export function getOtherIncomeDetailFields(activeFields = [], options = {}) {
  const { includeKontan = false } = options;
  const seen = new Set();
  const detailFields = [];

  for (const field of activeFields) {
    if (!field || field === TOTAL_OTHER_INCOME_FIELD) continue;
    if (!includeKontan && field === MANUAL_KONTAN_FIELD) continue;
    if (seen.has(field)) continue;
    seen.add(field);
    detailFields.push(field);
  }

  if (includeKontan && !seen.has(MANUAL_KONTAN_FIELD)) {
    detailFields.push(MANUAL_KONTAN_FIELD);
  }

  return detailFields;
}

export function formatOtherIncomeColumnLabel(field, suffix = '') {
  const baseLabel = String(field || '')
    .replace(/^pendapatan_/, '')
    .toUpperCase();

  return suffix ? `${baseLabel} ${suffix}` : baseLabel;
}

export function getEditableOtherIncomeConfig(field) {
  return EDITABLE_OTHER_INCOME_CONFIG[field] || null;
}

export function isEditableOtherIncomeField(field) {
  return Boolean(getEditableOtherIncomeConfig(field));
}

export function getEditableOtherIncomeFields(activeFields = []) {
  const seen = new Set();
  const fields = [];
  const add = (field) => {
    if (!field || seen.has(field) || !isEditableOtherIncomeField(field)) return;
    seen.add(field);
    fields.push(field);
  };

  for (const field of activeFields) add(field);

  add('pendapatan_bonus');
  add(MANUAL_KONTAN_FIELD);

  return fields;
}
