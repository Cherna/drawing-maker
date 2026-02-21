import MakerJs from 'makerjs';
import { AppConfig } from '../types';

export type PostProcessorType = 'standard' | 'linuxcnc' | 'reprap';

export function getGCodeExtension(type: PostProcessorType): string {
    return type === 'linuxcnc' ? '.ngc' : '.gcode';
}

interface PostProcessor {
    header: string[];
    footer: string[];
    formatMove: (x: number, y: number, feedRate?: number) => string;
    formatTravel: (x: number, y: number, travelRate: number) => string;
    formatArc: (x: number, y: number, i: number, j: number, clockwise: boolean) => string;
    formatSafeZ: (z: number) => string;
    formatDwell: (ms: number) => string;
}

const POST_PROCESSORS: Record<PostProcessorType, (config: AppConfig) => PostProcessor> = {
    'standard': (config) => ({
        header: [
            'G21', // mm
            'G90', // absolute positioning
            `G0 Z${config.gcode.zSafe ?? 40} F${config.gcode.travelRate}`, // Safe clearance height
            `G0 X0 Y0`,
        ],
        footer: [
            `G0 Z${config.gcode.zSafe ?? 40} F${config.gcode.travelRate}`, // Safe clearance height
            'G0 X0 Y0',
            'M2',
        ],
        formatMove: (x, y, feedRate) => `G1 X${x.toFixed(3)} Y${y.toFixed(3)}${feedRate ? ` F${feedRate}` : ''}`,
        formatTravel: (x, y, travelRate) => `G0 X${x.toFixed(3)} Y${y.toFixed(3)} F${travelRate}`,
        formatArc: (x, y, i, j, clockwise) => `${clockwise ? 'G2' : 'G3'} X${x.toFixed(3)} Y${y.toFixed(3)} I${i.toFixed(3)} J${j.toFixed(3)}`,
        formatSafeZ: (z) => `G0 Z${z}`,
        formatDwell: (ms) => `G4 P${(ms / 1000).toFixed(3)}`,
    }),
    'linuxcnc': (config) => ({
        header: [
            '%',
            'G17 G21 G90 G64 P0.1', // XY Plane, mm, Absolute, Constant Velocity with tolerance
            `G0 Z${config.gcode.zSafe ?? 40}`, // Safe clearance height
            `G0 X0 Y0 F${config.gcode.travelRate}`,
            'M3 S1000', // Spindle On
        ],
        footer: [
            `G0 Z${config.gcode.zSafe ?? 40}`, // Safe clearance height
            `G0 X0 Y0 F${config.gcode.travelRate}`,
            'M5',
            'M30',
            '%',
        ],
        formatMove: (x, y, feedRate) => `G1 X${x.toFixed(4)} Y${y.toFixed(4)}${feedRate ? ` F${feedRate}` : ''}`,
        formatTravel: (x, y, travelRate) => `G0 X${x.toFixed(4)} Y${y.toFixed(4)} F${travelRate}`,
        formatArc: (x, y, i, j, clockwise) => `${clockwise ? 'G2' : 'G3'} X${x.toFixed(4)} Y${y.toFixed(4)} I${i.toFixed(4)} J${j.toFixed(4)}`,
        formatSafeZ: (z) => `G0 Z${z}`,
        formatDwell: (ms) => `G4 P${(ms / 1000).toFixed(3)}`,
    }),
    'reprap': (config) => ({
        header: [
            'G21',
            'G90',
            'M107',
            `G0 Z${config.gcode.zSafe ?? 40} F${config.gcode.travelRate}`, // Safe clearance height
        ],
        footer: [
            `G0 Z${config.gcode.zSafe ?? 40}`, // Safe clearance height
            `G0 X0 Y0 F${config.gcode.travelRate}`,
            'M84',
        ],
        formatMove: (x, y, feedRate) => `G1 X${x.toFixed(2)} Y${y.toFixed(2)}${feedRate ? ` F${feedRate}` : ''}`,
        formatTravel: (x, y, travelRate) => `G0 X${x.toFixed(2)} Y${y.toFixed(2)} F${travelRate}`,
        formatArc: (x, y, i, j, clockwise) => `${clockwise ? 'G2' : 'G3'} X${x.toFixed(2)} Y${y.toFixed(2)} I${i.toFixed(2)} J${j.toFixed(2)}`,
        formatSafeZ: (z) => `G0 Z${z}`,
        formatDwell: (ms) => `G4 P${ms}`,
    })
};

