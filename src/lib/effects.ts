import MakerJs from 'makerjs';
import { createNoise2D } from 'simplex-noise';
import { Transformer } from '../core/transformer';

export interface NoiseOptions {
    scale: number;
    magnitude: number;
    axis?: 'x' | 'y' | 'both';
}

export class Effects {
    static resample(model: MakerJs.IModel, distance: number) {
        return Transformer.resample(model, distance);
    }

    static noise(model: MakerJs.IModel, options: NoiseOptions, mask?: (x: number, y: number) => number) {
        const noise2D = createNoise2D();

        Transformer.displace(model, (x, y) => {
            // Calculate noise value
            const n = noise2D(x * options.scale, y * options.scale);

            // Calculate mask weight (0 to 1)
            const weight = mask ? mask(x, y) : 1;

            let dx = 0;
            let dy = 0;

            if (options.axis === 'x' || options.axis === 'both' || !options.axis) {
                dx = n * options.magnitude * weight;
            }
            if (options.axis === 'y' || options.axis === 'both' || !options.axis) {
                dy = n * options.magnitude * weight;
            }

            return { x: x + dx, y: y + dy };
        });

        return model;
    }

    static trim(model: MakerJs.IModel, threshold: number, mask: (x: number, y: number) => number) {
        const filterPaths = (m: MakerJs.IModel) => {
            if (m.paths) {
                for (const [id, path] of Object.entries(m.paths)) {
                    // Calculate midpoint
                    const extents = MakerJs.measure.pathExtents(path);
                    const mid = [
                        (extents.low[0] + extents.high[0]) / 2,
                        (extents.low[1] + extents.high[1]) / 2
                    ];
                    const val = mask(mid[0], mid[1]);

                    // Probabilistic trimming:
                    // If mask value is 0.8, we have 80% chance to KEEP it.
                    // So if Random > Val, we DELETE it.
                    if (Math.random() > val) {
                        delete m.paths[id];
                    }
                }
            }
            if (m.models) {
                for (const child of Object.values(m.models)) {
                    filterPaths(child);
                }
            }
        };

        filterPaths(model);
        return model;
    }
}
