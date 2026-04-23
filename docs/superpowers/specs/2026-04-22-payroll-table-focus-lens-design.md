# Payroll Table Focus Lens Design

## Context

`CustomPayrollTable` sudah bergerak ke header bertingkat yang lebih rapi, tetapi UX-nya masih belum cocok untuk tabel payroll yang sangat lebar:

- mayoritas grup kolom masih terasa seperti accordion, padahal operator perlu membaca tabel secara utuh
- header `POTONGAN UPAH BERSIH` belum menampilkan hierarki caruman dengan jelas, terutama blok `ASTEK`
- row terpilih belum cukup kontras ketika bertemu background group tint
- user kehilangan orientasi saat horizontal scroll karena tidak ada petunjuk grup mana yang sedang dominan di viewport

Pengguna menyetujui arah desain berikut:

- hanya `PAJAK` yang tetap collapsible
- grup lain selalu terbuka
- tabel memakai pemisahan warna soft per grup agar sekilas langsung terbaca
- muncul `chapter bar` dinamis saat horizontal scroll, mirip chapter video, untuk menunjukkan bagian tabel yang sedang dilihat
- tersedia `Focus Lens` agar grup aktif terlihat lebih menonjol tanpa menutup grup lain

## Decision Summary

Arsitektur UX yang dipilih adalah `open semantic grid + dynamic scroll chapters + optional focus lens`.

- semua grup top-level selain `PAJAK` tampil terbuka penuh
- perbedaan grup dibaca dari struktur header yang benar, soft color tint, dan chapter bar saat horizontal scroll
- tidak ada auto-close kolom mengikuti scroll
- fokus berpindah dengan cara visual, bukan dengan mengubah struktur tabel

Pendekatan ini dipilih karena payroll register dibaca sebagai lembar kerja lebar, bukan sebagai serangkaian panel yang dibuka satu per satu.

## Goals

- Membuat struktur header top-level dan sub-level benar secara semantik.
- Menjadikan `POTONGAN UPAH BERSIH` terbaca jelas sebagai blok caruman dan potongan lain.
- Membuat navigasi horizontal lebih mudah dipahami melalui chapter bar dinamis.
- Membuat grup aktif lebih cepat dikenali tanpa memberi warna keras yang melelahkan mata.
- Membuat row yang sedang dipilih jelas terlihat di atas semua tint grup.

## Non-Goals

- Mengubah logika perhitungan payroll atau sumber data backend.
- Menambah collapse state baru di luar `PAJAK`.
- Mengubah tabel menjadi virtual chapter/stepper yang menyembunyikan kolom lain.
- Menambah diagram, mini-map penuh, atau overlay permanen yang selalu memenuhi layar.

## Information Architecture

Top-level group final:

- `IDENTITAS`
- `PAJAK`
- `ABSENSI`
- `PANEN`
- `PENGGAJIAN`
- `TUNJANGAN`
- `PREMI`
- `PENDAPATAN LAINNYA`
- `POTONGAN UPAH KOTOR`
- `UPAH KOTOR`
- `POTONGAN UPAH BERSIH`
- `UPAH BERSIH`

Rules:

- hanya `PAJAK` yang boleh collapse/expand
- grup lain selalu tampil penuh
- field yang tax-oriented tetap di `PAJAK`
- field kompensasi non-tax tetap di grup semantiknya, tidak dipindahkan ke `PAJAK` hanya demi ringkas

## Header Hierarchy Rules

### `POTONGAN UPAH BERSIH`

Hierarki wajib:

- level 1: `POTONGAN UPAH BERSIH`
- level 2: `CARUMAN`, `LAINNYA`, `TOTAL`
- level 3:
  - di bawah `CARUMAN`: `ASTEK`, `BPJS KES`, `BPJS PEN`
  - di bawah `LAINNYA`: `SPSI`, `PPH21`, `PREMI PPH`, dynamic deduction lain
- level 4:
  - di bawah `ASTEK`, `BPJS KES`, `BPJS PEN`: `PEK.`, `MAJ.`

Prinsip penting:

- `ASTEK` tidak boleh muncul sebagai label datar langsung di bawah level 1
- `CARUMAN` harus menjadi parent visual agar blok asuransi/caruman langsung terbaca
- kolom total potongan bersih tetap berada di top group yang sama, tetapi tidak menipu seolah bagian dari `LAINNYA`

### Group lain

