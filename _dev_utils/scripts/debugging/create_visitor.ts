import { AuthService } from "../services/authService";
import { UserRole } from "../types/user";

async function createVisitor() {
    const authService = AuthService.getInstance();
    try {
        await authService.createUser({
            username: "visitor_test",
            email: "visitor@test.com",
            password: "password123",
            full_name: "Test Visitor",
            role: UserRole.VISITOR,
            divisions: ["ALL"]
        });
        console.log("Visitor user created successfully!");
    } catch (e: any) {
        if (e.message.includes("UNIQUE constraint failed")) {
            console.log("Visitor user already exists.");
        } else {
            console.error("Error creating visitor account:", e.message);
        }
    }
}

createVisitor();
