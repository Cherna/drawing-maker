import MakerJs from 'makerjs';
import { Jimp } from 'jimp';
import sharp from 'sharp';
import { CanvasConfig } from '../../types';
import { Effects } from '../../lib/effects';

export class ConcentricHatchingParams {
    densityMap?: string;
    shadingSteps?: number;
    density?: number;
    threshold?: number;
    scale?: number;
    offsetX?: number;
    offsetY?: number;
    flipX?: boolean;
    flipY?: boolean;
    blur?: number;
    minAlpha?: number;
    maxAlpha?: number;
    showShading?: boolean;
    drawContour?: boolean;
    contourThreshold?: number;
    simplifyContour?: boolean;
    simplifyTolerance?: number;
    densityCurve?: number;
    minSegmentLength?: number;
    preFilter?: boolean;
    preBrightness?: number;
    preContrast?: number;
    signal?: AbortSignal;
}

function computeEDT(width: number, height: number, insideFn: (x: number, y: number) => boolean): Float32Array {
    const grid = new Float32Array(width * height);
    const MAX_DIST = width + height;

    // Pass 1: Vertical 1D
    for (let x = 0; x < width; x++) {
        let d = MAX_DIST;
        for (let y = 0; y < height; y++) {
            if (!insideFn(x, y)) d = 0;
            else if (d < MAX_DIST) d++;
            grid[y * width + x] = d * d;
        }
        d = MAX_DIST;
        for (let y = height - 1; y >= 0; y--) {
            if (!insideFn(x, y)) d = 0;
            else if (d < MAX_DIST) d++;
            if (d * d < grid[y * width + x]) grid[y * width + x] = d * d;
        }
    }

    // Pass 2: Horizontal 1D (Meijster)
    const f = new Float32Array(width);
    const v = new Int32Array(width);
    const z = new Float32Array(width + 1);

    for (let y = 0; y < height; y++) {
        const offset = y * width;
        for (let x = 0; x < width; x++) f[x] = grid[offset + x];

        let k = 0;
        v[0] = 0;
        z[0] = -Infinity;
        z[1] = Infinity;

        for (let q = 1; q < width; q++) {
            let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
            while (s <= z[k] && k > 0) {
                k--;
                s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
            }
            k++;
            v[k] = q;
            z[k] = s;
            z[k + 1] = Infinity;
        }

        k = 0;
        for (let q = 0; q < width; q++) {
            while (z[k + 1] < q) k++;
            const dx = (q - v[k]);
            grid[offset + q] = dx * dx + f[v[k]];
        }
    }

    for (let i = 0; i < grid.length; i++) {
        grid[i] = Math.sqrt(grid[i]);
    }

    return grid;
}

interface Seg2D { x1: number; y1: number; x2: number; y2: number; d: number; }

