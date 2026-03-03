async function testApi() {
    try {
        console.log("Testing POST /employee-estate/update");
        const res = await fetch('http://localhost:8002/employee-estate/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                empCode: "TEST001",
                jobTitle: "karyawan panen"
            })
        });

        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Response:", text);
    } catch (e) {
        console.error("Test failed:", e);
    }
}

testApi();
