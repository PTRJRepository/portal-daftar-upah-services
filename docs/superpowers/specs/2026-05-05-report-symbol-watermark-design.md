# Report Symbol Watermark Design

## Goal

Make every printed payroll report, especially slip gaji, carry a formal repeated watermark that signals authenticity through Rebinmas visual identity instead of explicit words such as "resmi" or "credential".

## Scope

- Applies to all frontend print report surfaces that use payroll/report print layouts.
- Payslip/slip gaji is included and prioritized because it is the most employee-facing credential document.
- Watermark uses the existing Rebinmas logo asset at `frontend/public/images/rebinmas.webp`.
- Watermark should appear in print/PDF output and may remain visible in print preview when that preview represents the printed page.

## Design

Use a repeated diagonal Rebinmas symbol/logo pattern. The pattern should be subtle enough to preserve readability but visible enough that white cards, table containers, and boxed totals do not fully hide it.

The implementation should introduce or extend a shared watermark primitive so report pages do not each maintain separate watermark markup. The primitive should support report-page scale and payslip-card scale. Report pages use a wider repeated page overlay. Payslips use a denser repeated pattern inside each card because four cards fit on one A4 portrait page.

Layering is the main requirement:

- Watermark is non-interactive with `pointer-events: none`.
- Watermark sits above plain white or gray report box backgrounds.
- Report text, borders, table lines, signatures, and totals sit above the watermark.
- Print color adjustment is enabled so browser print/PDF keeps the watermark visible.

Existing print page orientation should stay unchanged: landscape reports remain landscape; payslip remains portrait.

## Testing

- Add/update component tests proving watermark markup renders for the shared report watermark and payslip card.
- Add/update CSS tests proving watermark layering uses a middle layer: background below, watermark above background, content above watermark.
- Run focused frontend tests for watermark, payslip print CSS, and report print foundation.
- Run frontend build if practical after focused tests pass.
