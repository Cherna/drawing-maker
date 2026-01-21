import MakerJs from 'makerjs';
import { createNoise2D } from 'simplex-noise';
import { Transformer } from '../core/transformer';

// Seeded random number generator (mulberry32)
function seededRandom(seed: number) {
    return function () {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

export interface NoiseOptions {
    scale: number;
    magnitude: number;
    axis?: 'x' | 'y' | 'both';
    seed?: number;
    octaves?: number;       // For turbulence-like effect
    persistence?: number;   // Amplitude decay per octave
    lacunarity?: number;    // Frequency growth per octave
}

// Helper to check if model contains any arcs or circles
function modelHasArcs(model: MakerJs.IModel): boolean {
    let found = false;
    MakerJs.model.walk(model, {
        onPath: (wp) => {
            if (wp.pathContext.type === 'arc' || wp.pathContext.type === 'circle') {
                found = true;
            }
        }
    });
    return found;
}

export class Effects {
    static resample(model: MakerJs.IModel, distance: number) {
        return Transformer.resample(model, distance);
    }

    /**
     * Apply noise displacement to paths
     * Supports single-octave and multi-octave (turbulence) noise
     */
    static noise(model: MakerJs.IModel, options: NoiseOptions, mask?: (x: number, y: number) => number) {
        // Auto-resample if model contains curves, as displace only works on lines
        if (modelHasArcs(model)) {
            // Use a default reasonable resolution (e.g. 0.5mm) if not specified
            // Since we are modifying in place (conceptually), we update the reference
            // But resample returns a NEW model. We must return it.
            // However, the pipeline expects us to modify the passed model or return a new one.
            // Our signature is static noise(model, ...).
            // Code in pipeline: Effects.noise(model, ...)
            // It ignores return value! 
            // WAIT: pipeline.ts says: 
            // 'noise': (model, params, ...) => { Effects.noise(model, ...); }
            // Effects.noise returns model, but pipeline ignores it?
            // "if (result) currentModel = result;" in pipeline.
            // So we MUST return the new model if we resample.

            const resampled = Transformer.resample(model, 0.5);
            // Replace contents of original model with resampled one?
            // Or just return resampled?
            // If we return resampled, pipeline will use it.
            model = resampled;
        }

        const seed = options.seed ?? Date.now();
        const rng = seededRandom(seed);
        const noise2D = createNoise2D(rng);

        const octaves = options.octaves ?? 1;
        const persistence = options.persistence ?? 0.5;
        const lacunarity = options.lacunarity ?? 2;

        // For multi-octave, we need a second noise instance for the second axis
        const noise2D_y = octaves > 1 ? createNoise2D(seededRandom(seed + 1000)) : noise2D;

        Transformer.displace(model, (x, y) => {
            // Calculate noise value (single or multi-octave)
            let nx = 0, ny = 0;
            let amplitude = 1;
            let frequency = options.scale;
            let maxValue = 0;

            for (let i = 0; i < octaves; i++) {
                const sampleX = x * frequency;
                const sampleY = y * frequency;

                nx += noise2D(sampleX, sampleY) * amplitude;
                ny += noise2D_y(sampleX + 100, sampleY + 100) * amplitude;

                maxValue += amplitude;
                amplitude *= persistence;
                frequency *= lacunarity;
            }

            // Normalize
            nx /= maxValue;
            ny /= maxValue;

            // Calculate mask weight (0 to 1)
            const weight = mask ? mask(x, y) : 1;

            let dx = 0;
            let dy = 0;

            if (options.axis === 'x' || options.axis === 'both' || !options.axis) {
                dx = nx * options.magnitude * weight;
            }
            if (options.axis === 'y' || options.axis === 'both' || !options.axis) {
                dy = ny * options.magnitude * weight;
            }

            return { x: x + dx, y: y + dy };
        });

        return model;
    }

    /**
     * Probabilistically trim paths based on mask value
     */
    static trim(model: MakerJs.IModel, threshold: number, mask: (x: number, y: number) => number, seed?: number) {
        const rng = seededRandom(seed ?? Date.now());

        // Threshold acts as a density bias.
        // Default 0.5 = Unbiased (prob = mask value)
        // 1.0 = Keep all (prob = mask + 0.5)
        // 0.0 = Delete all (prob = mask - 0.5)
        const densityBias = 0.5 - threshold;

        const filterPaths = (m: MakerJs.IModel) => {
            if (m.paths) {
                for (const [id, path] of Object.entries(m.paths)) {
                    const extents = MakerJs.measure.pathExtents(path);
                    const mid = [
                        (extents.low[0] + extents.high[0]) / 2,
                        (extents.low[1] + extents.high[1]) / 2
                    ];
                    // Mask value 0..1 (0=black=delete, 1=white=keep)
                    const val = mask(mid[0], mid[1]);

                    const pKeep = val + (threshold - 0.5);

                    if (rng() > pKeep) {
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

    /**
     * Scale the model uniformly or non-uniformly
     */
    static scale(model: MakerJs.IModel, scaleX: number, scaleY?: number, origin?: [number, number]) {
        const sy = scaleY ?? scaleX;
        const ox = origin?.[0] ?? 0;
        const oy = origin?.[1] ?? 0;

        // Optimized scale has been removed due to offset issues.
        // Always usage displace (with auto-resample for arcs).

        // Non-uniform scale: MakerJs doesn't support this well for Arcs (Ellipses).
        // So we fallback to displace, but we MUST resample arcs first.
        if (modelHasArcs(model)) {
            model = Transformer.resample(model, 0.5);
        }

        Transformer.displace(model, (x, y) => ({
            x: (x - ox) * scaleX + ox,
            y: (y - oy) * sy + oy
        }));

        return model;
    }

    /**
     * Simplify paths by removing points that don't contribute much to the shape
     * Uses Douglas-Peucker-like approach per segment
     */
    static simplify(model: MakerJs.IModel, tolerance: number) {
        // For now, just filter out very short segments
        const filterShort = (m: MakerJs.IModel) => {
            if (m.paths) {
                for (const [id, path] of Object.entries(m.paths)) {
                    if (path.type === 'line') {
                        const line = path as MakerJs.IPathLine;
                        const len = Math.hypot(
                            line.end[0] - line.origin[0],
                            line.end[1] - line.origin[1]
                        );
                        if (len < tolerance) {
                            delete m.paths[id];
                        }
                    }
                }
            }
            if (m.models) {
                for (const child of Object.values(m.models)) {
                    filterShort(child);
                }
            }
        };

        filterShort(model);
        return model;
    }

    /**
     * Apply a warp effect using a custom displacement function
     */
    static warp(
        model: MakerJs.IModel,
        warpFn: (x: number, y: number) => { dx: number, dy: number },
        mask?: (x: number, y: number) => number
    ) {
        // Auto-resample arcs/circles
        if (modelHasArcs(model)) {
            model = Transformer.resample(model, 0.5);
        }

        Transformer.displace(model, (x, y) => {
            const weight = mask ? mask(x, y) : 1;
            const { dx, dy } = warpFn(x, y);
            return {
                x: x + dx * weight,
                y: y + dy * weight
            };
        });
        return model;
    }
}
