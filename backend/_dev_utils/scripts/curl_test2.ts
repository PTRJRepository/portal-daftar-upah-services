async function test() {
    try {
        console.log("Fetching API endpoint directly...");
        const res = await fetch("http://localhost:8002/payroll/locked/report/raw-tree?div=PG1A&month=3&year=2026", {
            headers: { "Authorization": "Bearer TEST" } // doesn't matter if it returns 401
        });
        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Content-Type:", res.headers.get('content-type'));
        console.log("Data text length:", text.length);
        console.log("Data snippet:", text.substring(0, 500));
        
        try {
            const data = JSON.parse(text);
            console.log("Parsed keys:", Object.keys(data));
            if(data.gangs) {
                console.log("Gangs length:", data.gangs.length);
            }
        } catch(e) {}
    } catch(e) {
        console.error(e);
    }
}
test();
