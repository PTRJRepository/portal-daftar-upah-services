# PRD: Dashboard Daftar Upah Redesign V3
## Implementation Plan untuk Agent Eksekusi

---

## 1. Ringkasan Masalah & Tujuan

### Masalah Saat Ini
1. **MonthSelector popup terlalu besar** — mode full calendar (quarter grid) menghalangi konten, merusak UX terutama untuk kerani yang hanya perlu cepat pilih bulan
2. **Desain terlalu "keanak-anakan"** — dashboard-modern.css menggunakan animated mesh gradient, glassmorphism, emerald/teal yang tidak cocok untuk aplikasi financial/payroll
3. **Kerani butuh akses cepat ke isi daftar upah** — flow saat ini terlalu banyak langkah: pilih periode → divisi locked → pilih gang → klik button → navigasi ke halaman baru
4. **Tidak ada tema profesional yang konsisten** — styling campur aduk antara playful dashboard dan professional report

### Tujuan Redesign
- Dashboard profesional seperti **financial report** (tema summary-report.css + CustomPayrollTable.css)
- **Windows tile/grid card** layout — bersih, structured, tanpa animasi berlebihan
- Kerani bisa langsung **melihat isi daftar upah** dari dashboard tanpa popup yang menghalangi
- MonthSelector menggunakan **compact mode only** (inline select + arrows) di filter bar
- Reduce clicks 30%, faster report access, less scrolling

---

## 2. Design Direction — Dark Palm Theme (Referensi: index_payroll_dashboard.html)

### Tema Utama
**Dark mode enterprise dashboard** dengan nuansa palm/estate. Referensi lengkap ada di `C:\Users\nbgmf\Downloads\index_payroll_dashboard.html`.

### Color Tokens
```css
:root {
  --bg: #08111f;
  --bg-soft: #0d1727;
  --panel: #101c2e;
  --card: #111d2e;
  --card-2: #15243a;
  --border: rgba(255,255,255,.08);
  --text: #f8fafc;
  --muted: #94a3b8;
  --blue: #3b82f6;
  --cyan: #22d3ee;
  --green: #22c55e;
  --orange: #f97316;
  --purple: #8b5cf6;
  --red: #ef4444;
  --shadow: 0 20px 60px rgba(0,0,0,.36);
  --radius-xl: 24px;
  --radius-lg: 20px;
  --radius-md: 14px;
}
```

### Visual Characteristics
| Aspek | Detail |
|-------|--------|
| Font | Plus Jakarta Sans (400-800) |
| Background | `#08111f` + radial gradient biru/hijau subtle |
| Cards | Semi-transparent `rgba(255,255,255,.045)` → `rgba(255,255,255,.018)` gradient, border `rgba(255,255,255,.08)` |
| Radius | 14-24px (rounded, modern) |
| Shadows | Deep `0 20px 60px rgba(0,0,0,.36)` |
| Sidebar | Fixed, 76px, icon-only, `#07101d` |
| Topbar | 64px, sticky, backdrop-filter blur(16px) |
| Hero | 250px, background image sawit + gradient overlay |
| Filter Card | Floating (margin-top negative, overlap hero), backdrop-filter blur(18px) |
| KPI Cards | Glow effect (pseudo-element circle), large values 31px |
| Module Cards | Hover: translateY(-4px) + blue border glow |
| Insight Cards | Grid with icon + text, subtle background |

