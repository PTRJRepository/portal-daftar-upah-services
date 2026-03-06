import axios from "axios";

async function testApiWahidan() {
    const year = 2026;
    const month = 2;
    const division = 'DME';
    const gang = 'E3H';

    const url = `http://localhost:3001/backend/upah/other-incomes?year=${year}&month=${month}&divisionCode=${division}&gangCode=${gang}`;
    
    console.log(`GET ${url}`);
    try {
        const response = await axios.get(url);
        const incomes = response.data.data;
        const wahidan = incomes.find(i => i.nik === '5208030508790001');
        
        if (wahidan) {
            console.log("Wahidan from API:");
            console.log(JSON.stringify(wahidan, null, 2));
        } else {
            console.log("Wahidan not found in API response.");
        }
    } catch (e) {
        console.error("API Call failed. Is the server running?");
    }
}

testApiWahidan();
