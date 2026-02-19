
import MakerJs from 'makerjs';
import { Transformer } from './src/core/transformer';
import { Filling } from './src/lib/filling';
import { generateGCode } from './src/core/gcode';
import { AppConfig } from './src/types';

import { Patterns } from './src/lib/patterns';

console.log("DEBUG: Testing Grid...");
const root = Patterns.Grid(2, 2, 40, 40, { fillChance: 1, seed: 123 });

// Inspect a rect
const keys = Object.keys(root.models || {}).filter(k => k.startsWith('rect_'));
const firstKeys = keys.length > 0 ? keys[0] : null;
if (firstKeys) {
    const r = root.models![firstKeys];
    console.log(`Original Grid Rect Origin: ${r.origin}`);
}

// 2. Resample
console.log("DEBUG: Resampling Grid...");
const resampled = Transformer.resample(root, 2);

// 3. Inspect Resampled Grid
const rRectKey = Object.keys(resampled.models || {}).filter(k => k.startsWith('rect_'))[0];
const rRect = resampled.models![rRectKey];
console.log(`Resampled Grid Rect Key: ${rRectKey}`);
console.log(`Resampled Grid Rect Origin: ${rRect?.origin}`);

if (rRect) {
    const chains = MakerJs.model.findChains(rRect, { containment: false });
    console.log(`Resampled Grid Rect Chains: ${chains.length}`);
}

// 4. Apply Filling
console.log("DEBUG: Filling Resampled Grid...");
Filling.applyFilling(resampled, { angle: 0, spacing: 1 });

if (rRect && rRect.models) {
    const fillKeys = Object.keys(rRect.models).filter(k => k.startsWith('fill_'));
    console.log(`Grid Rect Fill Count: ${fillKeys.length}`);
}

// 5. Inspect Chains directy
console.log("DEBUG: Inspecting Chains...");
const chains = MakerJs.model.findChains(resampled);
console.log(`Found ${chains.length} chains total.`);

let hatchCount = 0;
let outlineCount = 0;

(chains as any[]).forEach((chain: any, i: number) => {
    const isClosed = chain.endless;
    const links = chain.links ? chain.links.length : 0;

    // Heuristic: Hatch lines are usually single links and not closed
    // Outlines are usually closed (endless) or many links
    if (!isClosed && links === 1) {
        hatchCount++;
        // Print sample of hatch
        if (hatchCount <= 5) {
            const ctx = chain.links[0].walkedPath.pathContext;
            console.log(`Hatch candidate #${i}: Line from ${ctx.origin} to ${ctx.end}`);
        }
    } else {
        outlineCount++;
        if (outlineCount <= 1) {
            console.log(`Outline candidate #${i}: Closed=${isClosed}, Links=${links}`);
        }
    }
});

console.log(`Analysis: ${hatchCount} likely hatch lines, ${outlineCount} likely outlines.`);

// 6. Generate GCode with the FIX
console.log("DEBUG: Generating G-Code with updated gcode.ts...");
const config: AppConfig = {
    canvas: { width: 100, height: 100, margin: 0 },
    gcode: {
        travelRate: 3000,
        feedRate: 1000,
        zSafe: 5,
        zDown: 0,
        zUp: 5,
        optimizePaths: false
    }
} as any;

const gcode = generateGCode(resampled, config);
const g1Count = (gcode.match(/^G1/gm) || []).length;
console.log(`Total G1 (Draw) Commands: ${g1Count}`);

// Check if we have hatching-like moves
// Match G1 X... Y... where Y is repeated
// Check if ROOT has fills (This would be the bug: filling the grid lines)
const rootFillKeys = Object.keys(resampled.models || {}).filter(k => k.startsWith('fill_'));
console.log(`DEBUG: Root Fill Models: ${rootFillKeys.length}`);
if (rootFillKeys.length > 0) {
    console.log("BUG CONFIRMED: Grid lines are being filled!");
}

console.log("Checking for hatch lines in G-Code...");

const lines = gcode.split('\n');
let hatchMoves = 0;
for (let i = 0; i < lines.length - 1; i++) {
    // Look for G1 moves that might be hatching (horizontal lines)
    // G1 X10 Y10.5 -> G1 X30 Y10.5
    // But format is G1 X... Y...
    if (lines[i].startsWith('G1') && lines[i + 1].startsWith('G1')) {
        // simple heuristic
    }
}
// Just dump the first few lines of "orphan" processing if possible?
// We can't see the console log from gcode.ts easily here as it's commented out in gcode.ts.
// But we can check the G-code content.
// Search for coordinates that match the hatch lines.
// Hatch lines should be at Y = 10 + k (spacing 1) -> 11, 12, 13...
// Grid is at 10,10.
// Outline is 10,10 to 30,10 etc.
// Hatching inside: 10.5, 11.5 ...
// Let's filter G1 commands with Y having .5 fraction
const fractionY = lines.filter(l => l.startsWith('G1') && l.includes('.500')).length;
console.log(`G1 commands with .5 coordinate (likely hatching): ${fractionY}`);



