import { importSPKI, jwtVerify } from "jose";

const token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjE3LCJlbWFpbCI6ImFkbWluIiwibmFtZSI6IkFkbWluaXN0cmF0b3IiLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3Njk2MTczNTQsImV4cCI6MTc2OTY0NjE1NH0.J0PhbFrFyuaRUd_BiZhoNwUpWN4ZLOzcll6Dz6GL34rnAohMJNVyg9dgz31DbBioKJ1Yx_BBTscmvJOlgKNkyHepPAjhPgTm4q2FzXeL706sRmDN1I6OYDGXr2dwjwT1BPJAnkHydzRyLaip8WluYZo1giyhqeg9FgnTOg8Hi4cNMVbi3EsKJqslC9rcZjf5uyVKwUQkd2uwS1OTPd8nqDpQSYCDc8mcztgxRrGORw6_JsYs-E25RF6vKp92D0ZKx0SPzctcgzNE1s8nm1lhy4AfTW-uQxswftJAoq5PK3iYjGDlHGv7yjn0YIyOOT68Rc4hoZeUIVp5jKvE0UBg7A";

async function verify() {
    try {
        console.log("Reading public key...");
        const pem = await Bun.file("keys/public.pem").text();
        console.log(`Key length: ${pem.length}`);

        console.log("Importing SPKI...");
        const publicKey = await importSPKI(pem, "RS256");

        console.log("Verifying token...");
        const { payload, protectedHeader } = await jwtVerify(token, publicKey, {
            algorithms: ["RS256"]
        });

        console.log("SUCCESS!");
        console.log("Header:", protectedHeader);
        console.log("Payload:", payload);
    } catch (error) {
        console.error("FAILED:", error);
    }
}

verify();