### Layout Structure
```
┌──────────────────────────────────────────────────────────┐
│ SIDEBAR (76px fixed)  │  MAIN CONTENT                    │
│ [Logo]                │  ┌─ TOPBAR (64px sticky) ──────┐ │
│ [⌂] active           │  │ [☰] PT REBINMAS    [🔔][U]  │ │
│ [▤]                   │  └────────────────────────────────┘│
│ [▥]                   │                                    │
│ [$]                   │  ┌─ HERO (250px) ────────────────┐│
│ [◌]                   │  │ Dashboard Payroll              ││
│ [✓]                   │  │ [badges: role, estate, gang]   ││
│ [◎]                   │  │                  [Periode Box] ││
│ [⚙]                   │  └──────────────────────────────────┘│
│                       │                                    │
│ [↪] logout           │  ┌─ FILTER CARD (floating) ──────┐│
│                       │  │ [Periode] [Divisi] [Gang]     ││
│                       │  │ [Estate] [Tampilkan Daftar]   ││
│                       │  └──────────────────────────────────┘│
│                       │                                    │
│                       │  ┌─ KPI GRID (4 cols) ───────────┐│
│                       │  │ [Total Upah] [Total HK]       ││
│                       │  │ [Jml Karyawan] [Cost/HK]      ││
│                       │  └──────────────────────────────────┘│
│                       │                                    │
│                       │  ┌─ ANALYTICS (2 cols) ──────────┐│
│                       │  │ [Line Chart] [Donut Chart]    ││
│                       │  │ [Insight Cards x4]            ││
│                       │  └──────────────────────────────────┘│
│                       │                                    │
│                       │  ┌─ MODULE SECTIONS ─────────────┐│
│                       │  │ Operational (4 cols grid)      ││
│                       │  │ Payslip & Kehadiran (4 cols)   ││
│                       │  │ Analysis (4 cols)              ││
│                       │  │ Finance (4 cols)               ││
│                       │  │ Verification (3 cols)          ││
│                       │  └──────────────────────────────────┘│
│                       │                                    │
│                       │  ┌─ ACTIVITY GRID (2 cols) ──────┐│
│                       │  │ [Quick Access] [Status]        ││
│                       │  └──────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

### Key Styling Rules
1. **Body background**: `radial-gradient(circle at top left, rgba(59,130,246,.18), transparent 28%), radial-gradient(circle at top right, rgba(34,197,94,.11), transparent 25%), var(--bg)`
2. **Cards**: `background: linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.018))` + `border: 1px solid var(--border)` + `border-radius: var(--radius-lg)`
3. **Filter card**: `background: rgba(16,28,46,.92)` + `backdrop-filter: blur(18px)` + floating overlap hero
4. **KPI glow**: `::after` pseudo-element, 130px circle, `opacity: .17`, `filter: blur(2px)`, color per card
5. **Module hover**: `transform: translateY(-4px)` + `border-color: rgba(59,130,246,.35)` + gradient shift
6. **Topbar**: `background: rgba(13,23,39,.92)` + `backdrop-filter: blur(16px)` + sticky
7. **Section headers**: eyebrow (uppercase, colored, 13px, 800 weight) + title (28px, -0.7px tracking) + subtitle (muted)
8. **Buttons**: `background: linear-gradient(135deg, #2563eb, #3b82f6)` + `box-shadow: 0 12px 30px rgba(37,99,235,.3)`

### Tema yang TIDAK DIPAKAI Lagi
- ❌ Light mode / white background
- ❌ Financial monochrome (summary-report.css style)
- ❌ Sharp 4px corners (sekarang 14-24px)
- ❌ Thin font weights (sekarang 600-800 bold)
- ❌ Animated mesh gradient (dashboard-modern.css emerald/teal)

---

## 3. Arsitektur Komponen

### File yang Perlu Dimodifikasi

| File | Aksi | Prioritas |
|------|------|-----------|
| `frontend/src/pages/ProfessionalDashboard.jsx` | **REWRITE** — ganti tema ke professional financial | P0 |
| `frontend/src/styles/dashboard-modern.css` | **REPLACE** — buat `dashboard-professional.css` baru | P0 |
| `frontend/src/components/common/MonthSelector.jsx` | **MODIFY** — hapus full mode, hanya compact | P1 |
| `frontend/src/pages/DashboardHome.jsx` | **DEPRECATE** — redirect ke ProfessionalDashboard | P2 |
| `frontend/src/layouts/DashboardLayout.jsx` | **MINOR** — pastikan routing ke dashboard baru | P2 |

### File Baru yang Perlu Dibuat

| File | Deskripsi |
|------|-----------|
| `frontend/src/styles/dashboard-professional.css` | CSS baru dengan tema financial professional |
| `frontend/src/components/dashboard/KeraniDaftarUpahPreview.jsx` | Widget preview isi daftar upah inline di dashboard |
| `frontend/src/components/dashboard/FilterBarCompact.jsx` | Sticky filter bar (compact, horizontal) |
| `frontend/src/components/dashboard/ModuleRegistry.js` | Registry semua module + role mapping (single source of truth) |

---

## 4. Layout Structure

### Referensi Visual
File: `C:\Users\nbgmf\Downloads\index_payroll_dashboard.html` (Dark Palm Theme)
Simpan copy ke: `docs/reference/dashboard-dark-palm-theme.html`

### Layout Utama (Semua Role)
```
┌────┬──────────────────────────────────────────────────────┐
│SIDE│ TOPBAR (64px, sticky, blur)                          │
│BAR │ [☰] PT REBINMAS JAYA              [🔔] [ADMIN] [U]  │
│76px├──────────────────────────────────────────────────────┤
│    │                                                      │
│[RJ]│ ┌─ HERO BANNER (250px, palm bg) ──────────────────┐ │
│    │ │ Dashboard Payroll                                │ │
│[⌂] │ │ Sistem Manajemen Data Upah                      │ │
│[▤] │ │ [Role: Kerani] [Estate: PG1A] [Gang: A1T]      │ │
│[▥] │ │                              ┌──────────┐       │ │
│[$] │ │                              │ Mei 2026 │       │ │
│[◌] │ │                              └──────────┘       │ │
│[✓] │ └────────────────────────────────────────────────────┘│
│[◎] │                                                      │
│[⚙] │ ┌─ FILTER CARD (floating, overlap hero -48px) ────┐ │
│    │ │ FILTER BAR                                       │ │
│    │ │ Filter Payroll                                   │ │
│    │ │ [Periode▾] [Divisi▾] [Gang▾] [Estate]           │ │
│    │ │                        [Tampilkan Daftar Upah]   │ │
│[↪] │ └────────────────────────────────────────────────────┘│
│    │                                                      │
│    │ ┌─ KPI SECTION ─────────────────────────────────────┐│
│    │ │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐     ││
│    │ │ │Tot Upah│ │Tot HK  │ │Jml Kary│ │Cost/HK │     ││
│    │ │ │Rp 9.2M │ │336     │ │1,823   │ │Rp27,403│     ││
│    │ │ │ +8% ▲  │ │ +3% ▲  │ │ ±0%    │ │ +2% ▲  │     ││
│    │ │ └────────┘ └────────┘ └────────┘ └────────┘     ││
│    │ └────────────────────────────────────────────────────┘│
│    │                                                      │
│    │ ┌─ DAFTAR UPAH PREVIEW (Kerani only) ───────────────┐│
│    │ │ CustomPayrollTable (read-only, compact, 400px max)││
│    │ │ [Buka Detail Lengkap →]                           ││
│    │ └────────────────────────────────────────────────────┘│
│    │                                                      │
│    │ ┌─ ANALYTICS (non-kerani) ──────────────────────────┐│
│    │ │ [Line Chart 1.4fr] [Donut Chart .9fr]             ││
│    │ │ [Insight] [Insight] [Insight] [Insight]           ││
│    │ └────────────────────────────────────────────────────┘│
│    │                                                      │
│    │ ┌─ MODULE SECTIONS (role-filtered) ─────────────────┐│
│    │ │ § Operational (4 cols)                            ││
│    │ │ § Payslip & Kehadiran (4 cols)                    ││
│    │ │ § Analysis & Comparison (4 cols)                  ││
│    │ │ § Finance (4 cols)                                ││
│    │ │ § Verification (3 cols)                           ││
│    │ └────────────────────────────────────────────────────┘│
│    │                                                      │
│    │ ┌─ ACTIVITY GRID (2 cols) ──────────────────────────┐│
│    │ │ [Quick Access]          [Activity & Status]       ││
│    │ └────────────────────────────────────────────────────┘│
└────┴──────────────────────────────────────────────────────┘
```

### Untuk Role Lain (Payroll Admin, Finance, Executive)
- KPI Cards tetap tampil
- Daftar Upah Preview diganti dengan Analytics Charts
- Module tiles sesuai role (lihat Section 7)

### Module Group Layout (Bento Grid)
```
┌─────────────────────────────────────────────────────────────┐
│ OPERATIONAL                                                  │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │Daftar    │ │Summary   │ │Upah IJL  │ │Upah      │       │
│ │Upah      │ │Report    │ │          │ │Rebinmas  │       │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│ PAYSLIP & KEHADIRAN                                         │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │Slip Gaji │ │Absensi/  │ │Lembur    │ │Info      │       │
│ │(Payslip) │ │HK        │ │          │ │Karyawan  │       │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│ ANALYSIS & COMPARISON                                       │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │Produkti- │ │Comparison│ │Impact    │ │Staging   │       │
│ │vitas     │ │          │ │Report    │ │vs Plantw.│       │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│ FINANCE                                                     │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │Executive │ │Detail    │ │Upah      │ │Pendapatan│       │
│ │Payroll   │ │Gaji      │ │Bersih    │ │Tdk Tetap │       │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│ VERIFICATION                                                │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │Verifikasi│ │Seeder    │ │Staging   │ │Spreadshee│       │
│ │Data      │ │          │ │Compare   │ │t Sync    │       │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Implementasi Detail per Komponen

### 5.1 Sidebar (Fixed, Icon-Only)
```
Width: 76px
Position: fixed, inset: 0 auto 0 0
Background: #07101d
Border-right: 1px solid rgba(255,255,255,.08)
Content: Logo (42px, white bg, red text "RJ") + nav icons (46px, rounded 14px)
Active state: white text + rgba(59,130,246,.18) bg + inset box-shadow left 3px blue
Logout icon: margin-top auto (bottom)
Mobile: hidden (hamburger in topbar)
```

### 5.2 Topbar (Sticky)
```
Height: 64px
Position: sticky, top: 0, z-index: 40
Background: rgba(13,23,39,.92)
Backdrop-filter: blur(16px)
Border-bottom: 1px solid rgba(255,255,255,.08)
Left: hamburger (42px) + "PT REBINMAS JAYA" (bold white)
Right: notification bell + role label (muted 13px) + avatar (blue circle, initial)
```

### 5.3 Hero Banner
```
Height: 250px
Border-radius: 24px
Overflow: hidden
Background:
  - linear-gradient(90deg, rgba(8,17,31,.95) 0%, rgba(8,17,31,.68) 48%, rgba(8,17,31,.35) 100%)
  - url(palm plantation image), cover, center
Content left:
  - h1: "Dashboard Payroll", 44px, weight 800, letter-spacing -1.4px
  - p: subtitle, 16px, color #cbd5e1
  - Badge row: [Role: xxx] [Estate: xxx] [Gang: xxx] — pill 999px, dark bg, 13px 600
Content right:
  - Period box: rounded 18px, blurred bg, "Mei 2026" bold 22px
```

### 5.4 Filter Card (Floating, CRITICAL)
```
Position: relative, margin-top: -48px (overlap hero), margin-inline: 22px
Background: rgba(16,28,46,.92)
Backdrop-filter: blur(18px)
Border: 1px solid rgba(255,255,255,.08)
Border-radius: 22px
Box-shadow: 0 20px 60px rgba(0,0,0,.36)
Padding: 26px
Z-index: 5

Header:
  - Eyebrow: "Filter Bar", blue, 13px, 800, uppercase, letter-spacing .1em
  - Title: "Filter Payroll", 28px, -0.7px tracking
  - Subtitle: muted, line-height 1.6
  - Floating icon: 54px, rounded 18px, blue bg/icon

Grid: 5 columns [1.2fr 1fr 1.6fr 1.1fr auto], gap 14px, align-items end
Inputs:
  - Height: 52px
  - Border-radius: 14px
  - Border: 1px solid rgba(255,255,255,.08)
  - Background: rgba(255,255,255,.04)
  - Color: white, font-weight 600
  - Chevron indicator on right

Button: "Tampilkan Daftar Upah"
  - Height: 52px, padding 0 24px
  - Background: linear-gradient(135deg, #2563eb, #3b82f6)
  - Box-shadow: 0 12px 30px rgba(37,99,235,.3)
  - Font-weight: 800, white
```

**PENTING**: Periode selector = dropdown style (tampilkan "Mei 2026" + chevron), BUKAN calendar popup.

### 5.5 KPI Cards
```
Grid: 4 columns, gap 20px
Card:
  - min-height: 146px, padding: 23px
  - background: linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.018))
  - border: 1px solid rgba(255,255,255,.08)
  - border-radius: 20px
  - box-shadow: 0 12px 34px rgba(0,0,0,.16)
  - overflow: hidden, position: relative

