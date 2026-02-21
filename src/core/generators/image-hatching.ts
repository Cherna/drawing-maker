import MakerJs from 'makerjs';
import sharp from 'sharp';

export class ImageHatchingParams {
    densityMap?: string;
    normalMap?: string;
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
    densityCurve?: number;   // gamma exponent for the period curve (1=linear, <1=more dense darks, >1=sparser)
    drawContour?: boolean;   // trace the boundary of dark regions as a line
    contourThreshold?: number; // brightness cutoff for contour detection (default = same as threshold)
}

export class ImageHatching {
    static async generate(
        width: number,
        height: number,
        options: ImageHatchingParams
    ): Promise<MakerJs.IModel> {
        const model: MakerJs.IModel = { paths: {}, models: {} };

        if (!options.densityMap) {
            return model;
        }

        const base64Data = options.densityMap.replace(/^data:image\/[^;]+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, 'base64');
        // Do NOT call .grayscale() here — it strips the alpha channel before ensureAlpha()
        // can preserve it, causing transparent pixels to become opaque black.
        // Grayscale is computed manually via the luma formula in getDensity().
        // Force RGBA (4 channels) so channel indexing is always predictable.
        const densitySharp = sharp(imageBuffer);
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
            let minAlpha = 255;
            for (let py = 0; py < dHeight; py += 10) {
                for (let px = 0; px < dWidth; px += 10) {
                    const idx = (py * dWidth + px) * ch;
                    if (ch >= 4) {
                        const a = dData[idx + 3];
                        if (a < minAlpha) minAlpha = a;
                    } else if (ch === 2) {
                        const a = dData[idx + 1];
                        if (a < minAlpha) minAlpha = a;
                    }
                }
            }
            if (minAlpha < 255) hasTransparency = true;
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

        // Bilinear interpolation for smooth anti-aliased edges
        const getDensity = (x: number, y: number): number => {
            // Sub-pixel position in image space (with Y flip)
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

            // Outside image bounds â†’ white
            if (fx < -0.5 || fx >= dWidth - 0.5 || fy < -0.5 || fy >= dHeight - 0.5) return 1;

            // Bilinear interpolation
            const x0 = Math.floor(fx);
            const y0 = Math.floor(fy);
            const tx = fx - x0;
            const ty = fy - y0;

            const s00 = samplePixel(x0, y0);
            const s10 = samplePixel(x0 + 1, y0);
            const s01 = samplePixel(x0, y0 + 1);
            const s11 = samplePixel(x0 + 1, y0 + 1);

            return s00 * (1 - tx) * (1 - ty)
                + s10 * tx * (1 - ty)
                + s01 * (1 - tx) * ty
                + s11 * tx * ty;
        };

        // ── Normal Map Tangent Sampling (bilinear, uses normal map's own dimensions) ──
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
                const bx = applyFlipX(Math.max(0, Math.min(nWidth - 1, px)));
                const by = applyFlipY(Math.max(0, Math.min(nHeight - 1, py)));
                const idx = (by * nWidth + bx) * nChannels;
                const snx = (nData[idx] / 255) * 2.0 - 1.0;
                let sny = (nData[idx + 1] / 255) * 2.0 - 1.0;
                if (options.flipY) sny = -sny;
                return { nx: snx, ny: sny };
            };

            // Bilinear interpolation of the normal XY components
            const x0 = Math.floor(fx);
            const y0 = Math.floor(fy);
            const tx = fx - x0;
            const ty = fy - y0;

            const s00 = sampleNormal(x0, y0);
            const s10 = sampleNormal(x0 + 1, y0);
            const s01 = sampleNormal(x0, y0 + 1);
            const s11 = sampleNormal(x0 + 1, y0 + 1);

            const nx = s00.nx * (1 - tx) * (1 - ty) + s10.nx * tx * (1 - ty)
                + s01.nx * (1 - tx) * ty + s11.nx * tx * ty;
            const ny = s00.ny * (1 - tx) * (1 - ty) + s10.ny * tx * (1 - ty)
                + s01.ny * (1 - tx) * ty + s11.ny * tx * ty;

