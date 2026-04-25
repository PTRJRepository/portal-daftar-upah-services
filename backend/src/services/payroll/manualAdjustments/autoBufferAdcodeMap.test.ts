import { describe, expect, it } from "bun:test";
import {
    AUTO_BUFFER_ADCODE_BY_ADJUSTMENT_NAME,
    buildAutoBufferSeedRemark,
    resolveAutoBufferAdcode
} from "./autoBufferAdcodeMap";

describe("autoBufferAdcodeMap", () => {
    it("keeps exact adcode mapping required by seeder", () => {
        expect(AUTO_BUFFER_ADCODE_BY_ADJUSTMENT_NAME["AUTO SPSI"]).toBe("potongan spsi");
        expect(AUTO_BUFFER_ADCODE_BY_ADJUSTMENT_NAME["AUTO MASA KERJA"]).toBe("masa kerja");
        expect(AUTO_BUFFER_ADCODE_BY_ADJUSTMENT_NAME["AUTO TUNJANGAN JABATAN"]).toBe("tunjangan jabatan");
    });

    it("builds remark with format adjustment_name | adcode | amount", () => {
        expect(buildAutoBufferSeedRemark("AUTO SPSI", 4000)).toBe("AUTO SPSI | potongan spsi | 4000");
        expect(buildAutoBufferSeedRemark("AUTO MASA KERJA", 25000)).toBe("AUTO MASA KERJA | masa kerja | 25000");
        expect(buildAutoBufferSeedRemark("AUTO TUNJANGAN JABATAN", 0)).toBe("AUTO TUNJANGAN JABATAN | tunjangan jabatan | 0");
    });

    it("rejects unknown adjustment name", () => {
        expect(() => resolveAutoBufferAdcode("AUTO UNKNOWN")).toThrow();
    });
});
