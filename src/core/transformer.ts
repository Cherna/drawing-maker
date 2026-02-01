import MakerJs from 'makerjs';

export class Transformer {
    /**
     * Resamples a generic model's paths into small linear segments.
     * This turns a long Line (2 points) into a Polyline (N points).
     * Necessary for applying non-linear effects (noise, warp) to straight lines.
     */
    static resample(model: MakerJs.IModel, resolution: number): MakerJs.IModel {
        const result: MakerJs.IModel = { models: {} };

        const processPath = (path: MakerJs.IPath): MakerJs.IModel => {
            const len = MakerJs.measure.pathLength(path);
            const divisions = Math.max(1, Math.ceil(len / resolution));
            const segmentModel: MakerJs.IModel = { paths: {} };

            // Start point - circles need special handling
            let prev: MakerJs.IPoint;
            let firstPoint: MakerJs.IPoint; // Keep ref to first point for closure

            if (path.type === 'circle' || path.type === 'arc') {
                const arc = path as MakerJs.IPathArc;
                // Circles might not have startAngle set, default to 0
                const startAngle = arc.startAngle !== undefined ? arc.startAngle : 0;
                // FIX: Convert to radians for fromPolar
                const startRad = startAngle * Math.PI / 180;
                const polar = MakerJs.point.fromPolar(startRad, arc.radius);
                prev = MakerJs.point.add(polar, arc.origin!);
            } else {
                const ends = MakerJs.point.fromPathEnds(path);
                if (!ends) {
                    console.warn(`Transformer.resample: Cannot get path ends for path type '${path.type}'`);
                    return { paths: {} };
                }
                prev = ends[0];
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
            // Lines are generally not closed in this context (single path)

            for (let i = 1; i <= divisions; i++) {
                let curr: MakerJs.IPoint;

                // If this is the last segment and it's a closed loop, reuse the first point object
                // This ensures exact object identity for the loop closure, which fixes warp gaps
                if (i === divisions && isClosed) {
                    curr = firstPoint;
                } else {
                    const t = i / divisions;

                    if (path.type === 'line') {
                        const line = path as MakerJs.IPathLine;
                        const start = line.origin;
                        const end = line.end;
                        curr = [
                            start[0] + (end[0] - start[0]) * t,
                            start[1] + (end[1] - start[1]) * t
                        ];
                    } else if (path.type === 'arc' || path.type === 'circle') {
                        const arc = path as MakerJs.IPathArc;
                        // Circles might not have startAngle set, default to 0 (full circle)
                        const startAngle = arc.startAngle !== undefined ? arc.startAngle : 0;
                        const endAngle = arc.endAngle !== undefined ? arc.endAngle : 360;
                        const totalAngle = endAngle - startAngle;
                        const currentAngle = startAngle + totalAngle * t;
                        // MakerJs.point.fromPolar expects RADIANS, but Arcs use DEGREES
                        const currRad = currentAngle * Math.PI / 180;
                        const polar = MakerJs.point.fromPolar(currRad, arc.radius);
                        curr = MakerJs.point.add(polar, arc.origin!);
                    } else {
                        // Fallback
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
            if (m.paths) {
                target.models = target.models || {};
                const keys = Object.keys(m.paths).sort();
                for (const id of keys) {
                    target.models[`resample_${id}`] = processPath(m.paths[id]);
                }
            }
            if (m.models) {
                target.models = target.models || {};
                const keys = Object.keys(m.models).sort();
                for (const id of keys) {
                    target.models[id] = {};
                    traverse(m.models[id], target.models[id]!);
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
        // Cache displaced points to preserve topology
        // Index by object ref AND coordinates to merge identical points (e.g. seams)
        const pointCache = new Map<MakerJs.IPoint, MakerJs.IPoint>();
        const coordCache = new Map<string, MakerJs.IPoint>();

        const getDisplacedPoint = (p: MakerJs.IPoint): MakerJs.IPoint => {
            // 1. Check object cache
            if (pointCache.has(p)) {
                return pointCache.get(p)!;
            }

            // 2. Check coordinate cache (to merge seams where points are distinct objects but same loc)
            // Use high precision key
            const key = `${p[0]},${p[1]}`;
            if (coordCache.has(key)) {
                // Should we return the existing object?
                // Yes, this merges the topology.
                const existing = coordCache.get(key)!;
                pointCache.set(p, existing); // Map this point ref to the existing one too
                return existing;
            }

            // 3. Create new
            const newPos = displaceFn(p[0], p[1]);
            const newPoint: MakerJs.IPoint = [newPos.x, newPos.y];

            pointCache.set(p, newPoint);
            coordCache.set(key, newPoint);

            return newPoint;
        };

        MakerJs.model.walk(model, {
            onPath: (walkPath) => {
                const path = walkPath.pathContext;
                if (path.type === 'line') {
                    const line = path as MakerJs.IPathLine;

                    // Update ends using the cache to preserve connectivity
                    line.origin = getDisplacedPoint(line.origin);
                    line.end = getDisplacedPoint(line.end);
                }
            }
        });
    }
}
