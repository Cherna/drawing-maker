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
    minPeriod?: number;      // darkest shading: draw every Nth line (1 = every line)
    maxPeriod?: number;      // lightest shading: draw every Nth line (e.g. 6)
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

        const base64Data = options.densityMap.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, 'base64');
        // Do NOT call .grayscale() here â€” it strips the alpha channel before ensureAlpha()
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

        // ── Normal Map Tangent Sampling ─────────────────────────────────────────
        const getTangent = (x: number, y: number): { vx: number, vy: number } | null => {
            if (!rawNormal) return null;
            const fx = (x - startX) / scale;
            const fy = (startY + imgH - y) / scale;

            // Outside image bounds â†’ flow straight horizontally as fallback
            if (fx < -0.5 || fx >= dWidth - 0.5 || fy < -0.5 || fy >= dHeight - 0.5) return null;

            const applyFlipX = (px: number) => options.flipX ? (dWidth - 1) - px : px;
            const applyFlipY = (py: number) => options.flipY ? (dHeight - 1) - py : py;

            const bx = applyFlipX(Math.max(0, Math.min(dWidth - 1, Math.round(fx))));
            const by = applyFlipY(Math.max(0, Math.min(dHeight - 1, Math.round(fy))));

            const nChannels = rawNormal.info.channels;
            const idx = (by * dWidth + bx) * nChannels;

            // R: X-axis (-1 left to 1 right)
            // G: Y-axis (-1 down to 1 up)
            // B: Z-axis (forward)
            const r = rawNormal.data[idx];
            const g = rawNormal.data[idx + 1];

            // Remap [0, 255] to [-1.0, 1.0]
            // Standard normal map: R=128, G=128 is "flat" (facing camera)
            const nx = (r / 255) * 2.0 - 1.0;
            // IMPORTANT: Normal map G channel conventions vary (DirectX vs OpenGL).
            // Usually Y goes *up*, but image coords go down. We assume standard +Y=Up.
            let ny = (g / 255) * 2.0 - 1.0;
            if (options.flipY) ny = -ny; // User flip might affect normal direction

            // The surface normal is (nx, ny, nz).
            // To hatch *along* the surface, we want a tangent.
            // Rotating the XY normal vector by 90Â° gives a tangent flow direction: [-ny, nx].
            let tx = -ny;
            let ty = nx;

            const len = Math.hypot(tx, ty);
            if (len < 0.001) return null; // Flat area: fallback

            return { vx: tx / len, vy: ty / len };
        };

        const baseAngleRad = (options.baseAngle || 45) * Math.PI / 180;
        const threshold = options.threshold ?? 0.95;
        const densityMultiplier = Math.max(0.1, options.density || 1.5);
        const steps = Math.floor(Math.max(1, options.shadingSteps || 5));

        const baseMinSpacing = 2.0;
        const minSpacing = baseMinSpacing / densityMultiplier;

        // Period controls: how many scan lines to skip per shading level
        const periodMin = Math.max(1, Math.round(options.minPeriod ?? 1));
        const periodMax = Math.max(periodMin, Math.round(options.maxPeriod ?? 6));
        // densityCurve: gamma exponent applied to the normalised darkness before mapping to period
        // <1 = more lines in dark areas (emphasises darks), >1 = sparsely spaced (emphasises lights)
        const densityCurve = Math.max(0.1, options.densityCurve ?? 1.0);

        // -------------------------------------------------------------------------
        // buildBoundary() runs the strand-accumulation contour scan, applies smoothing,
        // and returns a flat list of [x1,y1,x2,y2] segments in world (canvas) space.
        // These are used both for drawing the contour line AND for clipping hatch lines,
        // so both operations share exactly the same clean edge.
        // -------------------------------------------------------------------------
        interface Seg2D { x1: number; y1: number; x2: number; y2: number; }

        const buildBoundary = (bThresh: number): Seg2D[] => {
            const cSpacingY = minSpacing * 0.4;
            const cStepX = 0.25;
            const maxGap = Math.max(cSpacingY * 8, 3.0);

            type Strand = { pts: MakerJs.IPoint[] };
            let activeStrands: Strand[] = [];

            // Smooth weights [1,2,4,2,1]/10
            const smW = [1, 2, 4, 2, 1];
            const smWsum = 10;

            const smoothPts = (pts: MakerJs.IPoint[]): MakerJs.IPoint[] =>
                pts.map((_, i) => {
                    let sx = 0, sy = 0;
                    for (let k = -2; k <= 2; k++) {
                        const j = Math.max(0, Math.min(pts.length - 1, i + k));
                        sx += pts[j][0] * smW[k + 2];
                        sy += pts[j][1] * smW[k + 2];
                    }
                    return [sx / smWsum, sy / smWsum] as MakerJs.IPoint;
                });

            const resultSegs: Seg2D[] = [];

            const flushStrand = (s: Strand) => {
                if (s.pts.length < 2) return;
                const sm = smoothPts(s.pts);
                for (let i = 0; i < sm.length - 1; i++) {
                    resultSegs.push({ x1: sm[i][0], y1: sm[i][1], x2: sm[i + 1][0], y2: sm[i + 1][1] });
                }
            };

            for (let sy = 0; sy <= height; sy += cSpacingY) {
                const rowCrossings: MakerJs.IPoint[] = [];
                let prevD = 1.0, prevPx = 0.0;

                for (let sx = 0; sx <= width; sx += cStepX) {
                    const d = getDensity(sx, sy);
                    if ((prevD >= bThresh) !== (d >= bThresh) && d !== prevD) {
                        const t = (bThresh - prevD) / (d - prevD);
                        rowCrossings.push([prevPx + t * cStepX, sy]);
                    }
                    prevD = d; prevPx = sx;
                }

                const matchedStrand = new Set<number>();
                const matchedCross = new Set<number>();
                const nextStrands: Strand[] = [];

                for (let si = 0; si < activeStrands.length; si++) {
                    const lastPt = activeStrands[si].pts[activeStrands[si].pts.length - 1];
                    let bestDist = maxGap, bestCi = -1;
                    for (let ci = 0; ci < rowCrossings.length; ci++) {
                        if (matchedCross.has(ci)) continue;
                        const dist = Math.abs(rowCrossings[ci][0] - lastPt[0]);
                        if (dist < bestDist) { bestDist = dist; bestCi = ci; }
                    }
                    if (bestCi >= 0) {
                        matchedStrand.add(si); matchedCross.add(bestCi);
                        activeStrands[si].pts.push(rowCrossings[bestCi]);
                        nextStrands.push(activeStrands[si]);
                    }
                }
                for (let si = 0; si < activeStrands.length; si++) {
                    if (!matchedStrand.has(si)) flushStrand(activeStrands[si]);
                }
                for (let ci = 0; ci < rowCrossings.length; ci++) {
                    if (!matchedCross.has(ci)) nextStrands.push({ pts: [rowCrossings[ci]] });
                }
                activeStrands = nextStrands;
            }
            for (const s of activeStrands) flushStrand(s);
            return resultSegs;
        };

        // -------------------------------------------------------------------------
        // For a scan line at perpendicular offset y (in rotated frame), direction cosA/sinA,
        // find all x-parameters along the scan line where it crosses boundary segment seg.
        //
        // Scan point at param x: world = (cx + x * cosA - y * sinA,  cy + x * sinA + y * cosA)
        // Segment from A to B:   world = A + t * (B - A),  t in [0,1]
        //
        // 2x2 system (Cramer's rule):
        //   x * cosA - t * ddx = rx    where rx = Ax - cx + y * sinA
        //   x * sinA - t * ddy = ry          ry = Ay - cy - y * cosA
        //   det = ddx * sinA - cosA * ddy
        //   x   = (-rx * ddy + ry * ddx) / det
        //   t   = ( cosA * ry - sinA * rx) / det
        // -------------------------------------------------------------------------
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
                if (tSeg < -1e-6 || tSeg > 1 + 1e-6) continue;
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

                // â”€â”€ Determine active x-ranges for this scan line â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

                // â”€â”€ Emit hatch segments within each active range â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                for (const range of activeRanges) {
                    let currentSegment: MakerJs.IPoint[] = [];

                    const emitSeg = () => {
                        if (currentSegment.length === 2) {
                            const len = Math.hypot(
                                currentSegment[0][0] - currentSegment[1][0],
                                currentSegment[0][1] - currentSegment[1][1]
                            );
                            if (len > 0.5) {
                                model.models![`hatch_${angleOffset}_${lineIdCounter++}`] =
                                    new MakerJs.models.ConnectTheDots(false, [...currentSegment]);
                            }
                        }
                        currentSegment = [];
                    };

                    // Clip range endpoints to canvas and to xMin/xMax
                    const xStart = Math.max(xMin, range.xStart);
                    const xEnd = Math.min(xMax, range.xEnd);

                    for (let x = xStart; x <= xEnd; x = Math.min(x + stepX, xEnd)) {
                        const rx = cx + x * cosA - y * sinA;
                        const ry = cy + x * sinA + y * cosA;
                        const inBounds = rx >= 0 && rx <= width && ry >= 0 && ry <= height;
                        const dens = inBounds ? getDensity(rx, ry) : 1.0;

                        let draw = false;
                        if (inBounds && dens < threshold) {
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
                                const period = Math.round(periodMax * (1 - tCurved) + periodMin * tCurved);
                                if (lineIndex % period === 0) draw = true;
                            }
                        }

                        if (draw) {
                            if (currentSegment.length === 0) currentSegment.push([R(rx), R(ry)]);
                            else if (currentSegment.length === 1) currentSegment.push([R(rx), R(ry)]);
                            else currentSegment[1] = [R(rx), R(ry)];
                        } else if (currentSegment.length > 0) {
                            if (currentSegment.length < 2) currentSegment.push([R(rx), R(ry)]);
                            emitSeg();
                        }

                        if (x >= xEnd) break;
                    }

                    // Flush last segment â€” use exact boundary point as endpoint
                    if (currentSegment.length > 0) {
                        const endRx = cx + range.xEnd * cosA - y * sinA;
                        const endRy = cy + range.xEnd * sinA + y * cosA;
                        if (currentSegment.length < 2) currentSegment.push([R(endRx), R(endRy)]);
                        else currentSegment[1] = [R(endRx), R(endRy)];
                        emitSeg();
                    }
                }

                // â”€â”€ Fallback: no boundary â€” use density threshold scan â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                if (!boundarySegs || boundarySegs.length === 0) {
                    let prevDens = 1.0;
                    let prevRx = cx + xMin * cosA - y * sinA;
                    let prevRy = cy + xMin * sinA + y * cosA;
                    let prevDraw = false;
                    let currentSegment: MakerJs.IPoint[] = [];

                    const emitSeg = () => {
                        if (currentSegment.length === 2) {
                            const len = Math.hypot(currentSegment[0][0] - currentSegment[1][0], currentSegment[0][1] - currentSegment[1][1]);
                            if (len > 0.5) {
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
                        let draw = false;
                        if (inBounds && dens < threshold) {
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
                                const per = Math.round(periodMax * (1 - tC) + periodMin * tC);
                                if (lineIndex % per === 0) draw = true;
                            }
                        }
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
                        prevDens = dens; prevRx = rx; prevRy = ry; prevDraw = draw;
                    }
                    if (prevDraw && currentSegment.length >= 1) {
                        if (currentSegment.length === 1) currentSegment.push([R(prevRx), R(prevRy)]);
                        emitSeg();
                    }
                }
            }
        };

        // ── Streamline Hatching (Normal Map Driven) ─────────────────────────────
        const runStreamlineHatching = () => {
            const stepLen = 0.5; // mm per integration step
            const maxRadius = Math.hypot(width, height) / 2;
            const cx = width / 2;
            const cy = height / 2;

            const bThresh = options.contourThreshold ?? threshold;
            const boundary = buildBoundary(bThresh);

            // Spatial density tracking via a coarse grid
            // Grid cell size matches the minSpacing we want in the darkest areas.
            const cellSize = minSpacing / 2;
            const gridCols = Math.ceil(width / cellSize);
            const gridRows = Math.ceil(height / cellSize);
            const spatialGrid = new Int8Array(gridCols * gridRows);

            const getCell = (x: number, y: number) => {
                const c = Math.floor(x / cellSize);
                const r = Math.floor(y / cellSize);
                if (c < 0 || c >= gridCols || r < 0 || r >= gridRows) return -1;
                return r * gridCols + c;
            };

            let lineIdCounter = 0;
            const R = (v: number) => Math.round(v * 1000) / 1000;

            // Generate seed points on a grid across the canvas
            const seeds: { x: number, y: number }[] = [];
            const seedSpacing = minSpacing;
            for (let y = 0; y < height; y += seedSpacing) {
                const xOffset = (Math.floor(y / seedSpacing) % 2) * (seedSpacing / 2);
                for (let x = xOffset; x < width; x += seedSpacing) {
                    seeds.push({ x, y });
                }
            }

            // Randomize seed order
            for (let i = seeds.length - 1; i > 0; i--) {
                const j = Math.floor(Math.abs(Math.sin(i * 12.345)) * 10000) % (i + 1);
                [seeds[i], seeds[j]] = [seeds[j], seeds[i]];
            }

            const traceStreamline = (startX: number, startY: number) => {
                const startCell = getCell(startX, startY);
                if (startCell < 0 || spatialGrid[startCell] !== 0) return;

                const dens = getDensity(startX, startY);
                if (dens >= threshold) return; // Started in empty space

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
                        if (nDens >= threshold) {
                            const t = (threshold - dens) / (nDens - dens);
                            const edgeX = px + t * (nx - px);
                            const edgeY = py + t * (ny - py);
                            currentPath.push([R(edgeX), R(edgeY)]);
                            break;
                        }

                        const darkness = 1.0 - nDens;
                        let nd = Math.max(0, darkness - (1.0 - threshold)) / threshold;
                        nd = Math.min(1.0, nd);
                        const bi = Math.floor(nd * (steps - 0.001));

                        const tB = steps > 1 ? bi / (steps - 1) : 1;
                        const tC = Math.pow(tB, densityCurve);
                        const reqClearance = Math.max(1, Math.round(periodMax * (1 - tC) + periodMin * tC));

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

            for (const s of seeds) {
                traceStreamline(s.x, s.y);
            }

            if (options.drawContour && boundary.length > 0) {
                let contourId = 0;
                type CStrand = MakerJs.IPoint[];
                const strands: CStrand[] = [];
                const usedSeg = new Set<number>();

                for (let si = 0; si < boundary.length; si++) {
                    if (usedSeg.has(si)) continue;
                    usedSeg.add(si);
                    const strand: CStrand = [[boundary[si].x1, boundary[si].y1], [boundary[si].x2, boundary[si].y2]];
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
                        model.models![`contour_${contourId++}`] = new MakerJs.models.ConnectTheDots(false, strand);
                    }
                }
            }
        };

        // ── Main Execution Branch ─────────────────────────────────────────────────
        if (options.normalMap) {
            runStreamlineHatching();
        } else {
            const bThresh = options.contourThreshold ?? threshold;
            const boundary = buildBoundary(bThresh);

            // Pass null for boundary segments to force fallback exact density scanning, 
            // as the smoothed strand accumulator produces unclosed paths that break even-odd raycasts.
            runRasterHatching(0, null);
            if (options.crossHatch || (options.crossHatchChance || 0) > 0) {
                runRasterHatching(Math.PI / 2, null);
            }

            // Draw contour lines
            if (options.drawContour && boundary.length > 0) {
                let contourId = 0;
                type CStrand = MakerJs.IPoint[];
                const strands: CStrand[] = [];
                const usedSeg = new Set<number>();

                for (let si = 0; si < boundary.length; si++) {
                    if (usedSeg.has(si)) continue;
                    usedSeg.add(si);
                    const strand: CStrand = [[boundary[si].x1, boundary[si].y1], [boundary[si].x2, boundary[si].y2]];
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
                        model.models![`contour_${contourId++}`] = new MakerJs.models.ConnectTheDots(false, strand);
                    }
                }
            }
        }

        return model;
    }
}