/**
 * Metadata for optimized chain ordering
 * Instead of mutating chains, we return this metadata
 */
interface OptimizedChain {
    chain: MakerJs.IChain;
    reverse: boolean;  // Should points be reversed during extraction
}

/**
 * Consolidate continuous paths by merging chains that connect end-to-end
 * This dramatically reduces fragmentation and travel moves
 */
// Update optimizeChainOrder to accept tolerance
function optimizeChainOrder(chains: MakerJs.IChain[], tolerance: number = 0.01): OptimizedChain[] {
    if (chains.length <= 1) return chains.map(chain => ({ chain, reverse: false }));

    // Step 1: Consolidate continuous paths
    const consolidated = consolidateContinuousPaths(chains, tolerance);

    // Step 2: Detect parallel line patterns
    const parallelGroups = detectParallelLines(consolidated);

    if (parallelGroups.length > 0) {
        return optimizeParallelGroups(parallelGroups, consolidated);
    }

    // Step 3: Fallback to improved nearest-neighbor
    return optimizeNearestNeighbor(consolidated);
}

// Update consolidateContinuousPaths signature
function consolidateContinuousPaths(chains: MakerJs.IChain[], tolerance: number): MakerJs.IChain[] {
    if (chains.length <= 1) return chains;

    const TOLERANCE = tolerance; // mm tolerance for endpoint matching

    const getEndPoint = (chain: MakerJs.IChain): [number, number] => {
        if (chain.endless) {
            return chain.links[0].walkedPath.pathContext.origin as [number, number];
        }
        const lastLink = chain.links[chain.links.length - 1];
        const endPoint = (lastLink.walkedPath.pathContext as any).end || lastLink.walkedPath.pathContext.origin;
        return endPoint as [number, number];
    };

    const getStartPoint = (chain: MakerJs.IChain): [number, number] => {
        return chain.links[0].walkedPath.pathContext.origin as [number, number];
    };

    const pointsMatch = (p1: [number, number], p2: [number, number]): boolean => {
        return Math.abs(p1[0] - p2[0]) < TOLERANCE && Math.abs(p1[1] - p2[1]) < TOLERANCE;
    };

    const consolidated: MakerJs.IChain[] = [];
    const used = new Set<number>();

    for (let i = 0; i < chains.length; i++) {
        if (used.has(i) || chains[i].endless) {
            if (!used.has(i)) consolidated.push(chains[i]);
            used.add(i);
            continue;
        }

        // Start a new consolidated chain
        let current = { ...chains[i], links: [...chains[i].links] };
        used.add(i);

        // Keep looking for chains that connect to the end
        let foundConnection = true;
        while (foundConnection) {
            foundConnection = false;
            const currentEnd = getEndPoint(current);

            for (let j = 0; j < chains.length; j++) {
                if (used.has(j) || chains[j].endless) continue;

                const nextStart = getStartPoint(chains[j]);
                const nextEnd = getEndPoint(chains[j]);

                // Check if this chain connects to our current end
                if (pointsMatch(currentEnd, nextStart)) {
                    // Append this chain's links
                    current.links.push(...chains[j].links);
                    used.add(j);
                    foundConnection = true;
                    break;
                } else if (pointsMatch(currentEnd, nextEnd)) {
                    // Append reversed chain
                    const reversed = [...chains[j].links].reverse();
                    current.links.push(...reversed);
                    used.add(j);
                    foundConnection = true;
                    break;
                }
            }
        }

        consolidated.push(current);
    }

    // console.log(`[G-Code] Consolidated ${chains.length} chains into ${consolidated.length} continuous paths (tolerance: ${tolerance}mm)`);
    return consolidated;
}

/**
 * Collect paths that were not included in any chain (e.g. single lines/hatching)
 * and wrap them in single-link chains.
 */
