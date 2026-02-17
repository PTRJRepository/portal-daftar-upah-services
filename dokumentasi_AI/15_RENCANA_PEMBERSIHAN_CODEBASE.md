# Rencana Pembersihan Codebase

## Analisis File yang Tidak Terpakai

Berdasarkan analisis struktur project, berikut adalah file-file yang dapat dihapus untuk efisiensi codebase.

---

## Kategori File yang Akan Dihapus

### 1. Backend - Test/Debug Files (Root Level)

| File | Alasan |
|------|--------|
| `backend/ab1_after_fix.json` | Test data file |
| `backend/ab1_api_result.json` | Test data file |
| `backend/ab1_f620897.json` | Test data file |
| `backend/ab1_new_filter.json` | Test data file |
| `backend/ab1_new_logic.json` | Test data file |
| `backend/ab1_test.json` | Test data file |
| `backend/aggregation_result.json` | Test output file |
| `backend/harvest_bunches_scan_report.json` | Test output file |
| `backend/seeder_response.json` | Test output file |
| `backend/taskcode_found.json` | Test output file |
| `backend/check_dynamic_premi.ts` | Debug script |
| `backend/check_pph_values.ts` | Debug script |
| `backend/check_update.ts` | Debug script |
| `backend/debug_holiday_2026.ts` | Debug script |
| `backend/debug_holiday_simple.sql` | Debug SQL |
| `backend/debug.log` | Log file |
| `backend/output.txt` | Output file |
| `backend/output_alt.txt` | Output file |
| `backend/pph_debug.txt` | Debug file |
| `backend/pph_debug_2.txt` | Debug file |
| `backend/pph_debug_3.txt` | Debug file |
| `backend/test_output.txt` | Test output |
| `backend/test_pph_mapping.ts` | Test script |
| `backend/verification_output.txt` | Verification output |
| `backend/verify_output.txt` | Verification output |
| `backend/verify_result.txt` | Verification output |
| `backend/verify.log` | Log file |
| `backend/run_seed.ts` | One-time seed script |
| `backend/create_table_employee_estate.ts` | One-time migration script |

### 2. Backend - Scripts Folder (Debug/Test Scripts)

| File | Alasan |
|------|--------|
| `backend/scripts/checkHolidayOnly.ts` | Debug script |
| `backend/scripts/debug_validate_ab1.ts` | Debug script |
| `backend/scripts/debug-raw-tree.ts` | Debug script |
| `backend/scripts/debugIsRegionPH.ts` | Debug script |
| `backend/scripts/find_114k_employee.ts` | One-time find script |
| `backend/scripts/fixHoliday2026.mjs` | One-time fix script |
| `backend/scripts/fixHoliday2026.ts` | One-time fix script |
| `backend/scripts/test_aggregation_logging.ts` | Test script |
| `backend/scripts/test-component-api.sh` | Test script |
| `backend/scripts/test-spreadsheet-direct.ts` | Test script |
| `backend/scripts/test-spreadsheet-sync.ts` | Test script |
| `backend/scripts/testPph21Ter.ts` | Test script |
| `backend/scripts/testTiketExclusion.ts` | Test script |
| `backend/scripts/verify_refactor.ts` | Verification script |

### 3. Backend - Src Scripts Folder (Development Scripts)

