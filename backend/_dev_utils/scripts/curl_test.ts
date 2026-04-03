async function test() {
    try {
        console.log("Fetching...");
        const res = await fetch("http://localhost:8002/locked/report/raw-tree?div=PG1A&month=3&year=2026", {
            headers: { "Authorization": "Bearer TEST" }
        });
        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Response Type:", typeof text);
        console.log("Data text length:", text.length);
        console.log("Data snippet:", text.substring(0, 200));
    } catch(e) {
        console.error(e);
    }
}
test();
