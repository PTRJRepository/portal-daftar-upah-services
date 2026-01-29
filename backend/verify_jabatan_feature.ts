
const BASE_URL = "http://localhost:8002";

async function verify() {
    await Bun.write("verify.log", "Starting Verification\n");
    const log = async (msg) => {
        console.log(msg);
        await Bun.write("verify.log", (typeof msg === 'object' ? JSON.stringify(msg) : msg) + "\n", { append: true });
    };

    await log("Verifying Employee Job Title Feature...");

    // 2. Test Save
    await log("\n2. Testing POST /employee-estate/save...");
    const testData = {
        jobs: [
            {
                empcode: "TEST_001",
                employee_name: "Test Employee 1",
                gang: "TEST_GANG",
                divisi_id: "TEST_DIV",
                jabatan: "Mandor"
            },
            {
                empcode: "TEST_002",
                employee_name: "Test Employee 2",
                gang: "TEST_GANG",
                divisi_id: "TEST_DIV",
                jabatan: "Kerani"
            }
        ]
    };

    try {
        const res = await fetch(`${BASE_URL}/employee-estate/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(testData)
        });
        const json = await res.json();
        await log("POST Response:");
        await log(json);
    } catch (e) {
        await log("POST Failed: " + e.message);
        return;
    }

    // 3. Verify Persistence
    await log("\n3. Verifying Persistence...");
    try {
        const res = await fetch(`${BASE_URL}/employee-estate`);
        const json = await res.json();
        await log("GET Response data keys: " + (json.data ? Object.keys(json.data) : "null"));
        const map = json.data || {};

        if (map["TEST_001"] === "Mandor" && map["TEST_002"] === "Kerani") {
            await log("SUCCESS: Data persisted correctly!");
        } else {
            await log("FAILURE: Data mismatch.");
            await log(map);
        }
    } catch (e) {
        await log("Verification Failed: " + e.message);
    }
}

verify();