| File | Alasan |
|------|--------|
| `backend/src/output.txt` | Output file |
| `backend/src/test.ts` | Test file |
| `backend/src/verify_fix.ts` | Verification script |
| `backend/src/verify_friday.ts` | Verification script |
| `backend/src/verify_gang_mapping.ts` | Verification script |
| `backend/src/verify_profile_fix.ts` | Verification script |
| `backend/src/scripts/add_kinerja_column.ts` | One-time migration |
| `backend/src/scripts/add_missing_column.ts` | One-time migration |
| `backend/src/scripts/analyze_attendance.ts` | Analysis script |
| `backend/src/scripts/check_138_employees.ts` | Debug script |
| `backend/src/scripts/check_ab1_attendance.ts` | Debug script |
| `backend/src/scripts/check_ab1_gangs.ts` | Debug script |
| `backend/src/scripts/check_aggregation_data.ts` | Debug script |
| `backend/src/scripts/check_aggregation_periods.ts` | Debug script |
| `backend/src/scripts/check_employee_columns.ts` | Debug script |
| `backend/src/scripts/check_employee_loc.ts` | Debug script |
| `backend/src/scripts/check_employee_master.ts` | Debug script |
| `backend/src/scripts/check_ext_prod.ts` | Debug script |
| `backend/src/scripts/check_gang_details.ts` | Debug script |
| `backend/src/scripts/check_gangln_columns.ts` | Debug script |
| `backend/src/scripts/check_harvester_columns.ts` | Debug script |
| `backend/src/scripts/check_harvester_columns_v2.ts` | Debug script |
| `backend/src/scripts/check_jamila_cuti.ts` | Debug script |
| `backend/src/scripts/check_jamila_salary.ts` | Debug script |
| `backend/src/scripts/check_jamila.ts` | Debug script |
| `backend/src/scripts/check_loc_simple.ts` | Debug script |
| `backend/src/scripts/check_mill_data.ts` | Debug script |
| `backend/src/scripts/check_null_gang_employees.ts` | Debug script |
| `backend/src/scripts/check_payroll_extraction.ts` | Debug script |
| `backend/src/scripts/check_payroll_location.ts` | Debug script |
| `backend/src/scripts/check_pr_bunch.ts` | Debug script |
| `backend/src/scripts/check_raw_gangs_db.ts` | Debug script |
| `backend/src/scripts/check_raw_gangs.ts` | Debug script |
| `backend/src/scripts/check_sec_employees.ts` | Debug script |
| `backend/src/scripts/check_specific_gangs.ts` | Debug script |
| `backend/src/scripts/check_taskregln_columns.ts` | Debug script |
| `backend/src/scripts/check_workshop_data.ts` | Debug script |
| `backend/src/scripts/cleanup_workshop.ts` | One-time cleanup |
| `backend/src/scripts/compare_api_vs_db.ts` | Comparison script |
| `backend/src/scripts/debug_attendance.ts` | Debug script |
| `backend/src/scripts/debug_divisions.ts` | Debug script |
| `backend/src/scripts/debug_source_divisions.ts` | Debug script |
| `backend/src/scripts/find_driver_gang.ts` | Find script |
| `backend/src/scripts/find_missing_employee.ts` | Find script |
| `backend/src/scripts/find_missing.ts` | Find script |
| `backend/src/scripts/find_production_table.ts` | Find script |
| `backend/src/scripts/find_production_table_v2.ts` | Find script |
| `backend/src/scripts/get_token.ts` | Utility script |
| `backend/src/scripts/insert_manual_gang.ts` | One-time insert |
| `backend/src/scripts/inspect_data_to_file.ts` | Inspection script |
| `backend/src/scripts/inspect_mill_tickets.ts` | Inspection script |
| `backend/src/scripts/inspect_mill_tickets_v2.ts` | Inspection script |
| `backend/src/scripts/list_tables.ts` | Utility script |
| `backend/src/scripts/scan_harvest_bunches_data.ts` | Scan script |
| `backend/src/scripts/seed_aggregation.ts` | Seed script |
| `backend/src/scripts/seed_feb_2026.ts` | One-time seed |
| `backend/src/scripts/seed_mill.ts` | Seed script |
| `backend/src/scripts/seed_workshop.ts` | Seed script |
| `backend/src/scripts/test_regex.ts` | Test script |
| `backend/src/scripts/test-component-integration.ts` | Test script |
| `backend/src/scripts/trigger_seeder_direct.ts` | Trigger script |
| `backend/src/scripts/verify_driver_employee.ts` | Verification script |
| `backend/src/scripts/verify_gang_production.ts` | Verification script |
| `backend/src/scripts/verify_lembur_refactor.ts` | Verification script |

