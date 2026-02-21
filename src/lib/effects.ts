import MakerJs from 'makerjs';

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
     * Simplify paths using the Ramer-Douglas-Peucker algorithm.
     * Chains connected line segments into polylines and removes intermediate
     * points that deviate less than `tolerance` mm from the straight line
     * between their neighbours.  Non-line paths and isolated segments are kept.
     */
    static simplify(model: MakerJs.IModel, tolerance: number) {
        // ── RDP core ───────────────────────────────────────────────────
        const rdp = (pts: [number, number][], eps: number): [number, number][] => {
            if (pts.length <= 2) return pts;
            // Find the point with the maximum perpendicular distance from the
            // line between the first and last point.
            const [x1, y1] = pts[0];
            const [x2, y2] = pts[pts.length - 1];
            const dx = x2 - x1, dy = y2 - y1;
            const len = Math.hypot(dx, dy);
            let maxDist = 0, maxIdx = 1;
            for (let i = 1; i < pts.length - 1; i++) {
                const dist = len < 1e-10
                    ? Math.hypot(pts[i][0] - x1, pts[i][1] - y1)
                    : Math.abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / len;
                if (dist > maxDist) { maxDist = dist; maxIdx = i; }
            }
            if (maxDist <= eps) return [pts[0], pts[pts.length - 1]];
            return [
                ...rdp(pts.slice(0, maxIdx + 1), eps),
                ...rdp(pts.slice(maxIdx), eps).slice(1)
            ];
        };

        // ── Simplify one flat model (paths only, no sub-models) ────────
        const simplifyFlat = (m: MakerJs.IModel) => {
            if (!m.paths) return;

            // Build adjacency: endpoint → [pathKey, …]
            const ptKey = (x: number, y: number) =>
                `${Math.round(x * 1e4)},${Math.round(y * 1e4)}`;

            type Endpoint = { key: string; other: string; pathId: string };
            const adj = new Map<string, Endpoint[]>();
            const lines = new Map<string, { origin: [number, number]; end: [number, number] }>();

            for (const id of Object.keys(m.paths)) {
                const p = m.paths[id];
                if (p.type !== 'line') continue;
                const ln = p as MakerJs.IPathLine;
                const o: [number, number] = [ln.origin[0], ln.origin[1]];
                const e: [number, number] = [ln.end[0], ln.end[1]];
                lines.set(id, { origin: o, end: e });
                const ok = ptKey(o[0], o[1]), ek = ptKey(e[0], e[1]);
                if (!adj.has(ok)) adj.set(ok, []);
                if (!adj.has(ek)) adj.set(ek, []);
                adj.get(ok)!.push({ key: ok, other: ek, pathId: id });
                adj.get(ek)!.push({ key: ek, other: ok, pathId: id });
            }

            // Walk chains: start from degree-1 endpoints (or any unvisited for loops)
            const visited = new Set<string>();
            const chains: { ids: string[]; pts: [number, number][] }[] = [];

            const walkChain = (startId: string, startEnd: 'origin' | 'end') => {
                const ids: string[] = [];
                const pts: [number, number][] = [];
                let curId = startId;
                let fromEnd = startEnd === 'end'; // we leave from the 'end' side

                while (true) {
                    if (visited.has(curId)) break;
                    visited.add(curId);
                    ids.push(curId);
                    const seg = lines.get(curId)!;
                    if (pts.length === 0) {
                        pts.push(fromEnd ? seg.end : seg.origin);
                    }
                    const nextPt = fromEnd ? seg.origin : seg.end;
                    pts.push(nextPt);

                    const nk = ptKey(nextPt[0], nextPt[1]);
                    const neighbors = (adj.get(nk) || []).filter(e => !visited.has(e.pathId));
                    if (neighbors.length !== 1) break; // junction or dead end
                    const next = neighbors[0];
                    fromEnd = (next.other === nk); // are we entering via the 'other' endpoint?
                    curId = next.pathId;
                }
                if (ids.length >= 2) chains.push({ ids, pts });
            };

            // Find degree-1 start points
            for (const [id, seg] of lines) {
                if (visited.has(id)) continue;
                const ok = ptKey(seg.origin[0], seg.origin[1]);
                const ek = ptKey(seg.end[0], seg.end[1]);
                const degO = (adj.get(ok) || []).length;
                const degE = (adj.get(ek) || []).length;
                if (degO === 1) { walkChain(id, 'origin'); }
                else if (degE === 1) { walkChain(id, 'end'); }
                else if (!visited.has(id)) { walkChain(id, 'origin'); } // loop
            }

            // Apply RDP and rewrite paths
            for (const chain of chains) {
                const simplified = rdp(chain.pts, tolerance);
                // Remove original segments
                for (const id of chain.ids) delete m.paths[id];
                // Add simplified segments
                for (let i = 0; i < simplified.length - 1; i++) {
                    const key = `s_${chain.ids[0]}_${i}`;
                    m.paths[key] = {
                        type: 'line',
                        origin: simplified[i],
                        end: simplified[i + 1]
                    } as MakerJs.IPathLine;
                }
            }
        };

        // ── Walk full model recursively ────────────────────────────────
        const walk = (m: MakerJs.IModel) => {
            simplifyFlat(m);
            if (m.models) {
                for (const key of Object.keys(m.models)) walk(m.models[key]);
            }
        };

        walk(model);
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