function collectOrphanedPaths(model: MakerJs.IModel, existingChains: MakerJs.IChain[]): MakerJs.IChain[] {
    const usedPaths = new Set<MakerJs.IPath>();
    existingChains.forEach(chain => {
        if (chain.links) {
            chain.links.forEach(link => {
                if (link.walkedPath && link.walkedPath.pathContext) {
                    usedPaths.add(link.walkedPath.pathContext);
                }
            });
        }
    });

    const orphans: MakerJs.IChain[] = [];

    MakerJs.model.walk(model, {
        onPath: (walkPath) => {
            if (!usedPaths.has(walkPath.pathContext)) {
                // Create a chain for this orphan path
                // We need to construct a valid IChain object with an IWalkLink
                const path = walkPath.pathContext;
                const offset = walkPath.offset || [0, 0];

                // Calculate absolute endpoints
                const origin = MakerJs.point.add(path.origin, offset);
                const end = (path as any).end ? MakerJs.point.add((path as any).end, offset) : origin;

                const link: any = {
                    walkedPath: walkPath,
                    endPoints: [origin, end],
                    reversed: false
                };

                orphans.push({
                    links: [link],
                    endless: false,
                    pathLength: MakerJs.measure.pathLength(path)
                } as any);
            }
        }
    });

    // console.log(`[G-Code] Collected ${orphans.length} orphaned paths`);
    return orphans;
}


/**
 * Detect groups of parallel lines (e.g., horizontal stripes)
 */
function detectParallelLines(chains: MakerJs.IChain[]): MakerJs.IChain[][] {
    if (chains.length < 3) return [];

    const ANGLE_TOLERANCE = 5; // degrees
    const SPACING_TOLERANCE = 0.15; // 15% variation in spacing

    const getStartPoint = (chain: MakerJs.IChain): [number, number] => {
        return chain.links[0].walkedPath.pathContext.origin as [number, number];
    };

    const getEndPoint = (chain: MakerJs.IChain): [number, number] => {
        if (chain.endless) return getStartPoint(chain);
        const lastLink = chain.links[chain.links.length - 1];
        return (lastLink.walkedPath.pathContext as any).end || lastLink.walkedPath.pathContext.origin;
    };

    const getAngle = (chain: MakerJs.IChain): number => {
        const start = getStartPoint(chain);
        const end = getEndPoint(chain);
        return Math.atan2(end[1] - start[1], end[0] - start[0]) * 180 / Math.PI;
    };

    // Group chains by similar angle
    const angleGroups: MakerJs.IChain[][] = [];

    for (const chain of chains) {
        if (chain.endless) continue;

        const angle = getAngle(chain);
        let foundGroup = false;

        for (const group of angleGroups) {
            const groupAngle = getAngle(group[0]);
            if (Math.abs(angle - groupAngle) < ANGLE_TOLERANCE) {
                group.push(chain);
                foundGroup = true;
                break;
            }
        }

        if (!foundGroup) {
            angleGroups.push([chain]);
        }
    }

    // Filter groups that have at least 3 parallel lines with consistent spacing
    const parallelGroups: MakerJs.IChain[][] = [];

    for (const group of angleGroups) {
        if (group.length < 3) continue;

        // Sort by perpendicular distance from origin
        const angle = getAngle(group[0]);
        const perpAngle = angle + 90;
        const perpRad = perpAngle * Math.PI / 180;

        group.sort((a, b) => {
            const aStart = getStartPoint(a);
            const bStart = getStartPoint(b);
            const aDist = aStart[0] * Math.cos(perpRad) + aStart[1] * Math.sin(perpRad);
            const bDist = bStart[0] * Math.cos(perpRad) + bStart[1] * Math.sin(perpRad);
            return aDist - bDist;
        });

        // Check spacing consistency
        const spacings: number[] = [];
        for (let i = 1; i < group.length; i++) {
            const prev = getStartPoint(group[i - 1]);
            const curr = getStartPoint(group[i]);
            const spacing = Math.sqrt(Math.pow(curr[0] - prev[0], 2) + Math.pow(curr[1] - prev[1], 2));
            spacings.push(spacing);
        }

        const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;
        const maxDeviation = Math.max(...spacings.map(s => Math.abs(s - avgSpacing) / avgSpacing));

        if (maxDeviation < SPACING_TOLERANCE) {
            parallelGroups.push(group);
        }
    }

    if (parallelGroups.length > 0) {
        const totalParallel = parallelGroups.reduce((sum, g) => sum + g.length, 0);
        // console.log(`[G-Code] Detected ${parallelGroups.length} parallel groups with ${totalParallel} total lines`);
    }

    return parallelGroups;
}

