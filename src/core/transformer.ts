import MakerJs from 'makerjs';

export class Transformer {
    /**
     * Resamples a generic model's paths into small linear segments.
     * This turns a long Line (2 points) into a Polyline (N points).
     * Necessary for applying non-linear effects (noise, warp) to straight lines.
     */
    static resample(model: MakerJs.IModel, resolution: number): MakerJs.IModel {
        const result: MakerJs.IModel = { models: {} };
        const pointCache = new Map<MakerJs.IPoint, MakerJs.IPoint>();
        // coordCache removed - it causes issues with nested models sharing local coordinates

        const getCachedPoint = (p: MakerJs.IPoint): MakerJs.IPoint | null => {
            if (pointCache.has(p)) return pointCache.get(p)!;
            return null;
        };

        const cachePoint = (original: MakerJs.IPoint, created: MakerJs.IPoint) => {
            pointCache.set(original, created);
        };

        const processPath = (path: MakerJs.IPath): MakerJs.IModel => {
            const len = MakerJs.measure.pathLength(path);
            const divisions = Math.max(1, Math.ceil(len / resolution));
            const segmentModel: MakerJs.IModel = { paths: {} };

            // Resolve start point
            let prev: MakerJs.IPoint;
            let firstPoint: MakerJs.IPoint;

            // Get original ends to check cache
            // Note: fromPathEnds returns [origin, end] for line/arc
            const originalEnds = MakerJs.point.fromPathEnds(path);
            let cachedStart: MakerJs.IPoint | null = null;
            let cachedEnd: MakerJs.IPoint | null = null;

            if (originalEnds) {
                cachedStart = getCachedPoint(originalEnds[0]);
                cachedEnd = getCachedPoint(originalEnds[1]);
            }

            if (path.type === 'circle' || path.type === 'arc') {
                const arc = path as MakerJs.IPathArc;
                // Circles might not have startAngle set, default to 0
                const startAngle = arc.startAngle !== undefined ? arc.startAngle : 0;
                // FIX: Convert to radians for fromPolar
                const startRad = startAngle * Math.PI / 180;
                const polar = MakerJs.point.fromPolar(startRad, arc.radius);

                // For arcs, origin is center. pathEnds keys off calculated points (start/end on arc).
                if (cachedStart) {
                    prev = cachedStart;
                } else {
                    prev = MakerJs.point.add(polar, arc.origin!);
                    if (originalEnds) cachePoint(originalEnds[0], prev);
                }
            } else {
                // Line
                if (cachedStart) {
                    prev = cachedStart;
                } else {
                    prev = originalEnds ? [originalEnds[0][0], originalEnds[0][1]] : [0, 0];
                    if (originalEnds) cachePoint(originalEnds[0], prev);
                }
            }
            firstPoint = prev;

            // Check if loop is closed (Circle or full 360 Arc)
            let isClosed = false;
            if (path.type === 'circle') {
                isClosed = true;
            } else if (path.type === 'arc') {
                const arc = path as MakerJs.IPathArc;
                const startAngle = arc.startAngle || 0;
                const endAngle = arc.endAngle || 360;
                if (Math.abs((endAngle - startAngle) - 360) < 0.001) {
                    isClosed = true;
                }
            }

            for (let i = 1; i <= divisions; i++) {
                let curr: MakerJs.IPoint;

                if (i === divisions) {
                    // Last point
                    if (isClosed) {
                        curr = firstPoint;
                    } else {
                        // Use cached end if available
                        if (cachedEnd) {
                            curr = cachedEnd;
                        } else {
                            // Calculate end
                            if (path.type === 'line') {
                                const line = path as MakerJs.IPathLine;
                                curr = [line.end[0], line.end[1]];
                            } else if (path.type === 'arc' || path.type === 'circle') {
                                // Arcs end calculation
                                const arc = path as MakerJs.IPathArc;
                                const endAngle = arc.endAngle || 360;
                                const endRad = endAngle * Math.PI / 180;
                                const polar = MakerJs.point.fromPolar(endRad, arc.radius);
                                curr = MakerJs.point.add(polar, arc.origin!);
                            } else {
                                const ends = MakerJs.point.fromPathEnds(path);
                                curr = ends ? ends[1] : [0, 0];
                            }
                            if (originalEnds) cachePoint(originalEnds[1], curr);
                        }
                    }
                } else {
                    // Intermediate points
                    const t = i / divisions;
                    if (path.type === 'line') {
                        const line = path as MakerJs.IPathLine;
                        curr = [
                            line.origin[0] + (line.end[0] - line.origin[0]) * t,
                            line.origin[1] + (line.end[1] - line.origin[1]) * t
                        ];
                    } else if (path.type === 'arc' || path.type === 'circle') {
                        const arc = path as MakerJs.IPathArc;
                        const startAngle = arc.startAngle !== undefined ? arc.startAngle : 0;
                        const endAngle = arc.endAngle !== undefined ? arc.endAngle : 360;
                        const totalAngle = endAngle - startAngle;
                        const currentAngle = startAngle + totalAngle * t;
                        const currRad = currentAngle * Math.PI / 180;
                        const polar = MakerJs.point.fromPolar(currRad, arc.radius);
                        curr = MakerJs.point.add(polar, arc.origin!);
                    } else {
                        const ends = MakerJs.point.fromPathEnds(path);
                        curr = ends ? ends[1] : [0, 0];
                    }
                }

                segmentModel.paths![`seg_${i}`] = new MakerJs.paths.Line(prev, curr);
                prev = curr;
            }

            return segmentModel;
        };

        const traverse = (m: MakerJs.IModel, target: MakerJs.IModel) => {
            // Process models FIRST before paths to maintain hierarchy
            if (m.models) {
                target.models = target.models || {};
                const keys = Object.keys(m.models).sort();
                for (const id of keys) {
                    const sourceModel = m.models[id];
                    target.models[id] = {};

                    // Preserve properties
                    if (sourceModel.origin) target.models[id].origin = [sourceModel.origin[0], sourceModel.origin[1]];
                    if (sourceModel.type) target.models[id].type = sourceModel.type;
                    if (sourceModel.layer) target.models[id].layer = sourceModel.layer;
                    if (sourceModel.units) target.models[id].units = sourceModel.units;

                    traverse(sourceModel, target.models[id]!);
                }
            }

            // Process paths at this level only
            if (m.paths) {
                target.paths = target.paths || {};
                const keys = Object.keys(m.paths).sort();
                for (const id of keys) {
                    const segments = processPath(m.paths[id]);
                    if (segments.paths) {
                        for (const segId in segments.paths) {
                            target.paths[`${id}_${segId}`] = segments.paths[segId];
                        }
                    }
                }
            }
        };

        traverse(model, result);
        return result;
    }

