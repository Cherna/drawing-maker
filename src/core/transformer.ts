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

            for (let i = 1; i <= divisions; i++) {
                let curr: MakerJs.IPoint;
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
                    // Fallback for paths we don't interpolate yet (like Bezier)
                    // We should try to use MakerJs.path.interpolate or similar if available,
                    // but for now, let's just use the end point to avoid crashing.
                    // Ideally, we should flatten the model before this step if possible.
                    console.warn(`Transformer: Unhandled path type '${path.type}'`);
                    const ends = MakerJs.point.fromPathEnds(path);
                    curr = ends ? ends[1] : [0, 0];
                }

                segmentModel.paths![`seg_${i}`] = new MakerJs.paths.Line(prev, curr);
                prev = curr;
            }

            return segmentModel;
        };

        const traverse = (m: MakerJs.IModel, target: MakerJs.IModel) => {
            if (m.paths) {
                target.models = target.models || {};
                for (const [id, p] of Object.entries(m.paths)) {
                    target.models[`resample_${id}`] = processPath(p);
                }
            }
            if (m.models) {
                target.models = target.models || {};
                for (const [id, child] of Object.entries(m.models)) {
                    target.models[id] = {};
                    traverse(child, target.models[id]!);
                }
            }
        };

        // Pre-process: Simplify/Flatten the model to convert Bezier curves to Arcs/Lines if possible?
        // Actually, better to just rely on processPath handling Beziers if we add support.
        // But MakerJs.path.distort can turn Bezier to Arcs?

        // Let's modify the traverse loop to handle "Curve" models (Bezier) specifically if they don't have paths?
        // The debug output said Curve_1 had 'type', 'seed', 'accuracy', 'paths'.
        // Wait, if it has 'paths', traverse should catch it.
        // But debug said paths: undefined/empty?

        traverse(model, result);
        return result;
    }

    /**
     * Applies a function to every point in the model.
     */
    static displace(model: MakerJs.IModel, displaceFn: (x: number, y: number) => { x: number, y: number }): void {
        MakerJs.model.walk(model, {
            onPath: (walkPath) => {
                const path = walkPath.pathContext;
                if (path.type === 'line') {
                    const line = path as MakerJs.IPathLine;
                    const newOrigin = displaceFn(line.origin[0], line.origin[1]);
                    const newEnd = displaceFn(line.end[0], line.end[1]);

                    line.origin = [newOrigin.x, newOrigin.y];
                    line.end = [newEnd.x, newEnd.y];
                }
            }
        });
    }
}
