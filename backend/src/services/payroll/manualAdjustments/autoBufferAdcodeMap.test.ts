import { describe, expect, it } from "bun:test";
import {
    AUTO_BUFFER_ADCODE_BY_ADJUSTMENT_NAME,
    buildAutoBufferSeedRemark,
    resolveAutoBufferAdcode
} from "./autoBufferAdcodeMap";

describe("autoBufferAdcodeMap", () => {
    it("keeps exact adcode mapping required by seeder", () => {
        expect(AUTO_BUFFER_ADCODE_BY_ADJUSTMENT_NAME["SPSI"]).toBe("potongan spsi");
        expect(AUTO_BUFFER_ADCODE_BY_ADJUSTMENT_NAME["MASA KERJA"]).toBe("masa kerja");
        expect(AUTO_BUFFER_ADCODE_BY_ADJUSTMENT_NAME["TUNJANGAN JABATAN"]).toBe("tunjangan jabatan");
    });

    it("builds remark with sync + match status when seeded value matches source", () => {
        expect(buildAutoBufferSeedRemark("SPSI", 4000, 4000)).toBe(
            "SPSI | potongan spsi | 4000 | sync:SYNC | match:MATCH"
        );
        expect(buildAutoBufferSeedRemark("MASA KERJA", 25000, 25000)).toBe(
            "MASA KERJA | masa kerja | 25000 | sync:SYNC | match:MATCH"
        );
        expect(buildAutoBufferSeedRemark("TUNJANGAN JABATAN", 0, 0)).toBe(
            "TUNJANGAN JABATAN | tunjangan jabatan | 0 | sync:SYNC | match:MATCH"
        );
    });

    it("marks remark as miss + mismatch when seeded value differs from source", () => {
        expect(buildAutoBufferSeedRemark("SPSI", 4000, 0)).toBe(
            "SPSI | potongan spsi | 4000 | sync:MISS | match:MISMATCH"
        );
    });

    it("accepts legacy AUTO-prefixed names but emits canonical names", () => {
        expect(buildAutoBufferSeedRemark("AUTO MASA KERJA", 25000, 25000)).toBe(
            "MASA KERJA | masa kerja | 25000 | sync:SYNC | match:MATCH"
        );
    });

    it("rejects unknown adjustment name", () => {
        expect(() => resolveAutoBufferAdcode("AUTO UNKNOWN")).toThrow();
    });
});