function marchingSquaresMulti(
    grid: Float32Array,
    width: number,
    height: number,
    spacing: number,
    maxDist: number
): Seg2D[] {
    const segments: Seg2D[] = [];

    const getV = (x: number, y: number) => grid[y * width + x];

    const interp = (x1: number, y1: number, x2: number, y2: number, v1: number, v2: number, isovalue: number) => {
        if (v1 === v2) return { x: x1, y: y1 };
        const t = (isovalue - v1) / (v2 - v1);
        return {
            x: x1 + t * (x2 - x1),
            y: y1 + t * (y2 - y1)
        };
    };

    const edges = [
        [], [[3, 0]], [[0, 1]], [[3, 1]],
        [[1, 2]], [[3, 0], [1, 2]], [[0, 2]], [[3, 2]],
        [[2, 3]], [[2, 0]], [[0, 1], [2, 3]], [[2, 1]],
        [[1, 3]], [[1, 0]], [[0, 3]], []
    ];

    for (let y = 0; y < height - 1; y++) {
        for (let x = 0; x < width - 1; x++) {
            const v0 = getV(x, y);     // top-left
            const v1 = getV(x + 1, y);     // top-right
            const v2 = getV(x + 1, y + 1); // bottom-right
            const v3 = getV(x, y + 1); // bottom-left

            const minV = Math.min(v0, v1, v2, v3);
            const maxV = Math.max(v0, v1, v2, v3);

            if (minV === maxV) continue;

            // Find all multiples of spacing that fall in (minV, maxV]
            // We shift by spacing/2 to match the original offset
            const startD = Math.ceil((minV - spacing / 2) / spacing) * spacing + spacing / 2;

            for (let d = startD; d <= maxV && d <= maxDist; d += spacing) {
                if (d < spacing / 2) continue;

                let state = 0;
                if (v0 >= d) state |= 1;
                if (v1 >= d) state |= 2;
                if (v2 >= d) state |= 4;
                if (v3 >= d) state |= 8;

                if (state === 0 || state === 15) continue;

                const pts = [
                    interp(x, y, x + 1, y, v0, v1, d),         // edge 0 (top)
                    interp(x + 1, y, x + 1, y + 1, v1, v2, d), // edge 1 (right)
                    interp(x, y + 1, x + 1, y + 1, v3, v2, d), // edge 2 (bottom)
                    interp(x, y, x, y + 1, v0, v3, d)          // edge 3 (left)
                ];

                for (const edgeObj of edges[state]) {
                    const pt1 = pts[edgeObj[0]];
                    const pt2 = pts[edgeObj[1]];
                    const dx = pt2.x - pt1.x;
                    const dy = pt2.y - pt1.y;
                    // Skip degenerate near-zero-length segments (appear as dots in output)
                    if (dx * dx + dy * dy < 1e-6) continue;
                    segments.push({
                        x1: pt1.x, y1: pt1.y,
                        x2: pt2.x, y2: pt2.y,
                        d: d // Keep track of the ring distance for clipping logic
                    });
                }
            }
        }
    }

    return segments;
}

