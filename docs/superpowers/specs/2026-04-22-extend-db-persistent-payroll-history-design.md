# Extend DB Persistent Payroll History Design

## Context

`db_ptrj` adalah source operasional yang terus berubah. Itu membuat hasil payroll, status karyawan, dan struktur komponen daftar upah bisa berbeda ketika report yang sama dibuka di waktu berbeda. Kebutuhan baru adalah menjadikan `extend_db_ptrj` sebagai tempat penyimpanan histori yang presisi, time-based, dan tetap bisa menerima perubahan manual dari user tanpa merusak makna snapshot yang sudah pernah dibuat.

Permintaan pengguna juga menambah dua kelas data baru:

- data master editable lintas periode:
  - status anggota `SPSI`
  - `tanggal_mulai_bekerja_efektif`
- data payroll editable per periode:
  - premi dynamic
  - koreksi
  - potongan lainnya

Target desain ini adalah memastikan:

- snapshot payroll lama tetap beku
- perubahan manual user tidak menulis langsung ke snapshot
- backend dapat membaca data terbaru secara konsisten
- histori perubahan tetap lengkap
- proses snapshot berikutnya dapat mengambil base data + override terbaru secara presisi

## Decision Summary

Arsitektur yang dipilih adalah `base + overlay + immutable snapshot`.

- `db_ptrj` tetap dipakai sebagai base extractor untuk data operasional.
- `extend_db_ptrj` menyimpan:
  - overlay history yang append-only
  - snapshot payroll yang immutable per versi
  - batch metadata untuk versioning snapshot
- edit user dari UI masuk ke tabel overlay history.
- snapshot lama tidak berubah saat ada edit user baru.
- snapshot baru dibuat dengan mengambil base data lalu menerapkan overlay terbaru pada cutoff waktu snapshot tersebut.

Desain ini sengaja menghindari dua antipattern:

- menulis edit manual langsung ke tabel snapshot
- memakai tabel history snapshot lama sebagai editable master

## Goals

- Menyediakan histori payroll yang presisi per periode dan per versi snapshot.
- Menyediakan source of truth editable di `extend_db_ptrj` untuk profil karyawan yang berlaku lintas periode.
- Menyediakan source of truth editable di `extend_db_ptrj` untuk override payroll per periode.
- Menjaga agar backend selalu bisa mengambil versi terbaru dengan query yang deterministik.
- Menyediakan UI Daftar Upah yang bisa menampilkan dan mengedit data baru tersebut.

## Non-Goals

- Mengubah `db_ptrj` menjadi database histori.
- Menghapus tabel snapshot lama secara massal pada fase desain ini.
- Menambahkan multi-branch approval workflow atau audit approval user.
- Mengubah semua report di repo sekaligus pada iterasi pertama.

## Data Model

### 1. `employee_profile_override_history`

Purpose:
- Menyimpan perubahan manual lintas periode untuk profil payroll karyawan.

Fields:
- `id`
- `emp_code`
- `nik`
- `is_spsi_member`
- `effective_start_date`
- `employee_status_at_change`
- `update_index`
- `change_source`
- `change_reason`
- `changed_by`
- `created_at`
- `is_active_record`

Rules:
- Append-only.
- Tidak ada `UPDATE` untuk mengganti row lama.
- Setiap perubahan membuat row baru dengan `update_index = max(update_index) + 1` untuk `emp_code` yang sama.
- Read latest dilakukan per `emp_code`.

Seed initial state:
- `is_spsi_member = 1` bila payroll Maret menunjukkan `pot_spsi > 0`.
- `effective_start_date` mengikuti rule THR yang memperhitungkan rehire setelah terminate.

### 2. `payroll_value_override_history`

Purpose:
- Menyimpan perubahan manual user untuk nilai payroll per periode.

Fields:
- `id`
- `period_month`
- `period_year`
- `division_code`
- `gang_code`
- `emp_code`
- `nik`
- `field_name`
- `field_group`
- `numeric_value`
- `text_value`
- `update_index`
- `change_source`
- `change_reason`
- `changed_by`
- `created_at`
- `is_active_record`

Target fields initial scope:
- premi dynamic
- koreksi
- potongan lainnya

