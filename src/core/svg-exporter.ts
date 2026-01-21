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
 * Custom SVG exporter that preserves canvas coordinates.
 * MakerJs.exporter.toSVG auto-shifts coordinates to (0,0) which breaks our centering.
 */
export function modelToSVG(model: MakerJs.IModel, canvas: CanvasConfig): string {
    const lines: string[] = [];
    const canvasHeight = canvas.height;

    function walkModel(m: MakerJs.IModel, offsetX: number = 0, offsetY: number = 0) {
        // Account for model's origin if it has one
        const modelOrigin = m.origin || [0, 0];
        const newOffsetX = offsetX + modelOrigin[0];
        const newOffsetY = offsetY + modelOrigin[1];

        if (m.paths) {
            for (const p of Object.values(m.paths)) {
                processPathToLines(p, newOffsetX, newOffsetY, canvasHeight, lines);
            }
        }
        if (m.models) {
            for (const child of Object.values(m.models)) {
                walkModel(child, newOffsetX, newOffsetY);
            }
        }
    }

    walkModel(model);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" 
     width="${canvas.width}mm" 
     height="${canvas.height}mm" 
     viewBox="0 0 ${canvas.width} ${canvas.height}"
     style="background-color: #FAF8F3;">
  <g stroke="#000" stroke-width="0.25" fill="none" stroke-linecap="round">
    ${lines.join('\n    ')}
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
    const lines: string[] = [];
    const canvasHeight = canvas.height;

    function walkModel(m: MakerJs.IModel, offsetX: number = 0, offsetY: number = 0) {
        const modelOrigin = m.origin || [0, 0];
        const newOffsetX = offsetX + modelOrigin[0];
        const newOffsetY = offsetY + modelOrigin[1];

        if (m.paths) {
            for (const p of Object.values(m.paths)) {
                processPathToLines(p, newOffsetX, newOffsetY, canvasHeight, lines);
            }
        }
        if (m.models) {
            for (const child of Object.values(m.models)) {
                walkModel(child, newOffsetX, newOffsetY);
            }
        }
    }

    walkModel(model);

    const opacityAttr = opacity < 1.0 ? ` stroke-opacity="${opacity.toFixed(2)}"` : '';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" 
     width="${canvas.width}mm" 
     height="${canvas.height}mm" 
     viewBox="0 0 ${canvas.width} ${canvas.height}"
     style="background-color: #FAF8F3;">
  <g stroke="${color}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round"${opacityAttr}>
    ${lines.join('\n    ')}
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
        const lines: string[] = [];
        const { model, color, opacity = 1.0, strokeWidth = 0.25 } = data;

        function walkModel(m: MakerJs.IModel, offsetX: number = 0, offsetY: number = 0) {
            const modelOrigin = m.origin || [0, 0];
            const newOffsetX = offsetX + modelOrigin[0];
            const newOffsetY = offsetY + modelOrigin[1];

            if (m.paths) {
                for (const p of Object.values(m.paths)) {
                    processPathToLines(p, newOffsetX, newOffsetY, canvasHeight, lines);
                }
            }
            if (m.models) {
                for (const child of Object.values(m.models)) {
                    walkModel(child, newOffsetX, newOffsetY);
                }
            }
        }

        walkModel(model);

        const opacityAttr = opacity < 1.0 ? ` stroke-opacity="${opacity.toFixed(2)}"` : '';

        // Create a group for this layer
        layerGroups.push(`  <g id="${layerId}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round"${opacityAttr}>
${lines.join('\n')}
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
