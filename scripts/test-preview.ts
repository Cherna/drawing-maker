import { Pipeline } from "../src/core/pipeline";
import { modelToSVG } from "../src/core/svg-exporter";
import { AppConfig } from "../src/types";
import fs from 'fs';

const validB64 = "iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAAWklEQVR42u3PMREAAAwCoH1z+y+p0O8qWIAEtwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAhMNkS1A63V6X5yAAAAAElFTkSuQmCC";

const config: AppConfig = {
    sketch: "concentric-hatching",
    outputBaseName: "test",
    canvas: { width: 100, height: 100, margin: 0 },
    gcode: { feedRate: 1000, travelRate: 1000, zUp: 5, zDown: 0 },
    params: {
        steps: [
            {
                tool: "concentric-hatching",
                params: {
                    densityMap: "data:image/png;base64," + validB64,
                    density: 5,
                    minAlpha: 0,
                    maxAlpha: 1,
                    preFilter: false,
                    centerX: 50,
                    centerY: 50,
                    checkBounds: false,
                    drawContour: false,
                    count: 5 // Ensure it generates lines
                }
            }
        ],
        seed: 1
    }
};

async function run() {
    try {
        const model = await Pipeline.execute(config.params.steps || [], config.canvas, config.params.seed, config.gcode);

        let pathCount = 0;
        const keys = Object.keys(model.models || {});
        for (const k of keys) {
            if (model.models?.[k]?.models?.['isolines']) {
                const i = model.models[k].models['isolines'];
                pathCount += Object.keys(i.paths || {}).length;
            }
        }
        console.log("Total isolines:", pathCount);

        const svg = modelToSVG(model, config.canvas);
        fs.writeFileSync("test-output.svg", svg);
        console.log("Wrote test-output.svg");
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
