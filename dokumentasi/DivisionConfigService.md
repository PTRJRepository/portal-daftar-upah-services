# DivisionConfigService - Single Source of Truth

## Overview

`DivisionConfigService` adalah service sentral yang mengelola semua definisi divisi dalam sistem payroll. Service ini menyediakan:

- **Single Source of Truth** untuk semua pemetaan divisi
- **Virtual Divisions** (INF, NRS, WKS_AR, WKS_PG, MILL)
- **Alias Resolution** - resolve kode divisi ke bentuk kanonikal
- **Pattern Matching** - pencocokan gang ke divisi virtual berdasarkan pola

## Struktur

### Location
```
backend/src/services/config/DivisionConfigService.ts
```

### Interface Utama

```typescript
export interface DivisionDefinition {
    code: string;           // Kode kanonikal (e.g., 'PG1A', 'AB1', 'INF')
    name: string;           // Nama human-readable
    type: 'real' | 'virtual';  // Tipe divisi
    aliases: string[];      // Semua alias
    sourceDivision?: string; // Divisi sumber untuk virtual divisions
    gangPattern?: RegExp;   // Pola regex untuk pencocokan gang
    descriptionPattern?: RegExp; // Pola regex untuk deskripsi
    excludeFromSource?: boolean;
    description?: string;
}
```

## Divisi yang Didukung

### Real Divisions

| Code | Name | Aliases |
|------|------|---------|
| PG1A | Plasma 1 Afdeling | P1A, PG1A, Plasma 1A |
| PG1B | Plasma 1 Blok | P1B, PG1B, Plasma 1B |
| PG2A | Plasma 2 Afdeling | P2A, PG2A, Plasma 2A |
| PG2B | Plasma 2 Blok | P2B, PG2B, Plasma 2B |
| PGE | Plasma Energi | PGE |
| AB1 | Afdeling 1 | AB1, ARB1, Air Ruak 1 |
| AB2 | Afdeling 2 | AB2, ARB2 |
| ARA | Area | ARA |
| ARC | Air Ruak Central | ARC, AREC |
| DME | Dempo | DME |
| IJL | Ijuk | IJL, L |

### Virtual Divisions

| Code | Name | Source Division | Gang Pattern |
|------|------|-----------------|--------------|
| INF | Infrastruktur | PG1A | /^IN\d*$/i |
| NRS | Nursery | PG1B | /^B2N$/i |
| WKS_AR | Workshop Air Ruak | AB2 | /^HMC$/i |
| WKS_PG | Workshop Parit Gunung | PG1A | /^AMC$/i |
| WORKSHOP | Workshop All | - | /^(HMC\|AMC)$/i |
| MILL | Palm Oil Mill | - | /^M\d*$/i |

## Usage

### Basic Resolution

```typescript
import { divisionConfigService } from './services/config/DivisionConfigService';

// Resolve alias ke kode kanonikal
const canonical = divisionConfigService.resolveCode('HMC'); // → 'WKS_AR'
const canonical = divisionConfigService.resolveCode('ARB1');  // → 'AB1'
const canonical = divisionConfigService.resolveCode('P1A');   // → 'PG1A'
```

### Check Virtual Division

```typescript
// Cek apakah divisi adalah virtual
const isVirtual = divisionConfigService.isVirtualDivision('INF');   // → true
const isVirtual = divisionConfigService.isVirtualDivision('AB1');   // → false
```

### Get All Aliases

```typescript
// Dapatkan semua alias untuk sebuah divisi
const aliases = divisionConfigService.getAliases('AB1');
// → ['AB1', 'AB-1', 'ARB1', 'arb1', 'AFDELING1', 'AFD1', 'Air Ruak 1']
```

### Build SQL WHERE Clause

```typescript
// Bangun query clause dengan parameterized values
const { sql, params } = divisionConfigService.buildDivisionWhereClause('AB1', 'division_code');
// sql: ' AND division_code IN (?,?,?,?,?,?,?)'
// params: ['AB1', 'AB-1', 'ARB1', ...]
```

### Get Gangs for Division

```typescript
// Dapatkan semua gang untuk divisi tertentu (termasuk virtual)
const gangs = await divisionConfigService.getGangsForDivision('WKS_AR');
// Returns GangInfo[] dengan filtering berdasarkan pattern
```

### Match Gang to Virtual Division

```typescript
// Cocokkan gang ke divisi virtual
const vDiv = divisionConfigService.matchGangToVirtualDivision('HMC', 'Workshop Air Ruak', 'AB2');
// → 'WKS_AR'

const vDiv = divisionConfigService.matchGangToVirtualDivision('IN01', 'Infrastruktur Afd 1', 'PG1A');
// → 'INF'
```

## GangService Integration

`gangService` sekarang menggunakan `DivisionConfigService` sebagai sumber kebenaran:

```typescript
import { gangService } from './services/gangService';

// Semua method ini sekarang menggunakan DivisionConfigService di belakang
gangService.normalizeDivisionCode('HMC');           // → 'WKS_AR'
gangService.isVirtualDivision('WKS_PG');            // → true
gangService.getAllDivisionAliases('AB1');           // → ['AB1', 'AB-1', ...]
gangService.buildDivisionWhereClause('PG1A', 'loc_code');  // → { sql, params }
```

## Migration Notes

### Sebelum (Duplikasi)

```typescript
// Sebelum: setiap service punya mapping sendiri
const DIVISION_MAP = {
    'P1A': 'PG1A',
    'HMC': 'WKS_AR',
    // ...
};
```

### Sesudah (Single Source)

```typescript
// Sesudah: semua menggunakan DivisionConfigService
import { divisionConfigService } from './services/config/DivisionConfigService';

const canonical = divisionConfigService.resolveCode('P1A'); // → 'PG1A'
```

## Best Practices

1. **Selalu gunakan DivisionConfigService** untuk resolusi divisi
2. **Gunakan parameterized queries** dengan `buildDivisionWhereClause()` untuk keamanan
3. **Cek virtual division** sebelum query dengan `isVirtualDivision()`
4. **Gunakan alias** yang sudah didefinisikan - jangan buat alias baru tanpa didaftarkan

## Testing

```bash
# Test division mapping
cd backend && bun run src/scripts/test_division_mapping.ts
```

Semua test harus PASS sebelum deploy:
- ✓ `normalizeDivisionCode()` - semua alias resolve dengan benar
- ✓ `isSameDivision()` - pencocokan antar divisi
- ✓ `getAllDivisionAliases()` - semua alias terdokumentasi
- ✓ `buildDivisionWhereClause()` - query generation benar