Glow (::after):
  - position: absolute, bottom-right (-20px, -35px)
  - width/height: 130px, border-radius: 50%
  - background: var(--glow) per card (blue/green/purple/orange)
  - opacity: .17, filter: blur(2px)

Content:
  - Top row: label (13px, uppercase, #aab7cf, 800) + trend pill (999px, colored)
  - Value: 31px, weight 800, letter-spacing -0.9px, white
  - Note: 14px, var(--muted)
```

### 5.6 Analytics Section
```
Grid: 2 columns [1.4fr .9fr], gap 20px
Chart cards: same card style, padding 24px, min-height 390px
  - Header: card-title (18px) + select dropdown (blue bg, 13px)
  - Chart 1: Line chart (Chart.js/Recharts), 6 months, Total Upah (blue fill) + Cost/HK (orange fill)
  - Chart 2: Doughnut chart, top divisi, cutout 64%, legend right

Insight cards (below, 4 columns):
  - min-height: 87px, padding: 17px
  - grid: [46px icon | 1fr text]
  - Icon: 46px, rounded 15px, colored bg (purple default)
  - Text: strong (white) + span (muted 13px)
```

### 5.7 Module Sections
```
Container:
  - background: rgba(16,28,46,.55)
  - border: 1px solid rgba(255,255,255,.08)
  - border-radius: 24px
  - padding: 24px
  - margin-bottom: 22px

Header:
  - Eyebrow: colored per group (orange/red/blue/green), 13px, 800, uppercase
  - Title: 28px section-title
  - Subtitle: muted
  - Right: module count badge (colored, 13px, 800)

Module grid: 4 columns (3 for verification), gap 18px
Module card:
  - min-height: 168px, padding: 22px
  - Same gradient card bg + border + radius 20px
  - Icon: 46px, rounded 15px, colored bg per group
  - h3: 18px, margin-top 20px
  - p: 14px, muted, line-height 1.45
  - a: "Open module →", #60a5fa, 800, 14px, margin-top auto

Hover:
  - transform: translateY(-4px)
  - border-color: rgba(59,130,246,.35)
  - background: linear-gradient(180deg, rgba(59,130,246,.12), rgba(255,255,255,.02))
  - transition: .2s ease
```

### 5.8 Daftar Upah Preview (Kerani Only)
```
Kondisi: role === 'kerani' DAN filter lengkap (divisi + gang)
Posisi: SETELAH filter card, SEBELUM KPI section

Container: same module-section style (dark panel, rounded 24px)
Header: eyebrow "Daftar Upah" + title "Preview Data Upah"
Content:
  - CustomPayrollTable embedded, compact, read-only
  - Max height: 400px, overflow-y auto
  - Dark mode table override: dark header bg, light text, subtle row borders
  - Kolom: NIK, Nama, HK, Premi Total, Lembur, Potongan, Upah Bersih
  - Auto-load saat gang berubah (no extra button click needed)

Footer: "Buka Detail Lengkap →" link (blue, 800 weight)
Fallback: placeholder card jika filter belum lengkap
```

### 5.9 Activity Grid (Bottom)
```
Grid: 2 columns, gap 20px
Cards: same chart-card style

Left: "Quick Access"
  - Eyebrow + title + subtitle
  - Status boxes: dark bg, rounded 18px, label (12px uppercase) + value (18px bold)

Right: "Activity & Status"
  - Periode aktif, Role aktif, Filter status
  - Success state: green bg rgba(34,197,94,.12), green border, green text #86efac
```

---

## 6. MonthSelector Refactor

### Perubahan yang Diperlukan
File: `frontend/src/components/common/MonthSelector.jsx`

**Hapus**: Full calendar mode (quarter grid, year navigator, month grid buttons)
**Pertahankan**: Compact mode — tapi style-nya disesuaikan ke dark theme

Di dashboard, MonthSelector ditampilkan sebagai **dropdown input** (bukan calendar popup):
```
┌─────────────────────────┐
│ Mei 2026            ⌄   │  ← height 52px, dark bg, white text
└─────────────────────────┘
```

### Implementasi di Dashboard
```jsx
// Di filter card, MonthSelector render sebagai styled select
// BUKAN calendar grid, BUKAN popup modal
<div className="input" onClick={openMonthDropdown}>
  {monthLabel} {year} <ChevronDown />
</div>

// Dropdown: simple list of months (native select atau custom dropdown)
// Style: dark bg rgba(255,255,255,.04), border rgba(255,255,255,.08)
// Height: 52px, border-radius: 14px
```

### Alasan
- Full calendar mode menghalangi konten (user complaint utama)
- Dark theme reference menggunakan simple dropdown "Mei 2026 ⌄"
- Kerani hanya perlu ganti bulan 1-2 kali, tidak perlu visual calendar
- Compact dropdown sudah cukup fungsional

---

## 7. Role-Based Module Visibility

### Complete Module Registry (Semua Menu yang Bisa Diakses dari Dashboard)

Berikut SEMUA route yang tersedia di aplikasi dan harus bisa diakses dari dashboard sesuai role:

```javascript
const ALL_MODULES = {
  operational: [
    { path: '/operational', label: 'Daftar Upah', description: 'Tampilkan isi daftar upah karyawan' },
    { path: '/summary', label: 'Summary Report', description: 'Ringkasan upah dan rekap utama' },
    { path: '/wages-ijl', label: 'Upah IJL', description: 'Laporan upah tenaga IJL' },
    { path: '/wages-rebinmas', label: 'Daftar Upah Rebinmas', description: 'Laporan payroll Rebinmas' },
  ],
  payslip_attendance: [
    { path: '/payslip-print', label: 'Payslip / Slip Gaji', description: 'Cetak slip gaji karyawan', openNewTab: true },
    { path: '/operational?view=attendance', label: 'Absensi / HK', description: 'Matrix kehadiran per gang' },
    { path: '/operational?view=overtime', label: 'Lembur', description: 'Matrix lembur per gang' },
    { path: '/operational?view=employee-directory', label: 'Info Karyawan', description: 'Data karyawan per gang' },
  ],
  analysis: [
    { path: '/productivity', label: 'Produktivitas', description: 'Tonase, HK, dan biaya per performa' },
    { path: '/wages-comparison', label: 'Comparison', description: 'Perbandingan payroll antar periode' },
    { path: '/impact', label: 'Impact Report', description: 'Analisis dampak biaya dan perubahan' },
    { path: '/comprehensive', label: 'Comprehensive Analysis', description: 'Analisis payroll lintas komponen' },
    { path: '/mill-production', label: 'Produktivitas Kebun', description: 'Tonase FFB, HK, dan biaya kebun' },
    { path: '/tonase-analysis', label: 'Tonase Analysis', description: 'Analisis tonase detail per divisi' },
    { path: '/staging-comparison', label: 'Staging vs Plantware', description: 'Perbandingan data staging dan plantware' },
  ],
  finance: [
    { path: '/executive', label: 'Executive Payroll', description: 'Ringkasan high-level biaya payroll' },
    { path: '/detailed-salary', label: 'Detail Gaji', description: 'Rincian gaji, lembur, dan komponen' },
    { path: '/detail-upah-bersih', label: 'Upah Bersih', description: 'Detail payroll bersih per filter' },
    { path: '/pendapatan-tidak-tetap', label: 'Pendapatan Tidak Tetap', description: 'Komponen pendapatan non-rutin' },
    { path: '/report-pajak', label: 'Report Pajak', description: 'Unduh dan audit laporan pajak' },
    { path: '/report/high-earners', label: 'High Earner Report', description: 'Karyawan dengan gaji tertinggi' },
    { path: '/report/salary-range-detail', label: 'Salary Range', description: 'Distribusi range gaji' },
  ],
  verification: [
    { path: '/data-verification', label: 'Verifikasi Data', description: 'Verifikasi konsistensi data payroll' },
    { path: '/seed', label: 'Seeder', description: 'Re-aggregation data manual' },
    { path: '/staging-comparison', label: 'Staging Comparison', description: 'Bandingkan data staging vs plantware' },
    { path: '/spreadsheet-sync', label: 'Spreadsheet Sync', description: 'Sinkronisasi data spreadsheet' },
  ],
  directory: [
    { path: '/employee-directory', label: 'Employee Directory', description: 'Direktori dan analytics karyawan' },
    { path: '/employee/detail', label: 'Detail Karyawan', description: 'Profil lengkap karyawan', openNewTab: true },
    { path: '/hr-info', label: 'HR Info', description: 'Informasi HR dan karir', openNewTab: true },
  ]
}
```

### Kerani
```
Visible:
  ✓ KPI Cards (4 cards)
  ✓ Daftar Upah Preview (auto-load, inline table)
  ✓ Module: Daftar Upah (link ke /operational full view)
  ✓ Module: Payslip / Slip Gaji (cetak slip gaji)
  ✓ Module: Absensi / HK (matrix kehadiran)
  ✓ Module: Lembur (matrix lembur)
  ✓ Module: Info Karyawan (data per gang)
  ✓ Module: Staging vs Plantware (perbandingan data)
  
Hidden:
  × Analytics charts (productivity, impact)
  × Seeder, Verification, Correction
  × Executive Payroll, Finance modules
  × High Earner, Salary Range
  
Special:
  - Divisi LOCKED (amber indicator)
  - Button text: "Tampilkan Daftar Upah" (bukan "Generate")
  - Auto-load preview saat gang dipilih
  - Payslip bisa diakses langsung dari preview table (select employees → print)
```

### Payroll Admin
```
Visible:
  ✓ KPI Cards
  ✓ ALL Operational modules (Daftar Upah, Summary, IJL, Rebinmas)
  ✓ ALL Payslip/Attendance modules (Payslip, Absensi, Lembur, Info Karyawan)
  ✓ Verification modules (Verifikasi, Seeder, Koreksi, Staging Comparison, Spreadsheet Sync)
  ✓ Finance: Report Pajak
  ✓ Directory: Employee Directory
  ✓ Analysis: Staging vs Plantware
  
Hidden:
  × Productivity analytics (estate manager domain)
  × Executive-level insights
```

### Finance
```
Visible:
  ✓ KPI Cards
  ✓ ALL Finance modules (Executive Payroll, Detail Gaji, Upah Bersih, PTT, Pajak, High Earner, Salary Range)
  ✓ Analytics (Cost trends, payroll distribution)
  ✓ Comparison, Comprehensive Analysis
  ✓ Summary Report
  
Hidden:
  × Seeder, Verification, Spreadsheet Sync
  × Operational detail (daftar upah per gang)
```

### Estate Manager / Executive
```
Visible:
  ✓ KPI Cards (prominent)
  ✓ Analytics (Trends, Productivity vs Cost, Top Divisi)
  ✓ ALL Analysis modules (Productivity, Comparison, Impact, Comprehensive, Mill Production, Tonase)
  ✓ Summary Report
  ✓ Executive Payroll
  ✓ Staging vs Plantware
  
Hidden:
  × Operational detail per gang
  × Seeder, Correction, Spreadsheet Sync
```

---

## 8. CSS Architecture

### File: `frontend/src/styles/dashboard-professional.css`

```css
/* Dark Palm Theme - Payroll Dashboard
   Referensi: index_payroll_dashboard.html
   
   Design principles:
   - Dark mode (#08111f base)
   - Semi-transparent cards with subtle borders
   - Radial gradient background (blue/green subtle)
   - Large rounded corners (14-24px)
   - Bold typography (Plus Jakarta Sans, 600-800)
   - Glow effects on KPI cards
   - Hover lift on module cards
   - Backdrop-filter blur on floating elements
*/

:root {
  --bg: #08111f;
  --bg-soft: #0d1727;
  --panel: #101c2e;
  --card: #111d2e;
  --card-2: #15243a;
  --border: rgba(255,255,255,.08);
  --text: #f8fafc;
  --muted: #94a3b8;
  --blue: #3b82f6;
  --cyan: #22d3ee;
  --green: #22c55e;
  --orange: #f97316;
  --purple: #8b5cf6;
  --red: #ef4444;
  --shadow: 0 20px 60px rgba(0,0,0,.36);
  --radius-xl: 24px;
  --radius-lg: 20px;
  --radius-md: 14px;
}

.dashboard-dark {
  font-family: "Plus Jakarta Sans", sans-serif;
  background:
    radial-gradient(circle at top left, rgba(59,130,246,.18), transparent 28%),
    radial-gradient(circle at top right, rgba(34,197,94,.11), transparent 25%),
    var(--bg);
  color: var(--text);
  min-height: 100vh;
}

.dashboard-dark .card {
  background: linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.018));
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 12px 34px rgba(0,0,0,.16);
}

