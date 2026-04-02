async function testApiEndpoints() {
    const baseURL = 'http://localhost:8002';
    const token = 'dev-bypass-token-12345'; 
    const headers = { Authorization: `Bearer ${token}` };

    console.log("=== TESTING API ENDPOINTS ===\\n");

    try {
        console.log("1. Fetching Divisions (/payroll/divisions)...");
        const divRes = await fetch(`${baseURL}/payroll/divisions`, { headers });
        const divData = await divRes.json();
        console.log(`Status: ${divRes.status}`);
        console.log(`Data (Sample): ${JSON.stringify(divData.slice ? divData.slice(0, 3) : divData)}\\n`);

        console.log("2. Fetching Gangs for ALL (/payroll/gangs?division=ALL)...");
        const gangRes = await fetch(`${baseURL}/payroll/gangs?division=ALL`, { headers });
        const gangData = await gangRes.json();
        console.log(`Status: ${gangRes.status}`);
        console.log(`Data (Count): ${gangData?.length || 0}`);
        if (gangData?.length > 0) {
           console.log(`Data (Sample): ${JSON.stringify(gangData.slice(0, 3))}\\n`);
        } else {
           console.log(`Data: ${JSON.stringify(gangData)}\\n`);
        }

        console.log("3. Fetching Gangs for PG1A (/payroll/gangs?division=PG1A)...");
        const pg1aRes = await fetch(`${baseURL}/payroll/gangs?division=PG1A`, { headers });
        const pg1aData = await pg1aRes.json();
        console.log(`Status: ${pg1aRes.status}`);
        console.log(`Data (Count): ${pg1aData?.length || 0}`);
        if (pg1aData?.length > 0) {
           console.log(`Data (Sample): ${JSON.stringify(pg1aData.slice(0, 3))}\\n`);
        }

        console.log("4. Fetching Locked Gangs for PG1A (/payroll/locked/gangs?div=PG1A)...");
        const lockedRes = await fetch(`${baseURL}/payroll/locked/gangs?div=PG1A`, { headers });
        const lockedData = await lockedRes.json();
        console.log(`Status: ${lockedRes.status}`);
        console.log(`Data (Count): ${lockedData?.length || 0}`);

    } catch (e: any) {
        console.error("API Request Failed!", e);
    }
}

testApiEndpoints();
