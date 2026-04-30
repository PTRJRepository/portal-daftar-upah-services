export function serializePremiumMetadata(metadataJson) {
    if (!metadataJson) return undefined;
    return typeof metadataJson === 'string' ? metadataJson : JSON.stringify(metadataJson);
}

export function parsePremiumMetadata(metadataJson) {
    if (!metadataJson) return null;
    if (typeof metadataJson === 'object') return metadataJson;
    try {
        return JSON.parse(metadataJson);
    } catch {
        return null;
    }
}

function normalizeInputType(metadata, inputType) {
    return String(inputType || metadata?.input_type || 'amount').trim().toLowerCase();
}

function isBlank(value) {
    return String(value || '').trim() === '';
}

function isPositiveAmount(value) {
    return Number(value || 0) > 0;
}

function hasAnyValue(item = {}, keys = []) {
    return keys.some((key) => !isBlank(item[key]) || (key === 'jumlah' && Number(item[key] || 0) !== 0));
}

function validateBlokItems(items = []) {
    const relevantItems = (items || []).filter((item) => hasAnyValue(item, ['subblok', 'gang_code', 'jumlah']));
    const reasons = [];

    if (relevantItems.length === 0) {
        reasons.push('Minimal satu detail blok wajib diisi.');
        return reasons;
    }

    relevantItems.forEach((item, index) => {
        const row = index + 1;
        if (isBlank(item.subblok)) reasons.push(`Baris blok ${row}: subblok wajib diisi.`);
        if (isBlank(item.gang_code)) reasons.push(`Baris blok ${row}: gang code wajib diisi.`);
        if (!isPositiveAmount(item.jumlah)) reasons.push(`Baris blok ${row}: jumlah wajib lebih dari 0.`);
    });

    return reasons;
}

function validateKendaraanItems(items = []) {
    const relevantItems = (items || []).filter((item) => hasAnyValue(item, ['nomor_kendaraan', 'expense_code', 'jumlah']));
    const reasons = [];

    if (relevantItems.length === 0) {
        reasons.push('Minimal satu detail kendaraan wajib diisi.');
        return reasons;
    }

    relevantItems.forEach((item, index) => {
        const row = index + 1;
        if (isBlank(item.nomor_kendaraan)) reasons.push(`Baris kendaraan ${row}: nomor kendaraan wajib diisi.`);
        if (isBlank(item.expense_code)) reasons.push(`Baris kendaraan ${row}: expense code wajib diisi.`);
        if (!isPositiveAmount(item.jumlah)) reasons.push(`Baris kendaraan ${row}: jumlah wajib lebih dari 0.`);
    });

    return reasons;
}

function validateExpense(expense = {}) {
    const reasons = [];
    if (isBlank(expense.expense_code)) reasons.push('Expense code wajib diisi.');
    if (!isPositiveAmount(expense.jumlah)) reasons.push('Jumlah expense wajib lebih dari 0.');
    return reasons;
}

export function validatePremiumDetailMetadata(metadataJson, inputType) {
    const metadata = parsePremiumMetadata(metadataJson) || {};
    const resolvedInputType = normalizeInputType(metadata, inputType);
    const reasons = [];

    if (resolvedInputType === 'amount') {
        return { isComplete: true, reasons: [], inputType: resolvedInputType };
    }

    if (resolvedInputType === 'blok') {
        reasons.push(...validateBlokItems(metadata.items));
    } else if (resolvedInputType === 'kendaraan') {
        reasons.push(...validateKendaraanItems(metadata.items));
    } else if (resolvedInputType === 'exp') {
        reasons.push(...validateExpense(metadata));
    } else if (resolvedInputType === 'blok,exp') {
        reasons.push(...validateBlokItems(metadata.blok_items));
        reasons.push(...validateExpense(metadata.expense));
    }

    return {
        isComplete: reasons.length === 0,
        reasons,
        inputType: resolvedInputType
    };
}

export function buildPremiumDetailEdit({ existingEdit, editBase, metadataJson, amountToSave }) {
    const source = existingEdit || editBase;
    if (!source) return null;

    const nextEdit = {
        ...source,
        value: Number(amountToSave) || 0
    };

    const serializedMetadata = serializePremiumMetadata(metadataJson);
    if (serializedMetadata !== undefined) {
        nextEdit.metadata_json = serializedMetadata;
    } else if (existingEdit?.metadata_json) {
        nextEdit.metadata_json = existingEdit.metadata_json;
    }

    return nextEdit;
}