.dashboard-dark .module-card:hover {
  transform: translateY(-4px);
  border-color: rgba(59,130,246,.35);
  background: linear-gradient(180deg, rgba(59,130,246,.12), rgba(255,255,255,.02));
}

.dashboard-dark .btn-primary {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  box-shadow: 0 12px 30px rgba(37,99,235,.3);
  color: #fff;
  font-weight: 800;
  border: 0;
  border-radius: var(--radius-md);
}

.dashboard-dark .filter-card {
  background: rgba(16,28,46,.92);
  backdrop-filter: blur(18px);
  border: 1px solid var(--border);
  border-radius: 22px;
  box-shadow: var(--shadow);
}

.dashboard-dark .topbar {
  background: rgba(13,23,39,.92);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border);
}
```

### Responsive Breakpoints
```css
@media (max-width: 1200px) {
  .filter-grid, .kpi-grid, .module-grid, .analytics-grid, .activity-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 760px) {
  .app { grid-template-columns: 1fr; }
  .sidebar { display: none; }
  .filter-grid, .kpi-grid, .module-grid, .analytics-grid, .activity-grid {
    grid-template-columns: 1fr;
  }
}
```

---

## 9. Execution Steps (Urutan Implementasi)

### Phase 1: Foundation (P0)
1. **Buat `dashboard-professional.css`** — CSS baru dengan tema financial
2. **Refactor `ProfessionalDashboard.jsx`** — ganti semua inline styles ke CSS classes, hapus animated/playful elements, terapkan tema professional
3. **MonthSelector compact-only** — hapus full calendar mode, pastikan hanya compact yang render

### Phase 2: Kerani Experience (P0)
4. **Buat `KeraniDaftarUpahPreview.jsx`** — widget yang auto-load dan tampilkan CustomPayrollTable inline (read-only, compact columns)
5. **Integrasi preview ke dashboard** — jika role kerani + filter lengkap, tampilkan preview table
6. **Filter bar behavior** — auto-trigger load saat gang berubah (untuk kerani)

### Phase 3: Polish (P1)
7. **Module tiles** — implementasi Windows tile grid dengan border-left accent
8. **KPI cards** — implementasi dengan monospace values, thin weight, sharp corners
9. **Role-based visibility** — pastikan module filtering benar per role
10. **Responsive** — 4-col → 2-col → 1-col grid breakpoints

### Phase 4: Cleanup (P2)
11. **Deprecate DashboardHome.jsx** — redirect ke ProfessionalDashboard
12. **Remove dashboard-modern.css references** — hapus import animated styles
13. **Testing** — pastikan semua role bisa akses dashboard dengan benar

---

## 10. Akses Menu Detail dari Dashboard

### Payslip / Slip Gaji
- Dari dashboard: klik tile "Slip Gaji" → buka `/payslip-print` di tab baru
- Dari Daftar Upah Preview (kerani): select karyawan → button "Cetak Slip Gaji" → buka payslip print page
- Perlu: division, gang, month, year, selected employee codes

### Absensi / HK (Attendance Matrix)
- Dari dashboard: klik tile "Absensi/HK" → navigasi ke `/operational?view=attendance`
- OperationalReportWrapper sudah support `viewMode` state
- Menampilkan GangAttendanceMatrix component

### Lembur (Overtime Matrix)
- Dari dashboard: klik tile "Lembur" → navigasi ke `/operational?view=overtime`
- Menampilkan GangOvertimeMatrix component

### Staging vs Plantware
- Dari dashboard: klik tile "Staging vs Plantware" → navigasi ke `/staging-comparison`
- StagingComparisonPage sudah ada sebagai route
- Membandingkan data dari staging database vs plantware

### Info Karyawan
- Dari dashboard: klik tile "Info Karyawan" → navigasi ke `/operational?view=employee-directory`
- Menampilkan GangEmployeeInfo component

### Implementasi Navigation Helper
```javascript
// Di ProfessionalDashboard, handle tile click dengan query params
const handleTileClick = (module) => {
  if (module.openNewTab) {
    // Payslip, Employee Detail, HR Info → buka di tab baru
    const params = new URLSearchParams({ month, year, division, gang });
    window.open(buildAppPath(`${module.path}?${params}`), '_blank');
  } else if (module.path.includes('?view=')) {
    // Attendance, Overtime, Employee → navigasi dengan view mode
    navigate(module.path);
  } else {
    navigate(module.path);
  }
};
```

---

## 11. Data Flow untuk Kerani Preview

```
Dashboard Load
  → guessRole(user) === 'kerani'
  → Filter bar: divisi LOCKED, gang dropdown loaded
  → User pilih gang
  → Auto-fetch: GET /payroll/data?month={m}&year={y}&division={locked}&gang={selected}
  → Render CustomPayrollTable (compact, read-only)
  → Kolom: NIK, Nama, HK, Premi, Lembur, Potongan, Upah Bersih
  → Footer: "Buka Detail Lengkap →" → navigate('/operational')
