import { Database } from "../db/client";

interface VirtualDivisionConfig {
    name: string;
    source_division: string | null;
    pattern: string | null;
    description_pattern?: string;
    exclude_from_source: boolean;
    description: string;
}

interface Gang {
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
            "source_division": null,
            "pattern": null,
            "description_pattern": "workshop.*(parit|pge|p\\.g)",
            "exclude_from_source": true,
            "description": "Divisi Workshop Parit Gunung - Gang dengan Description mengandung 'workshop' DAN 'parit/PGE'"
        },
        "WKS_AR": {
            "name": "Workshop Air Ruak",
            "source_division": null,
            "pattern": null,
            "description_pattern": "workshop.*(air\\s*ruak|are|a\\.r)",
            "exclude_from_source": true,
            "description": "Divisi Workshop Air Ruak - Gang dengan Description mengandung 'workshop' DAN 'air ruak/ARE'"
        }
    };

    public readonly VIRTUAL_DIVISION_ORDER = ["INF", "NRS", "WKS_PG", "WKS_AR", "MILL"];

    private constructor() { }

    public static getInstance(): DivisionDefinition {
        if (!DivisionDefinition.instance) {
            DivisionDefinition.instance = new DivisionDefinition();
        }
        return DivisionDefinition.instance;
    }

    public isVirtualDivision(divisionCode: string): boolean {
        if (divisionCode.toUpperCase() === "MILL") return false;
        return !!this.getVirtualDivisionConfig(divisionCode);
    }

    public getVirtualDivisionConfig(divisionCode: string): VirtualDivisionConfig | undefined {
        return this.VIRTUAL_DIVISIONS[divisionCode.toUpperCase()];
    }

    public async getAllDivisions(includeVirtual: boolean = true): Promise<string[]> {
        try {
            const db = Database.getInstance();
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
        const divUpper = divisionCode.trim().toUpperCase();

        if (this.isVirtualDivision(divUpper)) {
            return this.getVirtualDivisionGangs(divUpper);
        } else {
            return this.getRealDivisionGangs(divUpper, excludeVirtualGangs);
        }
    }

    private async getRealDivisionGangs(locCode: string, excludeVirtual: boolean = true): Promise<Gang[]> {
        const db = Database.getInstance();
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

        const db = Database.getInstance();

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
