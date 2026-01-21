import MakerJs from 'makerjs';
import { AppConfig } from '../types';

export type PostProcessorType = 'standard' | 'linuxcnc' | 'reprap';

interface PostProcessor {
    header: string[];
    footer: string[];
    formatMove: (x: number, y: number, feedRate?: number) => string;
    formatArc: (x: number, y: number, i: number, j: number, clockwise: boolean) => string;
    formatSafeZ: (z: number) => string;
    formatDwell: (ms: number) => string;
}

const POST_PROCESSORS: Record<PostProcessorType, (config: AppConfig) => PostProcessor> = {
    'standard': (config) => ({
        header: [
            'G21', // mm
            'G90', // absolute positioning
            `G0 Z${config.gcode.zUp} F${config.gcode.feedRate}`,
        ],
        footer: [
            `G0 Z${config.gcode.zUp}`,
            'G0 X0 Y0',
            'M2',
        ],
        formatMove: (x, y, feedRate) => `G1 X${x.toFixed(3)} Y${y.toFixed(3)}${feedRate ? ` F${feedRate}` : ''}`,
        formatArc: (x, y, i, j, clockwise) => `${clockwise ? 'G2' : 'G3'} X${x.toFixed(3)} Y${y.toFixed(3)} I${i.toFixed(3)} J${j.toFixed(3)}`,
        formatSafeZ: (z) => `G0 Z${z}`,
        formatDwell: (ms) => `G4 P${(ms / 1000).toFixed(3)}`,
    }),
    'linuxcnc': (config) => ({
        header: [
            '%',
            'G17 G21 G90 G64 P0.1', // XY Plane, mm, Absolute, Constant Velocity with tolerance
            `G0 Z${config.gcode.zUp}`,
            `G0 X0 Y0`,
            'M3 S1000', // Spindle On (if creating a drawing machine that needs spindle signal)
            `F${config.gcode.feedRate}`,
        ],
        footer: [
            `G0 Z${config.gcode.zUp}`,
            'G0 X0 Y0',
            'M5', // Spindle Off
            'M30', // Program End & Rewind
            '%',
        ],
        formatMove: (x, y, feedRate) => `G1 X${x.toFixed(4)} Y${y.toFixed(4)}${feedRate ? ` F${feedRate}` : ''}`,
        formatArc: (x, y, i, j, clockwise) => `${clockwise ? 'G2' : 'G3'} X${x.toFixed(4)} Y${y.toFixed(4)} I${i.toFixed(4)} J${j.toFixed(4)}`,
        formatSafeZ: (z) => `G0 Z${z}`,
        formatDwell: (ms) => `G4 P${(ms / 1000).toFixed(3)}`,
    }),
    'reprap': (config) => ({
        header: [
            'G21',
            'G90',
            'M107', // Fan off
            `G0 Z${config.gcode.zUp} F3000`,
        ],
        footer: [
            `G0 Z${config.gcode.zUp}`,
            'G28 X0 Y0', // Home
            'M84', // Disable motors
        ],
        formatMove: (x, y, feedRate) => `G1 X${x.toFixed(2)} Y${y.toFixed(2)}${feedRate ? ` F${feedRate}` : ''}`,
        formatArc: (x, y, i, j, clockwise) => `${clockwise ? 'G2' : 'G3'} X${x.toFixed(2)} Y${y.toFixed(2)} I${i.toFixed(2)} J${j.toFixed(2)}`,
        formatSafeZ: (z) => `G0 Z${z}`,
        formatDwell: (ms) => `G4 P${ms}`, // RepRap uses milliseconds directly
    })
};

/**
 * Sort chains using greedy nearest-neighbor algorithm
 * Helps reduce pen-up travel distance
 */
function optimizeChainOrder(chains: MakerJs.IChain[]): MakerJs.IChain[] {
    if (chains.length <= 1) return chains;

    const optimized: MakerJs.IChain[] = [];
    const remaining = [...chains];

    // Start with first chain
    let current = remaining.shift()!;
    optimized.push(current);

    // Get end point of a chain
    const getEndPoint = (chain: MakerJs.IChain): [number, number] => {
        if (chain.endless) {
            const firstPath = chain.paths[0];
            return firstPath.origin as [number, number];
        }
        const lastLink = chain.links[chain.links.length - 1];
        const endPoint = lastLink.walkedPath.pathContext.endPoint || lastLink.walkedPath.pathContext.origin;
        return endPoint as [number, number];
    };

    // Get start point of a chain
    const getStartPoint = (chain: MakerJs.IChain): [number, number] => {
        if (chain.endless) {
            return chain.paths[0].origin as [number, number];
        }
        return chain.links[0].walkedPath.pathContext.origin as [number, number];
    };

    // Find nearest chain
    while (remaining.length > 0) {
        const currentEnd = getEndPoint(current);
        let nearestIndex = 0;
        let nearestDist = Infinity;

        remaining.forEach((chain, index) => {
            const start = getStartPoint(chain);
            const dx = start[0] - currentEnd[0];
            const dy = start[1] - currentEnd[1];
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < nearestDist) {
                nearestDist = dist;
                nearestIndex = index;
            }
        });

        current = remaining.splice(nearestIndex, 1)[0];
        optimized.push(current);
    }

    return optimized;
}