/**
 * Optimize parallel groups with back-and-forth pattern
 */
function optimizeParallelGroups(parallelGroups: MakerJs.IChain[][], allChains: MakerJs.IChain[]): OptimizedChain[] {
    const result: OptimizedChain[] = [];
    const usedChains = new Set<MakerJs.IChain>();

    // Process each parallel group with alternating direction
    for (const group of parallelGroups) {
        for (let i = 0; i < group.length; i++) {
            const chain = group[i];

            // Alternate direction: even indices go forward, odd go backward
            const shouldReverse = (i % 2 === 1);

            result.push({ chain, reverse: shouldReverse });
            usedChains.add(chain);
        }
    }

    // Add remaining chains using nearest-neighbor
    const remaining = allChains.filter(c => !usedChains.has(c));
    if (remaining.length > 0) {
        // console.log(`[G-Code] Processing ${remaining.length} non-parallel chains with nearest-neighbor`);
        result.push(...optimizeNearestNeighbor(remaining));
    }

    return result;
}

/**
 * Improved nearest-neighbor optimization
 * Returns metadata instead of mutating chains
 */
function optimizeNearestNeighbor(chains: MakerJs.IChain[]): OptimizedChain[] {
    if (chains.length <= 1) return chains.map(chain => ({ chain, reverse: false }));

    const getEndPoint = (chain: MakerJs.IChain): [number, number] => {
        if (chain.endless) {
            return chain.links[0].walkedPath.pathContext.origin as [number, number];
        }
        const lastLink = chain.links[chain.links.length - 1];
        const endPoint = (lastLink.walkedPath.pathContext as any).end || lastLink.walkedPath.pathContext.origin;
        return endPoint as [number, number];
    };

    const getStartPoint = (chain: MakerJs.IChain): [number, number] => {
        return chain.links[0].walkedPath.pathContext.origin as [number, number];
    };

    const optimized: OptimizedChain[] = [];
    const remaining = [...chains];

    // Start from origin [0, 0]
    let currentPos: [number, number] = [0, 0];

    while (remaining.length > 0) {
        let nearestIndex = 0;
        let nearestDist = Infinity;
        let shouldReverse = false;

        remaining.forEach((chain, index) => {
            const start = getStartPoint(chain);
            const distStart = Math.sqrt(
                Math.pow(start[0] - currentPos[0], 2) +
                Math.pow(start[1] - currentPos[1], 2)
            );

            if (distStart < nearestDist) {
                nearestDist = distStart;
                nearestIndex = index;
                shouldReverse = false;
            }

            if (!chain.endless) {
                const end = getEndPoint(chain);
                const distEnd = Math.sqrt(
                    Math.pow(end[0] - currentPos[0], 2) +
                    Math.pow(end[1] - currentPos[1], 2)
                );

                if (distEnd < nearestDist) {
                    nearestDist = distEnd;
                    nearestIndex = index;
                    shouldReverse = true;
                }
            }
        });

        const nearestChain = remaining.splice(nearestIndex, 1)[0];

        // DON'T mutate the chain - just set the reverse flag
        optimized.push({
            chain: nearestChain,
            reverse: shouldReverse
        });

        // Update current position based on which end we'll finish at
        if (shouldReverse) {
            currentPos = getStartPoint(nearestChain);
        } else {
            currentPos = getEndPoint(nearestChain);
        }
    }

    return optimized;
}

// ... (Updating exports to pass config.gcode.joinTolerance)

