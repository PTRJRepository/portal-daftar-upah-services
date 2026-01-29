import { Database } from "bun:sqlite";
import { Config } from "../config";
import { User, UserCreate, UserRole, UserWithHash } from "../types/user";
import * as bcrypt from "bcryptjs";
import { SignJWT, jwtVerify, importSPKI, decodeProtectedHeader } from "jose";
import { join } from "path";

export class AuthService {
    private static instance: AuthService;
    private db: Database;
    private secret: Uint8Array;

    private constructor() {
        // DB Path: backend/data/users.db
        const dbPath = join(process.cwd(), "data", "users.db");
        console.log(`[AuthService] Opening SQLite DB: ${dbPath}`);
        this.db = new Database(dbPath, { create: true });
        this.secret = new TextEncoder().encode(Config.JWT_SECRET);

        this.initDb();
    }

    public static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }

    private initDb() {
        this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        divisions TEXT NOT NULL DEFAULT '[]',
        is_active BOOLEAN NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Audit logs
        this.db.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            details TEXT,
            timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `);

        // Check admin
        const admin = this.db.query("SELECT * FROM users WHERE username = 'admin'").get();
        if (!admin) {
            console.log("[AuthService] Creating default admin user");
            const hash = bcrypt.hashSync("admin", 10);
            const allDivisions = JSON.stringify(["PG1A", "PG1B", "PG2A", "PG2B", "DME", "ARA", "ARB1", "ARB2", "INFRA", "AREC", "IJL", "STF-OFFICE", "SECURITY"]);
            this.db.run(
                `INSERT INTO users (username, email, password_hash, full_name, role, divisions, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
                ["admin", "admin@payroll.com", hash, "System Administrator", "admin", allDivisions, true]
            );
        }
    }

    // --- User Management ---

    public async getUser(username: string): Promise<UserWithHash | null> {
        const row = this.db.query("SELECT * FROM users WHERE username = ?").get(username) as any;
        if (!row) return null;
        return this.mapRowToUser(row);
    }

    public async getUserById(id: number): Promise<User | null> {
        const row = this.db.query("SELECT * FROM users WHERE id = ?").get(id) as any;
        if (!row) return null;
        return this.mapRowToUser(row);
    }

    private mapRowToUser(row: any): UserWithHash {
        return {
            id: row.id,
            username: row.username,
            email: row.email,
            full_name: row.full_name,
            password_hash: row.password_hash,
            role: row.role as UserRole,
            divisions: JSON.parse(row.divisions || "[]"),
            is_active: !!row.is_active,
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at)
        };
    }

    // --- Authentication ---

    public async authenticate(username: string, password: string): Promise<User | null> {
        const user = await this.getUser(username);
        if (!user || !user.is_active) return null;

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) return null;

        // Log login
        this.logAudit(user.id, "LOGIN_SUCCESS", `User ${username} logged in`);

        const { password_hash, ...safeUser } = user;
        return safeUser;
    }

    public async createToken(user: User): Promise<string> {
        const jwt = await new SignJWT({
            sub: user.username,
            role: user.role,
            divisions: user.divisions
        })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("24h") // Python was ACCESS_TOKEN_EXPIRE_MINUTES, default 30-60m usually, check Config? 
            .sign(this.secret);

        return jwt;
    }

    public async verifyToken(token: string): Promise<User | null> {
        try {
            console.log(`[AuthService] Verifying token. Token starts with: ${token.substring(0, 10)}...`);

            let payload;
            let header;
            try {
                header = decodeProtectedHeader(token);
            } catch (e) {
                console.error("[AuthService] Invalid token header:", e);
                return null;
            }

            if (header.alg === "HS256") {
                // Internal Token (always trusted verified by SECRET)
                try {
                    const result = await jwtVerify(token, this.secret);
                    payload = result.payload;
                } catch (e) {
                    console.error("[AuthService] Internal HS256 verification failed:", e);
                    return null;
                }
            } else if (header.alg === "RS256") {
                // External Token (verify with PUBLIC KEY)
                try {
                    const pem = await Bun.file(Config.PUBLIC_KEY_PATH).text();
                    const publicKey = await importSPKI(pem, "RS256");
                    const result = await jwtVerify(token, publicKey, {
                        algorithms: ["RS256"]
                    });
                    payload = result.payload;
                    console.log("[AuthService] External token verified.");
                } catch (e) {
                    console.error("[AuthService] External RS256 verification failed:", e);
                    return null;
                }
            } else {
                console.error(`[AuthService] Unsupported token algorithm: ${header.alg}`);
                return null;
            }

            // Normalization and Mapping
            const username = payload.sub || (payload as any).preferred_username || (payload as any).username || (payload as any).email;

            if (!username) {
                console.log("[AuthService] No username found in token payload");
                // Optional debug log
                // console.log("Payload keys:", Object.keys(payload));
                return null;
            }

            // Normalize Role
            let roleStr = (payload as any).role || "user";
            if (typeof roleStr === "string") roleStr = roleStr.toLowerCase();
            const role = (roleStr === "admin" ? UserRole.ADMIN : UserRole.USER);

            // Try to find user locally
            const user = await this.getUser(username);

            if (user) {
                // console.log(`[AuthService] User '${username}' found locally.`);
                const { password_hash, ...safeUser } = user;
                return safeUser;
            }

            // If not found locally, allow transient if External Token (RS256)
            // MODIFIED: Allow transient creation for ANY valid RS256 token, regardless of Config.AUTH_MODE
            // This enables hybrid mode where Internal server can still accept External tokens.
            if (header.alg === "RS256") {
                const externalId = (payload as any).userId || 0;

                // Extract divisions from various possible payload keys
                let rawDivs = (payload as any).divisions || (payload as any).division || (payload as any).divisi || (payload as any).div || (payload as any).DIV || [];

                // Normalize to string array
                let divisions: string[] = [];
                if (Array.isArray(rawDivs)) {
                    divisions = rawDivs.map(d => String(d));
                } else if (typeof rawDivs === 'string') {
                    // Handle comma-separated or single value
                    if (rawDivs.includes(',')) {
                        divisions = rawDivs.split(',').map(d => d.trim());
                    } else if (rawDivs.trim() !== '') {
                        divisions = [rawDivs.trim()];
                    }
                }

                // FALLBACK: Infer from Username or Name
                if (divisions.length === 0) {
                    const targetStr = (username || "") + " " + ((payload as any).name || "");
                    console.log(`[AuthService] Attempting division inference from: '${targetStr}'`);

                    // NEW: Explicit checks for named divisions
                    const upperTarget = targetStr.toUpperCase();
                    if (upperTarget.includes("INFRA") || upperTarget.includes("INF")) {
                        divisions.push("INFRA");
                    }
                    if (upperTarget.includes("NURSERY") || upperTarget.includes("BIBITAN") || upperTarget.includes("NRS")) {
                        divisions.push("NURSERY");
                    }
                    if (upperTarget.includes("WORKSHOP") || upperTarget.includes("BENGKEL") || upperTarget.includes("WKS")) {
                        divisions.push("WORKSHOP");
                    }

                    // Regex to find things like PG1A, PGE 1A, DIV 1, ARB 1, etc.
                    const patterns = [
                        /\b(PGE?\s*\d+[A-Z]?)\b/i,
                        /\b(DIV\s*\d+[A-Z]?)\b/i,
                        /\b(PG\d+[A-Z]?)\b/i,
                        /\b(ARB?\s*\d+[A-Z]?)\b/i,
                        /\b([A-Z]{2,3}\d+[A-Z]?)\b/i
                    ];

                    for (const pat of patterns) {
                        const match = targetStr.match(pat);
                        if (match) {
                            let inferred = match[1].toUpperCase().replace(/\s+/g, "");

                            // ALIAS NORMALIZATION for compatibility with GangService/DB
                            // PG1A -> P1A, PG1B -> P1B, PG2A -> P2A, PG2B -> P2B
                            // Only apply if it looks like PG1A (PG + digit + letter)
                            if (/^PG\d[A-Z]$/.test(inferred)) {
                                inferred = inferred.replace("PG", "P");
                            }
                            // ARB1 -> AB1, ARB2 -> AB2
                            if (inferred.startsWith("ARB")) {
                                inferred = inferred.replace("ARB", "AB");
                            }

                            divisions.push(inferred);
                            console.log(`[AuthService] Inferred division '${inferred}' from string '${targetStr}'`);
                            break;
                        }
                    }

                    // Deduplicate
                    divisions = [...new Set(divisions)];
                }

                console.log(`[AuthService] Creating transient user from external token. ID: ${externalId}, Role: ${role}`);
                console.log(`[AuthService] Transient Divisions extracted: ${JSON.stringify(divisions)}`);

                return {
                    id: externalId,
                    username: username,
                    email: (payload as any).email || "external@remote",
                    full_name: (payload as any).name || (payload as any).full_name || username,
                    role: role,
                    divisions: divisions,
                    is_active: true,
                    created_at: new Date(),
                    updated_at: new Date()
                };
            }

            return null;
        } catch (e) {
            console.error("[AuthService] verifyToken exception:", e);
            return null;
        }
    }

    private logAudit(userId: number, action: string, details: string) {
        try {
            this.db.run(
                "INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)",
                [userId, action, details]
            );
        } catch (e) {
            console.error("[AuthService] Failed to log audit:", e);
        }
    }

    public getAccessibleDivisions(user: User): string[] {
        if (user.role === UserRole.ADMIN) {
            return ["PG1A", "PG1B", "PG2A", "PG2B", "DME", "ARA", "ARB1", "ARB2", "INFRA", "AREC", "IJL", "STF-OFFICE", "SECURITY"];
        }
        return user.divisions;
    }

    public listUsers(skip: number = 0, limit: number = 100): User[] {
        const rows = this.db.query("SELECT * FROM users WHERE is_active = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?").all(limit, skip) as any[];
        return rows.map(row => {
            const mapped = this.mapRowToUser(row);
            const { password_hash, ...safeUser } = mapped;
            return safeUser;
        });
    }

    public async createUser(userData: { username: string; email: string; password: string; full_name: string; role?: string; divisions?: string[]; is_active?: boolean }): Promise<User> {
        const hash = bcrypt.hashSync(userData.password, 10);
        const divisions = JSON.stringify(userData.divisions || []);
        const role = userData.role || "user";
        const isActive = userData.is_active !== undefined ? userData.is_active : true;

        this.db.run(
            `INSERT INTO users (username, email, password_hash, full_name, role, divisions, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userData.username, userData.email, hash, userData.full_name, role, divisions, isActive]
        );

        const user = await this.getUser(userData.username);
        if (!user) throw new Error("Failed to create user");

        const { password_hash, ...safeUser } = user;
        return safeUser;
    }

    public deleteUser(userId: number): boolean {
        const result = this.db.run("UPDATE users SET is_active = 0 WHERE id = ?", [userId]);
        return (result.changes || 0) > 0;
    }
}
