import MakerJs from 'makerjs';
import { CanvasConfig } from '../types';

/**
 * Custom SVG exporter that preserves canvas coordinates.
 * MakerJs.exporter.toSVG auto-shifts coordinates to (0,0) which breaks our centering.
 */
export function modelToSVG(model: MakerJs.IModel, canvas: CanvasConfig): string {
    const lines: string[] = [];
    
    // Walk all paths and collect SVG line elements
    // In our model: Y=0 is at bottom (G-code style)
    // In SVG: Y=0 is at top
    // So we flip Y: svg_y = canvasHeight - model_y
    const canvasHeight = canvas.height;
    
    function processPath(path: MakerJs.IPath) {
        if (path.type === 'line') {
            const line = path as MakerJs.IPathLine;
            const x1 = line.origin[0].toFixed(3);
            const y1 = (canvasHeight - line.origin[1]).toFixed(3);
            const x2 = line.end[0].toFixed(3);
            const y2 = (canvasHeight - line.end[1]).toFixed(3);
            lines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
        }
    }
    
    function walkModel(m: MakerJs.IModel) {
        if (m.paths) {
            for (const p of Object.values(m.paths)) {
                processPath(p);
            }
        }
        if (m.models) {
            for (const child of Object.values(m.models)) {
                walkModel(child);
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
