export function getEmployeeRows(rows = []) {
    return Array.isArray(rows)
        ? rows.filter((row) => row?.type === 'employee')
        : [];
}

function toFiniteNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function resolveAttendanceDays(row = {}) {
    const candidates = [row.jumlah_hk, row.kehadiran, row.hari_kerja];
    for (const candidate of candidates) {
        const numeric = toFiniteNumber(candidate);
        if (numeric !== null && numeric > 0) {
            return numeric;
        }
    }
    return null;
}

export function resolveJabatanRate(row = {}) {
    const existingRate = toFiniteNumber(row.jabatan_rate);
    if (existingRate !== null && existingRate > 0) {
        return existingRate;
    }

    const jabatanJumlah = toFiniteNumber(row.jabatan_jumlah);
    const attendanceDays = resolveAttendanceDays(row);

    if (jabatanJumlah === null || attendanceDays === null) {
        return existingRate;
    }

    return jabatanJumlah / attendanceDays;
}

export function buildEmployeeRowMap(rows = []) {
    const result = {};

    getEmployeeRows(rows).forEach((row) => {
        const key = String(row.emp_code || row.nik || '').trim().toUpperCase();
        if (key) {
            result[key] = row;
        }
    });

    return result;
}

export function buildSelectedEmployeeRowMap(rows = [], selectedCodes = []) {
    const employeeMap = buildEmployeeRowMap(rows);
    const result = {};

    (Array.isArray(selectedCodes) ? selectedCodes : []).forEach((code) => {
        const key = String(code || '').trim().toUpperCase();
        if (key && employeeMap[key]) {
            result[key] = employeeMap[key];
        }
    });

    return result;
}