Rules:
- Append-only.
- Satu save membuat row baru per field yang diubah.
- Latest read key:
  - `period_month`
  - `period_year`
  - `division_code`
  - `gang_code`
  - `emp_code`
  - `field_name`

### 3. `payroll_snapshot_batch`

Purpose:
- Menjadi header versioning untuk snapshot payroll immutable.

Fields:
- `id`
- `period_month`
- `period_year`
- `division_code`
- `gang_code`
- `snapshot_version`
- `base_source`
- `overlay_profile_cutoff`
- `overlay_value_cutoff`
- `created_by`
- `created_at`
- `status`
- `notes`

Rules:
- Append-only.
- `snapshot_version` naik per scope:
  - `period_month`
  - `period_year`
  - `division_code`
  - `gang_code`

### 4. Snapshot detail tables

Snapshot detail existing dapat dipertahankan sementara, tetapi harus dikaitkan tegas ke batch/version terbaru.

Minimal contract:
- semua row snapshot punya `snapshot_batch_id` atau `snapshot_version`
- pembacaan history tidak boleh mengira semua row untuk periode/divisi/gang adalah satu versi tunggal tanpa filter

Jika tabel existing tidak mendukung ini dengan aman, perlu migration bertahap ke tabel snapshot detail baru yang explicit-versioned.

## Source-of-Truth Contract

### Base source
- `db_ptrj`

Dipakai untuk:
- extract data operasional mentah
- membangun working projection live
- membentuk bahan awal snapshot baru

### Editable source of truth
- `employee_profile_override_history`
- `payroll_value_override_history`

Dipakai untuk:
- semua perubahan manual dari UI
- semua query backend yang membutuhkan nilai editable terbaru
- seluruh proses snapshot generasi berikutnya

### Immutable history source
- `payroll_snapshot_batch` + snapshot detail tables

Dipakai untuk:
- mode history
- audit hasil payroll yang sudah dibekukan
- report yang harus konsisten terhadap snapshot yang telah disahkan

## Read Model Rules

### Live Working View

Dipakai oleh Daftar Upah operasional.

Flow:
1. extract base payroll dari `db_ptrj`
2. ambil latest profile override per karyawan
3. ambil latest payroll value override untuk periode yang diminta
4. apply override
5. render hasil sebagai working projection

Karakteristik:
- dapat berubah ketika user edit
- bukan histori immutable
- digunakan sebelum snapshot baru dijalankan

### History Snapshot View

Dipakai oleh mode history/report snapshot.

Flow:
1. pilih `snapshot_version` target atau latest version untuk scope yang diminta
2. baca data snapshot detail milik batch itu
3. render tanpa menerapkan overlay baru

Karakteristik:
- immutable
- harus tetap sama walaupun ada edit baru setelah snapshot dibuat

## Snapshot Generation Flow

Saat user menjalankan snapshot:

1. backend memilih scope:
  - `period_month`
  - `period_year`
  - `division_code`
  - `gang_code`
2. backend extract base data dari `db_ptrj`
3. backend baca latest `employee_profile_override_history`
4. backend baca latest `payroll_value_override_history` untuk scope periode
5. backend apply semua override ke working projection
6. backend buat row baru di `payroll_snapshot_batch` dengan `snapshot_version + 1`
7. backend simpan seluruh row hasil final ke snapshot detail untuk batch tersebut
8. snapshot lama tetap utuh dan tidak disentuh

Important:
- edit user tidak mengubah snapshot yang sudah ada
- perubahan manual baru hanya terlihat di history setelah snapshot baru dibuat

## UI Design

### Daftar Upah Display

Tambahan kolom:
- `SPSI`
- `Tanggal Mulai Bekerja`
- `Masa Kerja`

Display rules:
- `SPSI` tampil sebagai penanda jelas:
  - `SPSI`
  - `Non-SPSI`
- `Tanggal Mulai Bekerja` memakai `effective_start_date`
- `Masa Kerja` dihitung terhadap periode aktif yang sedang dibuka, mengikuti rule THR

### Edit Mode

Editable fields:
- `SPSI`
- `Tanggal Mulai Bekerja`
- premi dynamic
- koreksi
- potongan lainnya

Save behavior:
- `SPSI` dan `Tanggal Mulai Bekerja` masuk ke `employee_profile_override_history`
- premi dynamic, koreksi, potongan lainnya masuk ke `payroll_value_override_history`
- setelah save, live working view direfresh dari projection backend agar user melihat hasil yang sama dengan yang nanti dipakai snapshot

