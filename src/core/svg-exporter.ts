import MakerJs from 'makerjs';
import { CanvasConfig } from '../types';

// Helper to process a path and convert to SVG string, pushing to lines array
// Handles Y-flip (Cartesian -> SVG) replacement
function processPathToLines(
    path: MakerJs.IPath,
    offsetX: number,
    offsetY: number,
    canvasHeight: number,
    lines: string[]
) {
    if (path.type === 'line') {
        const line = path as MakerJs.IPathLine;
        const x1 = (line.origin[0] + offsetX).toFixed(3);
        const y1 = (canvasHeight - (line.origin[1] + offsetY)).toFixed(3);
        const x2 = (line.end[0] + offsetX).toFixed(3);
        const y2 = (canvasHeight - (line.end[1] + offsetY)).toFixed(3);
        lines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
    } else if (path.type === 'circle') {
        const circle = path as MakerJs.IPathCircle;
        const cx = (circle.origin[0] + offsetX).toFixed(3);
        const cy = (canvasHeight - (circle.origin[1] + offsetY)).toFixed(3);
        const r = circle.radius.toFixed(3);
        lines.push(`<circle cx="${cx}" cy="${cy}" r="${r}" />`);
    } else if (path.type === 'arc') {
        const arc = path as MakerJs.IPathArc;
        const startRad = arc.startAngle * Math.PI / 180;
        const endRad = arc.endAngle * Math.PI / 180;

        // Calculate points in Cartesian space relative to origin
        const startPt = MakerJs.point.add(arc.origin, MakerJs.point.fromPolar(startRad, arc.radius));
        const endPt = MakerJs.point.add(arc.origin, MakerJs.point.fromPolar(endRad, arc.radius));

        // Transform to SVG coordinates (Y flip)
        const sx = (startPt[0] + offsetX).toFixed(3);
        const sy = (canvasHeight - (startPt[1] + offsetY)).toFixed(3);
        const ex = (endPt[0] + offsetX).toFixed(3);
        const ey = (canvasHeight - (endPt[1] + offsetY)).toFixed(3);
        const r = arc.radius.toFixed(3);

        const largeArc = Math.abs(arc.endAngle - arc.startAngle) >= 180 ? 1 : 0;
        // Sweep flag 0 for CCW in Cartesian (which is CCW/Negative-Rotation in SVG Y-down)
        const sweep = 0;

        lines.push(`<path d="M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} ${sweep} ${ex} ${ey}" />`);
    }
}

/**
 * Shared utility to walk a model tree and collect SVG path strings.
 * Paths inside submodels whose key starts with 'fill_' are treated as hatch lines
 * and collected separately so the caller can style them differently.
 */
function walkAllPaths(
    model: MakerJs.IModel,
    canvasHeight: number,
    pathProcessor: (path: MakerJs.IPath, offsetX: number, offsetY: number, canvasHeight: number, lines: string[]) => void
): { normal: string[]; hatch: string[] } {
    const normal: string[] = [];
    const hatch: string[] = [];

    function walkModel(m: MakerJs.IModel, offsetX: number = 0, offsetY: number = 0, insideHatch: boolean = false) {
        const modelOrigin = m.origin || [0, 0];
        const newOffsetX = offsetX + modelOrigin[0];
        const newOffsetY = offsetY + modelOrigin[1];

        if (m.paths) {
            const target = insideHatch ? hatch : normal;
            for (const p of Object.values(m.paths)) {
                pathProcessor(p, newOffsetX, newOffsetY, canvasHeight, target);
            }
        }
        if (m.models) {
            for (const [key, child] of Object.entries(m.models)) {
                const childIsHatch = insideHatch || key.startsWith('fill_');
                walkModel(child, newOffsetX, newOffsetY, childIsHatch);
            }
        }
    }

    walkModel(model);
    return { normal, hatch };
}

/**
 * Custom SVG exporter that preserves canvas coordinates.
 * MakerJs.exporter.toSVG auto-shifts coordinates to (0,0) which breaks our centering.
 */
export function modelToSVG(model: MakerJs.IModel, canvas: CanvasConfig): string {
    const { normal, hatch } = walkAllPaths(model, canvas.height, processPathToLines);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" 
     width="${canvas.width}mm" 
     height="${canvas.height}mm" 
     viewBox="0 0 ${canvas.width} ${canvas.height}"
     style="background-color: #FAF8F3;">
  <g stroke="#000" stroke-width="0.25" fill="none" stroke-linecap="round">
    ${normal.join('\n    ')}
  </g>
  <g stroke="#888" stroke-width="0.08" fill="none" stroke-linecap="round">
    ${hatch.join('\n    ')}
  </g>
</svg>`;

    return svg;
}

/**
 * Export a single model to SVG with custom color and opacity.
 * Useful for exporting individual layers.
 */
export function modelToSVGWithColor(
    model: MakerJs.IModel,
    canvas: CanvasConfig,
    color: string = '#000000',
    opacity: number = 1.0,
    strokeWidth: number = 0.25
): string {
    const { normal, hatch } = walkAllPaths(model, canvas.height, processPathToLines);
    const opacityAttr = opacity < 1.0 ? ` stroke-opacity="${opacity.toFixed(2)}"` : '';
    const hatchStrokeWidth = Math.max(0.05, strokeWidth * 0.3);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" 
     width="${canvas.width}mm" 
     height="${canvas.height}mm" 
     viewBox="0 0 ${canvas.width} ${canvas.height}"
     style="background-color: #FAF8F3;">
  <g stroke="${color}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round"${opacityAttr}>
    ${normal.join('\n    ')}
  </g>
  <g stroke="#888" stroke-width="${hatchStrokeWidth}" fill="none" stroke-linecap="round"${opacityAttr}>
    ${hatch.join('\n    ')}
  </g>
</svg>`;

    return svg;
}

