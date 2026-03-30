/**
 * ============================================================================================
 * DIVISION DEFINITION SERVICE
 * ============================================================================================
 *
 * PURPOSE:
 * Service ini mengelola definisi divisi (real dan virtual) untuk seluruh aplikasi.
 * Menyediakan API terpusat untuk:
 * - Mendapatkan semua divisi (real + virtual)
 * - Mapping gang ke virtual division
 * - Resolution virtual division ke real division untuk query database
 *
 * VIRTUAL DIVISIONS:
 * Virtual divisions adalah grouping gang berdasarkan fungsi:
 * - INF: Infrastruktur (gang IN*)
 * - NRS: Nursery (gang B2N)
 * - WKS_PG: Workshop Parit Gunung (gang AMC)
 * - WKS_AR: Workshop Air Ruak (gang HMC)
 * - WORKSHOP: Gabungan Workshop
 * - ARC: Air Ruak Central (gang J)
 * - MILL: Palm Oil Mill (gang M)
 *
 * MODULAR ARCHITECTURE:
 * Sekarang menggunakan VirtualDivisionRegistry sebagai backend storage.
 * DivisionDefinition menjadi thin wrapper yang menjaga backward compatibility.
 *
 * AI INDEXING TAGS:
 * - division-definition
 * - virtual-divisions
 * - gang-mapping
 * - payroll-system
 * - modular-system
 * ============================================================================================
 */

import { Database } from "../db/client";
import { divisionConfigService } from "./config/DivisionConfigService";
import { virtualDivisionRegistry } from "./virtualDivisionRegistry";
import { gangService } from "./gangService";

/**
 * Interface untuk konfigurasi virtual division.
 * DIJAGA UNTUK BACKWARD COMPATIBILITY - Gunakan VirtualDivisionPlugin dari virtualDivisionRegistry
 */
export interface VirtualDivisionConfig {
    name: string;
    source_division: string | null;
    pattern: string | null;
    description_pattern?: string;
    exclude_from_source: boolean;
    description: string;
}

/**
 * Interface untuk data gang
 */
export interface Gang {
    gang_code: string;
    description: string;
    loc_code: string;
    source_loc_code?: string;
    asistensi?: string;
}

/**
 * Main Division Definition Service
 *
 * Sekarang menggunakan VirtualDivisionRegistry secara internal untuk definisi.
 * Semua method publik dipertahankan untuk backward compatibility.
 *
 * SERVICES YANG MENGGUNAKAN:
 * - taxReportService: Untuk resolve virtual division ke real division
 * - summaryService: Untuk agregasi data per virtual division
 * - otherIncomesService: Untuk filtering THR per virtual division
 * - historyDatabaseService: Untuk query data berdasarkan virtual division
 * - wagesService: Untuk laporan wages per virtual division
 * - gangService: Untuk mendapatkan list gang per divisi
 */
export class DivisionDefinition {
    private static instance: DivisionDefinition;

    /**
     * Constructor private untuk singleton pattern.
     * Secara internal menggunakan VirtualDivisionRegistry.
     */
    private constructor() { }

    /**
     * Mendapatkan instance singleton.
     *
     * Usage:
     *   const divDef = DivisionDefinition.getInstance();
     *   const gangs = await divDef.getGangsForDivision('INF');
     */
    public static getInstance(): DivisionDefinition {
        if (!DivisionDefinition.instance) {
            DivisionDefinition.instance = new DivisionDefinition();
        }
        return DivisionDefinition.instance;
    }

    /**
     * Mendapatkan nomor asistensi dari kode gang.
     * Aturan:
     * - Angka pertama dalam gang code menjadi nomor asistensi (Grup)
     *
     * Usage:
     *   const asistensi = divDef.getAsistensiFromGang('D2'); // returns '2'
     *   const asistensi = divDef.getAsistensiFromGang('P1A'); // returns '1'
     *   const asistensi = divDef.getAsistensiFromGang('K2A'); // returns '2' (follows first digit rule)
     *
     * @param gangCode - Kode gang (misal: 'D2', 'P1A', 'K2A')
     * @param locCode - Optional, kode divisi
     */
    public getAsistensiFromGang(gangCode: string, locCode?: string): string | null {
        if (!gangCode) return null;
        const gc = gangCode.trim().toUpperCase();

        // Extract only the FIRST digit found in the gang code.
        // This corresponds to the "middle number" in patterns like A1H, G2M, etc.
        const match = gc.match(/\d/);
        return match ? match[0] : null;
    }

