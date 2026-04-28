import axios from 'axios';

function authHeaders(token) {
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchTaskCodeOptions(token, { search = '', divisionCode = '', limit = 50 } = {}) {
    const response = await axios.get('payroll/manual-adjustment/taskcode-options', {
        params: {
            ...(search ? { search } : {}),
            ...(divisionCode ? { division_code: divisionCode } : {}),
            limit
        },
        headers: authHeaders(token)
    });
    return response.data;
}

export async function fetchManualAdjustments(token, params) {
    const response = await axios.get('payroll/manual-adjustment', {
        params,
        headers: authHeaders(token)
    });
    return response.data;
}

export async function saveManualAdjustment(token, payload) {
    const response = await axios.post('payroll/manual-adjustment', payload, {
        headers: authHeaders(token)
    });
    return response.data;
}

export async function deleteManualAdjustment(token, id, params = {}) {
    const response = await axios.delete(`payroll/manual-adjustment/${id}`, {
        params,
        headers: authHeaders(token)
    });
    return response.data;
}
