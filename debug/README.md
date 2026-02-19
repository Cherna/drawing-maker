# Debug Scripts

Standalone TypeScript scripts for diagnosing specific issues in the drawing pipeline.
Run each with `npx ts-node debug/<script>.ts` or `npx tsx debug/<script>.ts`.

## Scripts

| File | Purpose |
|------|---------|
| `debug_chains.ts` | Tests `MakerJs.model.findChains` on a sample model. Use when chains are not being detected correctly (e.g., filling fails to find closed loops). |
| `debug_coordinates.ts` | Verifies coordinate transformations and model origin handling. Use when paths appear offset in G-code or SVG output. |
| `debug_resample_fill.ts` | Tests the full resample → fill pipeline on a simple grid. Use when fill hatching doesn't appear or appears at wrong coordinates after resampling. |

## When to Use

Before creating a new debug script, check if one of these already covers the scenario.
Common triggers:
- Filling not generating hatch lines → `debug_resample_fill.ts`
- Paths/chains missing or mangled → `debug_chains.ts`
- Wrong absolute positions in G-code/SVG → `debug_coordinates.ts`
