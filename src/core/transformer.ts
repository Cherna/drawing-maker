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

            // Start point
            let prev = MakerJs.point.fromPathEnds(path)[0];

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
                    const endAngle = MakerJs.angle.ofArcEnd(arc);
                    const totalAngle = endAngle - arc.startAngle;
                    const currentAngle = arc.startAngle + totalAngle * t;
                    const polar = MakerJs.point.fromPolar(currentAngle, arc.radius);
                    curr = MakerJs.point.add(polar, arc.origin!);
                } else {
                    // Fallback for paths we don't interpolate yet
                    curr = MakerJs.point.fromPathEnds(path)[1]; // just end point
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
