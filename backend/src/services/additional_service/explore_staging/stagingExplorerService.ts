import { Database } from "../../../db/client";
import { Config } from "../../../config";
import { debug, error as logError } from "../../../utils/logger";

export interface TableInfo {
    table_name: string;
    table_type: string;
    row_count: number;
}

export interface ColumnInfo {
    column_name: string;
    data_type: string;
    max_length: number | null;
    nullable: string;
    ordinal: number;
}

export interface StagingDiscovery {
    database: string;
    profile: string;
    tables: TableInfo[];
    columns: Record<string, ColumnInfo[]>;
}

const STAGING_CATALOG = Config.DB_STAGING_DATABASE;

export class StagingExplorerService {
    private static instance: StagingExplorerService;
    private stagingDb: Database;
    private prodDb: Database;

    private constructor() {
        this.stagingDb = Database.getStagingInstance();
        this.prodDb = Database.getInstance();
    }

    public static getInstance(): StagingExplorerService {
        if (!StagingExplorerService.instance) {
            StagingExplorerService.instance = new StagingExplorerService();
        }
        return StagingExplorerService.instance;
    }

    async listTables(): Promise<TableInfo[]> {
        const tables = await this.stagingDb.query<any>(`
            SELECT TABLE_NAME, TABLE_TYPE
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_CATALOG = '${STAGING_CATALOG}'
                AND TABLE_SCHEMA = 'dbo'
            ORDER BY TABLE_NAME
        `);

        const result: TableInfo[] = [];
        for (const t of tables) {
            try {
                const countRow = await this.stagingDb.queryOne<{ cnt: number }>(
                    `SELECT COUNT(*) as cnt FROM [${STAGING_CATALOG}].[dbo].[${t.TABLE_NAME}]`,
                );
                result.push({
                    table_name: t.TABLE_NAME,
                    table_type: t.TABLE_TYPE,
                    row_count: countRow?.cnt ?? 0,
                });
            } catch (e: any) {
                logError("StagingExplorer", `Count failed for ${t.TABLE_NAME}: ${e.message}`);
                result.push({ table_name: t.TABLE_NAME, table_type: t.TABLE_TYPE, row_count: -1 });
            }
        }
        return result;
    }

    async getColumns(tableName: string): Promise<ColumnInfo[]> {
        const columns = await this.stagingDb.query<any>(`
            SELECT COLUMN_NAME, DATA_TYPE,
                CHARACTER_MAXIMUM_LENGTH as max_length,
                IS_NULLABLE, ORDINAL_POSITION
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = '${tableName}'
                AND TABLE_CATALOG = '${STAGING_CATALOG}'
            ORDER BY ORDINAL_POSITION
        `);
        return columns.map((c: any) => ({
            column_name: c.COLUMN_NAME,
            data_type: c.DATA_TYPE,
            max_length: c.max_length,
            nullable: c.IS_NULLABLE,
            ordinal: c.ORDINAL_POSITION,
        }));
    }

    async discoverAll(): Promise<StagingDiscovery> {
        const tables = await this.listTables();
        const columns: Record<string, ColumnInfo[]> = {};
        for (const t of tables) {
            columns[t.table_name] = await this.getColumns(t.table_name);
        }
        return {
            database: Config.DB_STAGING_DATABASE,
            profile: Config.DB_STAGING_PROFILE,
            tables,
            columns,
        };
    }

    async sampleRows(tableName: string, limit = 100): Promise<any[]> {
        return this.stagingDb.query(
            `SELECT TOP ${limit} * FROM [${STAGING_CATALOG}].[dbo].[${tableName}] ORDER BY 1 DESC`,
        );
    }

    /**
     * Get row count for a table in prod DB
     */
    async prodCount(tableName: string, schema = "dbo"): Promise<number> {
        const row = await this.prodDb.queryOne<{ cnt: number }>(
            `SELECT COUNT(*) as cnt FROM [${Config.DEFAULT_DATABASE}].[${schema}].[${tableName}]`,
        );
        return row?.cnt ?? 0;
    }

    /**
     * Probe prod DB for table existence + row count
     */
    async probeProdTable(tableName: string, schema = "dbo"): Promise<{ exists: boolean; count: number }> {
        try {
            const tables = await this.prodDb.query<any>(`
                SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_CATALOG = '${Config.DEFAULT_DATABASE}' AND TABLE_SCHEMA = '${schema}' AND TABLE_NAME = '${tableName}'
            `);
            if (tables.length === 0) return { exists: false, count: 0 };
            const count = await this.prodCount(tableName, schema);
            return { exists: true, count };
        } catch {
            return { exists: false, count: 0 };
        }
    }

    /**
     * Find matching prod table candidates by name similarity.
     * Strategy: uppercase, strip trailing _ARC/_ACC/ln/Ln, match substrings.
     */
    findProdCandidates(stagingTableName: string): string[] {
        const name = stagingTableName.toUpperCase();
        const candidates: string[] = [];

        // Known manual mappings
        const known: Record<string, string[]> = {
            FFBSCANNERDATA: ["PR_HARVESTERLN_ACC", "PR_HARVESTER_ACC", "PR_HARVESTERLN_ARC"],
        };
        if (known[name]) return known[name];

        // Strip common suffixes
        let stripped = name.replace(/_(TMP|TEMP|BACKUP|BAK|OLD|TEST)$/i, "");
        // Add heuristic matches
        if (stripped.startsWith("PR_") || stripped.includes("HARVEST")) {
            candidates.push(stripped);
        }

        // Generic fallback: just return the name as-is
        if (candidates.length === 0) candidates.push(stripped);

        return candidates;
    }
}