export function generateGCode(model: MakerJs.IModel, config: AppConfig, type: PostProcessorType = 'standard'): string {
    try {
        console.log(`[G-Code] Starting export with post-processor: ${type}`);

        const post = POST_PROCESSORS[type](config);
        const lines: string[] = [...post.header];

        let chains = MakerJs.model.findChains(model);
        console.log(`[G-Code] Found ${chains.length} path chains`);

        // Optimize path order if enabled
        if (config.gcode.optimizePaths) {
            console.log('[G-Code] Optimizing path order...');
            chains = optimizeChainOrder(chains);
        }

        let arcCount = 0;
        let lineCount = 0;

        chains.forEach((chain, chainIndex) => {
            try {
                // Move to start of chain (Safe Height first)
                const start = chain.endless ? chain.paths[0].origin : chain.links[0].walkedPath.pathContext.origin;
                if (!start) {
                    console.warn(`[G-Code] Chain ${chainIndex}: No start point found, skipping`);
                    return;
                }

                lines.push(post.formatMove(start[0], start[1])); // Rapid to start XY

                // Plunge to Cut Height
                lines.push(`G1 Z${config.gcode.zDown} F${config.gcode.feedRate / 2}`); // Plunge slower

                // Add dwell time if configured
                if (config.gcode.dwellTime && config.gcode.dwellTime > 0) {
                    lines.push(post.formatDwell(config.gcode.dwellTime));
                }

                // Draw chain - convert to line segments
                const points = MakerJs.chain.toKeyPoints(chain, 1.0);

                // Skip first point as we are already there
                for (let i = 1; i < points.length; i++) {
                    lines.push(post.formatMove(points[i][0], points[i][1]));
                    lineCount++;
                }

                // Retract to Safe Height
                lines.push(post.formatSafeZ(config.gcode.zUp));
            } catch (chainError: any) {
                console.error(`[G-Code] Error processing chain ${chainIndex}:`, chainError.message);
            }
        });

        lines.push(...post.footer);

        console.log(`[G-Code] Export complete: ${lineCount} line segments, ${arcCount} arcs`);

        return lines.join('\n');
    } catch (error: any) {
        console.error('[G-Code] Export failed:', error.message, error.stack);
        throw new Error(`G-Code generation failed: ${error.message}`);
    }
}

export function generateGCodeForLayers(
    layerModels: Map<string, MakerJs.IModel>,
    config: AppConfig,
    type: PostProcessorType = 'standard'
): string {
    try {
        console.log(`[G-Code] Starting multi-layer export for ${layerModels.size} layers`);

        const post = POST_PROCESSORS[type](config);
        const lines: string[] = [...post.header];

        layerModels.forEach((model, layerId) => {
            try {
                console.log(`[G-Code] Processing layer: ${layerId}`);
                lines.push(`(Layer: ${layerId})`);

                const chains = MakerJs.model.findChains(model);

                chains.forEach((chain) => {
                    const start = chain.endless ? chain.paths[0].origin : chain.links[0].walkedPath.pathContext.origin;
                    if (!start) return;

                    lines.push(post.formatMove(start[0], start[1]));
                    lines.push(`G1 Z${config.gcode.zDown} F${config.gcode.feedRate / 2}`);

                    if (config.gcode.dwellTime && config.gcode.dwellTime > 0) {
                        lines.push(post.formatDwell(config.gcode.dwellTime));
                    }

                    const points = MakerJs.chain.toKeyPoints(chain, 1.0);
                    for (let i = 1; i < points.length; i++) {
                        lines.push(post.formatMove(points[i][0], points[i][1]));
                    }

                    lines.push(post.formatSafeZ(config.gcode.zUp));
                });
            } catch (layerError: any) {
                console.error(`[G-Code] Error processing layer ${layerId}:`, layerError.message);
            }
        });

        lines.push(...post.footer);
        console.log('[G-Code] Multi-layer export complete');

        return lines.join('\n');
    } catch (error: any) {
        console.error('[G-Code] Multi-layer export failed:', error.message);
        throw new Error(`G-Code generation failed: ${error.message}`);
    }
}