    /**
     * Resolve kode division (termasuk alias) ke kode actual.
     *
     * Usage:
     *   const code = divDef.resolveDivisionCode('INFRA'); // returns 'INF'
     *   const code = divDef.resolveDivisionCode('WORKSHOP AR'); // returns 'WKS_AR'
     *
     * @param code - Kode atau alias division
     */
    public resolveDivisionCode(code: string): string {
        // Use DivisionConfigService as single source of truth
        return divisionConfigService.resolveCode(code);
    }

    /**
     * Mengecek apakah kode adalah virtual division.
     *
     * Usage:
     *   const isVirtual = divDef.isVirtualDivision('INF'); // returns true
     *   const isVirtual = divDef.isVirtualDivision('AB1'); // returns false
     *
     * @param divisionCode - Kode division yang akan dicek
     */
    public isVirtualDivision(divisionCode: string): boolean {
        // Use DivisionConfigService as single source of truth
        return divisionConfigService.isVirtualDivision(divisionCode);
    }

    /**
     * Mendapatkan konfigurasi virtual division.
     *
     * Usage:
     *   const config = divDef.getVirtualDivisionConfig('INF');
     *   // returns { name: 'Infrastruktur', source_division: 'P1A', ... }
     *
     * @param divisionCode - Kode virtual division
     */
    public getVirtualDivisionConfig(divisionCode: string): VirtualDivisionConfig | undefined {
        const plugin = virtualDivisionRegistry.getPlugin(divisionCode);
        if (!plugin) return undefined;

        // Convert to legacy format for backward compatibility
        return {
            name: plugin.name,
            source_division: plugin.sourceDivision,
            pattern: plugin.gangPattern ? plugin.gangPattern.source : null,
            description_pattern: plugin.descriptionPattern ? plugin.descriptionPattern.source : undefined,
            exclude_from_source: plugin.excludeFromSource,
            description: plugin.description
        };
    }

