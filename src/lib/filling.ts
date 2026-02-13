import MakerJs from 'makerjs';

export interface FillParams {
    angle: number;       // Angle in degrees
    spacing: number;     // Spacing between lines in mm
    offset?: number;     // Offset of the hatching pattern
    tolerance?: number;  // Tolerance for intersection sorting
}

export class Filling {


    /**
     * Fills a closed loop with hatch lines.
     */
    static fillLoop(loop: MakerJs.IModel, params: FillParams): MakerJs.IModel {
        const result: MakerJs.IModel = { paths: {} };

        const angle = params.angle ?? 0;
        const spacing = Math.max(0.1, params.spacing ?? 0.5);
        const offset = params.offset ?? 0;
        const tolerance = params.tolerance ?? 0.001;

        // 1. Measure bounds of the loop
        const extents = MakerJs.measure.modelExtents(loop);
        if (!extents) return result;

        // 2. Generate scanlines

        const angleRad = angle * Math.PI / 180;
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);

        // We define the scanline direction D = (cos, sin)
        // And perpendicular P = (-sin, cos)

        // We project the model extents onto the Perpendicular vector to find the range of lines needed.
        const corners = [
            [extents.low[0], extents.low[1]],
            [extents.high[0], extents.low[1]],
            [extents.high[0], extents.high[1]],
            [extents.low[0], extents.high[1]]
        ];

        // Project onto P
        let minP = Number.MAX_VALUE;
        let maxP = -Number.MAX_VALUE;

        corners.forEach(p => {
            const val = p[0] * -sin + p[1] * cos;
            if (val < minP) minP = val;
            if (val > maxP) maxP = val;
        });

        // Align minP to spacing grid + offset
        const startIdx = Math.ceil((minP - offset) / spacing);
        const endIdx = Math.floor((maxP - offset) / spacing);

        // Determine line length needed (project onto D)
        let minD = Number.MAX_VALUE;
        let maxD = -Number.MAX_VALUE;
        corners.forEach(p => {
            const val = p[0] * cos + p[1] * sin;
            if (val < minD) minD = val;
            if (val > maxD) maxD = val;
        });

        // Add some margin to line length
        const extra = 10;

        for (let i = startIdx; i <= endIdx; i++) {
            const dVal = i * spacing + offset;

            // Construct line at distance dVal along P
            // Origin on P axis is dVal * P
            // Point on line: O + t * D
            // Center of line (approx)
            const cx = dVal * -sin;
            const cy = dVal * cos;

            // Start and End of scanline
            const x1 = cx + (minD - extra) * cos;
            const y1 = cy + (minD - extra) * sin;
            const x2 = cx + (maxD + extra) * cos;
            const y2 = cy + (maxD + extra) * sin;

            const scanLine = new MakerJs.paths.Line([x1, y1], [x2, y2]);

            // 3. Find intersections
            const intersections: number[] = [];

            // Walk the loop to intersect with all paths
            MakerJs.model.walk(loop, {
                onPath: (walkPath: any) => {
                    const path = walkPath.pathContext;
                    if (!path) return;

                    const ints = MakerJs.path.intersection(scanLine, path);
                    if (ints && ints.intersectionPoints) {
                        ints.intersectionPoints.forEach(pt => {
                            // Project pt onto scanline to get 't'.
                            // t = (pt - p1) . D
                            // Since D is (cos, sin)
                            const tx = pt[0] - x1;
                            const ty = pt[1] - y1;
                            const t = tx * cos + ty * sin;
                            intersections.push(t);
                        });
                    }
                }
            });

            // If no intersections, skip
            if (intersections.length === 0) continue;

            // Sort
            intersections.sort((a, b) => a - b);

            // Filter unique (dedupe close points)
            const unique: number[] = [];
            if (intersections.length > 0) {
                unique.push(intersections[0]);
                for (let k = 1; k < intersections.length; k++) {
                    if (intersections[k] - intersections[k - 1] > tolerance) {
                        unique.push(intersections[k]);
                    }
                }
            }

            // Create segments for Even-Odd
            for (let k = 0; k < unique.length - 1; k += 2) {
                const tA = unique[k];
                const tB = unique[k + 1];

                const pA: MakerJs.IPoint = [x1 + tA * cos, y1 + tA * sin];
                const pB: MakerJs.IPoint = [x1 + tB * cos, y1 + tB * sin];

                result.paths![`hatch_${i}_${k}`] = new MakerJs.paths.Line(pA, pB);
            }
        }