export class ConcentricHatching {
    static async generate(
        canvas: CanvasConfig,
        options: ConcentricHatchingParams
    ): Promise<MakerJs.IModel> {
        const { width, height } = canvas;
        const model: MakerJs.IModel = { paths: {}, models: {} };

        if (!options.densityMap) {
            return model;
        }

        try {
            const b64Parts = options.densityMap.split(',');
            const base64Data = b64Parts.length > 1 ? b64Parts[1] : options.densityMap;
            const rawBuffer = Buffer.from(base64Data, 'base64');

            let sharpInstance = sharp(rawBuffer)
                .toColorspace('srgb')
                .ensureAlpha();

            if (options.blur && options.blur > 0) {
                sharpInstance = sharpInstance.blur(options.blur);
            }

            const cleanBuffer = await sharpInstance
                .toFormat('png')
                .toBuffer();

            const image = await Jimp.read(cleanBuffer);
            image.greyscale();

            if (options.preFilter) {
                if (options.preBrightness && options.preBrightness !== 1) {
                    // Map [0, 2] multiplier UI to [-1, 1] Jimp additive bounds
                    image.brightness(options.preBrightness - 1);
                }
                if (options.preContrast && options.preContrast !== 0) {
                    image.contrast(options.preContrast);
                }
            }

            const dWidth = image.bitmap.width;
            const dHeight = image.bitmap.height;

            const stepsAmount = Math.floor(Math.max(1, options.shadingSteps || 5));
            const thresholdInt = Math.floor((options.threshold ?? 0.95) * 255);
            const minAlphaInt = Math.floor((options.minAlpha ?? 0.5) * 255);
            const maxAlphaInt = Math.floor((options.maxAlpha ?? 1.0) * 255);

            // Step 3: Layer Processing and Masking
            // Manual posterization using user-defined shading steps and alpha clipping
            const uniqueValues = new Set<number>();
            for (let y = 0; y < dHeight; y++) {
                for (let x = 0; x < dWidth; x++) {
                    const idx = (y * dWidth + x) * 4;
                    const a = image.bitmap.data[idx + 3];

                    if (a >= minAlphaInt && a <= maxAlphaInt) {
                        const r = image.bitmap.data[idx];
                        if (r < thresholdInt) {
                            // Map to discrete layers
                            const stepRatio = r / thresholdInt; // 0.0 to < 1.0
                            const layerIdx = Math.floor(stepRatio * stepsAmount);
                            const posterizedR = Math.floor((layerIdx / stepsAmount) * thresholdInt);

                            image.bitmap.data[idx] = posterizedR;
                            image.bitmap.data[idx + 1] = posterizedR;
                            image.bitmap.data[idx + 2] = posterizedR;
                            image.bitmap.data[idx + 3] = 255;
                            uniqueValues.add(posterizedR);
                        } else {
                            // Too bright
                            image.bitmap.data[idx + 3] = 0;
                        }
                    } else {
                        // Outside alpha bounds
                        image.bitmap.data[idx + 3] = 0;
                    }
                }
            }
            const layers = Array.from(uniqueValues).sort((a, b) => a - b);

            const processedBase64 = await image.getBase64('image/png');

            const userScale = options.scale ?? 1;
            const userOffsetX = options.offsetX ?? 0;
            const userOffsetY = options.offsetY ?? 0;

            const baseScale = Math.max(width / dWidth, height / dHeight);
            const scale = baseScale * userScale;

            const imgW = dWidth * scale;
            const imgH = dHeight * scale;

            const startX = (width - imgW) / 2 + (userOffsetX * width / 100);
            const startY = (height - imgH) / 2 + (userOffsetY * height / 100);

            // Construct Global Isolines and mask based on shading density
            const isolinesModel: MakerJs.IModel = { paths: {}, models: {} };
            let lineIdCounter = 0;

            // Compute unified EDT based on just the alpha mask of valid layers
            const globalEdt = computeEDT(dWidth, dHeight, (x, y) => {
                const idx = (y * dWidth + x) * 4;
                const a = image.bitmap.data[idx + 3];
                return a > 0; // Inside if not marked transparent during clipping
            });

            let maxDist = 0;
            for (let i = 0; i < globalEdt.length; i++) if (globalEdt[i] > maxDist) maxDist = globalEdt[i];

            // Uniform spacing based strictly on density, with sub-pixel support
            const spacing = Math.max(0.1, 2 / (options.density || 1.5));
            let ringIndex = 0;

            const segs = marchingSquaresMulti(globalEdt, dWidth, dHeight, spacing, maxDist);

            for (const seg of segs) {
                // Determine ring index from segment distance
                ringIndex = Math.round((seg.d - spacing / 2) / spacing);

                // Sample the underlying posterized darkness at segment start to calculate skip rate
                const px = Math.floor(seg.x1);
                const py = Math.floor(seg.y1);
                let clipMod = 1; // Default draw all

                if (px >= 0 && px < dWidth && py >= 0 && py < dHeight) {
                    const idx = (py * dWidth + px) * 4;
                    if (image.bitmap.data[idx + 3] > 0) {
                        const r = image.bitmap.data[idx];

                        // Map internal r value (0 = darkest, thresholdInt = lightest)
                        let stepRatio = Math.max(0, Math.min(1.0, r / thresholdInt));

                        // Apply user-defined density curve to the ratio
                        if (options.densityCurve && options.densityCurve !== 1.0) {
                            stepRatio = Math.pow(stepRatio, options.densityCurve);
                        }

                        const stepIdx = Math.floor(stepRatio * stepsAmount);
                        clipMod = stepIdx + 1;
                    } else {
                        // Laying over a transparent pixel, shouldn't officially be here but skip drawing
                        continue;
                    }
                }

                if (ringIndex % clipMod !== 0) {
                    continue; // Clip (skip) this segment
                }

                const mapX1 = startX + seg.x1 * scale;
                const mapY1 = height - (startY + seg.y1 * scale);
                const mapX2 = startX + seg.x2 * scale;
                const mapY2 = height - (startY + seg.y2 * scale);

                isolinesModel.paths!['iso_' + lineIdCounter++] = new MakerJs.paths.Line(
                    [mapX1, mapY1],
                    [mapX2, mapY2]
                );
            }

            // Pre-simplify: remove isolated short segments (the dots near contour boundaries).
            // An isolated segment has BOTH endpoints shared by no other segment (degree 1 on both ends).
            // Ring contour segments always share an endpoint with a neighbor, so they are never removed.
            // Filtering BEFORE simplify avoids the false-positive where curved rings get simplified
            // into short straight Lines with a small origin→end distance.
            const minPathLengthMm = options.minSegmentLength ?? 0;
            if (minPathLengthMm > 0 && isolinesModel.paths) {
                const ptKey = (x: number, y: number) =>
                    `${Math.round(x * 1e4)},${Math.round(y * 1e4)}`;
                const degree = new Map<string, number>();
                for (const key of Object.keys(isolinesModel.paths)) {
                    const p = isolinesModel.paths[key] as MakerJs.IPathLine;
                    if (p.type !== 'line') continue;
                    const ok = ptKey(p.origin[0], p.origin[1]);
                    const ek = ptKey(p.end[0], p.end[1]);
                    degree.set(ok, (degree.get(ok) ?? 0) + 1);
                    degree.set(ek, (degree.get(ek) ?? 0) + 1);
                }
                for (const key of Object.keys(isolinesModel.paths)) {
                    const p = isolinesModel.paths[key] as MakerJs.IPathLine;
                    if (p.type !== 'line') continue;
                    const ok = ptKey(p.origin[0], p.origin[1]);
                    const ek = ptKey(p.end[0], p.end[1]);
                    if ((degree.get(ok) ?? 0) === 1 && (degree.get(ek) ?? 0) === 1) {
                        const dx = p.end[0] - p.origin[0];
                        const dy = p.end[1] - p.origin[1];
                        if (Math.sqrt(dx * dx + dy * dy) < minPathLengthMm) {
                            delete isolinesModel.paths[key];
                        }
                    }
                }
            }

            // GCODE OPTIMIZATION:
            // Native marching squares outputs thousands of microscopic line segments, causing intense travel chatter. 
            // Running a low-tolerance simplification forces MakerJS RDP algorithm to search, merge, and chain them seamlessly into unified strokes.
            Effects.simplify(isolinesModel, 0.1);

            model.models!['isolines'] = isolinesModel;

            // Generate main boundary contour if requested
            if (options.drawContour) {
                const contourModel: MakerJs.IModel = { paths: {}, models: {} };
                const contourThresholdInt = Math.floor((options.contourThreshold ?? 0.5) * 255);

                const contourEdt = computeEDT(dWidth, dHeight, (x, y) => {
                    const idx = (y * dWidth + x) * 4;
                    const a = image.bitmap.data[idx + 3];
                    if (a < 128) return false;
                    const r = image.bitmap.data[idx];
                    return r < contourThresholdInt;
                });

                // Get exactly distance 1 inside the threshold boundary
                // the multi algo starts at spacing/2
                const cSegs = marchingSquaresMulti(contourEdt, dWidth, dHeight, 2, 2);
                let cId = 0;
                for (const seg of cSegs) {
                    const mapX1 = startX + seg.x1 * scale;
                    const mapY1 = height - (startY + seg.y1 * scale);
                    const mapX2 = startX + seg.x2 * scale;
                    const mapY2 = height - (startY + seg.y2 * scale);
                    contourModel.paths!['c_' + (cId++)] = new MakerJs.paths.Line([mapX1, mapY1], [mapX2, mapY2]);
                }

                if (options.simplifyContour) {
                    Effects.simplify(contourModel, options.simplifyTolerance ?? 0.3);
                }

                model.models!['contour'] = contourModel;
            }

            // Embed as pseudo-model for svg-exporter.ts
            if (options.showShading) {
                const rasterModel: any = {
                    layer: 'raster',
                    origin: [0, 0],
                    rasterData: {
                        base64: processedBase64,
                        width: imgW,
                        height: imgH,
                        x: startX,
                        // The SVG exporter expects Cartesian Y (bottom-up).
                        // Image space startY is from Top. 
                        // To center it, we subtract from full canvas height.
                        y: height - (startY + imgH)
                    }
                };
                model.models!['raster_preview'] = rasterModel as MakerJs.IModel;
            }
        } catch (err) {
            console.error("ConcentricHatching Error:", err);
        }

        return model;
    }
}