    /**
     * Mendapatkan semua divisi (real + virtual).
     *
     * Usage:
     *   const allDivisions = await divDef.getAllDivisions(true);
     *   // returns ['AB1', 'AB2', 'P1A', 'P1B', ..., 'INF', 'NRS', ...]
     *
     * @param includeVirtual - Apakah menyertakan virtual divisions
     */
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
                // Use DivisionConfigService as single source of truth for virtual codes
                const virtualCodes = divisionConfigService.getAllDivisionCodes();
                return [...realDivisions, ...virtualCodes];
            }
            return realDivisions;

        } catch (e) {
            console.error("[DivisionDefinition] Error fetching divisions:", e);
            throw e;
        }
    }

    /**
     * Mendapatkan semua gang untuk division tertentu.
     * Jika division adalah virtual, returns gangs yang termasuk dalam virtual division tersebut.
     *
     * Usage:
     *   const gangs = await divDef.getGangsForDivision('INF');
     *   // returns [{ gang_code: 'IN01', description: '...', loc_code: 'INF', ... }]
     *
     * @param divisionCode - Kode division (real atau virtual)
     * @param excludeVirtualGangs - Apakah exclude gangs yang termasuk virtual division lain
     */
    public async getGangsForDivision(divisionCode: string, excludeVirtualGangs: boolean = true): Promise<Gang[]> {
        const resolved = this.resolveDivisionCode(divisionCode);

        if (this.isVirtualDivision(resolved)) {
            return this.getVirtualDivisionGangs(resolved);
        } else {
            return this.getRealDivisionGangs(resolved, excludeVirtualGangs);
        }
    }

    /**
     * Mendapatkan REAL source divisions untuk sebuah virtual division.
     * PENTING untuk aggregation - mengetahui divisi mana yang di-query.
     *
     * Usage:
     *   const sources = await divDef.getSourceDivisionsForAggregation('WKS_PG');
     *   // returns ['P1A']
     *
     *   const sources = await divDef.getSourceDivisionsForAggregation('WORKSHOP');
     *   // returns ['P1A', 'AB2'] (dari matched gangs)
     *
     * @param divisionCode - Kode virtual division
     */
    public async getSourceDivisionsForAggregation(divisionCode: string): Promise<string[]> {
        const resolved = this.resolveDivisionCode(divisionCode);

        // Jika bukan virtual division, return semua aliases menggunakan unified mapping
        if (!this.isVirtualDivision(resolved)) {
            // Use gangService unified mapping to get all aliases
            const aliases = gangService.getAllDivisionAliases(resolved);
            return aliases.length > 0 ? aliases : [resolved];
        }

        const config = this.getVirtualDivisionConfig(resolved);
        if (!config) {
            return [resolved];
        }

        // Jika virtual division punya source_division spesifik, gunakan itu
        if (config.source_division) {
            return [config.source_division];
        }

        // Untuk virtual divisions tanpa source_division (seperti WORKSHOP),
        // kita perlu dapat source LocCodes dari matched gangs
        const gangs = await this.getVirtualDivisionGangs(resolved);
        const sourceLocCodes = new Set<string>();

        for (const gang of gangs) {
            if (gang.source_loc_code) {
                sourceLocCodes.add(gang.source_loc_code);
            }
        }

        return sourceLocCodes.size > 0 ? Array.from(sourceLocCodes) : [resolved];
    }

    /**
     * Mendapatkan semua virtual divisions untuk sebuah source division.
     *
     * Usage:
     *   const virtuals = await divDef.getVirtualDivisionsForSource('P1A');
     *   // returns ['INF', 'WKS_PG']
     *
     * @param sourceDivCode - Kode divisi sumber
     */
    public async getVirtualDivisionsForSource(sourceDivCode: string): Promise<string[]> {
        const results: string[] = [];
        const source = sourceDivCode.trim().toUpperCase();
        const plugins = virtualDivisionRegistry.getAllPlugins();

        for (const plugin of plugins) {
            if (plugin.sourceDivision && plugin.sourceDivision.toUpperCase() === source) {
                results.push(plugin.code);
            }
        }
        return results;
    }

    /**
     * Mendapatkan gangs untuk division real.
     *
     * @param locCode - Kode divisi
     * @param excludeVirtual - Apakah exclude gangs yang termasuk virtual division lain
     */
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

    /**
     * Mendapatkan gangs untuk virtual division.
     *
     * @param virtualCode - Kode virtual division
     */
    private async getVirtualDivisionGangs(virtualCode: string): Promise<Gang[]> {
        const config = this.getVirtualDivisionConfig(virtualCode);
        if (!config) return [];

        const db = Database.getInstance(undefined, "SERVER_PROFILE_2");

        let rows: { GangCode: string, Description: string, LocCode: string }[];

        if (config.source_division) {
            // Use aliases for the source division to ensure we find all gangs
            const aliases = divisionConfigService.getAliases(config.source_division);
            const placeholders = aliases.map(() => '?').join(',');
            
            rows = await db.query(`
                SELECT [GangCode], [Description], [LocCode]
                FROM [dbo].[HR_GANG]
                WHERE RTRIM(LTRIM(UPPER(LocCode))) IN (${placeholders})
                ORDER BY [GangCode]
            `, aliases);
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

    /**
     * Mendeteksi virtual division untuk sebuah gang.
     *
     * Usage:
     *   const virtDiv = divDef.getVirtualDivisionForGang('IN01', 'P1A', 'Infrastruktur Afdeling 1');
     *   // returns 'INF'
     *
     * @param gangCode - Kode gang
     * @param sourceLocCode - Kode divisi sumber
     * @param description - Deskripsi gang
     */
    public getVirtualDivisionForGang(gangCode: string, sourceLocCode: string, description: string): string | null {
        return virtualDivisionRegistry.matchGang(gangCode, description, sourceLocCode);
    }

    /**
     * Fallback: deteksi virtual division hanya berdasarkan pattern (tanpa validasi source).
     * Digunakan ketika gang tidak ditemukan di gangDivMap.
     *
     * @param gangCode - Kode gang
     * @param description - Deskripsi gang
     */
    public getVirtualDivisionByPatternOnly(gangCode: string, description: string): string | null {
        return virtualDivisionRegistry.matchGangByPatternOnly(gangCode, description);
    }

    /**
     * Mengecek apakah gang termasuk dalam virtual division manapun.
     *
     * @param gangCode - Kode gang
     * @param sourceLocCode - Kode divisi sumber
     * @param description - Deskripsi gang
     */
    private gangBelongsToVirtual(gangCode: string, sourceLocCode: string, description: string): boolean {
        const gc = gangCode.trim().toUpperCase();
        const desc = description.trim().toUpperCase();
        const source = sourceLocCode.trim().toUpperCase();

        const plugins = virtualDivisionRegistry.getAllPlugins();

        for (const plugin of plugins) {
            if (!plugin.excludeFromSource) continue;

            // Check LocCode
            if (plugin.sourceDivision && plugin.sourceDivision.toUpperCase() !== source) {
                continue;
            }

            // Check gang pattern
            if (plugin.gangPattern && plugin.gangPattern.test(gc)) {
                return true;
            }

            // Check description pattern
            if (plugin.descriptionPattern && plugin.descriptionPattern.test(desc)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Mendapatkan urutan display untuk virtual divisions.
     * DIJAGA UNTUK BACKWARD COMPATIBILITY.
     */
    public get VIRTUAL_DIVISION_ORDER(): string[] {
        return virtualDivisionRegistry.getDisplayOrder();
    }
}

// Export singleton instance
export const divisionDefinition = DivisionDefinition.getInstance();
