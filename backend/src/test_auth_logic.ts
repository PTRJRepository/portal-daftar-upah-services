import { describe, expect, it } from "bun:test";
import { AuthService } from "./services/authService";
import { UserRole } from "./types/user";

// Mock payload for ALL division
const payloadAll = {
    sub: "user_all",
    division: "ALL",
    role: "user"
};

// Mock payload for Admin role
const payloadAdmin = {
    sub: "user_admin",
    division: "P1A",
    role: "admin"
};

// Mock function to simulate the logic inside verifyToken
// We can't easily mock private methods or DB in a simple script without setup, 
// so we'll test the logic block conceptually or try to use the actual service if DB is available.
// Since DB is available, let's try to use the actual service but strict mocking of JWT is hard.
// Instead, let's just test the Logic by exposing a helper or just trusting the code review + standard integration test.

// Actually, we can test `getAccessibleDivisions` easily.
const authService = AuthService.getInstance();

console.log("Testing getAccessibleDivisions...");

const adminUser = {
    id: 1,
    username: "admin",
    role: UserRole.ADMIN,
    divisions: ["P1A"], // Should be ignored
    email: "test@test.com",
    full_name: "Test",
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
};

const regularUser = {
    id: 2,
    username: "user",
    role: UserRole.USER,
    divisions: ["P1A", "P1B"],
    email: "test@test.com",
    full_name: "Test",
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
};

const adminDivs = authService.getAccessibleDivisions(adminUser);
console.log(`Admin Divisions Count: ${adminDivs.length}`);
if (adminDivs.length < 20) {
    console.error("FAIL: Admin should have all divisions");
    process.exit(1);
}

const userDivs = authService.getAccessibleDivisions(regularUser);
console.log(`User Divisions: ${userDivs.join(", ")}`);
if (userDivs.length !== 2) {
    console.error("FAIL: User should have specific divisions");
    process.exit(1);
}

console.log("PASS: getAccessibleDivisions logic is correct.");
