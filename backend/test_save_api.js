async function testSaveApi() {
    try {
        console.log("Testing POST /employee-estate/save");
        const res = await fetch('http://localhost:8002/employee-estate/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jobs: [
                    {
                        empcode: "XYZ001",
                        employee_name: "John Doe",
                        gang: "AA",
                        divisi_id: "DIV01",
                        jabatan: "karyawan panen"
                    },
                    {
                        empcode: "XYZ002",
                        employee_name: "Jane Doe",
                        gang: "BB",
                        divisi_id: "DIV01",
                        jabatan: "mandor panen"
                    }
                ]
            })
        });

        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Response:", text);
    } catch (e) {
        console.error("Test failed:", e);
    }
}

testSaveApi();