/**
 * Export multiple layers to a single combined SVG with each layer in its own color.
 * Layers are rendered in order (base first, additional layers on top).
 * 
 * @param layerData Map of layer IDs to objects containing model and layer metadata (color, opacity)
 * @param canvas Canvas configuration
 * @returns Combined SVG string with all layers
 */
export function layersToSVG(
    layerData: Map<string, { model: MakerJs.IModel, color: string, opacity?: number, strokeWidth?: number }>,
    canvas: CanvasConfig
): string {
    const canvasHeight = canvas.height;
    const layerGroups: string[] = [];

    // Process each layer
    for (const [layerId, data] of layerData.entries()) {
        const { model, color, opacity = 1.0, strokeWidth = 0.25 } = data;
        const { normal, hatch } = walkAllPaths(model, canvasHeight, processPathToLines);
        const opacityAttr = opacity < 1.0 ? ` stroke-opacity="${opacity.toFixed(2)}"` : '';
        const hatchStrokeWidth = Math.max(0.05, strokeWidth * 0.3);

        layerGroups.push(`  <g id="${layerId}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round"${opacityAttr}>
${normal.join('\n')}
  </g>
  <g id="${layerId}_hatch" stroke="#888" stroke-width="${hatchStrokeWidth}" fill="none" stroke-linecap="round"${opacityAttr}>
${hatch.join('\n')}
  </g>`);

    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" 
     width="${canvas.width}mm" 
     height="${canvas.height}mm" 
     viewBox="0 0 ${canvas.width} ${canvas.height}"
     style="background-color: #FAF8F3;">
${layerGroups.join('\n')}
</svg>`;

    return svg;
}

/**
 * Calculate statistics for a model
 * @param model The model to analyze
 * @returns Object containing pathCount and totalLength (in mm)
 */
export function getModelStats(model: MakerJs.IModel): { pathCount: number, totalLength: number } {
    let pathCount = 0;
    let totalLength = 0;

    function walkModel(m: MakerJs.IModel) {
        if (m.paths) {
            for (const path of Object.values(m.paths)) {
                pathCount++;
                totalLength += MakerJs.measure.pathLength(path);
            }
        }
        if (m.models) {
            for (const child of Object.values(m.models)) {
                walkModel(child);
            }
        }
    }

    walkModel(model);
    return { pathCount, totalLength };
}

/**
 * Export model as animated SVG with stroke-dasharray animation
 * Paths are drawn sequentially for pen plotter visualization
 * @param model The model to export
 * @param canvas Canvas configuration
 * @param options Animation options
 * @returns Animated SVG string
 */
export function modelToAnimatedSVG(
    model: MakerJs.IModel,
    canvas: CanvasConfig,
    options?: {
        duration?: number;    // Total animation duration in seconds (default: 10)
        stagger?: number;     // Delay between path animations in seconds (default: 0.05)
    }
): string {
    const duration = options?.duration || 10;
    const stagger = options?.stagger || 0.05;
    const canvasHeight = canvas.height;

    interface AnimatedPath {
        svgString: string;
        length: number;
    }

    const animatedPaths: AnimatedPath[] = [];

    function walkModel(m: MakerJs.IModel, offsetX: number = 0, offsetY: number = 0) {
        const modelOrigin = m.origin || [0, 0];
        const newOffsetX = offsetX + modelOrigin[0];
        const newOffsetY = offsetY + modelOrigin[1];

        if (m.paths) {
            for (const path of Object.values(m.paths)) {
                const length = MakerJs.measure.pathLength(path);
                const lines: string[] = [];
                processPathToLines(path, newOffsetX, newOffsetY, canvasHeight, lines);
                if (lines.length > 0) {
                    animatedPaths.push({
                        svgString: lines[0],
                        length
                    });
                }
            }
        }
        if (m.models) {
            for (const child of Object.values(m.models)) {
                walkModel(child, newOffsetX, newOffsetY);
            }
        }
    }

    walkModel(model);

    // Generate SVG with animations
    const pathElements = animatedPaths.map((p, index) => {
        const delay = index * stagger;
        const animDuration = duration / animatedPaths.length;

        // Replace line/circle/path tags with animated versions
        let element = p.svgString;

        // Add stroke-dasharray and animation
        const animationId = `anim_${index}`;
        element = element.replace(/\/>$/, `
            style="stroke-dasharray: ${p.length}; stroke-dashoffset: ${p.length};"
        >
            <animate
                attributeName="stroke-dashoffset"
                from="${p.length}"
                to="0"
                dur="${animDuration}s"
                begin="${delay}s"
                fill="freeze"
            />
        </${element.match(/<(\w+)/)?.[1]}>`);

        return element;
    }).join('\n    ');

    const totalDuration = (animatedPaths.length * stagger) + (duration / animatedPaths.length);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" 
     width="${canvas.width}mm" 
     height="${canvas.height}mm" 
     viewBox="0 0 ${canvas.width} ${canvas.height}"
     style="background-color: #FAF8F3;">
  <g stroke="#000" stroke-width="0.5" fill="none" stroke-linecap="round">
    ${pathElements}
  </g>
  <!-- Animation repeats indefinitely -->
  <animate attributeName="opacity" from="1" to="1" dur="${totalDuration}s" repeatCount="indefinite" />
</svg>`;

    return svg;
}

