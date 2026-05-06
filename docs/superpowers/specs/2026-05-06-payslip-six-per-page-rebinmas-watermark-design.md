# Payslip Six-Per-Page Rebinmas Watermark Design

## Goal

Add a repeated Rebinmas watermark behind each printed slip gaji while keeping the foreground payroll text, totals, borders, and employee information clearly readable.

## Scope

- Applies to the payslip print view only.
- The active print format is 6 slips per A4 portrait page: 2 columns by 3 rows.
- Uses the existing Rebinmas logo asset at `frontend/public/images/rebinmas.webp`.
- The watermark should be visible in browser preview, print output, and PDF export because the preview represents the printed page.

## Design

Render the watermark inside each `PayslipCard`, not as one page-level overlay. Each cut slip will therefore retain its own Rebinmas identity after printing and cutting.

Each watermark tile contains the small Rebinmas logo plus the text `REBINMAS`. Tiles repeat diagonally across the card. The 6-slip card is shorter than the previous 4-slip format, so the tile size, row height, and opacity must stay compact. Foreground content remains above the watermark through explicit z-index layering.

Layering requirements:

- Card background and decorative border stay at the lowest layer.
- Watermark layer sits above the card background and below all payslip content.
- Header, employee info, activity summary, income/deduction columns, notes, totals, and footer sit above the watermark.
- Watermark uses `pointer-events: none` and `aria-hidden="true"`.
- Opacity is low enough that numbers and labels remain readable in black-and-white print.

## Testing

- Add or update the `PayslipCard` component test to verify repeated watermark tiles include both the Rebinmas logo and `REBINMAS` label.
- Add or update the payslip print CSS test to verify the 2x3 grid and watermark layering.
- Run focused frontend tests for `PayslipCard` and `payslip-print.css`.
