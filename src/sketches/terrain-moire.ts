import MakerJs from 'makerjs';
import { SketchGenerator, CanvasConfig, MaskConfig } from '../types';
import { Patterns } from '../lib/patterns';
import { Effects } from '../lib/effects';
import { Layout } from '../lib/layout';
import { Masks } from '../lib/masks';

export interface TerrainMoireParams {
    lines: number;
    rotation: number;     // Degrees of interference
    noiseScale: number;
    noiseMagnitude: number;
    resampleRes: number;
    axis?: 'x' | 'y';
    mask?: MaskConfig | MaskConfig[];
}

export class TerrainMoireSketch implements SketchGenerator {
    generate(canvas: CanvasConfig, params: TerrainMoireParams): MakerJs.IModel {
        const bounds = Layout.getDrawArea(canvas.width, canvas.height, canvas.margin);

        // Defaults
        const lines = params.lines || 80;
        const res = params.resampleRes || 1.0;
        const rot = params.rotation || 0;

        // 1. Create Base Layer
        // Using "Stripes" which are horizontal lines by default
        const layer1 = Patterns.Stripes(lines, bounds.width, bounds.height);

        // Resample and Apply Noise
        const maskFn = params.mask ? Masks.create(params.mask, bounds) : undefined;

        const processedLayer1 = Effects.resample(layer1, res);
        Effects.noise(processedLayer1, {
            scale: params.noiseScale || 0.05,
            magnitude: params.noiseMagnitude || 5,
            axis: params.axis || 'y'
        }, maskFn);

        // 2. Create Second Layer (Clone & Transform)
        // We clone the first layer to get interference against itself
        const layer2 = MakerJs.cloneObject(processedLayer1);

        // Rotate Layer 2 around its center
        // MakerJS rotates around 0,0 by default unless anchor provided
        // Our stripes are in (0,0) to (w,h) box, so center is w/2, h/2
        MakerJs.model.rotate(layer2, rot, [bounds.width / 2, bounds.height / 2]);

        // 3. Combine
        const art = {
            models: {
                layer1: processedLayer1,
                layer2: layer2
            }
        };

        // 4. Center the Result in the "Draw Area" (Origin logic)
        // Creating the drawing inside (0,0)->(drawWidth, drawHeight) makes it easy
        // We just need to move it to the margin offsets
        MakerJs.model.move(art, [bounds.x, bounds.y]);

        return art;
    }
}
