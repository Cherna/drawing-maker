
import MakerJs from 'makerjs';
import { generateGCodeForLayers, generateGCode } from './src/core/gcode';
import { AppConfig } from './src/types';

// Mock Config
const config: AppConfig = {
    sketch: 'pipeline',
    params: {},
    canvas: { width: 100, height: 100, margin: 10 },
    gcode: {
        feedRate: 1000,
        travelRate: 2000,
        zSafe: 5,
        zDown: 0,
        zUp: 5,
        optimizePaths: false,
        postProcessor: 'standard'
    }
};

const run = () => {
    console.log("Testing GCode generation for raw Circle...");

    // 1. Create a model with a Circle (common in generators like Concentric, Phyllotaxis)
    const model: MakerJs.IModel = {
        paths: {
            "c1": new MakerJs.paths.Circle([50, 50], 20)
        }
    };

    // 2. Try single layer export logic
    console.log("--- Single Layer ---");
    try {
        const gcode = generateGCode(model, config);
        console.log(`Generated ${gcode.split('\n').length} lines`);
        if (gcode.includes('G1') || gcode.includes('G2') || gcode.includes('G3')) {
            console.log("SUCCESS: GCode contains movement commands");
        } else {
            console.error("FAIL: GCode missing movement commands");
            console.log(gcode);
        }
    } catch (e) {
        console.error("ERROR in single layer:", e);
    }

    // 3. Try multi-layer export logic
    console.log("\n--- Multi Layer ---");
    const layers = new Map<string, MakerJs.IModel>();
    layers.set('layer1', model);

    // Add a second layer with an Arc
    const model2: MakerJs.IModel = {
        paths: {
            "a1": new MakerJs.paths.Arc([20, 20], 10, 0, 90)
        }
    };
    layers.set('layer2', model2);

    try {
        const gcode = generateGCodeForLayers(layers, config);

        // Check for layer markers
        const hasL1 = gcode.includes('(Layer: layer1)');
        const hasL2 = gcode.includes('(Layer: layer2)');

        console.log(`Layer 1 found: ${hasL1}`);
        console.log(`Layer 2 found: ${hasL2}`);

        // Check for actual geometry
        // We expect G2/G3 for arcs/circles in standard processor (it supports arcs)
        // OR G1 if it defaults to segmentation (but it shouldn't unless requested)
        const hasMoves = gcode.split('\n').filter(l => l.startsWith('G1') || l.startsWith('G2') || l.startsWith('G3')).length > 0;

        if (hasL1 && hasL2 && hasMoves) {
            console.log("SUCCESS: Multi-layer export seems okay");
        } else {
            console.error("FAIL: Missing layers or movements");
            console.log(gcode);
        }

    } catch (e) {
        console.error("ERROR in multi layer:", e);
    }
};

run();
