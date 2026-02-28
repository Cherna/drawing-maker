import MakerJs from 'makerjs';
import { Jimp } from 'jimp';
import sharp from 'sharp';
import { CanvasConfig } from '../../types';

export class ExperimentalHatchingParams {
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
    preFilter?: boolean;
    preBrightness?: number;
    preContrast?: number;
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

interface Seg2D { x1: number; y1: number; x2: number; y2: number; }

function marchingSquares(
    grid: Float32Array,
    width: number,
    height: number,
    isovalue: number
): Seg2D[] {
    const segments: Seg2D[] = [];

    const getV = (x: number, y: number) => {
        if (x < 0 || x >= width || y < 0 || y >= height) return 0;
        return grid[y * width + x];
    };

    const interp = (x1: number, y1: number, x2: number, y2: number, v1: number, v2: number) => {
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

            let state = 0;
            if (v0 >= isovalue) state |= 1;
            if (v1 >= isovalue) state |= 2;
            if (v2 >= isovalue) state |= 4;
            if (v3 >= isovalue) state |= 8;

            if (state === 0 || state === 15) continue;

            const pts = [
                interp(x, y, x + 1, y, v0, v1),         // edge 0 (top)
                interp(x + 1, y, x + 1, y + 1, v1, v2), // edge 1 (right)
                interp(x, y + 1, x + 1, y + 1, v3, v2), // edge 2 (bottom)
                interp(x, y, x, y + 1, v0, v3)          // edge 3 (left)
            ];

            for (const edgeObj of edges[state]) {
                const pt1 = pts[edgeObj[0]];
                const pt2 = pts[edgeObj[1]];
                segments.push({
                    x1: pt1.x, y1: pt1.y,
                    x2: pt2.x, y2: pt2.y
                });
            }
        }
    }

    return segments;
}

export class ExperimentalHatching {
    static async generate(
        canvas: CanvasConfig,
        options: ExperimentalHatchingParams
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

            // Construct Isolines for each layer independently
            const isolinesModel: MakerJs.IModel = { paths: {}, models: {} };
            let lineIdCounter = 0;

            for (const v of layers) {
                // Compute EDT specifically for this grayscale layer
                const layerEdt = computeEDT(dWidth, dHeight, (x, y) => {
                    const idx = (y * dWidth + x) * 4;
                    const a = image.bitmap.data[idx + 3];
                    if (a === 0) return false;
                    const r = image.bitmap.data[idx];
                    return r === v; // Inside if it is EXACTLY this layer
                });

                let maxDist = 0;
                for (let i = 0; i < layerEdt.length; i++) if (layerEdt[i] > maxDist) maxDist = layerEdt[i];

                // Density dictates spacing. Base spacing is ~2 for density 1.5 -> 3.3px
                // The darker the layer, the tighter the spacing
                const layerDarkness = (thresholdInt - v) / thresholdInt; // 1.0 is darkest, 0.0 is lightest
                const adjustedDensity = (options.density || 1.5) * Math.max(0.3, layerDarkness);
                const spacing = Math.max(1, 5 / adjustedDensity);

                if (maxDist < spacing / 2) continue; // Skip if layer is too thin to fit a contour

                for (let d = spacing / 2; d <= maxDist; d += spacing) {
                    const segs = marchingSquares(layerEdt, dWidth, dHeight, d);
                    for (const seg of segs) {
                        const mapX1 = startX + seg.x1 * scale;
                        const mapY1 = height - (startY + seg.y1 * scale);
                        const mapX2 = startX + seg.x2 * scale;
                        const mapY2 = height - (startY + seg.y2 * scale);

                        isolinesModel.paths!['iso_' + lineIdCounter++] = new MakerJs.paths.Line(
                            [mapX1, mapY1],
                            [mapX2, mapY2]
                        );
                    }
                }
            }

            model.models!['isolines'] = isolinesModel;

            // Embed as pseudo-model for svg-exporter.ts
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
        } catch (err) {
            console.error("ExperimentalHatching Error:", err);
        }

        return model;
    }
}
