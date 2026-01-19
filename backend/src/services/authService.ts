import { Database } from "bun:sqlite";
import { Config } from "../config";
import { User, UserCreate, UserRole, UserWithHash } from "../types/user";
import * as bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
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
            const { payload } = await jwtVerify(token, this.secret);
            const username = payload.sub;
            if (!username) return null;

            const user = await this.getUser(username);
            if (!user) return null;

            const { password_hash, ...safeUser } = user;
            return safeUser;
        } catch (e) {
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
