import MakerJs from 'makerjs';
import { createNoise2D } from 'simplex-noise';
import { Transformer } from '../core/transformer';

// Seeded random number generator (mulberry32)
// Seeded random number generator (mulberry32)
function seededRandom(seed: number) {
    let state = Number(seed);
    return function () {
        let t = state += 0x6D2B79F5;
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
            // Default reasonable resolution (0.5mm)
            // We must return the newly resampled reference so it updates in the pipeline
            model = Transformer.resample(model, 0.5);
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
                // Sort keys for determinism
                const keys = Object.keys(m.paths).sort();
                for (const id of keys) {
                    const path = m.paths[id];
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
                const keys = Object.keys(m.models).sort();
                for (const key of keys) {
                    filterPaths(m.models[key]);
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
                const keys = Object.keys(m.paths).sort();
                for (const id of keys) {
                    const path = m.paths[id];
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
                const keys = Object.keys(m.models).sort();
                for (const key of keys) {
                    filterShort(m.models[key]);
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

    /**
     * Clip the model to a bounding box in absolute coordinates.
     */
    static clip(model: MakerJs.IModel, bounds: { x: number, y: number, width: number, height: number }, margin?: number | [number, number, number, number]) {
        // Auto-resample arcs first so we can use line clipping
        if (modelHasArcs(model)) {
            model = Transformer.resample(model, 0.5);
        }

        let minX = bounds.x;
        let maxX = bounds.x + bounds.width;
        let minY = bounds.y;
        let maxY = bounds.y + bounds.height;

        const inputExtents = MakerJs.measure.modelExtents(model);

        // Apply margins if provided - these reduce the clip area
        if (margin) {
            if (Array.isArray(margin)) {
                const [top, right, bottom, left] = margin;
                // Reduce clipping area by margins (inward from edges)
                maxY -= top;      // Top margin reduces max Y
                maxX -= right;    // Right margin reduces max X  
                minY += bottom;   // Bottom margin increases min Y
                minX += left;     // Left margin increases min X
            } else {
                const m = margin as number;
                minX += m;
                minY += m;
                maxX -= m;
                maxY -= m;
            }
        }

        const clipLine = (p1: MakerJs.IPoint, p2: MakerJs.IPoint): [MakerJs.IPoint, MakerJs.IPoint] | null => {
            let t0 = 0, t1 = 1;
            const dx = p2[0] - p1[0];
            const dy = p2[1] - p1[1];
            const p = [-dx, dx, -dy, dy];
            const q = [p1[0] - minX, maxX - p1[0], p1[1] - minY, maxY - p1[1]];

            for (let i = 0; i < 4; i++) {
                if (p[i] === 0) {
                    if (q[i] < 0) return null; // Parallel and outside
                } else {
                    const t = q[i] / p[i];
                    if (p[i] < 0) {
                        if (t > t1) return null;
                        if (t > t0) t0 = t;
                    } else {
                        if (t < t0) return null;
                        if (t < t1) t1 = t;
                    }
                }
            }

            if (t0 > t1) return null;

            return [
                [p1[0] + t0 * dx, p1[1] + t0 * dy],
                [p1[0] + t1 * dx, p1[1] + t1 * dy]
            ];
        };

        // Preserve layer structure by grouping clipped paths per layer
        const result: MakerJs.IModel = { models: {} };
        const pathCounters: Record<string, number> = {};

        // Walk all paths to get absolute coordinates (accounts for model.origin offsets)
        let routesSeen = new Set<string>();
        MakerJs.model.walk(model, {
            onPath: (wp) => {
                const routeStr = wp.route.join('/');
                if (!routesSeen.has(routeStr)) {
                    routesSeen.add(routeStr);
                }
                if (wp.pathContext.type === 'line') {
                    const line = wp.pathContext as MakerJs.IPathLine;
                    // Get absolute coordinates by adding the offset from the walk
                    const absOrigin: MakerJs.IPoint = [line.origin[0] + wp.offset[0], line.origin[1] + wp.offset[1]];
                    const absEnd: MakerJs.IPoint = [line.end[0] + wp.offset[0], line.end[1] + wp.offset[1]];

                    const clipped = clipLine(absOrigin, absEnd);
                    if (clipped) {
                        // Get the layer ID from the route (route[0] is 'models', route[1] is the layer ID)
                        const layerId = wp.route.length > 1 ? wp.route[1] : 'default';

                        // Ensure sub-model exists for this layer
                        if (!result.models![layerId]) {
                            result.models![layerId] = { paths: {} };
                            pathCounters[layerId] = 0;
                        }

                        result.models![layerId].paths![`line_${pathCounters[layerId]++}`] = {
                            type: 'line',
                            origin: clipped[0],
                            end: clipped[1]
                        } as MakerJs.IPathLine;
                    }
                }
            }
        });

        const totalPaths = Object.values(pathCounters).reduce((a, b) => a + b, 0);
        return result;
    }

    /**
     * Glitch effect - displaces points toward weighted average of nearby points.
     * Creates an interesting clustered/web-like distortion effect.
     * 
     * @param model The model to apply glitch to
     * @param iterations Number of glitch passes
     * @param factor Blend factor 0-1 (intensity of effect)
     */
    static glitch1(model: MakerJs.IModel, iterations: number = 1, factor: number = 0.5): MakerJs.IModel {
        // Auto-resample arcs first so we work with line segments
        if (modelHasArcs(model)) {
            model = Transformer.resample(model, 0.5);
        }

        // Collect all points from the model
        const collectPoints = (m: MakerJs.IModel, offset: [number, number] = [0, 0]): MakerJs.IPoint[] => {
            const pts: MakerJs.IPoint[] = [];
            const actualOffset: [number, number] = [
                offset[0] + (m.origin?.[0] || 0),
                offset[1] + (m.origin?.[1] || 0)
            ];

            if (m.paths) {
                for (const key in m.paths) {
                    const path = m.paths[key];
                    if (path.type === 'line') {
                        const line = path as MakerJs.IPathLine;
                        pts.push([line.origin[0] + actualOffset[0], line.origin[1] + actualOffset[1]]);
                        pts.push([line.end[0] + actualOffset[0], line.end[1] + actualOffset[1]]);
                    }
                }
            }
            if (m.models) {
                for (const key in m.models) {
                    pts.push(...collectPoints(m.models[key], actualOffset));
                }
            }
            return pts;
        };

        // For each iteration, compute a spatial average map and apply displacement
        for (let iter = 0; iter < iterations; iter++) {
            const allPoints = collectPoints(model);

            // Build a grid-based spatial index for fast neighbor lookups
            const gridSize = 5; // mm per grid cell
            const grid = new Map<string, MakerJs.IPoint[]>();

            for (const pt of allPoints) {
                const key = `${Math.floor(pt[0] / gridSize)},${Math.floor(pt[1] / gridSize)}`;
                if (!grid.has(key)) grid.set(key, []);
                grid.get(key)!.push(pt);
            }

            // Get neighbors for a point (within radius)
            const getNeighbors = (x: number, y: number, radius: number): MakerJs.IPoint[] => {
                const neighbors: MakerJs.IPoint[] = [];
                const cellRadius = Math.ceil(radius / gridSize);
                const cx = Math.floor(x / gridSize);
                const cy = Math.floor(y / gridSize);

                for (let dx = -cellRadius; dx <= cellRadius; dx++) {
                    for (let dy = -cellRadius; dy <= cellRadius; dy++) {
                        const key = `${cx + dx},${cy + dy}`;
                        const pts = grid.get(key);
                        if (pts) {
                            for (const pt of pts) {
                                const dist = Math.hypot(pt[0] - x, pt[1] - y);
                                if (dist > 0.001 && dist <= radius) { // Exclude self
                                    neighbors.push(pt);
                                }
                            }
                        }
                    }
                }
                return neighbors;
            };

            // Apply smoothing displacement
            const searchRadius = 3; // mm - look for points within this radius

            Transformer.displace(model, (x, y) => {
                const neighbors = getNeighbors(x, y, searchRadius);

                if (neighbors.length < 2) {
                    return { x, y }; // Not enough neighbors to smooth
                }

                // Compute weighted average of neighbors (closer = more weight)
                let sumX = 0, sumY = 0, sumW = 0;
                for (const n of neighbors) {
                    const dist = Math.hypot(n[0] - x, n[1] - y);
                    const w = 1 / (dist + 0.1); // Inverse distance weight
                    sumX += n[0] * w;
                    sumY += n[1] * w;
                    sumW += w;
                }

                const avgX = sumX / sumW;
                const avgY = sumY / sumW;

                // Move toward average
                return {
                    x: x + (avgX - x) * factor,
                    y: y + (avgY - y) * factor
                };
            });
        }

        return model;
    }

    /**
     * Glitch effect 2 - chaotic displacement based on proximity.
     * Uses Transformer.displace with pre-computed displacement map.
     */
    static glitch2(model: MakerJs.IModel, iterations: number = 1, factor: number = 0.5): MakerJs.IModel {
        // Ensure we're working with line segments
        if (modelHasArcs(model)) {
            model = Transformer.resample(model, 0.5);
        }

        // Resample to get more vertices
        model = Transformer.resample(model, 1);

        const tolerance = 1; // 1mm tolerance for matching points

        for (let iter = 0; iter < iterations; iter++) {
            // Collect all line endpoints and their neighbors
            const pointData = new Map<string, { x: number; y: number; neighbors: { x: number; y: number }[] }>();

            const getKey = (x: number, y: number) =>
                `${Math.round(x / tolerance)},${Math.round(y / tolerance)}`;

            // Walk model and collect endpoints
            const collectEndpoints = (m: MakerJs.IModel, ox: number = 0, oy: number = 0) => {
                const offX = ox + (m.origin?.[0] || 0);
                const offY = oy + (m.origin?.[1] || 0);

                if (m.paths) {
                    for (const pathKey in m.paths) {
                        const path = m.paths[pathKey];
                        if (path.type === 'line') {
                            const line = path as MakerJs.IPathLine;
                            const x1 = line.origin[0] + offX;
                            const y1 = line.origin[1] + offY;
                            const x2 = line.end[0] + offX;
                            const y2 = line.end[1] + offY;

                            // Origin point's neighbor is end point
                            const key1 = getKey(x1, y1);
                            if (!pointData.has(key1)) {
                                pointData.set(key1, { x: x1, y: y1, neighbors: [] });
                            }
                            pointData.get(key1)!.neighbors.push({ x: x2, y: y2 });

                            // End point's neighbor is origin point
                            const key2 = getKey(x2, y2);
                            if (!pointData.has(key2)) {
                                pointData.set(key2, { x: x2, y: y2, neighbors: [] });
                            }
                            pointData.get(key2)!.neighbors.push({ x: x1, y: y1 });
                        }
                    }
                }
                if (m.models) {
                    for (const modelKey in m.models) {
                        collectEndpoints(m.models[modelKey], offX, offY);
                    }
                }
            };
            collectEndpoints(model);

            // Pre-compute displacements
            const displacements = new Map<string, { dx: number; dy: number }>();

            for (const [key, data] of pointData) {
                if (data.neighbors.length < 2) {
                    // Edge point - don't move
                    displacements.set(key, { dx: 0, dy: 0 });
                    continue;
                }

                // Average neighbor position
                const avgX = data.neighbors.reduce((s, n) => s + n.x, 0) / data.neighbors.length;
                const avgY = data.neighbors.reduce((s, n) => s + n.y, 0) / data.neighbors.length;

                displacements.set(key, {
                    dx: (avgX - data.x) * factor,
                    dy: (avgY - data.y) * factor
                });
            }

            // Apply using Transformer.displace
            Transformer.displace(model, (x, y) => {
                const key = getKey(x, y);
                const d = displacements.get(key);
                if (d) {
                    return { x: x + d.dx, y: y + d.dy };
                }
                return { x, y };
            });
        }

        return model;
    }
}


