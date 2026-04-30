import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { PremiumDefinitionService } from "./premiumDefinitionService";

const tempRoot = join(process.cwd(), "logs", "premium-definition-service-test");

function writeDefinitions(filePath: string, definitions: any[]) {
    writeFileSync(filePath, JSON.stringify(definitions, null, 2), "utf-8");
}

describe("PremiumDefinitionService", () => {
    test("reloads definitions when the JSON file changes on disk", () => {
        mkdirSync(tempRoot, { recursive: true });
        const filePath = join(tempRoot, "premium_definitions.json");

        writeDefinitions(filePath, [{
            adjustment_type: "PREMI",
            adjustment_name: "PREMI TEST",
            ad_code: "AL001",
            task_desc: "OLD TASK",
            input_type: "blok",
            is_active: true
        }]);

        const service = PremiumDefinitionService.createForFile(filePath);
        expect(service.getActivePremiumDefinitions()).toContainEqual(expect.objectContaining({
            adjustment_name: "PREMI TEST",
            input_type: "blok"
        }));

        writeDefinitions(filePath, [{
            adjustment_type: "PREMI",
            adjustment_name: "PREMI TEST",
            ad_code: "AL001",
            task_desc: "NEW TASK DESC THAT CHANGES FILE SIZE",
            input_type: "kendaraan",
            is_active: true
        }]);

        expect(service.getActivePremiumDefinitions()).toContainEqual(expect.objectContaining({
            adjustment_name: "PREMI TEST",
            task_desc: "NEW TASK DESC THAT CHANGES FILE SIZE",
            input_type: "kendaraan"
        }));
    });

    test("rejects unsupported input_type values before saving definitions", () => {
        mkdirSync(tempRoot, { recursive: true });
        const filePath = join(tempRoot, "premium_definitions.json");
        writeDefinitions(filePath, []);

        const service = PremiumDefinitionService.createForFile(filePath);

        expect(() => service.addOrUpdateDefinition({
            adjustment_type: "PREMI",
            adjustment_name: "PREMI INVALID",
            ad_code: "AL002",
            task_desc: "INVALID INPUT",
            input_type: "unknown" as any,
            is_active: true
        })).toThrow("input_type");
    });
});
