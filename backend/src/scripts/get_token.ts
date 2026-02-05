
import { AuthService } from "../services/authService";

async function main() {
    console.log("Authenticating as admin...");
    const authService = AuthService.getInstance();
    const user = await authService.authenticate("admin", "admin");

    if (user) {
        console.log("Authentication successful.");
        const token = await authService.createToken(user);
        console.log(`TOKEN:${token}`);
    } else {
        console.error("Authentication failed.");
        process.exit(1);
    }
}

main().catch(console.error);
