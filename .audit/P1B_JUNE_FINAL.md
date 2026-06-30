# P1B Juni — Investigasi Final (data DB sama, live anomali)

## Temuan faktual
User: data DB sama, selisih ~6 juta. Investigasi:

### Query langsung ke gateway (10.0.0.110:8001, DB_PROFILE_2 db_ptrj)
B0088 Juni 2026:
- PR_TASKREGLN (LIVE) `COUNT(DISTINCT TrxDate) WHERE OT=0` = **28**
- PR_TASKREGLN_ARC = **0**
- UNION distinct = **28**

### Output aplikasi
- **Dev** (server-dev-merger-1, post-fix): hk=28 ✅ match DB
- **Live** (ptrjestate:3001): hk=25 ❌ ≠ DB (28)

### Logic compare (dev vs canonical c9e72ff6)
- `getAttendance` query: IDENTIK (UNION ALL LIVE+ARC, `COUNT(DISTINCT TrxDate)`, `WHERE OT=0`, no leave filter)
- `buildLeaveSqlExpressions`: IDENTIK (unused in getAttendance WHERE)
- `getCuti`: IDENTIK
- `payrollAutoBufferService`: dev fixed to canonical (attendanceDays, no guard)
- aggregation merge `Object.assign(attendanceMap, attB)`: IDENTIK

Dev logic = canonical 100%. Dev output=28 match DB+canonical.

## Kesimpulan
**Dev BENAR** (hk=28 = DB actual = canonical logic).
**Live ANOMALI** (hk=25 < DB actual 28). Live deploy ≠ canonical c9e72ff6 untuk attendance calc — live punya filter tambahan yg exclude 3 TrxDate B0088 Juni (mungkin filter leave/sick dari hk, atau live pakai code versi berbeda).

User anggap "live = stabil benar" — tapi untuk B0088 Juni, live **under-count hk** (25 < DB 28). Kalau dev ikut live (25), dev harus **under-count** juga = buang 3 TrxDate valid = salah vs DB.

## Catatan
- B0088 = sick leave (cuti_sakit 20 hari, GA9126). hk=28 = 28 TrxDate non-OT hadir (termasuk sakit dates).
- Live=25 mungkin exclude sakit dates dari hk? 28-20(sakit)=8, bukan 25. Atau 28-3=25 (3 date tertentu). Pola tidak clean → live filter tidak obvious.
- `cuti_tahunan_hari` dev=6 vs live=4 (diff 2). hk diff=3. Pola tidak konsisten → live mungkin pakai logic cuti/hk beda.

## Rekomendasi
1. **Jangan revert dev ke live** — dev benar (match DB + canonical). Live yang menyimpang.
2. Verifikasi live deploy commit — apakah live = c9e72ff6 atau versi lain? Live=origin/server-changes-1 @253eb1ea mungkin, tapi origin getAttendance = c9e72ff6 (verified identical). Jadi live deploy mungkin bukan origin juga — mungkin branch lama/manual patch.
3. Cek langsung live server code `getAttendance` — apakah ada filter `TaskCode NOT LIKE 'GA9126%'` (exclude sakit) atau `leaveSql.whereClause` di WHERE hk.
4. Kalau user mau dev=live (25), itu = adopt bug live (under-count). Tidak recommended.

## Status fix
- payrollAutoBufferService: FIXED to canonical (attendanceDays, drop guard). Test pass.
- period-adjustment (resolveAdjustedJabatanJumlah/shouldForcePotPph21ToTer): NOT applied (dev missing, canonical has 3 call sites). Affects May 2026 only, not June.
- B0088 June divergensi: NOT a dev bug. Live anomaly. No dev fix warranted.