        return result;
    }

    /**
     * Applies solid filling to a model in-place.
     * Recursively finds closed loops and adds hatching to the same sub-model,
     * ensuring that transformations (origin, rotation) are preserved.
     */
    static applyFilling(model: MakerJs.IModel, params: FillParams): void {
        console.log(`[DEBUG] applyFilling called with params:`, params);
        let traverseCount = 0;
        let totalLoopsFound = 0;
        let totalChains = 0;

        const traverse = (m: MakerJs.IModel, depth: number = 0) => {
            traverseCount++;
            const indent = '  '.repeat(depth);

            // Check for sub-models
            if (m.models) {
                console.log(`${indent}[DEBUG] Traversing ${Object.keys(m.models).length} submodels at depth ${depth}`);
                // Recurse into sub-models
                for (const key in m.models) {
                    console.log(`${indent}[DEBUG] - Processing submodel: ${key}`);
                    traverse(m.models[key], depth + 1);
                }
            }

            // Check paths in this model
            if (m.paths && Object.keys(m.paths).length > 0) {
                console.log(`${indent}[DEBUG] Found ${Object.keys(m.paths).length} paths at depth ${depth}`);

                // Detect chains in this model's paths
                const pathsClone: MakerJs.IPathMap = {};
                for (const k in m.paths) pathsClone[k] = MakerJs.cloneObject(m.paths[k]);

                const pathModel = { paths: pathsClone };

                // Use a generous tolerance for point matching to handle resample errors
                const options = { pointMatchingDistance: 0.05, containment: false };
                const chains = MakerJs.model.findChains(pathModel, options) as any[];

                if (chains && chains.length > 0) {
                    console.log(`${indent}[DEBUG] Found ${chains.length} chains in submodel.`);
                    totalChains += chains.length;

                    const loops: MakerJs.IModel[] = [];
                    chains.forEach((chain, chainIdx) => {
                        let isClosed = false;

                        // Check if chain is endless (loop)
                        if (chain.endless) {
                            isClosed = true;
                            console.log(`${indent}[DEBUG]   Chain ${chainIdx}: endless=true`);
                        } else {
                            // Check if start meets end manually
                            // Chain has 'links' array
                            if (chain.links && chain.links.length > 0) {
                                const firstLink = chain.links[0];
                                const lastLink = chain.links[chain.links.length - 1];

                                // link.endPoints[0] is start, [1] is end
                                const start = firstLink.endPoints[0];
                                const end = lastLink.endPoints[1];

                                if (MakerJs.measure.isPointEqual(start, end, 0.001)) {
                                    isClosed = true;
                                    console.log(`${indent}[DEBUG]   Chain ${chainIdx}: manually closed (${chain.links.length} links)`);
                                } else {
                                    console.log(`${indent}[DEBUG]   Chain ${chainIdx}: NOT closed (start: [${start[0].toFixed(2)}, ${start[1].toFixed(2)}], end: [${end[0].toFixed(2)}, ${end[1].toFixed(2)}])`);
                                }
                            }
                        }

                        if (isClosed && chain.links) {
                            // Convert chain to IModel
                            const loopModel: MakerJs.IModel = { paths: {} };
                            chain.links.forEach((link: any, i: number) => {
                                // link.walkedPath.pathContext is the path
                                if (link.walkedPath && link.walkedPath.pathContext) {
                                    loopModel.paths![`p_${i}`] = MakerJs.cloneObject(link.walkedPath.pathContext);
                                }
                            });
                            loops.push(loopModel);
                            totalLoopsFound++;
                        } else if (isClosed && !chain.links && chain.paths) {
                            loops.push(chain);
                            totalLoopsFound++;
                        }
                    });

                    console.log(`${indent}[DEBUG] Detected ${loops.length} closed loops at this level`);

                    // Fill detected loops and add to the current model 'm'
                    loops.forEach((loop, i) => {
                        const hatch = Filling.fillLoop(loop, params);
                        if (hatch && Object.keys(hatch.paths || {}).length > 0) {
                            console.log(`${indent}[DEBUG]   Loop ${i}: Generated ${Object.keys(hatch.paths || {}).length} hatch lines`);
                            if (!m.models) m.models = {};
                            m.models[`fill_${Date.now()}_${i}`] = hatch;
                        } else {
                            console.log(`${indent}[DEBUG]   Loop ${i}: No hatch lines generated`);
                        }
                    });
                }
            }
        };

        traverse(model);
        console.log(`[DEBUG] applyFilling complete. Traversed ${traverseCount} nodes, found ${totalChains} chains, ${totalLoopsFound} closed loops`);
    }
}
