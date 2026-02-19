
import MakerJs from 'makerjs';
import { Filling } from './src/lib/filling';

console.log("DEBUG: Investigating findChains coordinates...");

const rect = new MakerJs.models.Rectangle(10, 10);
// Rect paths are: Bottom: [0,0]->[10,0], Top: [0,10]->[10,10], etc.
// Center it
MakerJs.model.center(rect); // Bottom: [-5,-5]->[5,-5]

// Move it
MakerJs.model.move(rect, [20, 20]); // Origin -> [20, 20]

console.log("Rect Origin:", rect.origin);
console.log("Rect Path 'Bottom' Origin (Local):", rect.paths!.Bottom.origin);
// Note: In MakerJs, model.paths are ALWAYS local to model.origin.
// So Bottom.origin should still be [-5, -5].

// Now find chains
console.log("Finding Chains...");
const chains = MakerJs.model.findChains(rect);

if (chains.length > 0) {
    const chain = chains[0];
    const link = chain.links[0];
    const walkedPath = link.walkedPath;
    const pathContext = walkedPath.pathContext; // The original path?

    console.log("Chain Path Context Origin:", pathContext.origin);
    console.log("Chain Link EndPoints[0]:", link.endPoints[0]);

    // Check if endPoints are absolute (20, 20 based) or local (-5, -5)
    // If findChains applies model origin, endPoints will be [15, 15].
    // If it stays local, endPoints will be [-5, -5].

    if (link.endPoints[0][0] > 10) {
        console.log("CONCLUSION: findChains returns ABSOLUTE coordinates (applied origin).");
    } else {
        console.log("CONCLUSION: findChains returns LOCAL coordinates.");
    }
} else {
    console.log("No chains found.");
}

// Check what applyFilling does
console.log("\nChecking applyFilling...");
const tempModel: MakerJs.IModel = {
    models: { 'testRect': rect } // Wrap in a parent
};

// We mocked applyFilling logic in our head:
// 1. Traverse to testRect
// 2. findChains(testRect)
// 3. fillLoop(chain) -> Hatch lines
// 4. Add hatch to testRect.

// If findChains is Absolute -> Hatch is Absolute.
// Added to testRect (which has origin) -> Double Offset.
