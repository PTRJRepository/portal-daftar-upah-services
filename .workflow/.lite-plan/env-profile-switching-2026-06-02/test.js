
const out = "D:/Gawean Rebinmas/PORTAL_ESTATE/Plantware_Auto_Report/Daftar_Upah_baru/payroll_daftar_upah/refactor_production/.workflow/.lite-plan/env-profile-switching-2026-06-02/exploration-dependencies.json";
const d = JSON.parse(fs.readFileSync(out, 'utf8'));
process.stdout.write('ok: ' + d.task);