            // Rotate XY normal 90° to get the surface tangent: (-ny, nx)
            const tvx = -ny;
            const tvy = nx;

            const len = Math.hypot(tvx, tvy);
            if (len < 0.001) return null; // Flat area: callers fall back to baseAngle

            return { vx: tvx / len, vy: tvy / len };
        };

        const baseAngleRad = (options.baseAngle || 45) * Math.PI / 180;
        const threshold = options.threshold ?? 0.95;
        const densityMultiplier = Math.max(0.1, options.density || 1.5);

        // Continuous density subdivision: bit-reversed fractional mapping [0, 1]
        // This generates a Halton-style Van der Corput sequence.
        // E.g., line 1 -> 0.5, line 2 -> 0.25, line 3 -> 0.75, line 4 -> 0.125
        const getLineScore = (index: number): number => {
            let n = index + 1; // 1-indexed to avoid 0 mapping to 0 for the first line
            let rev = 0;
            let p = 0.5;
            while (n > 0) {
                if (n % 2 === 1) rev += p;
                p *= 0.5;
                n = Math.floor(n / 2);
            }
            return rev;
        };

        // Number of discrete grey values steps mapping limits
        const steps = Math.floor(Math.max(1, options.shadingSteps || 5));

        const baseMinSpacing = 1.0;
        const minSpacing = baseMinSpacing / densityMultiplier;

        // densityCurve: gamma exponent applied to the normalised darkness before mapping to density
        // <1 = more lines in dark areas (emphasises darks), >1 = sparsely spaced (emphasises lights)
        const densityCurve = Math.max(0.1, options.densityCurve ?? 1.0);

        // â”€â”€ Shared Boundary Segments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // buildBoundary() runs the strand-accumulation contour scan, applies smoothing,
        // and returns a flat list of [x1,y1,x2,y2] segments in world (canvas) space.
        // These are used both for drawing the contour line AND for clipping hatch lines,
        // so both operations share exactly the same clean edge.
        // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        interface Seg2D { x1: number; y1: number; x2: number; y2: number; }

        const buildBoundary = (bThresh: number): Seg2D[] => {
            const step = Math.max(0.5, minSpacing * 0.5);
            const resultSegs: Seg2D[] = [];

            const numCols = Math.ceil(width / step) + 1;
            const numRows = Math.ceil(height / step) + 1;
            const grid = new Float32Array(numCols * numRows);

            for (let r = 0; r < numRows; r++) {
                const y = r * step;
                for (let c = 0; c < numCols; c++) {
                    const x = c * step;
                    let v = -1;
                    if (x >= 0 && x <= width && y >= 0 && y <= height) {
                        if (hasTransparency) {
                            v = getAlpha(x, y) - 0.5;
                        } else {
                            v = bThresh - getDensity(x, y);
                        }
                    }
                    if (v === 0) v = 1e-9;
                    grid[r * numCols + c] = v;
                }
            }

            const getV = (c: number, r: number) => grid[r * numCols + c];

            const interp = (xA: number, yA: number, xB: number, yB: number, vA: number, vB: number) => {
                const t = vA / (vA - vB);
                return { x: xA + t * (xB - xA), y: yA + t * (yB - yA) };
            };

            const edgesTbl = [
                [], [[3, 0]], [[0, 1]], [[3, 1]],
                [[1, 2]], [[3, 0], [1, 2]], [[0, 2]], [[3, 2]],
                [[2, 3]], [[2, 0]], [[0, 1], [2, 3]], [[2, 1]],
                [[1, 3]], [[1, 0]], [[0, 3]], []
            ];

            for (let r = 0; r < numRows - 1; r++) {
                for (let c = 0; c < numCols - 1; c++) {
                    const x = c * step; const y = r * step;
                    const v0 = getV(c, r); const v1 = getV(c + 1, r);
                    const v2 = getV(c + 1, r + 1); const v3 = getV(c, r + 1);

                    const state = (v0 > 0 ? 1 : 0) | (v1 > 0 ? 2 : 0) | (v2 > 0 ? 4 : 0) | (v3 > 0 ? 8 : 0);
                    if (state === 0 || state === 15) continue;

                    const pts = [
                        interp(x, y, x + step, y, v0, v1),
                        interp(x + step, y, x + step, y + step, v1, v2),
                        interp(x, y + step, x + step, y + step, v3, v2),
                        interp(x, y, x, y + step, v0, v3)
                    ];

                    for (const edge of edgesTbl[state]) {
                        resultSegs.push({
                            x1: pts[edge[0]].x, y1: pts[edge[0]].y,
                            x2: pts[edge[1]].x, y2: pts[edge[1]].y
                        });
                    }
                }
            }
            return resultSegs;
        };

        // â”€â”€ Scan-line Ã— boundary intersection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // For a scan line at perpendicular offset y (in rotated frame), direction cosA/sinA,
        // find all x-parameters along the scan line where it crosses boundary segment seg.
        //
        // Scan point at param x: world = (cx + xÂ·cosA âˆ’ yÂ·sinA,  cy + xÂ·sinA + yÂ·cosA)
        // Segment from A to B:   world = A + tÂ·(Bâˆ’A),  t âˆˆ [0,1]
        //
        // 2Ã—2 system (Cramer's rule):
        //   xÂ·cosA âˆ’ tÂ·ddx = rx    where rx = Ax âˆ’ cx + yÂ·sinA
        //   xÂ·sinA âˆ’ tÂ·ddy = ry          ry = Ay âˆ’ cy âˆ’ yÂ·cosA
        //   det = ddxÂ·sinA âˆ’ cosAÂ·ddy
        //   x   = (âˆ’rxÂ·ddy + ryÂ·ddx) / det
        //   t   = ( cosAÂ·ry âˆ’ sinAÂ·rx) / det
        // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const hatchClipXValues = (
            cx: number, cy: number,
            cosA: number, sinA: number,
            y: number,
            segs: Seg2D[]
        ): number[] => {
            const hits: number[] = [];
            for (const seg of segs) {
                const ddx = seg.x2 - seg.x1;
                const ddy = seg.y2 - seg.y1;
                const det = ddx * sinA - cosA * ddy;
                if (Math.abs(det) < 1e-8) continue;
                const rx = seg.x1 - cx + y * sinA;
                const ry = seg.y1 - cy - y * cosA;
                const tSeg = (cosA * ry - sinA * rx) / det;
                if (tSeg < -1e-6 || tSeg >= 1 - 1e-6) continue;
                const xParam = (-rx * ddy + ry * ddx) / det;
                hits.push(xParam);
            }
            hits.sort((a, b) => a - b);
            return hits;
        };

        // â”€â”€ Raster Hatching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const runRasterHatching = (angleOffset: number, boundarySegs: Seg2D[] | null) => {
            const angle = baseAngleRad + angleOffset;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);

            const maxRadius = Math.hypot(width, height) / 2;
            const cx = width / 2;
            const cy = height / 2;

            const yMin = -maxRadius;
            const yMax = maxRadius;
            const xMin = -maxRadius;
            const xMax = maxRadius;

            let lineIdCounter = 0;
            const R = (v: number) => Math.round(v * 1000) / 1000;

            for (let y = yMin; y <= yMax; y += minSpacing) {
                const lineIndex = Math.round(Math.abs((y - yMin) / minSpacing));
                const stepX = 0.5;

                // ── Determine active x-ranges for this scan line ──────────────
                // If boundary segments are provided, use them for the clip; otherwise
                // fall back to density threshold (old behaviour).
                type Range = { xStart: number; xEnd: number };
                const activeRanges: Range[] = [];

                if (boundarySegs && boundarySegs.length > 0) {
                    const hits = hatchClipXValues(cx, cy, cosA, sinA, y, boundarySegs);
                    // Pair intersections: even-odd fill rule
                    for (let hi = 0; hi + 1 < hits.length; hi += 2) {
                        activeRanges.push({ xStart: hits[hi], xEnd: hits[hi + 1] });
                    }
                }

                // ── Emit hatch segments within each active range ──────────────
                for (const range of activeRanges) {
                    let currentSegment: MakerJs.IPoint[] = [];

                    const emitSeg = () => {
                        if (currentSegment.length === 2) {
                            const len = Math.hypot(
                                currentSegment[0][0] - currentSegment[1][0],
                                currentSegment[0][1] - currentSegment[1][1]
                            );
                            if (len > 0.01) {
                                model.models![`hatch_${angleOffset}_${lineIdCounter++}`] =
                                    new MakerJs.models.ConnectTheDots(false, [...currentSegment]);
                            }
                        }
                        currentSegment = [];
                    };

                    // Clip range endpoints to canvas and to xMin/xMax
                    const xStart = Math.max(xMin, range.xStart);
                    const xEnd = Math.min(xMax, range.xEnd);

                    let prevDens = 1.0;
                    let prevRx = cx + xStart * cosA - y * sinA;
                    let prevRy = cy + xStart * sinA + y * cosA;
                    let prevDraw = false;

                    for (let x = xStart; x <= xEnd; x = Math.min(x + stepX, xEnd)) {
                        const rx = cx + x * cosA - y * sinA;
                        const ry = cy + x * sinA + y * cosA;
                        const inBounds = rx >= 0 && rx <= width && ry >= 0 && ry <= height;
                        const dens = inBounds ? getDensity(rx, ry) : 1.0;
                        const alpha = inBounds ? getAlpha(rx, ry) : 0.0;

                        let draw = false;
                        if (inBounds && dens < threshold && (hasTransparency ? alpha >= 0.5 : true)) {
                            const darkness = 1.0 - dens;
                            let normalizedDarkness = Math.max(0, darkness - (1.0 - threshold)) / threshold;
                            normalizedDarkness = Math.min(1.0, normalizedDarkness);
                            const bucketIndex = Math.floor(normalizedDarkness * (steps - 0.001));

                            let isSwitched = false;
                            const chance = options.crossHatchChance || 0;
                            if (chance > 0) {
                                if (chance >= 1.0) { isSwitched = (bucketIndex % 2 === 1); }
                                else { const h = Math.sin((bucketIndex + 1) * 123.456) * 10000; isSwitched = (h - Math.floor(h)) < chance; }
                            }

                            let shouldDrawPass = false;
                            const isAltPass = Math.abs(angleOffset) > 0.01;
                            if (options.crossHatch) shouldDrawPass = true;
                            else shouldDrawPass = isAltPass ? isSwitched : !isSwitched;

                            if (shouldDrawPass) {
                                const tBucket = steps > 1 ? bucketIndex / (steps - 1) : 1;
                                const tCurved = Math.pow(tBucket, densityCurve);

                                // Compare directly against continuous density score to avoid artificial banding
                                if (getLineScore(lineIndex) < tCurved) {
                                    draw = true;
                                }
                            }
                        }

                        if (x === xStart) {
                            if (draw) currentSegment = [[R(rx), R(ry)]];
                        } else {
                            if (draw && !prevDraw) {
                                let sRx = rx, sRy = ry;
                                if (prevDens >= threshold && dens < threshold && dens !== prevDens) {
                                    const t = (threshold - prevDens) / (dens - prevDens);
                                    sRx = prevRx + t * (rx - prevRx); sRy = prevRy + t * (ry - prevRy);
                                }
                                currentSegment = [[R(sRx), R(sRy)]];
                            } else if (!draw && prevDraw) {
                                let eRx = prevRx, eRy = prevRy;
                                if (prevDens < threshold && dens >= threshold && dens !== prevDens) {
                                    const t = (threshold - prevDens) / (dens - prevDens);
                                    eRx = prevRx + t * (rx - prevRx); eRy = prevRy + t * (ry - prevRy);
                                }
                                if (currentSegment.length >= 1) {
                                    if (currentSegment.length === 1) currentSegment.push([R(eRx), R(eRy)]);
                                    else currentSegment[1] = [R(eRx), R(eRy)];
                                }
                                emitSeg();
                            } else if (draw) {
                                if (currentSegment.length === 1) currentSegment.push([R(rx), R(ry)]);
                                else currentSegment[1] = [R(rx), R(ry)];
                            }
                        }

                        if (x === xEnd) break;
                        prevDens = dens; prevRx = rx; prevRy = ry; prevDraw = draw;
                    }

                    if (prevDraw && currentSegment.length >= 1) {
                        if (currentSegment.length === 1) currentSegment.push([R(prevRx), R(prevRy)]);
                        emitSeg();
                    }
                }

                // ── Fallback: no boundary — use density threshold scan ──────────
                if (!boundarySegs || boundarySegs.length === 0) {
                    let prevDens = 1.0;
                    let prevAlpha = 0.0;
                    let prevRx = cx + xMin * cosA - y * sinA;
                    let prevRy = cy + xMin * sinA + y * cosA;
                    let prevDraw = false;
                    let currentSegment: MakerJs.IPoint[] = [];

                    const emitSeg = () => {
                        if (currentSegment.length === 2) {
                            const len = Math.hypot(currentSegment[0][0] - currentSegment[1][0], currentSegment[0][1] - currentSegment[1][1]);
                            if (len > 0.01) {
                                model.models![`hatch_${angleOffset}_${lineIdCounter++}`] =
                                    new MakerJs.models.ConnectTheDots(false, [...currentSegment]);
                            }
                        }
                        currentSegment = [];
                    };

                    for (let x = xMin; x <= xMax; x += stepX) {
                        const rx = cx + x * cosA - y * sinA;
                        const ry = cy + x * sinA + y * cosA;
                        const inBounds = rx >= 0 && rx <= width && ry >= 0 && ry <= height;
                        const dens = inBounds ? getDensity(rx, ry) : 1.0;
                        const alpha = inBounds ? getAlpha(rx, ry) : 0.0;
                        let draw = false;
                        if (inBounds && dens < threshold && (hasTransparency ? alpha >= 0.5 : true)) {
                            const darkness = 1.0 - dens;
                            let nd = Math.max(0, darkness - (1.0 - threshold)) / threshold;
                            nd = Math.min(1.0, nd);
                            const bi = Math.floor(nd * (steps - 0.001));
                            let sw = false;
                            const ch = options.crossHatchChance || 0;
                            if (ch > 0) { if (ch >= 1) sw = (bi % 2 === 1); else { const h = Math.sin((bi + 1) * 123.456) * 10000; sw = (h - Math.floor(h)) < ch; } }
                            let sdp = false;
                            const alt = Math.abs(angleOffset) > 0.01;
                            if (options.crossHatch) sdp = true; else sdp = alt ? sw : !sw;
                            if (sdp) {
                                const tB = steps > 1 ? bi / (steps - 1) : 1;
                                const tC = Math.pow(tB, densityCurve);

                                if (getLineScore(lineIndex) < tC) {
                                    draw = true;
                                }
                            }
                        }
                        if (draw && !prevDraw) {
                            let sRx = rx, sRy = ry;
                            if (hasTransparency && prevAlpha < 0.5 && alpha >= 0.5 && alpha !== prevAlpha) {
                                const t = (0.5 - prevAlpha) / (alpha - prevAlpha);
                                sRx = prevRx + t * (rx - prevRx); sRy = prevRy + t * (ry - prevRy);
                            } else if (prevDens >= threshold && dens < threshold && dens !== prevDens) {
                                const t = (threshold - prevDens) / (dens - prevDens);
                                sRx = prevRx + t * (rx - prevRx); sRy = prevRy + t * (ry - prevRy);
                            }
                            currentSegment = [[R(sRx), R(sRy)]];
                        } else if (!draw && prevDraw) {
                            let eRx = prevRx, eRy = prevRy;
                            if (hasTransparency && prevAlpha >= 0.5 && alpha < 0.5 && alpha !== prevAlpha) {
                                const t = (0.5 - prevAlpha) / (alpha - prevAlpha);
                                eRx = prevRx + t * (rx - prevRx); eRy = prevRy + t * (ry - prevRy);
                            } else if (prevDens < threshold && dens >= threshold && dens !== prevDens) {
                                const t = (threshold - prevDens) / (dens - prevDens);
                                eRx = prevRx + t * (rx - prevRx); eRy = prevRy + t * (ry - prevRy);
                            }
                            if (currentSegment.length >= 1) {
                                if (currentSegment.length === 1) currentSegment.push([R(eRx), R(eRy)]);
                                else currentSegment[1] = [R(eRx), R(eRy)];
                            }
                            emitSeg();
                        } else if (draw) {
                            if (currentSegment.length === 1) currentSegment.push([R(rx), R(ry)]);
                            else currentSegment[1] = [R(rx), R(ry)];
                        }
                        prevDens = dens; prevAlpha = alpha; prevRx = rx; prevRy = ry; prevDraw = draw;
                    }
                    if (prevDraw && currentSegment.length >= 1) {
                        if (currentSegment.length === 1) currentSegment.push([R(prevRx), R(prevRy)]);
                        emitSeg();
                    }
                }
            }
        };

        // ── Streamline Hatching (Normal Map Driven) ───────────────────────────────
        const runStreamlineHatching = () => {
            const stepLen = 0.5; // mm per integration step
            const bThresh = options.contourThreshold ?? threshold;
            const boundary = buildBoundary(bThresh);

            // Spatial density tracking: one cell per minSpacing/2 square
            const cellSize = minSpacing / 2;
            const gridCols = Math.ceil(width / cellSize);
            const gridRows = Math.ceil(height / cellSize);
            const spatialGrid = new Int8Array(gridCols * gridRows);

            const getCell = (wx: number, wy: number) => {
                const c = Math.floor(wx / cellSize);
                const r = Math.floor(wy / cellSize);
                if (c < 0 || c >= gridCols || r < 0 || r >= gridRows) return -1;
                return r * gridCols + c;
            };

            let lineIdCounter = 0;
            const R = (v: number) => Math.round(v * 1000) / 1000;

            // Hex-offset seed grid across the canvas
            const seeds: { x: number, y: number }[] = [];
            const seedSpacing = minSpacing;
            for (let sy = 0; sy < height; sy += seedSpacing) {
                const xOffset = (Math.floor(sy / seedSpacing) % 2) * (seedSpacing / 2);
                for (let sx = xOffset; sx < width; sx += seedSpacing) {
                    seeds.push({ x: sx, y: sy });
                }
            }

            // Deterministic shuffle
            for (let i = seeds.length - 1; i > 0; i--) {
                const j = Math.floor(Math.abs(Math.sin(i * 12.345)) * 10000) % (i + 1);
                [seeds[i], seeds[j]] = [seeds[j], seeds[i]];
            }

            const traceStreamline = (startX: number, startY: number, lineId: number) => {
                const startDens = getDensity(startX, startY);
                const startAlpha = getAlpha(startX, startY);
                if (startDens >= threshold || (hasTransparency && startAlpha < 0.5)) return; // Started in empty space

                const getClearanceForDensity = (dens: number): number => {
                    const darkness = 1.0 - dens;
                    let nd = Math.max(0, darkness - (1.0 - threshold)) / threshold;
                    nd = Math.min(1.0, nd);
                    const bi = Math.floor(nd * (steps - 0.001));
                    const tB = steps > 1 ? bi / (steps - 1) : 1;
                    const densityVal = Math.pow(tB, densityCurve);
                    return Math.max(1, Math.round(1.0 / Math.max(0.01, densityVal)));
                };

                const startClearance = getClearanceForDensity(startDens);
                let collStart = false;
                for (let dy = -startClearance; dy <= startClearance; dy++) {
                    for (let dx = -startClearance; dx <= startClearance; dx++) {
                        if (dx * dx + dy * dy <= startClearance * startClearance) {
                            const c = getCell(startX + dx * cellSize, startY + dy * cellSize);
                            if (c >= 0 && spatialGrid[c] !== 0) { collStart = true; break; }
                        }
                    }
                    if (collStart) break;
                }
                if (collStart) return;

                const pts: MakerJs.IPoint[] = [];
                const cellClaims: number[] = [];

                for (const dir of [1, -1]) {
                    let px = startX;
                    let py = startY;
                    let currentPath: MakerJs.IPoint[] = [];
                    if (dir === -1 && pts.length > 0) {
                        pts.reverse();
                    }

                    if (dir === 1) currentPath.push([R(px), R(py)]);

                    let prevDens = startDens;
                    let prevAlpha = startAlpha;

                    for (let step = 0; step < 1000; step++) {
                        let flow = getTangent(px, py);

                        if (!flow) {
                            flow = { vx: Math.cos(baseAngleRad), vy: Math.sin(baseAngleRad) };
                        }

                        if (currentPath.length > 1) {
                            const lastP = currentPath[currentPath.length - 1];
                            const prevP = currentPath[currentPath.length - 2];
                            const vpx = lastP[0] - prevP[0];
                            const vpy = lastP[1] - prevP[1];
                            if (flow.vx * vpx + flow.vy * vpy < 0) {
                                flow.vx = -flow.vx;
                                flow.vy = -flow.vy;
                            }
                        } else if (dir === -1) {
                            flow.vx = -flow.vx;
                            flow.vy = -flow.vy;
                        }

                        // RK2 Midpoint
                        const hLen = stepLen * 0.5;
                        const mx = px + flow.vx * hLen;
                        const my = py + flow.vy * hLen;

                        let flowMid = getTangent(mx, my);
                        if (!flowMid) flowMid = { vx: Math.cos(baseAngleRad), vy: Math.sin(baseAngleRad) };
                        if (flowMid.vx * flow.vx + flowMid.vy * flow.vy < 0) {
                            flowMid.vx = -flowMid.vx; flowMid.vy = -flowMid.vy;
                        }

                        const nx = px + flowMid.vx * stepLen;
                        const ny = py + flowMid.vy * stepLen;

                        if (nx < 0 || nx > width || ny < 0 || ny > height) break;
                        const nDens = getDensity(nx, ny);
                        const nAlpha = getAlpha(nx, ny);
                        const isInside = hasTransparency ? (nAlpha >= 0.5) : true;

                        if (!isInside || nDens >= threshold) {
                            if (hasTransparency && !isInside && nAlpha !== prevAlpha) {
                                const t = (0.5 - prevAlpha) / (nAlpha - prevAlpha);
                                const edgeX = px + t * (nx - px);
                                const edgeY = py + t * (ny - py);
                                currentPath.push([R(edgeX), R(edgeY)]);
                            } else if (nDens !== prevDens) {
                                const t = (threshold - prevDens) / (nDens - prevDens);
                                const edgeX = px + t * (nx - px);
                                const edgeY = py + t * (ny - py);
                                currentPath.push([R(edgeX), R(edgeY)]);
                            }
                            break;
                        }

                        const reqClearance = getClearanceForDensity(nDens);

                        let collision = false;
                        for (let dy = -reqClearance; dy <= reqClearance; dy++) {
                            for (let dx = -reqClearance; dx <= reqClearance; dx++) {
                                if (dx * dx + dy * dy <= reqClearance * reqClearance) {
                                    const cell = getCell(nx + dx * cellSize, ny + dy * cellSize);
                                    if (cell >= 0 && spatialGrid[cell] !== 0 && !cellClaims.includes(cell)) {
                                        collision = true; break;
                                    }
                                }
                            }
                            if (collision) break;
                        }

                        if (collision) break;

                        currentPath.push([R(nx), R(ny)]);

                        px = nx; py = ny;
                        prevDens = nDens;
                        prevAlpha = nAlpha;

                        const cId = getCell(px, py);
                        if (cId >= 0 && spatialGrid[cId] === 0) {
                            spatialGrid[cId] = 1;
                            cellClaims.push(cId);
                        }
                    }

                    if (dir === 1) {
                        pts.push(...currentPath);
                    } else {
                        pts.unshift(...currentPath.reverse().slice(0, -1));
                    }
                }

                if (pts.length > 2) {
                    model.models![`hatch_stream_${lineIdCounter++}`] = new MakerJs.models.ConnectTheDots(false, pts);
                } else {
                    for (const c of cellClaims) spatialGrid[c] = 0;
                }
            };

            let seedLineId = 0;
            for (const s of seeds) {
                traceStreamline(s.x, s.y, seedLineId++);
            }

            if (options.drawContour && boundary.length > 0) {
                emitContourLines(boundary);
            }
        };

        // ── Contour line helper ───────────────────────────────────────────────────
        const emitContourLines = (boundary: Seg2D[]) => {
            let contourId = 0;
            type CStrand = MakerJs.IPoint[];
            const strands: CStrand[] = [];
            const usedSeg = new Set<number>();

            for (let si = 0; si < boundary.length; si++) {
                if (usedSeg.has(si)) continue;
                usedSeg.add(si);
                const strand: CStrand = [
                    [boundary[si].x1, boundary[si].y1],
                    [boundary[si].x2, boundary[si].y2]
                ];
                let extended = true;
                while (extended) {
                    extended = false;
                    const last = strand[strand.length - 1];
                    for (let sj = 0; sj < boundary.length; sj++) {
                        if (usedSeg.has(sj)) continue;
                        const distToStart = Math.hypot(boundary[sj].x1 - last[0], boundary[sj].y1 - last[1]);
                        if (distToStart < 0.01) {
                            usedSeg.add(sj);
                            strand.push([boundary[sj].x2, boundary[sj].y2]);
                            extended = true;
                            break;
                        }
                    }
                }
                strands.push(strand);
            }

            for (const strand of strands) {
                if (strand.length >= 2) {
                    model.models![`contour_${contourId++}`] =
                        new MakerJs.models.ConnectTheDots(false, strand);
                }
            }
        };

        // DEBUG: Comprehensive pixel stats
        {
            const ch = rawDensity.info.channels;
            let transparent = 0, dark = 0, light = 0, total = dWidth * dHeight;
            let minAlpha = 255, maxAlpha = 0;
            let minR = 255, maxR = 0;
            // Scan every 10th pixel for speed
            for (let py = 0; py < dHeight; py += 10) {
                for (let px = 0; px < dWidth; px += 10) {
                    const idx = (py * dWidth + px) * ch;
                    const r = dData[idx], g = dData[idx + 1], b = dData[idx + 2], a = dData[idx + 3];
                    if (a < minAlpha) minAlpha = a;
                    if (a > maxAlpha) maxAlpha = a;
                    if (r < minR) minR = r;
                    if (r > maxR) maxR = r;
                    if (a === 0) transparent++;
                    const luma = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
                    if (luma < 0.5) dark++; else light++;
                }
            }
            const sampled = Math.ceil(dWidth / 10) * Math.ceil(dHeight / 10);
            // Also scan the alpha channel for a row through the middle
            const midRow = Math.floor(dHeight / 2);
            const alphaSlice: number[] = [];
            for (let px = 0; px < dWidth; px += Math.max(1, Math.floor(dWidth / 40))) {
                const idx = (midRow * dWidth + px) * ch;
                alphaSlice.push(dData[idx + 3]);
            }
        }

        if (options.normalMap) {
            runStreamlineHatching();
        } else {
            const bThresh = options.contourThreshold ?? threshold;
            const boundary = buildBoundary(bThresh);

            runRasterHatching(0, boundary);
            if (options.crossHatch || (options.crossHatchChance || 0) > 0) {
                runRasterHatching(Math.PI / 2, boundary);
            }

            if (options.drawContour && boundary.length > 0) {
                emitContourLines(boundary);
            }
        }

        return model;
    }
}
