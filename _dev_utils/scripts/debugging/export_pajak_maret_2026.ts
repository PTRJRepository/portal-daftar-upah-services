/**
 * Export PPh21 TER Tax Mapping per Division for Maret 2026
 *
 * Strategy: Query PER GANG (not per division) to avoid DB timeouts.
 *
 * Usage:
 *   bun run _dev_utils/scripts/debugging/export_pajak_maret_2026.ts
 *
 * Output:
 *   update_pajak/{DIVISI}_pajak.json      — calculated TER tax per emp_code
 *   update_pajak/{DIVISI}_pph_input.json — input PPh21 (pot_pph21) per emp_code
 *   update_pajak/_summary.json            — overview semua divisi
 */

import { taxReportService } from "../../../backend/src/services/taxReportService";
import { gangService } from "../../../backend/src/services/gangService";
import { divisionConfigService } from "../../../backend/src/services/config/DivisionConfigService";
import * as fs from "fs";
import * as path from "path";

// ——— Config ————————————————————————————————————————————————————————
const TARGET_DIR = path.resolve(__dirname, "../../../update_pajak");
const BULAN = 3;
const TAHUN = 2026;
const MAX_CONCURRENT = 2; // low concurrency to avoid DB overload

// ——— Helpers ——————————————————————————————————————————————————————————

function mapEmployeeTax(emp: any): Record<string, any> {
    return {
        no: emp.no,
        emp_code: emp.emp_code,
        emp_name: emp.emp_name,
        nik: emp.nik,
        npwp: emp.npwp,
        gender: emp.gender,
        jabatan: emp.jabatan,
        alamat: emp.alamat,
        gang_code: emp.gang_code,
        status_ptkp: emp.status_ptkp,
        kategori_ter: emp.kategori_ter,
        penghasilan_bruto: emp.penghasilan_bruto,
        tarif_pajak_ter: emp.tarif_pajak_ter,
        pph21_ter: emp.pph21_ter,
        pph21_input: emp.pot_pph21 ?? null,
        upah_kotor: emp.upah_kotor,
        tunjangan_beras: emp.tunjangan_beras,
        tunjangan_jabatan: emp.tunjangan_jabatan,
        tunjangan_masa_kerja: emp.tunjangan_masa_kerja,
        tunjangan_lembur: emp.tunjangan_lembur,
        total_tunjangan: emp.total_tunjangan,
        premi_detail: emp.premi_detail,
        premi_brondol: emp.premi_brondol,
        premi_pph: emp.premi_pph,
        total_premi: emp.total_premi,
        pot_spsi: emp.pot_spsi,
        pot_koreksi: emp.pot_koreksi,
        total_potongan_kotor: emp.total_potongan_kotor,
        bpjs_kes_majikan: emp.bpjs_kes_majikan,
        astek_jht_majikan: emp.astek_jht_majikan,
        thr_amount: emp.thr_amount,
        exgratia_amount: emp.exgratia_amount,
        other_incomes: emp.other_incomes,
        hk: emp.hk,
        gaji_pokok_aktual: emp.gaji_pokok_aktual,
        koreksi_hk: emp.koreksi_hk,
    };
}

function mapEmployeePphInput(emp: any): Record<string, any> {
    const input = emp.pot_pph21 ?? 0;
    const ter = emp.pph21_ter ?? 0;
    return {
        emp_code: emp.emp_code,
        emp_name: emp.emp_name,
        nik: emp.nik,
        gang_code: emp.gang_code,
        status_ptkp: emp.status_ptkp,
        pph21_input: input,
        pph21_ter: ter,
        selisih: input - ter,
    };
}

// ——— Concurrency limiter ———————————————————————————————————————————
async function runWithLimit<T>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<void>
): Promise<void> {
    const queue = [...items];
    const running: Promise<void>[] = [];

    while (queue.length > 0 || running.length > 0) {
        while (queue.length > 0 && running.length < concurrency) {
            const item = queue.shift()!;
            const p = fn(item).finally(() => {
                const idx = running.indexOf(p);
                if (idx !== -1) running.splice(idx, 1);
            });
            running.push(p);
        }
        if (running.length > 0) {
            await Promise.race(running);
        }
    }
    await Promise.all(running);
}

