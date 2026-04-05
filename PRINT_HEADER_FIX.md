# Print Header Fix

## Masalah
Saat print report, header aplikasi (dengan icon admin) ikut muncul di hasil print.

## Root Cause
Header/topbar (`DashboardLayout.jsx` TopBar component) tidak memiliki class `no-print` sehingga tidak di-hide saat print.

## Fix

### 1. Tambah class `no-print` ke TopBar
**File**: `frontend/src/layouts/DashboardLayout.jsx`

**Sebelum**:
```jsx
<div style={{
    height: '56px',
    backgroundColor: C.topbarBg,
    ...
}}>
```

**Sesudah**:
```jsx
<div className="no-print" style={{
    height: '56px',
    backgroundColor: C.topbarBg,
    ...
}}>
```

### 2. Enhance Print Overrides CSS
**File**: `frontend/src/styles/print-overrides.css`

Ditambah selector yang lebih agresif:
```css
@media print {
    /* Hide the header/topbar with admin icon */
    .no-print,
    header,
    [class*="header"],
    [class*="topbar"],
    [class*="navbar"],
    div[style*="z-index: 30"],
    div[style*="height: 56px"] {
        display: none !important;
    }
}
```

## Hasil
- ✅ Header dengan admin icon **tidak muncul** saat print
- ✅ Sidebar tetap ter-hide
- ✅ Hanya content report yang ter-print
- ✅ Print result bersih tanpa UI elements

## Testing
1. Buka report page manapun
2. Klik Print/Export
3. Preview print - header tidak boleh muncul
4. Print - hasil print bersih tanpa header
