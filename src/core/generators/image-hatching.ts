import MakerJs from 'makerjs';
import sharp from 'sharp';
import { CanvasConfig } from '../../types';

export class ImageHatchingParams {
    densityMap?: string;
    shadingSteps?: number;
    density?: number;
    baseAngle?: number;
    crossHatch?: boolean;
    crossHatchChance?: number;
    threshold?: number;
    scale?: number;
    offsetX?: number;
    offsetY?: number;
    flipX?: boolean;
    flipY?: boolean;
    densityCurve?: number;
    drawContour?: boolean;
    contourThreshold?: number;
    blur?: number;
    minAlpha?: number;
    maxAlpha?: number;
}

export class ImageHatching {
    static async generate(
        canvas: CanvasConfig,
        options: ImageHatchingParams
    ): Promise<MakerJs.IModel> {
        const { width, height } = canvas;
        const model: MakerJs.IModel = { paths: {}, models: {} };

        if (!options.densityMap) {
            return model;
        }

        const base64Data = options.densityMap.replace(/^data:image\/[^;]+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, 'base64');

        let densitySharp = sharp(imageBuffer);
        if (options.blur && options.blur > 0) {
            densitySharp = densitySharp.blur(options.blur);
        }

        const rawDensity = await densitySharp
            .toColorspace('srgb')
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const dData = rawDensity.data;
        const dWidth = rawDensity.info.width;
        const dHeight = rawDensity.info.height;

        const userScale = options.scale ?? 1;
        const userOffsetX = options.offsetX ?? 0;
        const userOffsetY = options.offsetY ?? 0;

        const baseScale = Math.max(width / dWidth, height / dHeight);
        const scale = baseScale * userScale;

        const imgW = dWidth * scale;
        const imgH = dHeight * scale;

        const startX = (width - imgW) / 2 + (userOffsetX * width / 100);
        const startY = (height - imgH) / 2 + (userOffsetY * height / 100);

        let hasTransparency = false;
        {
            const ch = rawDensity.info.channels;
            let minAlphaVal = 255;
            const checkPixel = (px: number, py: number) => {
                const idx = (py * dWidth + px) * ch;
                if (ch >= 4) {
                    if (dData[idx + 3] < minAlphaVal) minAlphaVal = dData[idx + 3];
                } else if (ch === 2) {
                    if (dData[idx + 1] < minAlphaVal) minAlphaVal = dData[idx + 1];
                }
            };
            for (let px = 0; px < dWidth; px++) { checkPixel(px, 0); checkPixel(px, dHeight - 1); }
            for (let py = 0; py < dHeight; py++) { checkPixel(0, py); checkPixel(dWidth - 1, py); }
            if (minAlphaVal === 255) {
                // If edges are solid, check full image with sparse sampling
                for (let py = 0; py < dHeight; py += 10) {
                    for (let px = 0; px < dWidth; px += 10) {
                        checkPixel(px, py);
                    }
                }
            }
            if (minAlphaVal < 255) hasTransparency = true;
        }

        const getAlpha = (x: number, y: number): number => {
            if (!hasTransparency) return 1.0;
            const fx = (x - startX) / scale;
            const fy = (startY + imgH - y) / scale;
            if (fx < -0.5 || fx >= dWidth - 0.5 || fy < -0.5 || fy >= dHeight - 0.5) return 0.0;
            const applyFlipX = (px: number) => options.flipX ? (dWidth - 1) - px : px;
            const applyFlipY = (py: number) => options.flipY ? (dHeight - 1) - py : py;

            const sampleAlpha = (px: number, py: number): number => {
                const bx = applyFlipX(Math.max(0, Math.min(dWidth - 1, px)));
                const by = applyFlipY(Math.max(0, Math.min(dHeight - 1, py)));
                const channels = rawDensity.info.channels;
                const idx = (by * dWidth + bx) * channels;
                if (channels >= 4) return dData[idx + 3] / 255;
                if (channels === 2) return dData[idx + 1] / 255;
                return 1.0;
            };
            const x0 = Math.floor(fx);
            const y0 = Math.floor(fy);
            const tx = fx - x0;
            const ty = fy - y0;
            return sampleAlpha(x0, y0) * (1 - tx) * (1 - ty)
                + sampleAlpha(x0 + 1, y0) * tx * (1 - ty)
                + sampleAlpha(x0, y0 + 1) * (1 - tx) * ty
                + sampleAlpha(x0 + 1, y0 + 1) * tx * ty;
        };

        const getDensity = (x: number, y: number): number => {
            const fx = (x - startX) / scale;
            const fy = (startY + imgH - y) / scale;
            const applyFlipX = (px: number) => options.flipX ? (dWidth - 1) - px : px;
            const applyFlipY = (py: number) => options.flipY ? (dHeight - 1) - py : py;

            const samplePixel = (px: number, py: number): number => {
                const bx = applyFlipX(Math.max(0, Math.min(dWidth - 1, px)));
                const by = applyFlipY(Math.max(0, Math.min(dHeight - 1, py)));
                const channels = rawDensity.info.channels;
                const idx = (by * dWidth + bx) * channels;
                let r, g, b, a;
                if (channels >= 4) {
                    r = dData[idx]; g = dData[idx + 1]; b = dData[idx + 2]; a = dData[idx + 3];
                } else if (channels === 3) {
                    r = dData[idx]; g = dData[idx + 1]; b = dData[idx + 2]; a = 255;
                } else if (channels === 2) {
                    r = dData[idx]; g = dData[idx]; b = dData[idx]; a = dData[idx + 1];
                } else {
                    r = dData[idx]; g = dData[idx]; b = dData[idx]; a = 255;
                }
                if (a === 0) return 1;
                const alpha = a / 255;
                const bR = r * alpha + 255 * (1 - alpha);
                const bG = g * alpha + 255 * (1 - alpha);
                const bB = b * alpha + 255 * (1 - alpha);
                return (bR * 0.299 + bG * 0.587 + bB * 0.114) / 255;
            };
            if (fx < -0.5 || fx >= dWidth - 0.5 || fy < -0.5 || fy >= dHeight - 0.5) return 1;
            const x0 = Math.floor(fx);
            const y0 = Math.floor(fy);
            const tx = fx - x0;
            const ty = fy - y0;
            const s00 = samplePixel(x0, y0);
            const s10 = samplePixel(x0 + 1, y0);
            const s01 = samplePixel(x0, y0 + 1);
            const s11 = samplePixel(x0 + 1, y0 + 1);
            return s00 * (1 - tx) * (1 - ty) + s10 * tx * (1 - ty) + s01 * (1 - tx) * ty + s11 * tx * ty;
        };

        const baseAngleRad = (options.baseAngle || 45) * Math.PI / 180;
        const threshold = options.threshold ?? 0.95;
        const densityMultiplier = Math.max(0.1, options.density || 1.5);
        const steps = Math.floor(Math.max(1, options.shadingSteps || 5));
        const spacing = 1.0 / densityMultiplier;
        const minAlpha = options.minAlpha ?? 0.5;
        const maxAlpha = options.maxAlpha ?? 1.0;
        const densityCurve = Math.max(0.1, options.densityCurve ?? 1.0);

        const runHatching = (angleRad: number, level: number) => {
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);
            const stepSize = spacing * (1 << (steps - 1 - level));
            const range = width * Math.abs(cos) + height * Math.abs(sin);

            for (let d = -range; d <= range; d += stepSize) {
                const path: MakerJs.IPoint[] = [];
                let inDrawing = false;

                const traceStep = stepSize * 0.5;
                const traceRange = Math.max(width, height) * 1.5;

                for (let t = -traceRange; t <= traceRange; t += traceStep) {
                    const x = width / 2 + t * cos - d * sin;
                    const y = height / 2 + t * sin + d * cos;

                    if (x < 0 || x > width || y < 0 || y > height) {
                        if (inDrawing) {
                            if (path.length >= 2) {
                                model.models![`hatch_${level}_${d}_${t}`] = new MakerJs.models.ConnectTheDots(false, path);
                            }
                            path.length = 0; inDrawing = false;
                        }
                        continue;
                    }

                    const dens = getDensity(x, y);
                    const alpha = getAlpha(x, y);
                    const darkness = 1.0 - dens;
                    const alphaOk = hasTransparency ? (alpha >= minAlpha && alpha <= maxAlpha) : true;

                    let targetDarkness = Math.max(0, darkness - (1.0 - threshold)) / threshold;
                    targetDarkness = Math.min(1.0, Math.pow(targetDarkness, densityCurve));

                    const requiredLevel = Math.floor(targetDarkness * steps);

                    if (level < requiredLevel && alphaOk) {
                        path.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
                        inDrawing = true;
                    } else {
                        if (inDrawing) {
                            if (path.length >= 2) {
                                model.models![`hatch_${level}_${d}_${t}`] = new MakerJs.models.ConnectTheDots(false, path);
                            }
                            path.length = 0; inDrawing = false;
                        }
                    }
                }
                if (path.length >= 2) {
                    model.models![`hatch_${level}_${d}_final`] = new MakerJs.models.ConnectTheDots(false, path);
                }
            }
        };

