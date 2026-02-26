import axios from 'axios';

const api = axios;

export const otherIncomesService = {
    getIncomes: async (year, month, divisionCode, gangCode) => {
        try {
            const params = new URLSearchParams({
                year: year.toString(),
                month: month.toString()
            });

            if (divisionCode) params.append('divisionCode', divisionCode);
            if (gangCode) params.append('gangCode', gangCode);

            const response = await api.get(`/other-incomes?${params.toString()}`);
            return response.data?.data || [];
        } catch (error) {
            console.error('Error fetching other incomes:', error);
            throw error;
        }
    },

    addIncome: async (data) => {
        try {
            const response = await api.post('/other-incomes', data);
            return response.data?.data;
        } catch (error) {
            console.error('Error adding other income:', error);
            throw error;
        }
    },

    updateIncome: async (id, data) => {
        try {
            const response = await api.put(`/other-incomes/${id}`, data);
            return response.data;
        } catch (error) {
            console.error('Error updating other income:', error);
            throw error;
        }
    },

    deleteIncome: async (id) => {
        try {
            const response = await api.delete(`/other-incomes/${id}`);
            return response.data;
        } catch (error) {
            console.error('Error deleting other income:', error);
            throw error;
        }
    }
};
