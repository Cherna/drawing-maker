import MakerJs from 'makerjs';
import sharp from 'sharp';
import { CanvasConfig } from '../../types';

export class ImageNormalTracingParams {
    densityMap?: string;
    normalMap?: string;
    shadingSteps?: number;
    density?: number;
    baseAngle?: number;
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

export class ImageNormalTracing {
    static async generate(
        canvas: CanvasConfig,
        options: ImageNormalTracingParams
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

        let rawNormal: { data: Buffer, info: sharp.OutputInfo } | null = null;
        if (options.normalMap) {
            const b64Norm = options.normalMap.replace(/^data:image\/\w+;base64,/, "");
            rawNormal = await sharp(Buffer.from(b64Norm, 'base64'))
                .toColorspace('srgb')
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });
        }

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
            const fy = (startY + imgH - y) / scale; // Convert Cartesian Y (bottom-up) to Buffer Y (top-down)
            if (fx < -0.5 || fx >= dWidth - 0.5 || fy < -0.5 || fy >= dHeight - 0.5) return 0.0;

            const applyFlipX = (px: number) => options.flipX ? (dWidth - 1) - px : px;
            const applyFlipY = (py: number) => options.flipY ? (dHeight - 1) - py : py;

            const sampleAlpha = (px: number, py: number): number => {
                const bx = applyFlipX(Math.max(0, Math.min(dWidth - 1, Math.round(px))));
                const by = applyFlipY(Math.max(0, Math.min(dHeight - 1, Math.round(py))));
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
                const bx = applyFlipX(Math.max(0, Math.min(dWidth - 1, Math.round(px))));
                const by = applyFlipY(Math.max(0, Math.min(dHeight - 1, Math.round(py))));
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

        const nWidth = rawNormal ? rawNormal.info.width : 0;
        const nHeight = rawNormal ? rawNormal.info.height : 0;
        const nBaseScale = nWidth > 0 ? Math.max(width / nWidth, height / nHeight) : 1;
        const nScale = nBaseScale * userScale;
        const nImgW = nWidth * nScale;
        const nImgH = nHeight * nScale;
        const nStartX = (width - nImgW) / 2 + (userOffsetX * width / 100);
        const nStartY = (height - nImgH) / 2 + (userOffsetY * height / 100);

        const getTangent = (x: number, y: number): { vx: number, vy: number } | null => {
            if (!rawNormal) return null;
            const fx = (x - nStartX) / nScale;
            const fy = (nStartY + nImgH - y) / nScale;
            if (fx < -0.5 || fx >= nWidth - 0.5 || fy < -0.5 || fy >= nHeight - 0.5) return null;

            const applyFlipX = (px: number) => options.flipX ? (nWidth - 1) - px : px;
            const applyFlipY = (py: number) => options.flipY ? (nHeight - 1) - py : py;
            const nData = rawNormal.data;
            const nChannels = rawNormal.info.channels;

            const sampleNormal = (px: number, py: number): { nx: number, ny: number } => {
                const bx = applyFlipX(Math.max(0, Math.min(nWidth - 1, Math.round(px))));
                const by = applyFlipY(Math.max(0, Math.min(nHeight - 1, Math.round(py))));

                const idx = (by * nWidth + bx) * nChannels;
                const snx = (nData[idx] / 255) * 2.0 - 1.0;
                let sny = (nData[idx + 1] / 255) * 2.0 - 1.0;
                // Normal maps in some apps use Y-up (OpenGL) vs Y-down (DirectX).
                // Our Cartesian system is Y-up. Buffer is Y-down. 
                // We keep it simple: flip Y based on common normal map conventions if needed.
                return { nx: snx, ny: sny };
            };
            const x0 = Math.floor(fx);
            const y0 = Math.floor(fy);
            const tx = fx - x0;
            const ty = fy - y0;
            const s00 = sampleNormal(x0, y0);
            const s10 = sampleNormal(x0 + 1, y0);
            const s01 = sampleNormal(x0, y0 + 1);
            const s11 = sampleNormal(x0 + 1, y0 + 1);
            const nx = s00.nx * (1 - tx) * (1 - ty) + s10.nx * tx * (1 - ty) + s01.nx * (1 - tx) * ty + s11.nx * tx * ty;
            const ny = s00.ny * (1 - tx) * (1 - ty) + s10.ny * tx * (1 - ty) + s01.ny * (1 - tx) * ty + s11.ny * tx * ty;

            const tvx = -ny;
            const tvy = nx;
            const len = Math.hypot(tvx, tvy);
            if (len < 0.01) return null;
            return { vx: tvx / len, vy: tvy / len };
        };

        const baseAngleRad = (options.baseAngle || 45) * Math.PI / 180;
        const threshold = options.threshold ?? 0.95;
        const densityMultiplier = Math.max(0.1, options.density || 1.5);
        const steps = Math.floor(Math.max(1, options.shadingSteps || 5));
        const minSpacing = 1.0 / densityMultiplier;
        const minAlpha = options.minAlpha ?? 0.5;
        const maxAlpha = options.maxAlpha ?? 1.0;
        const densityCurve = Math.max(0.1, options.densityCurve ?? 1.0);

        const runStreamlineHatching = () => {
            const stepLen = 0.5;
            const cellSize = minSpacing / 2.0;
            const gridCols = Math.ceil(width / cellSize);
            const gridRows = Math.ceil(height / cellSize);
            const spatialGrid = new Int16Array(gridCols * gridRows);

            const getCell = (wx: number, wy: number) => {
                const c = Math.floor(wx / cellSize);
                const r = Math.floor(wy / cellSize);
                if (c < 0 || c >= gridCols || r < 0 || r >= gridRows) return -1;
                return r * gridCols + c;
            };

            const R = (v: number) => Math.round(v * 100) / 100;

            const getClearanceForDensity = (dens: number): number => {
                const darkness = Math.max(0, 1.0 - dens - (1.0 - threshold)) / threshold;
                const nd = Math.min(1.0, Math.pow(darkness, densityCurve));
                const bi = Math.floor(nd * (steps - 0.001));
                const spacingFac = 1 << Math.max(0, Math.min(steps - 1, (steps - 1 - bi)));
                return (spacingFac * minSpacing) / cellSize;
            };

            const trace = (sx: number, sy: number, direction: number, lineId: number, currentLineCells: Set<number>): MakerJs.IPoint[] => {
                const path: MakerJs.IPoint[] = [];
                let px = sx; let py = sy;
                let prevFlow: { vx: number, vy: number } | null = null;

                const initialDens = getDensity(sx, sy);
                if (initialDens >= threshold) return [];

                let lastDens = initialDens;
                let lastAlpha = getAlpha(sx, sy);

                for (let i = 0; i < 1500; i++) {
                    let flow = getTangent(px, py);
                    if (!flow) flow = { vx: Math.cos(baseAngleRad), vy: Math.sin(baseAngleRad) };

                    if (prevFlow) {
                        if (flow.vx * prevFlow.vx + flow.vy * prevFlow.vy < 0) {
                            flow.vx = -flow.vx; flow.vy = -flow.vy;
                        }
                    } else if (direction < 0) {
                        flow.vx = -flow.vx; flow.vy = -flow.vy;
                    }

                    const mx = px + flow.vx * stepLen * 0.5;
                    const my = py + flow.vy * stepLen * 0.5;
                    let flowMid = getTangent(mx, my);
                    if (!flowMid) flowMid = flow;
                    if (flowMid.vx * flow.vx + flowMid.vy * flow.vy < 0) {
                        flowMid.vx = -flowMid.vx; flowMid.vy = -flowMid.vy;
                    }

                    const nx = px + flowMid.vx * stepLen;
                    const ny = py + flowMid.vy * stepLen;

                    if (nx < 0 || nx > width || ny < 0 || ny > height) break;

                    const nDens = getDensity(nx, ny);
                    const nAlpha = getAlpha(nx, ny);
                    const alphaOk = hasTransparency ? (nAlpha >= minAlpha && nAlpha <= maxAlpha) : true;

                    if (nDens >= threshold || !alphaOk) break;

                    const clearanceCells = getClearanceForDensity(nDens);
                    const SEARCH_LIMIT = 24; // Increase limit for sparse areas
                    const R_SEARCH = Math.max(1, Math.min(SEARCH_LIMIT, Math.ceil(clearanceCells)));
                    const R2 = clearanceCells * clearanceCells;

                    let collision = false;
                    search: for (let dr = -R_SEARCH; dr <= R_SEARCH; dr++) {
                        for (let dc = -R_SEARCH; dc <= R_SEARCH; dc++) {
                            const d2 = dr * dr + dc * dc;
                            if (d2 <= R2) {
                                const cId = getCell(nx + dc * cellSize, ny + dr * cellSize);
                                if (cId >= 0 && spatialGrid[cId] !== 0 && !currentLineCells.has(cId)) {
                                    collision = true; break search;
                                }
                            }
                        }
                    }
                    if (collision) break;

                    path.push([R(nx), R(ny)]);
                    px = nx; py = ny; prevFlow = flowMid; lastDens = nDens; lastAlpha = nAlpha;

                    const cId = getCell(px, py);
                    if (cId >= 0) {
                        spatialGrid[cId] = lineId;
                        currentLineCells.add(cId);
                    }
                }
                return path;
            };

            const seedSpacing = Math.max(minSpacing, 2.0);
            const seeds: { x: number, y: number }[] = [];
            for (let sy = 0; sy < height; sy += seedSpacing) {
                const xOffset = (Math.floor(sy / seedSpacing) % 2) * (seedSpacing / 2);
                for (let sx = xOffset; sx < width; sx += seedSpacing) {
                    seeds.push({ x: sx, y: sy });
                }
            }
            // Shuffle seeds loosely
            for (let i = seeds.length - 1; i > 0; i--) {
                const j = Math.abs(Math.sin(i)) * seeds.length | 0;
                [seeds[i], seeds[j % seeds.length]] = [seeds[j % seeds.length], seeds[i]];
            }

            let lineIdCounter = 1;
            for (const s of seeds) {
                const sc = getCell(s.x, s.y);
                if (sc >= 0 && spatialGrid[sc] !== 0) continue;

                const lineId = (lineIdCounter++ % 32767);
                const currentLineCells = new Set<number>();

                // Reserve start cell
                if (sc >= 0) { spatialGrid[sc] = lineId; currentLineCells.add(sc); }

                const forward = trace(s.x, s.y, 1, lineId, currentLineCells);
                const backward = trace(s.x, s.y, -1, lineId, currentLineCells);
                const pts: MakerJs.IPoint[] = [...backward.reverse(), [R(s.x), R(s.y)], ...forward];

                if (pts.length >= 2) {
                    model.models![`hatch_${lineIdCounter}`] = new MakerJs.models.ConnectTheDots(false, pts);
                    for (const pt of pts) {
                        const mid = getCell(pt[0], pt[1]);
                        if (mid >= 0) spatialGrid[mid] = 1; // Mark permanent
                    }
                }
            }

            if (options.drawContour) {
                const bThresh = options.contourThreshold ?? threshold;
                const step = Math.max(0.5, minSpacing * 0.5);
                const resultSegs: { x1: number; y1: number; x2: number; y2: number; }[] = [];
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
                        const interp = (xA: number, yA: number, xB: number, yB: number, valA: number, valB: number) => {
                            const t = valA / (valA - valB);
                            return { x: xA + t * (xB - xA), y: yA + t * (yB - yA) };
                        };
                        const pts = [interp(x, y, x + step, y, v0, v1), interp(x + step, y, x + step, y + step, v1, v2), interp(x, y + step, x + step, y + step, v3, v2), interp(x, y, x, y + step, v0, v3)];
                        const edgesTbl = [[], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], [[3, 0], [1, 2]], [[0, 2]], [[3, 2]], [[2, 3]], [[2, 0]], [[0, 1], [2, 3]], [[2, 1]], [[1, 3]], [[1, 0]], [[0, 3]], []];
                        for (const edge of edgesTbl[state]) {
                            resultSegs.push({ x1: pts[edge[0]].x, y1: pts[edge[0]].y, x2: pts[edge[1]].x, y2: pts[edge[1]].y });
                        }
                    }
                }

                let contourId = 0;
                const usedSeg = new Set<number>();
                for (let si = 0; si < resultSegs.length; si++) {
                    if (usedSeg.has(si)) continue;
                    usedSeg.add(si);
                    const strand: MakerJs.IPoint[] = [[resultSegs[si].x1, resultSegs[si].y1], [resultSegs[si].x2, resultSegs[si].y2]];
                    let extended = true;
                    while (extended) {
                        extended = false;
                        const last = strand[strand.length - 1];
                        for (let sj = 0; sj < resultSegs.length; sj++) {
                            if (usedSeg.has(sj)) continue;
                            if (Math.hypot(resultSegs[sj].x1 - last[0], resultSegs[sj].y1 - last[1]) < 0.01) {
                                usedSeg.add(sj); strand.push([resultSegs[sj].x2, resultSegs[sj].y2]); extended = true; break;
                            }
                        }
                    }
                    if (strand.length >= 2) model.models![`contour_${contourId++}`] = new MakerJs.models.ConnectTheDots(false, strand);
                }
            }
        };

        runStreamlineHatching();
        return model;
    }
}
