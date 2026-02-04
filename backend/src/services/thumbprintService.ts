import { join } from "path";
import { file, write } from "bun";

export class ThumbprintService {
    private static instance: ThumbprintService;
    private dataPath: string;

    private constructor() {
        this.dataPath = join(process.cwd(), "data", "thumbprint_data.json");
    }

    public static getInstance(): ThumbprintService {
        if (!ThumbprintService.instance) {
            ThumbprintService.instance = new ThumbprintService();
        }
        return ThumbprintService.instance;
    }

    private async loadData(): Promise<Record<string, Record<string, number>>> {
        try {
            const f = file(this.dataPath);
            if (await f.exists()) {
                return await f.json();
            }
            return {};
        } catch (e) {
            console.error("[ThumbprintService] Failed to load data:", e);
            return {};
        }
    }

    private async saveData(data: Record<string, Record<string, number>>): Promise<boolean> {
        try {
            await write(this.dataPath, JSON.stringify(data, null, 2));
            return true;
        } catch (e) {
            console.error("[ThumbprintService] Failed to save data:", e);
            return false;
        }
    }

    public async getThumbprintData(month: number, year: number): Promise<Record<string, number>> {
        const data = await this.loadData();
        const key = `${year}-${month.toString().padStart(2, '0')}`;
        return data[key] || {};
    }

    public async updateThumbprintValue(month: number, year: number, divisionCode: string, value: number): Promise<boolean> {
        const data = await this.loadData();
        const key = `${year}-${month.toString().padStart(2, '0')}`;

        if (!data[key]) {
            data[key] = {};
        }

        data[key][divisionCode] = value;
        return await this.saveData(data);
    }
}

export const thumbprintService = ThumbprintService.getInstance();
