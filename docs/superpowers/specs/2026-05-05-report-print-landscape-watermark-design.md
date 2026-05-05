# Report Print Landscape Watermark Design

## Goal

Make payroll report print layouts default to landscape, add a subtle Rebinmas watermark that does not reduce readability, and show short division descriptions in report metadata.

## Scope

- Applies to payroll/report pages: summary detail, wages summary, wages comparison, analysis, impact, cost/HK, gang, productivity, mill, and THR print previews.
- Keeps payslip/slip gaji in portrait because it is a dedicated card layout.
- Uses the existing Rebinmas logo at `frontend/public/images/rebinmas.webp`.
- Uses existing division descriptions from API rows when available and falls back to a local frontend mapping for known codes.

## Design

Add a small reusable division label utility that normalizes codes such as `P1A` and `PG1A` and returns concise labels such as `PG1A - Parit Gunung 1A`. Report headers will show one short metadata item instead of long explanatory text.

Add a reusable print watermark component with a `report-watermark` class. CSS will render it only in print, centered behind report content with low opacity and `pointer-events: none`. Report containers keep their content above the watermark with positioning and z-index rules.

Landscape page size remains centralized through existing print styles. Inline/generated print HTML such as THR preview will be changed to default to landscape, except payslip.

## Testing

- Add unit tests for division label fallback behavior.
- Add a component test for watermark rendering.
- Run the focused frontend tests.
- Run `npm run build` in `frontend` to verify CSS/JS integration.