- `PREMI`: top group tunggal dengan kolom rinci dan `TOTAL PREMI`
- `PENDAPATAN LAINNYA`: group mandiri, tidak lagi numpang di bawah `UPAH KOTOR`
- `PENGGAJIAN`: menampilkan `GP AKTUAL` sebagai kolom inti, detail seperti `GP IDEAL` dan `KOR. HK` tetap terlihat penuh karena grup ini tidak collapse

## Interaction Model

### 1. Display Mode

Disediakan dua mode:

- `Simple`
  - chapter bar aktif
  - fokus visual ada di level 1
  - subheader tetap ada, tetapi intensitasnya lebih tenang
- `Detail`
  - chapter bar tetap aktif
  - subheader level 2-4 diberi aksen lebih tegas
  - cocok untuk audit manual

Default mode: `Simple`

### 2. Focus Lens

Toggle `Focus Lens` mengatur intensitas visual:

- `Off`
  - semua grup memakai tint soft normal
- `On`
  - grup aktif mendapat tint lebih hidup dan header lebih tegas
  - grup lain tetap terbaca, tetapi sedikit lebih tenang

Focus Lens tidak pernah menyembunyikan kolom.

### 3. Scroll Chapter Bar

`Chapter bar` bersifat dinamis:

- muncul hanya saat user melakukan horizontal scroll
- segmennya mengikuti lebar aktual grup kolom
- grup aktif dihitung dari area dominan di viewport, bukan sekadar kolom pertama yang terlihat
- setelah scroll berhenti beberapa saat, chapter bar memudar/hilang

Interaksi:

- klik segmen chapter: scroll ke grup tersebut
- saat chapter aktif berubah, header level 1 grup aktif ikut naik intensitasnya

## Visual Language

Warna harus lembut, mudah dibedakan, dan tidak menyakitkan mata.

Arah warna:

- `IDENTITAS`: slate soft
- `PAJAK`: stone soft
- `ABSENSI`: green soft
- `PANEN`: yellow soft
- `PENGGAJIAN`: sky soft
- `TUNJANGAN`: orange soft
- `PREMI`: amber soft
- `PENDAPATAN LAINNYA`: emerald soft
- `POTONGAN UPAH KOTOR`: rose soft
- `UPAH KOTOR`: indigo soft
- `POTONGAN UPAH BERSIH`: pink soft
- `UPAH BERSIH`: teal soft

Rules:

- body cells tetap dominan putih/soft tint
- header top-level tetap dark base agar struktur tabel stabil
- perbedaan grup dibantu accent line, tint, dan focus state, bukan warna keras penuh

## Selected Row

Row yang dipilih harus lebih dominan daripada warna grup:

- background: slate gelap / abu gelap
- text: putih atau abu sangat terang
- sticky cell ikut warna yang sama
- hover style biasa tidak boleh mengalahkan selected state

Target hasil:

- user langsung tahu baris mana yang aktif walaupun tabel penuh tint grup

## Dynamic Behavior Rules

- chapter bar hanya muncul ketika ada horizontal scroll interaction
- chapter bar tidak permanent sticky saat user idle
- focus active chapter mengikuti posisi scroll horizontal saat ini
- tabel tidak pernah mengubah jumlah kolom visible hanya karena user scrolling

## Implementation Boundary

Perubahan difokuskan pada frontend payroll register:

- `CustomPayrollTable.jsx`
- style table
- util group taxonomy / viewport chapter calculation
- komponen chapter bar dinamis

Backend tidak perlu berubah untuk iterasi ini karena data yang dibutuhkan sudah ada.

## Testing Strategy

- Unit test untuk normalisasi grup header dan metadata chapter segment.
- Unit test untuk perhitungan grup aktif berdasarkan viewport horizontal.
- Build verification untuk memastikan perubahan JSX/CSS tidak merusak bundle.
- Manual QA:
  - semua grup selain `PAJAK` terbuka
  - `POTONGAN UPAH BERSIH` menampilkan `CARUMAN > ASTEK/BPJS > PEK./MAJ.`
  - selected row jelas terbaca
  - chapter bar muncul saat horizontal scroll dan hilang saat idle
  - klik chapter melakukan scroll ke grup yang benar

## Open Decisions Resolved

- `PAJAK` tetap satu-satunya grup collapsible
- chapter bar hanya muncul dinamis saat scroll
- mode default adalah `Simple`
- chapter behavior adalah `auto focus`, bukan `auto close`
