process.env.LOG_TO_FILE = process.env.LOG_TO_FILE || "false";
process.env.CLEAR_LOGS_ON_STARTUP = process.env.CLEAR_LOGS_ON_STARTUP || "false";

type SeedPreset = {
    adjustment_type: string;
    adjustment_name: string;
    ad_code: string;
    task_desc: string;
};

const DEFAULT_PRESETS: SeedPreset[] = [
    { adjustment_type: "POTONGAN_KOTOR", adjustment_name: "KOREKSI DENDA PANEN", ad_code: "DE0004", task_desc: "(DE) POTONGAN PREMI" },
    { adjustment_type: "POTONGAN_KOTOR", adjustment_name: "KOREKSI BRONDOL", ad_code: "DE0004", task_desc: "(DE) POTONGAN PREMI" },
    { adjustment_type: "POTONGAN_KOTOR", adjustment_name: "KOREKSI PANEN", ad_code: "DE0004", task_desc: "(DE) POTONGAN PREMI" },
    { adjustment_type: "POTONGAN_KOTOR", adjustment_name: "KOREKSI PRUNING", ad_code: "DE0004", task_desc: "(DE) POTONGAN PREMI" },
    { adjustment_type: "POTONGAN_BERSIH", adjustment_name: "POTONGAN LAINNYA BPJS", ad_code: "DE0009", task_desc: "(DE) POTONGAN BPJS" },
    { adjustment_type: "POTONGAN_BERSIH", adjustment_name: "POTONGAN LAINNYA POTONGAN SPSI", ad_code: "DE0009", task_desc: "(DE) POTONGAN BPJS" },
    { adjustment_type: "POTONGAN_BERSIH", adjustment_name: "POTONGAN LAINNYA POTONGAN TIKET", ad_code: "DE0002", task_desc: "(DE) POTONGAN HUTANG" },
    { adjustment_type: "PREMI", adjustment_name: "PREMI JAGA GENSET", ad_code: "AL0018", task_desc: "(AL) TUNJANGAN JAGA GENSET" },
    { adjustment_type: "PREMI", adjustment_name: "PREMI PANEN", ad_code: "AL3PM2501", task_desc: "(AL) TUNJANGAN PREMI ((PM) HARVESTING MISCELLANEOUS)" },
    { adjustment_type: "PREMI", adjustment_name: "PREMI PRUNING", ad_code: "AL3PM0601", task_desc: "(AL) TUNJANGAN PREMI ((PM) PRUNING)" },
    { adjustment_type: "PREMI", adjustment_name: "PREMI RAKING", ad_code: "AL3PM0106", task_desc: "(AL) TUNJANGAN PREMI ((PM) WEEDING - CIRCLE RAKING)" },
];

function buildRemarksTemplate(preset: SeedPreset): string {
    return `${preset.adjustment_name} | ${preset.ad_code} - ${preset.task_desc} | 0 | sync:MISS | match:MISMATCH`;
}

async function main() {
    const { Config } = await import("../../backend/src/config");
    const { ManualAdjustmentPresetService } = await import("../../backend/src/services/manualAdjustmentPresetService");

    const service = new ManualAdjustmentPresetService();
    const user = "setup_manual_adjustment_presets";

    console.log(`Target preset database: ${Config.DB_EXTEND_PROFILE}/${Config.DB_EXTEND_DATABASE}`);
    await service.ensureTable();

    const seeded = [];
    for (const preset of DEFAULT_PRESETS) {
        const id = await service.upsertPreset({
            ...preset,
            task_code: preset.ad_code,
            base_task_code: preset.ad_code,
            division_code: null,
            remarks_template: buildRemarksTemplate(preset)
        }, user);
        seeded.push({ id, name: preset.adjustment_name, ad_code: preset.ad_code });
        console.log(`[OK] id=${id} ${preset.adjustment_name} -> ${preset.ad_code}`);
    }

    const activePresets = await service.listPresets({ includeInactive: false });
    console.log(JSON.stringify({
        target: {
            profile: Config.DB_EXTEND_PROFILE,
            database: Config.DB_EXTEND_DATABASE
        },
        seeded: seeded.length,
        activePresets: activePresets.length,
        seededPresets: seeded
    }, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