export function generateGCode(model: MakerJs.IModel, config: AppConfig, type: PostProcessorType = 'standard'): string {
    try {
        // console.log(`[G-Code] Starting export with post-processor: ${type}`);

        const post = POST_PROCESSORS[type](config);
        const lines: string[] = [...post.header];

        // Coordinate transformation helper
        // Order of transformations:
        // 1. Y-flip to match SVG coordinate system (screen coords: Y+ down)
        // 2. Swap axes if enabled (transpose X and Y)
        // 3. Apply invert flags for machine compatibility
        const canvasHeight = config.canvas.height;

        const transformCoords = (x: number, y: number): [number, number] => {
            // Neutral mapping: canvasHeight - y converts MakerJS (Y=0 bottom) to screen-like (Y=0 top).
            // invertY:true (default) then negates this to Y-negative machine space.
            // invertY:false keeps Y-positive for machines with bottom-left origin.
            let finalX = x - (config.gcode.originX || 0);
            let finalY = canvasHeight - y;

            // Apply axis swap
            if (config.gcode.swapAxes) {
                [finalX, finalY] = [finalY, finalX];
            }

            // Apply invert flags (invertY:true = Y-negative machine space)
            if (config.gcode.invertX) finalX = -finalX;
            if (config.gcode.invertY) finalY = -finalY;

            return [finalX, finalY];
        };

        // Flatten all nested model origins into path coordinates.
        // MakerJs.chain.toKeyPoints returns LOCAL path coords (no parent offset).
        // By originating first, all paths become absolute world coords, so
        // toKeyPoints works correctly for both root paths and nested fill paths.
        MakerJs.model.originate(model);

        let chains = MakerJs.model.findChains(model) as MakerJs.IChain[];

        const orphans = collectOrphanedPaths(model, chains);

        // Optimize path order for main chains only
        let optimizedChains: OptimizedChain[];
        if (config.gcode.optimizePaths) {
            optimizedChains = optimizeChainOrder(chains, config.gcode.joinTolerance || 0.01);
        } else {
            optimizedChains = chains.map(chain => ({ chain, reverse: false }));
        }

        let lineCount = 0;

        const emitChainMoves = (optimized: OptimizedChain, chainIndex: number) => {
            try {
                let points = MakerJs.chain.toKeyPoints(optimized.chain, 1.0);
                if (optimized.reverse) points = points.reverse();

                if (optimized.chain.endless && points.length > 0) {
                    const start = points[0];
                    const end = points[points.length - 1];
                    if (Math.hypot(start[0] - end[0], start[1] - end[1]) > 0.001) {
                        points.push(start);
                    }
                }

                if (points.length === 0) return;

                const [startX, startY] = transformCoords(points[0][0], points[0][1]);
                lines.push(post.formatTravel(startX, startY, config.gcode.travelRate));
                lines.push(`G1 Z${config.gcode.zDown} F${config.gcode.feedRate}`);
                if (config.gcode.dwellTime && config.gcode.dwellTime > 0) {
                    lines.push(post.formatDwell(config.gcode.dwellTime));
                }
                for (const point of points) {
                    const [px, py] = transformCoords(point[0], point[1]);
                    lines.push(post.formatMove(px, py));
                    lineCount++;
                }
                lines.push(post.formatSafeZ(config.gcode.zUp));
            } catch (chainError: any) {
                console.error(`[G-Code] Error processing chain ${chainIndex}:`, chainError.message);
            }
        };

        optimizedChains.forEach(emitChainMoves);

        // Emit each orphan hatch line individually (pen-up between every segment)
        orphans.forEach((orphan, i) => {
            try {
                // Use pre-computed absolute endpoints from the orphan link
                const link = orphan.links[0] as any;
                const p0 = link.endPoints[0] as MakerJs.IPoint;
                const p1 = link.endPoints[1] as MakerJs.IPoint;
                if (!p0 || !p1) return;

                const [startX, startY] = transformCoords(p0[0], p0[1]);
                const [endX, endY] = transformCoords(p1[0], p1[1]);

                lines.push(post.formatTravel(startX, startY, config.gcode.travelRate));
                lines.push(`G1 Z${config.gcode.zDown} F${config.gcode.feedRate}`);
                if (config.gcode.dwellTime && config.gcode.dwellTime > 0) {
                    lines.push(post.formatDwell(config.gcode.dwellTime));
                }
                lines.push(post.formatMove(endX, endY));
                lines.push(post.formatSafeZ(config.gcode.zUp));
                lineCount++;
            } catch (e: any) {
                console.error(`[G-Code] Error processing orphan ${i}:`, e.message);
            }
        });

        lines.push(...post.footer);
        return lines.join('\n');
    } catch (error: any) {
        console.error('[G-Code] Export failed:', error.message);
        throw new Error(`G-Code generation failed: ${error.message}`);
    }
}

