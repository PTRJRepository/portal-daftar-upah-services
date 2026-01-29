import { Config } from "../config";

interface QueryResponse {
    success: boolean;
    error?: string;
    data?: {
        recordset?: any[];
        rowsAffected?: number[];
        transactionCommitted?: boolean;
        [key: string]: any;
    };
}

interface BatchQuery {
    sql: string;
    params?: Record<string, any>;
    database?: string;
}

export class Database {
    private static instances: Map<string, Database> = new Map();
    private serverProfile: string;
    private databaseName: string;
    private baseUrl: string;
    private apiKey: string;
    private timeout: number;

    private constructor(database?: string, profile?: string) {
        this.serverProfile = profile || Config.DB_PROFILE;
        this.databaseName = database || Config.DEFAULT_DATABASE;
        this.apiKey = Config.DB_API_KEY;
        this.timeout = Config.DB_CONN_TIMEOUT;

        // Simple normalization: remove trailing slash
        let rawUrl = Config.DB_API_URL.trim();
        while (rawUrl.endsWith('/')) {
            rawUrl = rawUrl.slice(0, -1);
        }
        this.baseUrl = rawUrl;

        console.log(`[DB] Initialized with Profile: ${this.serverProfile}, DB: ${this.databaseName}`);
        console.log(`[DB] Gateway Base: ${this.baseUrl}`);
        console.log(`[DB] Query Target: ${this.baseUrl}/v1/query`);
    }

    /**
     * Get database instance. Supports multiple database configurations:
     * - Default: db_ptrj with SERVER_PROFILE_1
     * - Extended: extend_db_ptrj with SERVER_PROFILE_1
     * - Venus: VenusHR14 with SERVER_PROFILE_3 (for Mill PKS data)
     */
    public static getInstance(database?: string, profile?: string): Database {
        const key = `${database || Config.DEFAULT_DATABASE}:${profile || Config.DB_PROFILE}`;

        if (!Database.instances.has(key)) {
            Database.instances.set(key, new Database(database, profile));
        }
        return Database.instances.get(key)!;
    }

    /**
     * Get VenusHR14 database instance (for Mill PKS data)
     */
    public static getVenusInstance(): Database {
        return Database.getInstance(Config.DB_VENUS_DATABASE, Config.DB_VENUS_PROFILE);
    }

    /**
     * Get Extended database instance (for aggregation history)
     */
    public static getExtendedInstance(): Database {
        return Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);
    }

    private prepareParams(sql: string, params?: any[] | Record<string, any>): { sql: string; params: any[] | Record<string, any> } {
        if (!params) return { sql, params: {} };

        // Auto-convert Array params with ? placeholders to Named params with @pX placeholders
        // because the Python SQL Gateway requires named parameters.
        if (Array.isArray(params)) {
            const newParams: Record<string, any> = {};
            let newSql = sql;
            let paramIndex = 0;

            // Replace each ? occurrence with @p0, @p1, etc.
            newSql = newSql.replace(/\?/g, () => {
                const key = `p${paramIndex}`;
                newParams[key] = params[paramIndex];
                paramIndex++;
                return `@${key}`;
            });

            return { sql: newSql, params: newParams };
        }

        return { sql, params };
    }

    public async query<T = any>(sql: string, params?: any[] | Record<string, any>): Promise<T[]> {
        const { sql: preparedSql, params: preparedParams } = this.prepareParams(sql, params);

        let attempt = 0;
        let delay = 500;
        const maxRetries = Config.DB_QUERY_RETRIES;

        while (attempt <= maxRetries) {
            try {
                const body = {
                    sql: preparedSql,
                    params: preparedParams,
                    server: this.serverProfile,
                    database: this.databaseName
                };

                const response = await fetch(`${this.baseUrl}/v1/query`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": this.apiKey
                    },
                    body: JSON.stringify(body),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`[DB] Gateway Error (${response.status}):`, errorText);
                    throw new Error(`Gateway returned ${response.status}: ${response.statusText} - ${errorText}`);
                }

                const result = (await response.json()) as QueryResponse;

                if (!result.success) {
                    throw new Error(result.error || "Unknown Gateway Error");
                }

                return (result.data?.recordset || []) as T[];

            } catch (error) {
                console.error(`[DB] Query failed (Attempt ${attempt + 1}):`, error);
                if (attempt >= maxRetries) throw error;
                await new Promise(r => setTimeout(r, delay));
                delay = Math.min(delay * 2, 2000);
                attempt++;
            }
        }
        return [];
    }

    public async transaction(queries: { sql: string; params?: any[] | Record<string, any> }[]): Promise<boolean> {
        const batchQueries: BatchQuery[] = queries.map(q => {
            const { sql, params } = this.prepareParams(q.sql, q.params);
            return { sql, params, database: this.databaseName };
        });

        try {
            const body = {
                server: this.serverProfile,
                queries: batchQueries,
                database: this.databaseName
            };

            const response = await fetch(`${this.baseUrl}/v1/query/batch`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": this.apiKey
                },
                body: JSON.stringify(body)
            });

            const result = (await response.json()) as QueryResponse;
            if (!result.success) {
                console.error("[DB] Transaction failed:", result.error);
                return false;
            }
            return !!result.data?.transactionCommitted;
        } catch (e) {
            console.error("[DB] Transaction request failed:", e);
            return false;
        }
    }

    /**
     * Execute a query and return the first result only
     */
    public async queryOne<T = any>(sql: string, params?: any[] | Record<string, any>): Promise<T | null> {
        const results = await this.query<T>(sql, params);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Execute a query and return count
     */
    public async count(sql: string, params?: any[] | Record<string, any>): Promise<number> {
        const result = await this.queryOne<{ count: number }>(sql, params);
        return result?.count || 0;
    }
}
