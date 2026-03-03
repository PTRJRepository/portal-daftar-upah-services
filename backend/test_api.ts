async function main() {
    try {
        const res = await fetch("http://localhost:8002/payroll/divisions");
        const json = await res.json();
        console.log("Divisions:");
        console.log(json);
    } catch (e: any) {
        console.error("Fetch failed:", e.message);
    }
}
main();