```

### API Endpoint yang Digunakan
- `GET /payroll/dashboard/executive-summary` — untuk KPI cards
- `GET /payroll/data` — untuk preview tabel (existing endpoint, same as MainPage)
- Gang list: sudah di-handle oleh `ReportContext` (gangs state)

---

## 12. Constraints & Notes

1. **CustomPayrollTable.jsx** (263KB) — JANGAN refactor. Gunakan as-is dalam mode read-only
2. **ReportContext** — sudah handle state month/year/division/gang/gangs. Gunakan context yang sama
3. **AuthContext** — sudah handle user role detection. Gunakan `user.role`
4. **lockedDivisionService** — sudah handle locked division logic untuk kerani
5. **Existing TOKENS object** di ProfessionalDashboard — GANTI dengan DESIGN_TOKENS baru yang lebih professional
6. **Jangan hapus** ProfessionalDashboard.jsx — refactor in-place
7. **MonthSelector compact prop** sudah ada — cukup pastikan full mode tidak dipanggil dari dashboard

---

## 13. Success Criteria

- [ ] Dashboard menggunakan tema professional (navy header, sharp cards, no animations)
- [ ] MonthSelector hanya compact mode di dashboard (no popup calendar)
- [ ] Kerani bisa lihat isi daftar upah langsung dari dashboard
- [ ] Filter bar sticky dan horizontal (periode + divisi + gang + button)
- [ ] Module tiles menggunakan Windows grid card style (border-left accent)
- [ ] KPI values menggunakan monospace font, thin weight
- [ ] Role-based module visibility bekerja dengan benar
- [ ] Tidak ada animated gradient atau glassmorphism
- [ ] Responsive: 4-col desktop → 2-col tablet → 1-col mobile
- [ ] Payslip/Slip Gaji bisa diakses dari dashboard tile (buka tab baru)
- [ ] Absensi/HK bisa diakses dari dashboard tile (navigasi ke operational?view=attendance)
- [ ] Lembur bisa diakses dari dashboard tile (navigasi ke operational?view=overtime)
- [ ] Staging vs Plantware bisa diakses dari dashboard tile (navigasi ke /staging-comparison)
- [ ] Info Karyawan bisa diakses dari dashboard tile
- [ ] Semua module yang ada di route App.jsx terdaftar di MODULE_GROUPS dashboard
