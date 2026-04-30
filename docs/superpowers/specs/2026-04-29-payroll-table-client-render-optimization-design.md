# Payroll Table Client Render Optimization Design

## Context

`frontend/src/components/CustomPayrollTable.jsx` renders the operational Daftar Upah table from streamed gang data. The current path can do overlapping work during data input and streaming: stream rows are flattened, mirrored into `rows`, sorted after completion, published to parents, cached to localStorage, and rendered as a full DOM table. This makes input and scrolling heavy, especially when the stream initially appears in one order and then changes after completion.

## Goals

- Keep `CustomPayrollTable` behavior intact for visible columns, edit mode, manual adjustments, export, DB_PTRJ comparison, gang headers/totals, grand total, and employee detail navigation.
- Reduce duplicate client-side work during streaming and after completion.
- Keep row order stable from the first rendered pass so employees do not jump from backend/empcode order to a later client sort.
- Make scrolling smoother by mounting only the body rows near the viewport.

## Non-Goals

- Do not replace `CustomPayrollTable` with AG Grid.
- Do not change backend payroll formulas, stream endpoint payloads, or saved adjustment payloads.
- Do not redesign the table UI.

## Design

1. Add a small row-pipeline utility that flattens stream gangs into display rows, applies pending edit overlays, and sorts employees inside each gang consistently. The component keeps `rows` for legacy fallback and local optimistic row patches, but stream data remains the primary source when SSE is active.
2. Adjust the runtime policy so streamed rows are not mirrored into React state after completion. Parent publication and localStorage persistence continue only after the stream settles, preventing repeated large payload serialization during streaming.
3. Add a virtual row-window utility. `CustomPayrollTable` computes the visible body window from `scrollTop`, container height, row height, header height, and a buffer. The table body renders top/bottom spacer rows plus the visible display rows. Selection indices remain absolute row indices.
4. Keep cache/export/parent callbacks based on the complete `displayRows`, not the visible virtual slice, so downstream functionality still sees the full dataset.

## Testing

- Unit-test runtime policy: stream rows should not mirror to `rows`, but parent publish/cache still wait for settled streams.
- Unit-test row pipeline: rows are stable by sort key during streaming and pending edits overlay without mutating source rows.
- Unit-test virtual window: only visible ranges are returned, with stable absolute indices and spacer heights.
- Run focused frontend tests for payroll runtime, row pipeline, virtual window, and existing `CustomPayrollTable` render/scope tests.
