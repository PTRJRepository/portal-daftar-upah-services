async function checkApi() {
    console.log('Checking Tax Report API...');
    
    // Check March 2026 (Historical)
    const year = 2026;
    const month = 3;
    const division = 'WORKSHOP'; // Use a division known to have data
    
    const baseUrl = 'http://127.0.0.1:8002'; // Use 127.0.0.1 to avoid resolution issues
    
    const headers = { 'Authorization': 'Bearer dev-bypass-token-12345' };
    
    try {
        console.log(`\n--- Case 1: Automatic Detection (Should check Live if month is current) ---`);
        let response = await fetch(`${baseUrl}/tax-report/monthly?year=${year}&month=${month}&division=${division}`, { headers });
        let data = await response.json();
        console.log(`Status: ${response.status}`);
        console.log(`Data rows: ${data.employees?.length || 0}`);
        console.log(`Data Source: ${data.data_source}`);

        console.log(`\n--- Case 2: Forced History (use_history=true) ---`);
        response = await fetch(`${baseUrl}/tax-report/monthly?year=${year}&month=${month}&division=${division}&use_history=true`, { headers });
        data = await response.json();
        console.log(`Status: ${response.status}`);
        console.log(`Data rows: ${data.employees?.length || 0}`);
        console.log(`Data Source: ${data.data_source}`);

        if (data.employees?.length > 0) {
            console.log(`\n--- Case 3: Excel Export (use_history=true) ---`);
            const excelResponse = await fetch(`${baseUrl}/tax-report/monthly/excel?year=${year}&month=${month}&division=${division}&use_history=true`, { headers });
            const buffer = await excelResponse.arrayBuffer();
            console.log(`Status: ${excelResponse.status}`);
            console.log(`Excel Size: ${buffer.byteLength} bytes`);
            
            if (buffer.byteLength === 0) {
                console.error('CRITICAL: Backend returned 0-byte Excel!');
            } else {
                console.log('SUCCESS: Excel generated with content.');
            }
        }
    } catch (e) {
        console.error('API Error:', e.message);
    }
}

checkApi();