// ——— File writer ——————————————————————————————————————————————————
function writeDivisionFiles(
    targetDir: string,
    divisi: string,
    bulan: number,
    tahun: number,
    timestamp: string,
    employees: Record<string, Record<string, any>>,
    pphInputs: Record<string, Record<string, any>>,
    dataSource: string
): void {
    const totalTer = Object.values(employees).reduce((s, e) => s + (e.pph21_ter ?? 0), 0);
    const inputTotal = Object.values(pphInputs).reduce((s, e) => s + (e.pph21_input ?? 0), 0);
    const terTotal = Object.values(pphInputs).reduce((s, e) => s + (e.pph21_ter ?? 0), 0);
    const selisihTotal = Object.values(pphInputs).reduce((s, e) => s + (e.selisih ?? 0), 0);

    const pajakPayload = {
        divisi,
        tipe: "pajak_ter",
        periode: { bulan, tahun },
        generated_at: timestamp,
        data_source: dataSource,
        total_pph21_ter: totalTer,
        employee_count: Object.keys(employees).length,
        employees,
    };
    fs.writeFileSync(path.join(targetDir, `${divisi}_pajak.json`), JSON.stringify(pajakPayload, null, 2));

    const pphPayload = {
        divisi,
        tipe: "pph_input",
        periode: { bulan, tahun },
        generated_at: timestamp,
        data_source: dataSource,
        totals: {
            total_pph21_input: inputTotal,
            total_pph21_ter: terTotal,
            total_selisih: selisihTotal,
        },
        employee_count: Object.keys(pphInputs).length,
        employees: pphInputs,
    };
    fs.writeFileSync(path.join(targetDir, `${divisi}_pph_input.json`), JSON.stringify(pphPayload, null, 2));
}

