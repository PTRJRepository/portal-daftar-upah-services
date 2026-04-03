const axios = require('axios');
const client = axios.create({ baseURL: '/backend/upah' });
try {
  console.log(client.getUri({ url: '/payroll/locked' }));
} catch(e) { console.error(e) }