### UX Notes

- UI perlu membedakan dengan jelas:
  - `saved overlay change`
  - `snapshot not regenerated yet`
- bila user mengedit periode yang sudah punya snapshot:
  - tampilkan bahwa perubahan tersimpan di overlay
  - tampilkan bahwa history snapshot lama belum berubah

## Backend Query Contract

Semua backend service yang membaca overlay harus memakai helper/query standar yang selalu mengambil row terbaru.

Required behavior:
- latest profile override:
  - `MAX(update_index)` per `emp_code`
- latest payroll value override:
  - `MAX(update_index)` per composite period key + `field_name`
- latest snapshot:
  - `MAX(snapshot_version)` per scope snapshot

Tidak boleh ada query ad-hoc yang:
- langsung membaca row pertama tanpa ordering
- membaca snapshot tanpa filter `snapshot_version`
- menganggap `history_hr_employee` sebagai editable master baru

## Mandatory Code Comment Policy

Komentar besar wajib dipasang di service layer, migration, dan query helper.

Required wording intent:
- snapshot tables are immutable
- never write user edits directly into snapshot tables
- all manual edits must be stored in overlay history tables
- latest overlay must always be read using highest `update_index`
- latest snapshot must always be read using target or latest `snapshot_version`
- `history_hr_employee` and related history tables are not the editable master for the new feature

Tujuan komentar ini adalah memberi guardrail agar agent atau developer berikutnya tidak kembali ke pola overwrite atau query “latest” yang ambigu.

## Migration Strategy

### Phase 1
- tambah tabel overlay baru
- tambah batch snapshot table
- tambah helper query latest overlay

### Phase 2
- implement backend save endpoints untuk profile override dan payroll override
- sambungkan UI edit mode ke endpoint baru

### Phase 3
- implement live working projection `base + overlay`
- tampilkan kolom baru di Daftar Upah

### Phase 4
- implement snapshot versioning flow baru
- tambahkan pembacaan snapshot by latest version

### Phase 5
- audit service report lain agar history mode juga memakai snapshot version terbaru dengan helper yang sama

## Risks

### Risk 1: Duplicate latest semantics
Jika ada service yang langsung query tabel history lama tanpa helper baru, hasil bisa berbeda dari working projection.

Mitigation:
- helper query wajib
- komentar besar di code
- audit read path utama

### Risk 2: Scope mismatch pada payroll overrides
Jika `division_code` atau `gang_code` tidak konsisten saat save, backend bisa gagal menemukan latest override yang benar.

Mitigation:
- normalisasi scope sebelum save
- gunakan helper key builder tunggal

### Risk 3: Snapshot detail existing belum version-aware
Jika tabel existing tidak punya relasi versi yang jelas, latest snapshot bisa ambigu.

Mitigation:
- wajib tambah `snapshot_batch_id` atau desain tabel snapshot baru

### Risk 4: User bingung karena edit sudah disimpan tetapi history belum berubah

Mitigation:
- UI harus menampilkan status bahwa perubahan sudah tersimpan di overlay
- snapshot baru perlu dijalankan untuk membekukan hasil ke history

## Testing Strategy

### Automated
- test latest overlay selection by `update_index`
- test snapshot batch version increment
- test live projection applies overlay correctly
- test history snapshot does not change after new overlay save
- test Maret seeding sets initial `SPSI` correctly from `pot_spsi`
- test THR-rule-based effective start date seeding

### Manual
1. seed initial Maret data
2. verify employee with `pot_spsi > 0` seeded as `SPSI`
3. edit `SPSI` and `Tanggal Mulai Bekerja` in edit mode
4. refresh live table and verify values persist
5. verify old history snapshot still unchanged
6. run snapshot version baru
7. verify history mode now shows the updated values in the new version only

## Open Implementation Constraint

Worktree repo saat ini sudah dirty dengan perubahan lain yang tidak terkait langsung ke desain ini. Karena itu, implementasi nanti harus menghindari sweeping commit yang mencampur feature ini dengan perubahan lain. Spec ini aman ditulis sekarang, tetapi baseline commit implementation harus diputuskan dengan hati-hati saat masuk fase coding.