// ——— Main ————————————————————————————————————————————————————————————
async function main() {
    console.log(`[export_pajak] Starting export for ${BULAN}/${TAHUN}`);
    console.log(`[export_pajak] Output: ${TARGET_DIR}`);

    if (!fs.existsSync(TARGET_DIR)) {
        fs.mkdirSync(TARGET_DIR, { recursive: true });
    }

    const allDivisions = divisionConfigService.getAllDivisionCodes();
    const realDivisions = allDivisions.filter(d => !divisionConfigService.isVirtualDivision(d));
    console.log(`[export_pajak] Divisions: ${realDivisions.join(", ")}`);

    const timestamp = new Date().toISOString();
    const allTasks: { division: string; gang: string; gangDesc: string }[] = [];

    // Collect all gangs per division
    for (const divisi of realDivisions) {
        try {
            const gangs = await gangService.fetchGangs(divisi);
            for (const g of gangs) {
                allTasks.push({ division: divisi, gang: g.gang_code, gangDesc: g.description });
            }
            console.log(`[export_pajak] ${divisi}: ${gangs.length} gangs`);
        } catch (err) {
            console.error(`[export_pajak] Failed gangs for ${divisi}:`, err);
        }
    }

    console.log(`[export_pajak] Total gangs: ${allTasks.length}, concurrency=${MAX_CONCURRENT}`);

    // In-memory accumulators per division
    const employeesAcc: Record<string, Record<string, Record<string, any>>> = {};
    const pphInputsAcc: Record<string, Record<string, Record<string, any>>> = {};
    const divMeta: Record<string, { totalTer: number; dataSource: string }> = {};
    const divGangStats: Record<string, Record<string, { emp_count: number; ter: number; input: number }>> = {};

    for (const d of realDivisions) {
        employeesAcc[d] = {};
        pphInputsAcc[d] = {};
        divMeta[d] = { totalTer: 0, dataSource: "unknown" };
        divGangStats[d] = {};
    }

    let done = 0;
    await runWithLimit(allTasks, MAX_CONCURRENT, async (task) => {
        const { division: divisi, gang: gangCode } = task;

        try {
            const result = await taxReportService.getMonthlyTaxReport(
                TAHUN,
                BULAN,
                undefined, // divisionCode - filter by gang only
                gangCode   // specific gang
            );

            if (!result || result.employees.length === 0) {
                process.stdout.write(`0`);
                return;
            }

            const dataSource = result.data_source ?? "unknown";
            if (divMeta[divisi].dataSource === "unknown" || divMeta[divisi].dataSource === "error") {
                divMeta[divisi].dataSource = dataSource;
            }

            for (const emp of result.employees) {
                const ec = emp.emp_code;
                employeesAcc[divisi][ec] = mapEmployeeTax(emp);
                pphInputsAcc[divisi][ec] = mapEmployeePphInput(emp);
                divMeta[divisi].totalTer += emp.pph21_ter ?? 0;
            }

            const gangTer = result.employees.reduce((s: number, e: any) => s + (e.pph21_ter ?? 0), 0);
            const gangInput = result.employees.reduce((s: number, e: any) => s + (e.pot_pph21 ?? 0), 0);
            divGangStats[divisi][gangCode] = {
                emp_count: result.employees.length,
                ter: gangTer,
                input: gangInput,
            };

            done++;
            process.stdout.write(`\r[export_pajak] Progress: ${done}/${allTasks.length} gangs done`);
        } catch (err: any) {
            const msg = err.message || String(err);
            // Don't print full stack - just key info
            const shortMsg = msg.length > 80 ? msg.substring(0, 80) + "..." : msg;
            console.error(`\n[export_pajak]   X [${divisi}:${gangCode}] ${shortMsg}`);
        }
    });

    console.log(`\n[export_pajak] Writing files...`);

    // Write per-division JSON files
    for (const divisi of realDivisions) {
        const stat = divGangStats[divisi];
        const empCount = Object.keys(employeesAcc[divisi]).length;

        if (empCount === 0) {
            // Write empty stubs
            writeDivisionFiles(TARGET_DIR, divisi, BULAN, TAHUN, timestamp, {}, {}, "none");
            continue;
        }

        writeDivisionFiles(
            TARGET_DIR,
            divisi,
            BULAN,
            TAHUN,
            timestamp,
            employeesAcc[divisi],
            pphInputsAcc[divisi],
            divMeta[divisi].dataSource
        );

        const totalTer = Object.values(employeesAcc[divisi]).reduce((s, e) => s + (e.pph21_ter ?? 0), 0);
        const totalInput = Object.values(pphInputsAcc[divisi]).reduce((s, e) => s + (e.pph21_input ?? 0), 0);
        const totalSelisih = Object.values(pphInputsAcc[divisi]).reduce((s, e) => s + (e.selisih ?? 0), 0);
        console.log(`[export_pajak]   ${divisi}: ${empCount} employees, ter=${totalTer}, input=${totalInput}, selisih=${totalSelisih}`);
    }

    // Write summary
    const summary: Record<string, any> = {};
    for (const divisi of realDivisions) {
        const empCount = Object.keys(employeesAcc[divisi]).length;
        const totalTer = Object.values(employeesAcc[divisi]).reduce((s, e) => s + (e.pph21_ter ?? 0), 0);
        const totalInput = Object.values(pphInputsAcc[divisi]).reduce((s, e) => s + (e.pph21_input ?? 0), 0);
        const totalSelisih = Object.values(pphInputsAcc[divisi]).reduce((s, e) => s + (e.selisih ?? 0), 0);
        summary[divisi] = {
            employee_count: empCount,
            total_pph21_ter: totalTer,
            total_pph21_input: totalInput,
            total_selisih: totalSelisih,
            file_ter: `${divisi}_pajak.json`,
            file_input: `${divisi}_pph_input.json`,
            data_source: divMeta[divisi].dataSource,
            gangs: divGangStats[divisi],
        };
    }

    fs.writeFileSync(
        path.join(TARGET_DIR, "_summary.json"),
        JSON.stringify({ periode: { bulan: BULAN, tahun: TAHUN }, generated_at: timestamp, divisions: summary }, null, 2)
    );

    console.log(`[export_pajak] Done! Files in: ${TARGET_DIR}`);
}

main().catch(console.error);
