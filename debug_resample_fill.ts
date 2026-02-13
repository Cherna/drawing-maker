
import MakerJs from 'makerjs';
import { Transformer } from './src/core/transformer';
import { Filling } from './src/lib/filling';

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
