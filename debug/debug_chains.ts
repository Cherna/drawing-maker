
import MakerJs from 'makerjs';
import { Transformer } from './src/core/transformer';
import { Filling } from './src/lib/filling';
import { generateGCode } from './src/core/gcode';
import { AppConfig } from './src/types';

import { Patterns } from './src/lib/patterns';

console.log("DEBUG: Testing Grid...");
const root = Patterns.Grid(2, 2, 40, 40, { fillChance: 1, seed: 123 });

// 2. Resample
console.log("DEBUG: Resampling Grid...");
const resampled = Transformer.resample(root, 2);
const rRectKey = Object.keys(resampled.models || {}).filter(k => k.startsWith('rect_'))[0];

// 4. Apply Filling
console.log("DEBUG: Filling Resampled Grid...");
Filling.applyFilling(resampled, { angle: 0, spacing: 1 });

// 5. Inspect Chains recursively
console.log("DEBUG: Inspecting Chains on ROOT...");
const chains = MakerJs.model.findChains(resampled);
console.log(`Found ${chains.length} chains on root.`);

// 6. Inspect Chains on Submodel
if (rRectKey) {
    const rRect = resampled.models![rRectKey];
    const fillKeys = Object.keys(rRect.models || {}).filter(k => k.startsWith('fill_'));
    if (fillKeys.length > 0) {
        const fillKey = fillKeys[0];
        const fillModel = rRect.models![fillKey];
        console.log(`DEBUG: Inspecting Chains on FILL MODEL (${fillKey})...`);
        const fillChains = MakerJs.model.findChains(fillModel);
        console.log(`Found ${fillChains.length} chains on fill model.`);

        if (fillChains.length > 0) {
            const ctx = fillChains[0].links[0].walkedPath.pathContext;
            console.log(`First fill chain type: ${ctx.type}, length: ${MakerJs.measure.pathLength(ctx)}`);
        } else {
            const pKeys = Object.keys(fillModel.paths || {});
            console.log("Fill model has paths:", pKeys.length);
            // Check if paths are valid
            if (pKeys.length > 0) {
                const p = fillModel.paths![pKeys[0]];
                // console.log("First path:", p);
                console.log("Is Line?", p.type === 'line');
                console.log("Origin:", p.origin);
                console.log("End:", (p as any).end);
            }
        }
    } else {
        console.log("No fill models found inside rect.");
    }
} else {
    console.log("No rect model found.");
}

// 7. Sanity Check
console.log("\nDEBUG: Sanity Check - Single Line Model");
const simpleLine: MakerJs.IModel = {
    paths: {
        'line1': new MakerJs.paths.Line([0, 0], [10, 0])
    }
};
const simpleChains = MakerJs.model.findChains(simpleLine);
console.log(`Simple Line Chains: ${simpleChains.length}`);
if (simpleChains.length > 0) {
    console.log("Simple Line Chain [0] links:", simpleChains[0].links.length);
}

// 8. Sanity Check - Array of Lines
console.log("\nDEBUG: Sanity Check - Multiple Disconnected Lines");
const multiLine: MakerJs.IModel = {
    paths: {
        'l1': new MakerJs.paths.Line([0, 0], [10, 0]),
        'l2': new MakerJs.paths.Line([0, 5], [10, 5])
    }
};
const multiChains = MakerJs.model.findChains(multiLine);
console.log(`Multi Line Chains: ${multiChains.length}`);

