import { Database } from "../db/client";

interface VirtualDivisionConfig {
    name: string;
    source_division: string | null;
    pattern: string | null;
    description_pattern?: string;
    exclude_from_source: boolean;
    description: string;
}

export interface Gang {
    gang_code: string;
    description: string;
    loc_code: string;
    source_loc_code?: string;
}

export class DivisionDefinition {
    private static instance: DivisionDefinition;

    private readonly VIRTUAL_DIVISIONS: Record<string, VirtualDivisionConfig> = {
        "INF": {
            "name": "Infrastruktur",
            "source_division": "P1A",
            "pattern": "^IN",
            "exclude_from_source": true,
            "description": "Divisi Infrastruktur - Gang yang dimulai dengan IN"
        },
        "NRS": {
            "name": "Nursery",
            "source_division": "P1B",
            "pattern": "^B2N$",
            "exclude_from_source": true,
            "description": "Divisi Nursery - Gang B2N"
        },
        "WKS_PG": {
            "name": "Workshop Parit Gunung",
            "source_division": "P1A",
            "pattern": "^AMC$",
            "description_pattern": "workshop.*(parit|pge|p\\.g|harapan\\s*mukti)",
            "exclude_from_source": true,
            "description": "Divisi Workshop Parit Gunung"
        },
        "WKS_AR": {
            "name": "Workshop Air Ruak",
            "source_division": "AB2",
            "pattern": "^HMC$",
            "description_pattern": "workshop.*(air\\s*ruak|are|a\\.r)|.*traksi.*air\\s*ruak",
            "exclude_from_source": true,
            "description": "Divisi Workshop Air Ruak"
        },
        "WORKSHOP": {
            "name": "Workshop All",
            "source_division": null,
            "pattern": null,
            "description_pattern": "workshop.*(parit|pge|p\\.g|air\\s*ruak|are|a\\.r)|.*traksi.*air\\s*ruak",
            "exclude_from_source": false,
            "description": "Gabungan Workshop Parit Gunung dan Air Ruak"
        },
        "ARC": {
            "name": "Air Ruak Central",
            "source_division": "ARC",
            "pattern": "^J",
            "exclude_from_source": false,
            "description": "Divisi Air Ruak Central - Gang J"
        }
    };

    private readonly DIVISION_ALIASES: Record<string, string> = {
        "INFRA": "INF",
        "NURSERY": "NRS",
        "AREC": "ARC",
        "WORKSHOP_AR": "WKS_AR",
        "WORKSHOP AR": "WKS_AR",
        "WKS AR": "WKS_AR",
        "HMC": "WKS_AR",
        "WORKSHOP_PG": "WKS_PG",
        "WORKSHOP PG": "WKS_PG",
        "WKS PG": "WKS_PG",
        "AMC": "WKS_PG"
    };

    public readonly VIRTUAL_DIVISION_ORDER = ["INF", "NRS", "WKS_PG", "WKS_AR", "WORKSHOP", "ARC", "MILL"];

    private constructor() { }

    public static getInstance(): DivisionDefinition {
        if (!DivisionDefinition.instance) {
            DivisionDefinition.instance = new DivisionDefinition();
        }
        return DivisionDefinition.instance;
    }

    public resolveDivisionCode(code: string): string {
        const upper = code.trim().toUpperCase();
        return this.DIVISION_ALIASES[upper] || upper;
    }

    public isVirtualDivision(divisionCode: string): boolean {
        const resolved = this.resolveDivisionCode(divisionCode);
        if (resolved === "MILL") return false;
        return !!this.getVirtualDivisionConfig(resolved);
    }

    public getVirtualDivisionConfig(divisionCode: string): VirtualDivisionConfig | undefined {
        const resolved = this.resolveDivisionCode(divisionCode);
        return this.VIRTUAL_DIVISIONS[resolved];
    }

    public async getAllDivisions(includeVirtual: boolean = true): Promise<string[]> {
        try {
            const db = Database.getInstance(undefined, "SERVER_PROFILE_2");
            const rows = await db.query<{ LocCode: string }>(`
            SELECT DISTINCT [LocCode]
            FROM [dbo].[HR_GANG]
            WHERE LocCode IS NOT NULL AND LocCode != ''
            ORDER BY [LocCode]
        `);

            const realDivisions = rows.map(r => r.LocCode.trim()).filter(Boolean);

            if (includeVirtual) {
                return [...realDivisions, ...this.VIRTUAL_DIVISION_ORDER];
            }
            return realDivisions;

        } catch (e) {
            console.error("[DivisionDefinition] Error fetching divisions:", e);
            throw e;
        }
    }

    public async getGangsForDivision(divisionCode: string, excludeVirtualGangs: boolean = true): Promise<Gang[]> {
        const resolved = this.resolveDivisionCode(divisionCode);

        if (this.isVirtualDivision(resolved)) {
            return this.getVirtualDivisionGangs(resolved);
        } else {
            return this.getRealDivisionGangs(resolved, excludeVirtualGangs);
        }
    }