export function generateGCodeForLayers(
    layerModels: Map<string, MakerJs.IModel>,
    config: AppConfig,
    type: PostProcessorType = 'standard'
): string {
    try {
        // console.log(`[G-Code] Starting multi-layer export for ${layerModels.size} layers`);

        const post = POST_PROCESSORS[type](config);
        const lines: string[] = [...post.header];

        // Coordinate transformation helper
        // Order of transformations:
        // 1. Y-flip to match SVG coordinate system (screen coords: Y+ down)
        // 2. Swap axes if enabled (transpose X and Y)
        // 3. Apply invert flags for machine compatibility
        const canvasHeight = config.canvas.height;

        const transformCoords = (x: number, y: number): [number, number] => {
            // Neutral mapping: canvasHeight - y converts MakerJS (Y=0 bottom) to screen-like (Y=0 top).
            // invertY:true (default) then negates this to Y-negative machine space.
            let finalX = x - (config.gcode.originX || 0);
            let finalY = canvasHeight - y;

            // Apply axis swap
            if (config.gcode.swapAxes) {
                [finalX, finalY] = [finalY, finalX];
            }

            // Apply invert flags (invertY:true = Y-negative machine space)
            if (config.gcode.invertX) finalX = -finalX;
            if (config.gcode.invertY) finalY = -finalY;

            return [finalX, finalY];
        };

        layerModels.forEach((model, layerId) => {
            try {
                // console.log(`[G-Code] Processing layer: ${layerId}`);
                lines.push(`(Layer: ${layerId})`);

                // Flatten all nested model origins into path coordinates before chain analysis.
                MakerJs.model.originate(model);

                let chains = MakerJs.model.findChains(model) as MakerJs.IChain[];
                const orphans = collectOrphanedPaths(model, chains);


                let optimizedChains: OptimizedChain[];
                if (config.gcode.optimizePaths) {
                    optimizedChains = optimizeChainOrder(chains, config.gcode.joinTolerance || 0.01);
                } else {
                    optimizedChains = chains.map(chain => ({ chain, reverse: false }));
                }

                optimizedChains.forEach((optimized: OptimizedChain) => {
                    let points = MakerJs.chain.toKeyPoints(optimized.chain, 1.0);
                    if (optimized.reverse) points = points.reverse();

                    if (optimized.chain.endless && points.length > 0) {
                        const start = points[0];
                        const end = points[points.length - 1];
                        if (Math.hypot(start[0] - end[0], start[1] - end[1]) > 0.001) {
                            points.push(start);
                        }
                    }

                    if (points.length === 0) return;

                    const [startX, startY] = transformCoords(points[0][0], points[0][1]);
                    lines.push(post.formatTravel(startX, startY, config.gcode.travelRate));
                    lines.push(`G1 Z${config.gcode.zDown} F${config.gcode.feedRate}`);
                    if (config.gcode.dwellTime && config.gcode.dwellTime > 0) {
                        lines.push(post.formatDwell(config.gcode.dwellTime));
                    }
                    for (let i = 1; i < points.length; i++) {
                        const [px, py] = transformCoords(points[i][0], points[i][1]);
                        lines.push(post.formatMove(px, py));
                    }
                    lines.push(post.formatSafeZ(config.gcode.zUp));
                });

                // Orphan hatch lines: each gets its own pen-lift (never consolidated)
                orphans.forEach((orphan, i) => {
                    try {
                        const link = orphan.links[0] as any;
                        const p0 = link.endPoints[0] as MakerJs.IPoint;
                        const p1 = link.endPoints[1] as MakerJs.IPoint;
                        if (!p0 || !p1) return;
                        const [startX, startY] = transformCoords(p0[0], p0[1]);
                        const [endX, endY] = transformCoords(p1[0], p1[1]);
                        lines.push(post.formatTravel(startX, startY, config.gcode.travelRate));
                        lines.push(`G1 Z${config.gcode.zDown} F${config.gcode.feedRate}`);
                        if (config.gcode.dwellTime && config.gcode.dwellTime > 0) {
                            lines.push(post.formatDwell(config.gcode.dwellTime));
                        }
                        lines.push(post.formatMove(endX, endY));
                        lines.push(post.formatSafeZ(config.gcode.zUp));
                    } catch (e: any) {
                        console.error(`[G-Code] Error processing orphan ${i}:`, e.message);
                    }
                });
            } catch (layerError: any) {
                console.error(`[G-Code] Error processing layer ${layerId}:`, layerError.message);
            }
        });

        lines.push(...post.footer);
        // console.log('[G-Code] Multi-layer export complete');
        return lines.join('\n');
    } catch (error: any) {
        console.error('[G-Code] Multi-layer export failed:', error.message);
        throw new Error(`G-Code generation failed: ${error.message}`);
    }
}