        for (let i = 0; i < steps; i++) {
            runHatching(baseAngleRad, i);
            if (options.crossHatch) {
                const chance = options.crossHatchChance || 0.5;
                if (Math.random() < chance) {
                    runHatching(baseAngleRad + Math.PI / 2, i);
                }
            }
        }

        if (options.drawContour) {
            const buildBoundary = (bThresh: number) => {
                const step = spacing * 0.5;
                const resultSegs: { x1: number, y1: number, x2: number, y2: number }[] = [];
                const numCols = Math.ceil(width / step) + 1;
                const numRows = Math.ceil(height / step) + 1;
                const grid = new Float32Array(numCols * numRows);

                for (let r = 0; r < numRows; r++) {
                    const y = r * step;
                    for (let c = 0; c < numCols; c++) {
                        const x = c * step;
                        let v = -1;
                        if (x >= 0 && x <= width && y >= 0 && y <= height) {
                            const rDens = getDensity(x, y);
                            const rAlpha = getAlpha(x, y);
                            if (hasTransparency) {
                                if (rAlpha >= minAlpha && rAlpha <= maxAlpha) v = bThresh - rDens;
                            } else {
                                v = bThresh - rDens;
                            }
                        }
                        if (v === 0) v = 1e-9;
                        grid[r * numCols + c] = v;
                    }
                }

                for (let r = 0; r < numRows - 1; r++) {
                    for (let c = 0; c < numCols - 1; c++) {
                        const x = c * step; const y = r * step;
                        const v0 = grid[r * numCols + c]; const v1 = grid[r * numCols + (c + 1)];
                        const v2 = grid[(r + 1) * numCols + (c + 1)]; const v3 = grid[(r + 1) * numCols + c];
                        const state = (v0 > 0 ? 1 : 0) | (v1 > 0 ? 2 : 0) | (v2 > 0 ? 4 : 0) | (v3 > 0 ? 8 : 0);
                        if (state === 0 || state === 15) continue;
                        const interp = (xA: number, yA: number, xB: number, yB: number, vA: number, vB: number) => {
                            const t = vA / (vA - vB);
                            return { x: xA + t * (xB - xA), y: yA + t * (yB - yA) };
                        };
                        const pts = [interp(x, y, x + step, y, v0, v1), interp(x + step, y, x + step, y + step, v1, v2), interp(x, y + step, x + step, y + step, v3, v2), interp(x, y, x, y + step, v0, v3)];
                        const edgesTbl = [[], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], [[3, 0], [1, 2]], [[0, 2]], [[3, 2]], [[2, 3]], [[2, 0]], [[0, 1], [2, 3]], [[2, 1]], [[1, 3]], [[1, 0]], [[0, 3]], []];
                        for (const edge of edgesTbl[state]) {
                            resultSegs.push({ x1: pts[edge[0]].x, y1: pts[edge[0]].y, x2: pts[edge[1]].x, y2: pts[edge[1]].y });
                        }
                    }
                }
                return resultSegs;
            };

            const emitContour = (boundary: any[]) => {
                let contourId = 0;
                type Strand = MakerJs.IPoint[];
                const strands: Strand[] = [];
                const used = new Set<number>();
                for (let si = 0; si < boundary.length; si++) {
                    if (used.has(si)) continue;
                    used.add(si);
                    const strand: Strand = [[boundary[si].x1, boundary[si].y1], [boundary[si].x2, boundary[si].y2]];
                    let extended = true;
                    while (extended) {
                        extended = false;
                        const last = strand[strand.length - 1];
                        for (let sj = 0; sj < boundary.length; sj++) {
                            if (used.has(sj)) continue;
                            if (Math.hypot(boundary[sj].x1 - last[0], boundary[sj].y1 - last[1]) < 0.01) {
                                used.add(sj);
                                strand.push([boundary[sj].x2, boundary[sj].y2]);
                                extended = true; break;
                            }
                        }
                    }
                    strands.push(strand);
                }
                for (const s of strands) {
                    if (s.length >= 2) model.models![`contour_${contourId++}`] = new MakerJs.models.ConnectTheDots(false, s);
                }
            };
            emitContour(buildBoundary(options.contourThreshold ?? threshold));
        }

        return model;
    }
}
