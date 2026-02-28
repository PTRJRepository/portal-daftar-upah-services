import { Database } from "../db/client";
import { divisionDefinition } from "./divisionDefinition";

interface Gang {
    gang_code: string;
    description: string;
    loc_code?: string;
}

export class GangService {
    private static instance: GangService;
    private db: Database;

    // GangCode to Division mapping
    private readonly DIVISION_MAPPING: Record<string, string[]> = {
        "PG1A": ["A"],
        "PG1B": ["B"],
        "PG2A": ["C"],
        "PG2B": ["D"],
        "DME": ["E"],
        "ARA": ["F"],
        "ARB1": ["G"],
        "ARB2": ["H"],
        "INFRA": ["I"],
        "ARC": ["J"],
        "IJL": ["L"],
        "STF-OFFICE": ["O"],
        "SECURITY": ["SEC"]
    };

    // Mapping from old division names to HR_GANG LocCode
    private readonly DIVISION_TO_LOCCODE: Record<string, string> = {
        "PG1A": "P1A",
        "PG1B": "P1B",
        "PG2A": "P2A",
        "PG2B": "P2B",
        "PGE": "PGE",
        "DME": "DME",
        "ARA": "ARA",
        "ARC": "ARC",
        "ARB1": "AB1",
        "ARB2": "AB2",
        "IJL": "IJL",
        "INFRA": "INF",
        "NURSERY": "NRS",
        "WORKSHOP": "WORKSHOP",
        "WKS_PG": "WKS_PG",
        "WORKSHOP_PG": "WKS_PG",
        "WORKSHOP PG": "WKS_PG",
        "WKS PG": "WKS_PG",
        "WKS_AR": "WKS_AR",
        "WORKSHOP_AR": "WKS_AR",
        "WORKSHOP AR": "WKS_AR",
        "WKS AR": "WKS_AR",
        "AREC": "ARC"
    };

    private constructor() {
        this.db = Database.getInstance();
    }

    public static getInstance(): GangService {
        if (!GangService.instance) {
            GangService.instance = new GangService();
        }
        return GangService.instance;
    }

    public convertDivisionToLocCode(division: string): string {
        if (!division) return division;
        const divUpper = division.trim().toUpperCase();
        return this.DIVISION_TO_LOCCODE[divUpper] || divUpper;
    }

    public async getAllDivisions(includeVirtual: boolean = true): Promise<string[]> {
        return divisionDefinition.getAllDivisions(includeVirtual);
    }

    public async getSubDivisions(): Promise<string[]> {
        try {
            const rows = await this.db.query<{ sub_division: string }>(`
                SELECT DISTINCT SUBSTRING(GangCode, 1, 2) as sub_division 
                FROM HR_GANG ORDER BY sub_division
            `);
            return rows.map(r => r.sub_division).filter(Boolean);
        } catch (e) {
            console.error("[GangService] Failed to get sub-divisions:", e);
            return [];
        }
    }

    public getDivisionForPrefix(gangCode: string): string | null {
        if (!gangCode) return null;
        const up = gangCode.toUpperCase();

        if (up.startsWith("SEC")) return "SECURITY";
        if (up.startsWith("L")) return "IJL";
        if (up.startsWith("O")) return "STF-OFFICE";

        const firstChar = up[0];
        for (const [division, prefixes] of Object.entries(this.DIVISION_MAPPING)) {
            if (prefixes.includes(firstChar)) return division;
        }
        return null;
    }

    public async fetchGangs(division?: string, search?: string, includeVirtual: boolean = false): Promise<Gang[]> {
        try {
            let gangs: Gang[] = [];

            if (division) {
                const locCode = this.convertDivisionToLocCode(division);
                // getGangsForDivision(divisionCode, excludeVirtualGangs)
                gangs = await divisionDefinition.getGangsForDivision(locCode, !includeVirtual);
            } else {
                // Fetch all gangs
                const rows = await this.db.query<{ GangCode: string, Description: string, LocCode: string }>(`
                    SELECT GangCode, Description, LocCode FROM HR_GANG 
                    WHERE GangCode IS NOT NULL ORDER BY GangCode
                `);
                gangs = rows.map(r => ({
                    gang_code: r.GangCode?.trim() || "",
                    description: r.Description?.trim() || "",
                    loc_code: r.LocCode?.trim() || ""
                }));
            }

            // Apply search filter
            if (search) {
                const term = search.toUpperCase();
                gangs = gangs.filter(g =>
                    g.gang_code.toUpperCase().includes(term) ||
                    g.description.toUpperCase().includes(term)
                );
            }

            return gangs.sort((a, b) => a.gang_code.localeCompare(b.gang_code));
        } catch (e) {
            console.error("[GangService] Error fetching gangs:", e);
            return [];
        }
    }

    public async getGangInfo(gangCode: string): Promise<any> {
        const division = this.getDivisionForPrefix(gangCode);

        try {
            const rows = await this.db.query<{ Description: string, LocCode: string }>(`
                SELECT Description, LocCode FROM HR_GANG WHERE GangCode = ?
            `, [gangCode]);
            const row = rows[0];

            return {
                gang_code: gangCode,
                division,
                prefix: gangCode[0] || null,
                is_security: gangCode.toUpperCase().startsWith("SEC"),
                description: row?.Description?.trim() || "",
                loc_code: row?.LocCode?.trim() || ""
            };
        } catch (e) {
            return {
                gang_code: gangCode,
                division,
                prefix: gangCode[0] || null,
                is_security: gangCode.toUpperCase().startsWith("SEC"),
                description: "",
                loc_code: ""
            };
        }
    }

    public async fetchGangsByLocCode(locCode: string): Promise<string[]> {
        try {
            const rows = await this.db.query<{ GangCode: string }>(`
                SELECT GangCode FROM HR_GANG 
                WHERE UPPER(LTRIM(RTRIM(LocCode))) = ?
                ORDER BY GangCode
            `, [locCode.toUpperCase()]);
            return rows.map(r => r.GangCode?.trim()).filter(Boolean) as string[];
        } catch (e) {
            console.error("[GangService] fetch_gangs_by_loc_code failed:", e);
            return [];
        }
    }
}

export const gangService = GangService.getInstance();
