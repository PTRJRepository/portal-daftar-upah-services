# TODO dan Fitur Pending - Payroll Daftar Upah

## Overview

Dokumen ini berisi daftar fitur yang belum diimplementasi, perbaikan yang perlu dilakukan, dan ide untuk pengembangan di masa depan.

---

## 1. Fitur Belum Diimplementasi

### 1.1 Unimplemented Fields

Kolom-kolom berikut saat ini **NULL** atau belum diimplementasi:

| Field | Source | Status | Notes |
|-------|--------|--------|-------|
| `total_ffb_weight` | WM_TICKET (db_ptrj_mill) | Not Implemented | Perlu getMillInstance() |
| `premi_prunning` | Dynamic Premi | Not Populated | Data tidak tersedia |
| `premi_insentif` | Dynamic Premi (Insentif Panen) | Not Populated | Data tidak tersedia |
| `premi_kinerja` | Dynamic Premi (Kinerja) | Not Populated | Data tidak tersedia |
| `total_koreksi` | Correction Table | Not Populated | Perlu tabel koreksi |

### 1.2 Pending Features

| Feature | Priority | Status | Description |
|---------|----------|--------|-------------|
| Mobile Responsive | High | Not Started | UI untuk mobile devices |
| Offline Mode | Medium | Not Started | Service worker untuk offline access |
| Real-time Updates | Medium | Not Started | WebSocket untuk live data |
| Bulk Import | Low | Not Started | Import data dari Excel |
| Audit Log UI | Low | Not Started | Tampilan untuk audit log |

---

## 2. Perbaikan yang Diperlukan

### 2.1 Performance Improvements

| Issue | Priority | Description |
|-------|----------|-------------|
| Query Optimization | High | Beberapa query perlu index |
| Caching | Medium | Implementasi caching untuk data sering diakses |
| Lazy Loading | Medium | Komponen besar perlu di-lazy load |
| Bundle Size | Low | Optimasi ukuran bundle frontend |

### 2.2 Code Quality

| Issue | Priority | Description |
|-------|----------|-------------|
| Test Coverage | High | Unit test perlu ditambah |
| Type Safety | Medium | Beberapa any type perlu diperbaiki |
| Error Handling | Medium | Standardisasi error handling |
| Documentation | Low | Komentar dan JSDoc perlu ditambah |

### 2.3 Security

| Issue | Priority | Description |
|-------|----------|-------------|
| Rate Limiting | High | Implementasi rate limiting |
| Input Validation | High | Validasi input yang lebih ketat |
| HTTPS | High | Pastikan HTTPS di production |
| Token Refresh | Medium | Implementasi refresh token |

---

## 3. Backlog Items

### 3.1 New Features (Proposed)

| Feature | Description | Complexity |
|---------|-------------|------------|
| **Dashboard Analytics** | Grafik dan chart untuk analytics | Medium |
| **Email Notifications** | Notifikasi via email untuk event tertentu | Medium |
| **PDF Report Generator** | Generate laporan PDF otomatis | Medium |
| **Multi-language Support** | Dukungan bahasa Indonesia/Inggris | High |
| **Dark Mode** | Tema gelap untuk UI | Low |
| **Keyboard Shortcuts** | Shortcut untuk navigasi cepat | Low |
| **Data Comparison** | Perbandingan data antar periode | Medium |
| **Employee Timeline** | Timeline perubahan data karyawan | Medium |

### 3.2 Integration Ideas

| Integration | Description | Status |
|-------------|-------------|--------|
| **Slack/Teams Notification** | Notifikasi ke chat platform | Idea |
| **SAP Integration** | Integrasi dengan SAP HR | Idea |
| **Biometric Integration** | Integrasi dengan mesin finger print | Idea |
| **Accounting Software** | Export ke software akuntansi | Idea |

---

## 4. Technical Debt

### 4.1 Code Refactoring Needed

| Area | Issue | Priority |
|------|-------|----------|
| `dataExtractorService.ts` | File terlalu besar (85KB) | High |
| `CustomPayrollTable.jsx` | Kompleksitas tinggi | Medium |
| Query files | Perlu organisasi lebih baik | Low |
| CSS files | Duplikasi styles | Low |

### 4.2 Deprecated Code

| File/Component | Status | Replacement |
|----------------|--------|-------------|
| `LegacyPayrollGrid.jsx` | Deprecated | `CustomPayrollTable.jsx` |
| Direct DB connection | Removed | SQL Gateway |
| Old API endpoints | Deprecated | New REST endpoints |

---

## 5. Known Issues

### 5.1 Open Bugs

| ID | Description | Severity | Status |
|----|-------------|----------|--------|
| BUG-001 | Gang filter sometimes not working | Medium | Fixed |
| BUG-002 | Lembur calculation inconsistent | High | Fixed |
| BUG-003 | Print layout issues on Firefox | Low | Open |
| BUG-004 | Export Excel timeout for large data | Medium | Open |

### 5.2 Limitations

| Limitation | Description | Workaround |
|------------|-------------|------------|
| Max rows in grid | AG Grid Enterprise limit | Pagination |
| Export size | Memory limit for large export | Export per batch |
| Concurrent users | No load balancing | Scale horizontally |

---

## 6. Roadmap

### Q1 2026

- [ ] Mobile responsive design
- [ ] Performance optimization
- [ ] Security improvements
- [ ] Test coverage improvement

### Q2 2026

- [ ] Real-time notifications
- [ ] Dashboard analytics
- [ ] PDF report generator
- [ ] Multi-language support

### Q3 2026

- [ ] Offline mode
- [ ] Integration dengan sistem lain
- [ ] Advanced analytics
- [ ] Machine learning predictions

---

## 7. Contribution Guidelines

### Cara Menambahkan TODO Baru

1. Tambahkan item di kategori yang sesuai
2. Isi semua kolom yang diperlukan
3. Update status saat dikerjakan
4. Pindahkan ke "Completed" saat selesai

### Format TODO Item

```markdown
| Feature | Priority | Status | Description |
|---------|----------|--------|-------------|
| Nama Fitur | High/Medium/Low | Not Started/In Progress/Done | Deskripsi singkat |
```

### Priority Levels

| Level | Kriteria |
|-------|----------|
| **High** | Blocking issue, security, data accuracy |
| **Medium** | Performance, UX improvement, new feature |
| **Low** | Nice to have, cosmetic, optimization |

---

## 8. Completed Items

### Yang Sudah Selesai

| Feature | Completed Date | Notes |
|---------|----------------|-------|
| Lembur calculation fix | Feb 2025 | Tier-based rate |
| Employee filtering fix | Feb 2025 | Correct business rule |
| Gang filter fix | Feb 2026 | Proper filtering logic |
| PPH21 TER calculation | Jan 2026 | TER method implementation |
| Google Spreadsheet sync | Jan 2026 | Apps Script integration |
| Page rename | Feb 2026 | Better naming |

---

## 9. How to Help

### Area yang Butuh Kontribusi

1. **Testing** - Tulis unit test dan integration test
2. **Documentation** - Perbaiki dan tambah dokumentasi
3. **Code Review** - Review pull request
4. **Bug Reports** - Laporkan bug yang ditemukan
5. **Feature Ideas** - Usulkan fitur baru

---

## 10. Contact

Untuk diskusi tentang TODO dan fitur:

- **Internal:** Hubungi tim development
- **Documentation:** Update file ini dengan progress terbaru

---

**Selanjutnya:** Baca [13_GIT_WORKFLOW.md](./13_GIT_WORKFLOW.md) untuk memahami workflow pengembangan kode.