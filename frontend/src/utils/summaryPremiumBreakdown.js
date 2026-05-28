export const SUMMARY_PREMI_RESIDUAL_HEADER = 'PREMI LAINNYA / SELISIH TOTAL';

const RESIDUAL_THRESHOLD = 0.01;

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeHeader(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function roundCurrency(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function roundPercent(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function isExcludedPremiumHeader(header) {
  return normalizeHeader(header).includes('KOREKSI');
}

function isBrondolHeader(header) {
  return normalizeHeader(header).includes('BRONDOL');
}

function buildHeaderOrder(row, headers = []) {
  const ordered = [];
  const seen = new Set();

  const addHeader = (header) => {
    const normalized = normalizeHeader(header);
    if (!normalized || seen.has(normalized) || isExcludedPremiumHeader(normalized)) return;
    seen.add(normalized);
    ordered.push(String(header || '').trim());
  };

  headers.forEach(addHeader);
  (row?._dynamic_premi_list || []).forEach((item) => addHeader(item?.header));

  return ordered;
}

function getDynamicPremiumValue(row, headerName) {
  const normalizedTarget = normalizeHeader(headerName);
  if (!normalizedTarget || !Array.isArray(row?._dynamic_premi_list)) return 0;

  return row._dynamic_premi_list.reduce((sum, item) => {
    if (normalizeHeader(item?.header) !== normalizedTarget) return sum;
    return sum + toNumber(item?.total);
  }, 0);
}

function withPercent(item, grandTotal) {
  return {
    ...item,
    total: roundCurrency(item.total),
    percentOfTotal: grandTotal ? roundPercent((item.total / grandTotal) * 100) : 0,
  };
}

function sortBreakdownItems(left, right) {
  const totalDiff = Math.abs(right.total) - Math.abs(left.total);
  if (Math.abs(totalDiff) > RESIDUAL_THRESHOLD) return totalDiff;
  return left.header.localeCompare(right.header);
}

export function getSummaryRowPremiumItems(row, headers = []) {
  const grandTotal = roundCurrency(toNumber(row?.total_premi));
  const headerOrder = buildHeaderOrder(row, headers);
  const items = headerOrder
    .map((header) => ({
      header,
      total: getDynamicPremiumValue(row, header),
      isResidual: false,
    }))
    .filter((item) => Math.abs(item.total) > RESIDUAL_THRESHOLD);

  const classifiedTotal = roundCurrency(items.reduce((sum, item) => sum + item.total, 0));
  const residualTotal = roundCurrency(grandTotal - classifiedTotal);

  if (Math.abs(residualTotal) > RESIDUAL_THRESHOLD) {
    items.push({
      header: SUMMARY_PREMI_RESIDUAL_HEADER,
      total: residualTotal,
      isResidual: true,
    });
  }

  return items
    .map((item) => withPercent(item, grandTotal))
    .sort(sortBreakdownItems);
}

export function getSummaryRowPremiumDoubleCount(row, headers = []) {
  const items = getSummaryRowPremiumItems(row, headers).filter((item) => !item.isResidual);
  const residualItem = getSummaryRowPremiumItems(row, headers).find((item) => item.isResidual);
  const residualTotal = residualItem ? roundCurrency(residualItem.total) : 0;

  if (Math.abs(residualTotal) <= RESIDUAL_THRESHOLD || items.length === 0) {
    return {
      isDetected: false,
      reason: '',
      residualTotal,
      items: [],
    };
  }

  const nonBrondolItems = items.filter((item) => !isBrondolHeader(item.header));
  const nonBrondolTotal = roundCurrency(nonBrondolItems.reduce((sum, item) => sum + item.total, 0));
  const classifiedTotal = roundCurrency(items.reduce((sum, item) => sum + item.total, 0));

  if (nonBrondolItems.length > 0 && Math.abs(residualTotal - nonBrondolTotal) <= RESIDUAL_THRESHOLD) {
    return {
      isDetected: true,
      reason: 'Residual sama dengan total dynamic premi non-brondol',
      residualTotal,
      items: nonBrondolItems.sort(sortBreakdownItems),
    };
  }

  if (Math.abs(residualTotal - classifiedTotal) <= RESIDUAL_THRESHOLD) {
    return {
      isDetected: true,
      reason: 'Residual sama dengan total dynamic premi',
      residualTotal,
      items: items.sort(sortBreakdownItems),
    };
  }

  return {
    isDetected: false,
    reason: '',
    residualTotal,
    items: [],
  };
}

export function buildSummaryPremiumBreakdown(rows = [], headers = []) {
  const itemMap = new Map();
  const doubleCountMap = new Map();
  let grandTotal = 0;
  let classifiedTotal = 0;

  rows.forEach((row) => {
    const rowTotal = toNumber(row?.total_premi);
    const rowItems = getSummaryRowPremiumItems(row, headers);

    grandTotal += rowTotal;

    rowItems.forEach((item) => {
      if (!item.isResidual) {
        classifiedTotal += item.total;
      }

      const normalized = normalizeHeader(item.header);
      const existing = itemMap.get(normalized) || {
        header: item.header,
        total: 0,
        gangCount: 0,
        isResidual: item.isResidual,
      };

      existing.total += item.total;
      if (Math.abs(item.total) > RESIDUAL_THRESHOLD) existing.gangCount += 1;
      existing.isResidual = existing.isResidual || item.isResidual;
      itemMap.set(normalized, existing);
    });

    const doubleCount = getSummaryRowPremiumDoubleCount(row, headers);
    if (doubleCount.isDetected) {
      doubleCount.items.forEach((item) => {
        const normalized = normalizeHeader(item.header);
        const existing = doubleCountMap.get(normalized) || {
          header: item.header,
          total: 0,
          gangCount: 0,
        };
        existing.total += item.total;
        if (Math.abs(item.total) > RESIDUAL_THRESHOLD) existing.gangCount += 1;
        doubleCountMap.set(normalized, existing);
      });
    }
  });

  grandTotal = roundCurrency(grandTotal);
  classifiedTotal = roundCurrency(classifiedTotal);
  const residualTotal = roundCurrency(grandTotal - classifiedTotal);

  const items = Array.from(itemMap.values())
    .map((item) => ({
      ...withPercent(item, grandTotal),
      gangCount: item.gangCount,
      isResidual: item.isResidual,
    }))
    .sort(sortBreakdownItems);

  const breakdownTotal = roundCurrency(items.reduce((sum, item) => sum + item.total, 0));
  const doubleCountTotal = roundCurrency(
    Array.from(doubleCountMap.values()).reduce((sum, item) => sum + item.total, 0)
  );
  const doubleCountItems = Array.from(doubleCountMap.values())
    .map((item) => ({
      header: item.header,
      total: roundCurrency(item.total),
      gangCount: item.gangCount,
      percentOfTotal: grandTotal ? roundPercent((item.total / grandTotal) * 100) : 0,
    }))
    .sort(sortBreakdownItems);

  return {
    items,
    grandTotal,
    classifiedTotal,
    residualTotal,
    breakdownTotal,
    doubleCountTotal,
    doubleCountItems,
    isReconciled: Math.abs(breakdownTotal - grandTotal) <= RESIDUAL_THRESHOLD,
  };
}
