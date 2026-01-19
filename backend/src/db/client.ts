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
    private static instance: Database;
    private serverProfile: string;
    private databaseName: string;
    private baseUrl: string;
    private apiKey: string;
    private timeout: number;

    private constructor(database?: string) {
        this.serverProfile = Config.DB_PROFILE;
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

    public static getInstance(database?: string): Database {
        if (database) {
            return new Database(database);
        }
        if (!Database.instance) {
            Database.instance = new Database();
        }
        return Database.instance;
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

    public async transaction(queries: { sql: string; params?: any[] }[]): Promise<boolean> {
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
}
