import fs from 'fs';
import path from 'path';
import MakerJs from 'makerjs';
import { generateGCode } from './core/gcode';
import { modelToSVG } from './core/svg-exporter';
import { AppConfig, SketchGenerator } from './types';
import { PipelineSketch } from './sketches/pipeline-sketch';

// --- CONFIG LOADING ---
function loadConfig(configPath: string): AppConfig {
    const absPath = path.isAbsolute(configPath)
        ? configPath
        : path.join(process.cwd(), configPath);

    if (!fs.existsSync(absPath)) {
        throw new Error(`Config file not found: ${absPath}`);
    }

    const raw = fs.readFileSync(absPath, 'utf8');
    return JSON.parse(raw) as AppConfig;
}

// --- SKETCH REGISTRY ---
const SKETCHES: Record<string, SketchGenerator> = {
    'pipeline': new PipelineSketch()
};

// --- FILE VERSIONING ---
function getNextFilename(outputDir: string, baseName: string): string {
    let counter = 1;
    while (true) {
        const numStr = counter.toString().padStart(3, '0');
        const filename = `${baseName}_${numStr}.gcode`;
        if (!fs.existsSync(path.join(outputDir, filename))) {
            return filename;
        }
        counter++;
    }
}

// --- MAIN RUNNER ---
async function main() {
    try {
        // 1. Get Config
        const configPath = process.argv[2];
        if (!configPath) {
            console.error('Usage: npm start <config-file>');
            console.error('Example: npm start configs/default.json');
            process.exit(1);
        }

        console.log(`Loading config from: ${configPath}`);
        const config = loadConfig(configPath);

        // 2. Select Sketch
        const generator = SKETCHES[config.sketch];
        if (!generator) {
            throw new Error(`Unknown sketch: ${config.sketch}`);
        }

        // 3. Generate Art
        console.log(`Running sketch: ${config.sketch}...`);
        const model = await generator.generate(config.canvas, config.params);

        // 4. Export G-Code
        const gcode = generateGCode(model, config, config.gcode.postProcessor || 'standard');

        // 5. Save Files
        const outputDir = path.join(__dirname, '../drawings');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        // Versioned GCode
        const gcodeFilename = getNextFilename(outputDir, config.outputBaseName);
        const gcodePath = path.join(outputDir, gcodeFilename);
        fs.writeFileSync(gcodePath, gcode);
        console.log(`Saved G-Code to: ${gcodePath}`);

        // SVG (Match GCode filename)
        const svgFilename = gcodeFilename.replace('.gcode', '.svg');
        const svgPath = path.join(outputDir, svgFilename);

        // Use custom SVG exporter that preserves coordinates
        const svg = modelToSVG(model, config.canvas);
        fs.writeFileSync(svgPath, svg);
        console.log(`Saved SVG to: ${svgPath}`);

    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

main();
