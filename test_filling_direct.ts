
import MakerJs from 'makerjs';
import { Filling } from './src/lib/filling';
import { Patterns } from './src/lib/patterns';

console.log("Starting Simulation (Grid 20x20, Chance 0.8, Seed 0)...");

// 1. Generate model with user params
const model = Patterns.Grid(20, 20, 200, 200, { fillChance: 0.8, seed: 0 });

// Simulate Pipeline: Resample (which was causing the issue)
console.log("Simulating Pipeline: Resample...");
import { Transformer } from './src/core/transformer';
const resampled = Transformer.resample(model, 2);
// Use the resampled model for next steps
const workingModel = resampled;

// Simulate Pipeline Centering
const offset = [100, 100];
console.log(`Simulating Pipeline: Moving model by ${offset}...`);
MakerJs.model.move(workingModel, offset as MakerJs.IPoint);


let rectCount = 0;
if (workingModel.models) {
    rectCount = Object.keys(workingModel.models).filter(k => k.startsWith('rect_')).length;
}
console.log(`Generated Rect Count: ${rectCount} (Expected ~320)`);

if (rectCount < 10) {
    console.error("FAILURE: Too few rectangles. Randomness issue?");
}

// 2. Apply Filling
console.log("Applying filling...");
Filling.applyFilling(workingModel, {
    angle: 0,
    spacing: 1
});

// 3. Inspect results
let filledRects = 0;
let filledMain = 0;
let totalHatchLines = 0;

const scan = (m: MakerJs.IModel, path: string[]) => {
    if (m.models) {
        for (const k in m.models) {
            if (k.startsWith('fill_')) {
                // This is a fill
                const lines = Object.keys(m.models[k].paths || {}).length;
                totalHatchLines += lines;
                if (lines > 0) {
                    // Check parent path
                    const parentName = path[path.length - 1]; // e.g. "rect_0_0" or "resample_rect_..." if structure changes?
                    // Transformer.resample preserves structure: m.models[id]
                    if (parentName && parentName.startsWith('rect_')) {
                        filledRects++;
                    } else {
                        filledMain++;
                        // console.log(`[INFO] Found fill in non-rect model (likely grid perimeter or path segment). Lines: ${lines}`);
                    }
                }
            } else {
                scan(m.models[k], [...path, k]);
            }
        }
    }
}

scan(workingModel, ['root']);

console.log(`Filled Rects: ${filledRects}`);
console.log(`Filled Main/Other: ${filledMain}`);
console.log(`Total Hatch Lines: ${totalHatchLines}`);

if (filledRects > 0) {
    console.log("SUCCESS: Rectangles are being filled.");
} else {
    console.error("FAILURE: No rectangles filled.");
}