### 4. Frontend - Test/Debug Files

| File | Alasan |
|------|--------|
| `frontend/build_error.log` | Build log |
| `frontend/build_log.txt` | Build log |
| `frontend/nul` | Invalid file |
| `frontend/vite.config.test.js` | Test config |
| `frontend/vitest.config.js` | Test config |
| `frontend/src/__tests__/expandCollapse.test.jsx` | Test file |
| `frontend/src/__tests__/hierarchy.test.js` | Test file |
| `frontend/src/components/common/GangFilter.test.jsx` | Test file |
| `frontend/src/services/gangFilterService.test.js` | Test file |
| `frontend/src/utils/PayrollAggregator.test.js` | Test file |
| `frontend/src/components/dashboard/GangComparisonChart.jsx.backup` | Backup file |

### 5. Root Level - Unused Files

| File | Alasan |
|------|--------|
| `backend_python.zip` | Old Python backend archive |
| `cookies.txt` | Cookie file (should not be in repo) |
| `token.txt` | Token file (should not be in repo) |
| `data_output.txt` | Output file |
| `employee_columns.txt` | Column list file |
| `gangln_columns.txt` | Column list file |
| `harvester_columns.txt` | Column list file |
| `inspection_results.txt` | Inspection results |
| `verify_api.ts` | Verification script |
| `verify_production_output.txt` | Verification output |
| `columns.json` | Column data |
| `all_tables.txt` | Table list |

---

## File yang TIDAK Boleh Dihapus

### Backend Services (Digunakan oleh index.ts)
- `backend/src/services/*` - Semua service files
- `backend/src/api/*` - Semua route files
- `backend/src/db/*` - Database client
- `backend/src/config.ts` - Configuration
- `backend/src/index.ts` - Main entry point
- `backend/src/types/*` - Type definitions

### Frontend (Digunakan oleh App.jsx)
- `frontend/src/pages/*` - Semua page files
- `frontend/src/components/*` - Semua component files
- `frontend/src/services/*` - Semua service files
- `frontend/src/context/*` - Context providers
- `frontend/src/hooks/*` - Custom hooks
- `frontend/src/layouts/*` - Layout components
- `frontend/src/utils/*` - Utility functions
- `frontend/src/styles/*` - CSS files

---

## Estimasi Penghematan

| Kategori | Jumlah File | Estimasi Ukuran |
|----------|-------------|-----------------|
| Backend Test/Debug Files | ~30 files | ~500 KB |
| Backend Scripts | ~60 files | ~150 KB |
| Frontend Test Files | ~10 files | ~50 KB |
| Root Level Files | ~12 files | ~600 KB |
| **Total** | **~112 files** | **~1.3 MB** |

---

## Langkah Eksekusi

1. **Commit state saat ini** - Memastikan ada backup
2. **Hapus file backend test/debug** - Root level
3. **Hapus file backend scripts** - Development scripts
4. **Hapus file frontend test** - Test files
5. **Hapus file root level** - Unused files
6. **Verifikasi build** - Pastikan tidak ada error
7. **Commit hasil pembersihan**

---

## Perintah Git

```bash
# Step 1: Commit current state
git add .
git commit -m "chore: backup before cleanup"

# Step 2: Remove files (akan dilakukan secara bertahap)

# Step 3: Verify build
cd backend && bun run build
cd frontend && bun run build

# Step 4: Commit cleanup
git add .
git commit -m "chore: remove unused test and debug files"
```

---

## Catatan Penting

⚠️ **PERINGATAN**: File-file berikut harus diperiksa manual sebelum dihapus:
- `backend/src/scripts/debug_extend_db.ts` - Mungkin masih digunakan
- File `.env` - Jangan dihapus (berisi konfigurasi)
- File `keys/` - Jangan dihapus (berisi SSL keys)

✅ **AMAN**: File-file dalam daftar di atas adalah file test, debug, output, dan temporary yang tidak mempengaruhi fungsionalitas aplikasi.