    /**
     * Applies a function to every point in the model.
     * Preserves object identity for shared points (e.g. polyline chains).
     */
    static displace(model: MakerJs.IModel, displaceFn: (x: number, y: number) => { x: number, y: number }): void {
        // Cache displaced points by world-coord key to preserve topology and merge seams
        const pointCache = new Map<MakerJs.IPoint, MakerJs.IPoint>();
        const worldKeyCache = new Map<string, MakerJs.IPoint>();

        /**
         * Displaces point `p` (in local space) using world coordinates for noise sampling.
         * offsetX/offsetY are the accumulated parent origins.
         * displaceFn is called with world coords; only the delta is applied to local coords.
         *
         * Cache keyed by (offsetX, offsetY, localX, localY) so two points at the same world
         * position but in different local frames never share a cached result.
         */
        const getDisplacedPoint = (p: MakerJs.IPoint, offsetX: number, offsetY: number): MakerJs.IPoint => {
            // Fast path: same object reference (shared point — always safe to reuse)
            if (pointCache.has(p)) {
                return pointCache.get(p)!;
            }

            // Compute world-space position for noise sampling
            const worldX = p[0] + offsetX;
            const worldY = p[1] + offsetY;

            // Cache key includes the offset context so cross-model collisions are impossible
            const cacheKey = `${offsetX.toFixed(4)},${offsetY.toFixed(4)},${p[0].toFixed(6)},${p[1].toFixed(6)}`;
            if (worldKeyCache.has(cacheKey)) {
                const existing = worldKeyCache.get(cacheKey)!;
                pointCache.set(p, existing);
                return existing;
            }

            // Call displaceFn with world coords — returns a new absolute world position
            const newWorldPos = displaceFn(worldX, worldY);

            // Apply only the delta to the local coordinate
            const dx = newWorldPos.x - worldX;
            const dy = newWorldPos.y - worldY;
            const newPoint: MakerJs.IPoint = [p[0] + dx, p[1] + dy];

            pointCache.set(p, newPoint);
            worldKeyCache.set(cacheKey, newPoint);

            return newPoint;
        };

        // Use a different approach: walk needs offset info, so use a manual walk instead
        const walkWithOffset = (m: MakerJs.IModel, offsetX: number, offsetY: number) => {
            const ox = offsetX + (m.origin?.[0] ?? 0);
            const oy = offsetY + (m.origin?.[1] ?? 0);

            if (m.paths) {
                for (const path of Object.values(m.paths)) {
                    if (path.type === 'line') {
                        const line = path as MakerJs.IPathLine;
                        line.origin = getDisplacedPoint(line.origin, ox, oy);
                        line.end = getDisplacedPoint(line.end, ox, oy);
                    }
                }
            }
            if (m.models) {
                for (const child of Object.values(m.models)) {
                    walkWithOffset(child, ox, oy);
                }
            }
        };

        walkWithOffset(model, 0, 0);
    }
}