/**
 * Simulate GCode generation to extract precise lengths for drawing and travel.
 */
export function computeGCodeStats(
    model: MakerJs.IModel,
    config: AppConfig
): { pathCount: number; totalLength: number; travelLength: number } {
    let pathCount = 0;
    let totalLength = 0;
    let travelLength = 0;

    MakerJs.model.originate(model);

    let chains = MakerJs.model.findChains(model) as MakerJs.IChain[];
    const orphans = collectOrphanedPaths(model, chains);

    let optimizedChains: OptimizedChain[];
    if (config.gcode.optimizePaths) {
        optimizedChains = optimizeChainOrder(chains, config.gcode.joinTolerance || 0.01);
    } else {
        optimizedChains = chains.map(chain => ({ chain, reverse: false }));
    }

    const canvasHeight = config.canvas.height;
    const transformCoords = (x: number, y: number): [number, number] => {
        let finalX = x - (config.gcode.originX || 0);
        let finalY = canvasHeight - y;
        if (config.gcode.swapAxes) [finalX, finalY] = [finalY, finalX];
        if (config.gcode.invertX) finalX = -finalX;
        if (config.gcode.invertY) finalY = -finalY;
        return [finalX, finalY];
    };

    let currentPos: [number, number] = [0, 0];

    const evaluateChain = (optimized: OptimizedChain) => {
        let points = MakerJs.chain.toKeyPoints(optimized.chain, 1.0);
        if (optimized.reverse) points = points.reverse();

        if (optimized.chain.endless && points.length > 0) {
            const start = points[0];
            const end = points[points.length - 1];
            if (Math.hypot(start[0] - end[0], start[1] - end[1]) > 0.001) {
                points.push(start);
            }
        }

        if (points.length === 0) return;

        const [startX, startY] = transformCoords(points[0][0], points[0][1]);
        const zUp = config.gcode.zUp !== undefined ? config.gcode.zUp : 2;
        const zDown = config.gcode.zDown !== undefined ? config.gcode.zDown : 0;
        const zTravel = Math.abs(zUp - zDown) * 2; // Up at end of last move, down at start of this move

        // Travel to chain start + Z lift/drop
        travelLength += Math.hypot(startX - currentPos[0], startY - currentPos[1]) + zTravel;
        currentPos = [startX, startY];

        // Draw segments
        for (let i = 1; i < points.length; i++) {
            const [px, py] = transformCoords(points[i][0], points[i][1]);
            totalLength += Math.hypot(px - currentPos[0], py - currentPos[1]);
            currentPos = [px, py];
            pathCount++;
        }
    };

    optimizedChains.forEach(evaluateChain);

    orphans.forEach(orphan => {
        const link = orphan.links[0] as any;
        const p0 = link.endPoints[0] as MakerJs.IPoint;
        const p1 = link.endPoints[1] as MakerJs.IPoint;
        if (!p0 || !p1) return;

        const [startX, startY] = transformCoords(p0[0], p0[1]);
        const [endX, endY] = transformCoords(p1[0], p1[1]);
        const zUp = config.gcode.zUp !== undefined ? config.gcode.zUp : 2;
        const zDown = config.gcode.zDown !== undefined ? config.gcode.zDown : 0;
        const zTravel = Math.abs(zUp - zDown) * 2;

        travelLength += Math.hypot(startX - currentPos[0], startY - currentPos[1]) + zTravel;
        totalLength += Math.hypot(endX - startX, endY - startY);
        currentPos = [endX, endY];
        pathCount++;
    });

    return { pathCount, totalLength, travelLength };
}