    /**
     * Get the REAL source division(s) for a virtual division.
     * This is needed for aggregation to know which actual divisions to query.
     * Returns array of source division codes (e.g., WKS_PG -> ["P1A"])
     */
    public async getSourceDivisionsForAggregation(divisionCode: string): Promise<string[]> {
        const resolved = this.resolveDivisionCode(divisionCode);

        // If not a virtual division, return as-is
        if (!this.isVirtualDivision(resolved)) {
            return [resolved];
        }

        const config = this.getVirtualDivisionConfig(resolved);
        if (!config) {
            return [resolved];
        }

        // If virtual division has a specific source_division, use that
        if (config.source_division) {
            return [config.source_division];
        }

        // For virtual divisions without source_division (like WKS_PG, WKS_AR),
        // we need to get the source LocCodes from the matched gangs
        const gangs = await this.getVirtualDivisionGangs(resolved);
        const sourceLocCodes = new Set<string>();

        for (const gang of gangs) {
            // Use source_loc_code if available (from original gang), otherwise skip
            if (gang.source_loc_code) {
                sourceLocCodes.add(gang.source_loc_code);
            }
        }

        return sourceLocCodes.size > 0 ? Array.from(sourceLocCodes) : [resolved];
    }

    private async getRealDivisionGangs(locCode: string, excludeVirtual: boolean = true): Promise<Gang[]> {
        const db = Database.getInstance(undefined, "SERVER_PROFILE_2");
        const cleanedLoc = locCode.toUpperCase();

        const rows = await db.query<{ GangCode: string, Description: string, LocCode: string }>(`
        SELECT [GangCode], [Description], [LocCode]
        FROM [dbo].[HR_GANG]
        WHERE RTRIM(LTRIM(UPPER(LocCode))) = ?
        ORDER BY [GangCode]
    `, [cleanedLoc]);

        const results: Gang[] = [];
        for (const row of rows) {
            const gangCode = row.GangCode ? row.GangCode.trim() : "";
            const description = row.Description ? row.Description.trim() : "";

            if (excludeVirtual && this.gangBelongsToVirtual(gangCode, cleanedLoc, description)) {
                continue;
            }

            results.push({
                gang_code: gangCode,
                description: description,
                loc_code: row.LocCode ? row.LocCode.trim() : ""
            });
        }

        return results;
    }

    private async getVirtualDivisionGangs(virtualCode: string): Promise<Gang[]> {
        const config = this.getVirtualDivisionConfig(virtualCode);
        if (!config) return [];

        const db = Database.getInstance(undefined, "SERVER_PROFILE_2");

        let rows: { GangCode: string, Description: string, LocCode: string }[];

        if (config.source_division) {
            rows = await db.query(`
             SELECT [GangCode], [Description], [LocCode]
             FROM [dbo].[HR_GANG]
              WHERE RTRIM(LTRIM(UPPER(LocCode))) = ?
             ORDER BY [GangCode]
        `, [config.source_division]);
        } else {
            rows = await db.query(`
             SELECT [GangCode], [Description], [LocCode]
             FROM [dbo].[HR_GANG]
             WHERE LocCode IS NOT NULL AND LocCode != ''
             ORDER BY [GangCode]
        `);
        }

        const results: Gang[] = [];
        const pattern = config.pattern ? new RegExp(config.pattern, "i") : null;
        const descPattern = config.description_pattern ? new RegExp(config.description_pattern, "i") : null;

        for (const row of rows) {
            const gangCode = row.GangCode ? row.GangCode.trim() : "";
            const description = row.Description ? row.Description.trim() : "";

            const codeMatch = pattern ? pattern.test(gangCode) : false;
            const descMatch = descPattern ? descPattern.test(description) : false;

            if (codeMatch || descMatch) {
                results.push({
                    gang_code: gangCode,
                    description: description,
                    loc_code: virtualCode,
                    source_loc_code: row.LocCode ? row.LocCode.trim() : ""
                });
            }
        }
        return results;
    }

    public getVirtualDivisionForGang(gangCode: string, sourceLocCode: string, description: string): string | null {
        for (const [virtCode, config] of Object.entries(this.VIRTUAL_DIVISIONS)) {
            // Check LocCode if source_division is specified
            if (config.source_division && config.source_division.toUpperCase() !== sourceLocCode.toUpperCase()) {
                continue;
            }

            // Check pattern
            if (config.pattern) {
                const regex = new RegExp(config.pattern, "i");
                if (regex.test(gangCode)) return virtCode;
            }

            // Check description
            if (config.description_pattern) {
                const regex = new RegExp(config.description_pattern, "i");
                if (regex.test(description)) return virtCode;
            }
        }
        return null;
    }

    private gangBelongsToVirtual(gangCode: string, sourceLocCode: string, description: string): boolean {
        for (const [virtCode, config] of Object.entries(this.VIRTUAL_DIVISIONS)) {
            if (!config.exclude_from_source) continue;

            // Check LocCode
            if (config.source_division && config.source_division.toUpperCase() !== sourceLocCode.toUpperCase()) {
                continue;
            }

            // Check pattern
            if (config.pattern) {
                const regex = new RegExp(config.pattern, "i");
                if (regex.test(gangCode)) return true;
            }

            // Check description
            if (config.description_pattern) {
                const regex = new RegExp(config.description_pattern, "i");
                if (regex.test(description)) return true;
            }
        }
        return false;
    }
}

export const divisionDefinition = DivisionDefinition.getInstance();
