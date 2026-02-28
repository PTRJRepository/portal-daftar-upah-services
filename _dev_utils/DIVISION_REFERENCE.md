# Division Definitions - PT Rebinmas Payroll System

## IMPORTANT: Correct Division Names

**DO NOT use incorrect definitions. Always refer to this file.**

### Real Divisions (from database `extend_db_ptrj` → `[dbo].[Divisi_Description]`)

| Code | Description | Notes |
|------|-------------|-------|
| **P1A** | Parit Gunung 1A | Plasma estate division 1A |
| **P1B** | Parit Gunung 1B | Plasma estate division 1B |
| **P2A** | Parit Gunung 2A | Plasma estate division 2A |
| **P2B** | Parit Gunung 2B | Plasma estate division 2B |
| **DME** | KEBUN DME | Estate division (confirm full name from DB) |
| **ARA** | KEBUN ARA | Ara estate division |
| **AB1** | Air Ruak B1 | Also known as ARB1 |
| **AB2** | Air Ruak B2 | Also known as ARB2 |
| **ARC** | Air Ruak RC | Air Ruak RC division |
| **IJL** | KEBUN IJL | IJL estate division |
| **INF** | INFRASTRUKTUR | Infrastructure division |
| **NRS** | NURSERY | Nursery division |
| **MILL** | MILL PKS | Palm Oil Mill division |
| **PGE** | Parit Gunung Estate | General estate division |
| **WKS** | WORKSHOP | General workshop |

### Virtual Divisions (defined in code)

| Code | Description | Source/Pattern |
|------|-------------|----------------|
| **WKS_PG** | WORKSHOP PARIT GUNUNG | Pattern: workshop + (parit\|PGE\|P.G\|Harapan Mukti) |
| **WKS_AR** | WORKSHOP AIR RUAK | Pattern: workshop + (Air Ruak\|ARE\|A.R) or traksi Air Ruak |

---

## CRITICAL: What NOT to Use

❌ **WRONG definitions:**
- ~~PG = Plantation Group~~ → **CORRECT: PG = Parit Gunung**
- ~~AR = Arbei~~ → **CORRECT: AR = Air Ruak**
- ~~DME = Estate Maintenance~~ → **CORRECT: DME = KEBUN DME** (verify from DB)
- ~~ARA = Ara Estate~~ → **CORRECT: ARA = KEBUN ARA**
- ~~ARB1 = Arbei Estate 1~~ → **CORRECT: ARB1 = Air Ruak B1**
- ~~ARB2 = Arbei Estate 2~~ → **CORRECT: ARB2 = Air Ruak B2**
- ~~AREC = Area Civil~~ → **Verify from DB**
- ~~PG1A/PG1B/PG2A/PG2B~~ → **Use P1A/P1B/P2A/P2B** (database codes)

---

## Gang Code Prefix Mapping

| Division | Gang Prefix | Example Gangs |
|----------|-------------|---------------|
| P1A | A | A1H, A2H, A1M, A1T |
| P1B | B | B1H, B2H, B1M |
| P2A | C | C1H, C2H, C1M |
| P2B | D | D1H, D2H, D1M |
| DME | E | E1H, E2H |
| ARA | F | F1H, F2H |
| AB1/ARB1 | G | G1H, G2H |
| AB2/ARB2 | H | H1H, H1M, H2H |
| INF/INFRA | I | I1H, I2H, IN001 |
| AREC | J | J1H, J2H |
| IJL | L | L1H, L2H |
| STF-OFFICE | O | O1H, O2H |
| SECURITY | SEC | SEC001, SEC002 |

---

## Division Aliases (Code Resolution)

The system automatically resolves these aliases:
- `INFRA` → `INF`
- `NURSERY` → `NRS`
- `PG1A` → `P1A`
- `PG1B` → `P1B`
- `PG2A` → `P2A`
- `PG2B` → `P2B`

---

## Source of Truth

1. **Primary Source**: Database `extend_db_ptrj` → Table `[dbo].[Divisi_Description]`
2. **Secondary Source**: `backend/data/area_produktif.json`
3. **Virtual Division Logic**: `backend/src/services/divisionDefinition.ts`

---

## For AI Agents

When asked about division definitions:
1. **Always** refer to this file first
2. **Never** assume or make up division names
3. **Direct users** to check `extend_db_ptrj` database for authoritative data
4. **Remember**: PG = Parit Gunung, AR = Air Ruak (NOT Plantation Group or Arbei)

---

## Related Files
- `dokumentasi/DAFTAR_DIVISI_LENGKAP.md` - Complete Indonesian documentation
- `backend/data/area_produktif.json` - Area data with hectare information
- `backend/src/services/divisionDefinition.ts` - Virtual division definitions
- `Additional_services/create_aggregation_upah/setup_divisi_description.py` - Division description seeder script
