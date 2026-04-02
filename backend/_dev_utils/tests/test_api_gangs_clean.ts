import fs from 'fs';

async function testApiEndpoints() {
    const baseURL = 'http://localhost:8002';
    const token = 'dev-bypass-token-12345'; 
    const headers = { Authorization: `Bearer ${token}` };

    let out = "=== TESTING API ENDPOINTS ===\\n\\n";

    try {
        out += "1. Fetching Divisions (/payroll/divisions)...\\n";
        const divRes = await fetch(`${baseURL}/payroll/divisions`, { headers });
        const divData = await divRes.json();
        out += `Status: ${divRes.status}\\n`;
        out += `Data (Sample): ${JSON.stringify(divData.slice ? divData.slice(0, 3) : divData)}\\n\\n`;

        out += "2. Fetching Gangs for ALL (/payroll/gangs?division=ALL)...\\n";
        const gangRes = await fetch(`${baseURL}/payroll/gangs?division=ALL`, { headers });
        const gangData = await gangRes.json();
        out += `Status: ${gangRes.status}\\n`;
        out += `Data (Count): ${gangData?.length || 0}\\n`;
        if (gangData?.length > 0) {
           out += `Data (Sample): ${JSON.stringify(gangData.slice(0, 3))}\\n\\n`;
        } else {
           out += `Data: ${JSON.stringify(gangData)}\\n\\n`;
        }

        out += "3. Fetching Gangs for PG1A (/payroll/gangs?division=PG1A)...\\n";
        const pg1aRes = await fetch(`${baseURL}/payroll/gangs?division=PG1A`, { headers });
        const pg1aData = await pg1aRes.json();
        out += `Status: ${pg1aRes.status}\\n`;
        out += `Data (Count): ${pg1aData?.length || 0}\\n`;
        if (pg1aData?.length > 0) {
           out += `Data (Sample): ${JSON.stringify(pg1aData.slice(0, 3))}\\n\\n`;
        } else {
           out += `Data: ${JSON.stringify(pg1aData)}\\n\\n`;
        }

        out += "4. Fetching Locked Gangs for PG1A (/payroll/locked/gangs?div=PG1A)...\\n";
        const lockedRes = await fetch(`${baseURL}/payroll/locked/gangs?div=PG1A`, { headers });
        const lockedData = await lockedRes.json();
        out += `Status: ${lockedRes.status}\\n`;
        out += `Data (Count): ${lockedData?.length || 0}\\n`;
        if (lockedData?.length > 0) {
           out += `Data: ${JSON.stringify(lockedData.slice(0, 3))}\\n\\n`;
        } else {
           out += `Data: ${JSON.stringify(lockedData)}\\n\\n`;
        }
        
        fs.writeFileSync('_dev_utils/tests/api_gangs_clean.txt', out, 'utf8');
        console.log("Done. Check api_gangs_clean.txt");
    } catch (e: any) {
        fs.writeFileSync('_dev_utils/tests/api_gangs_clean.txt', out + `\\nERROR: ${e.message}`, 'utf8');
        console.error("API Request Failed!", e);
    }
}

testApiEndpoints();
