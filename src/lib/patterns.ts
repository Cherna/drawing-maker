import MakerJs from 'makerjs';
import { NoisePatterns, seededRandom } from './noise-patterns';

export class Patterns {
    /**
     * Horizontal stripes
     */
    static Stripes(count: number, width: number, height: number): MakerJs.IModel {
        const model: MakerJs.IModel = { paths: {} };
        const step = height / count;

        for (let i = 0; i <= count; i++) {
            const y = i * step;
            model.paths![`s_${i}`] = new MakerJs.paths.Line([0, y], [width, y]);
        }

        return model;
    }

    /**
     * Vertical stripes
     */
    static VerticalStripes(count: number, width: number, height: number): MakerJs.IModel {
        const model: MakerJs.IModel = { paths: {} };
        const step = width / count;

        for (let i = 0; i <= count; i++) {
            const x = i * step;
            model.paths![`v_${i}`] = new MakerJs.paths.Line([x, 0], [x, height]);
        }

        return model;
    }

    /**
     * Grid pattern - horizontal and vertical lines
     */
    static Grid(
        countX: number,
        countY: number,
        width: number,
        height: number,
        options?: { fillChance?: number, seed?: number }
    ): MakerJs.IModel {
        const model: MakerJs.IModel = { paths: {}, models: {} };
        const stepX = width / countX;
        const stepY = height / countY;

        // Horizontal lines
        for (let i = 0; i <= countY; i++) {
            const y = i * stepY;
            // Shorten slightly to prevent loop detection of the grid border
            model.paths![`h_${i}`] = new MakerJs.paths.Line([0.01, y], [width - 0.01, y]);
        }

        // Vertical lines
        for (let i = 0; i <= countX; i++) {
            const x = i * stepX;
            // Shorten slightly to prevent loop detection of the grid border
            model.paths![`v_${i}`] = new MakerJs.paths.Line([x, 0.01], [x, height - 0.01]);
        }

        // Randomly fill cells
        const chance = options?.fillChance ?? 0;
        const seed = options?.seed ?? 0;

        if (chance > 0) {
            for (let i = 0; i < countX; i++) {
                for (let j = 0; j < countY; j++) {
                    // Unique seed per cell based on global seed
                    // Simple hash or just adding numbers (seededRandom usually takes a number)
                    // If seededRandom takes a number, let's use a unique index
                    const cellSeed = seed + (i * countY + j);

                    if (seededRandom(cellSeed)() < chance) {
                        const x = i * stepX;
                        const y = j * stepY;

                        // Create a rectangle slightly smaller than the cell
                        const rect: MakerJs.IModel = new MakerJs.models.Rectangle(stepX * 0.8, stepY * 0.8);

                        // Mark as filled content
                        rect.layer = 'filled';

                        // Move to center of cell
                        const cx = x + stepX / 2;
                        const cy = y + stepY / 2;
                        MakerJs.model.center(rect);
                        MakerJs.model.move(rect, [cx, cy]);

                        model.models![`rect_${i}_${j}`] = rect;
                    }
                }
            }
        }

        return model;
    }

    /**
     * Concentric circles
     */
    static Concentric(
        count: number,
        width: number,
        height: number,
        options?: {
            centerX?: number,  // 0-1, default 0.5
            centerY?: number,  // 0-1, default 0.5
            minRadius?: number, // Starting radius, default 0
            checkBounds?: boolean // If true (default), clip to width/height. If false, allow circles to exceed bounds.
        }
    ): MakerJs.IModel {
        const model: MakerJs.IModel = { paths: {} };

        // Validate width and height are valid numbers
        const safeWidth = Number(width);
        const safeHeight = Number(height);

        if (!isFinite(safeWidth) || !isFinite(safeHeight) || safeWidth <= 0 || safeHeight <= 0) {
            console.warn(`Concentric: Invalid dimensions (width=${width}, height=${height}), returning empty model`);
            return model;
        }


        // Ensure inputs are numbers and valid
        const safeCount = Math.max(1, Math.floor(Number(count) || 20));

        // CRITICAL: Check for undefined BEFORE Number() to avoid NaN
        // Number(undefined) = NaN, and NaN ?? 0.5 = NaN (not 0.5!)
        const centerXVal = options?.centerX !== undefined ? Number(options.centerX) : 0.5;
        const centerYVal = options?.centerY !== undefined ? Number(options.centerY) : 0.5;
        const cx = centerXVal * safeWidth;
        const cy = centerYVal * safeHeight;

        const dx = Math.max(cx, safeWidth - cx);
        const dy = Math.max(cy, safeHeight - cy);
        const maxRadius = Math.hypot(dx, dy);
        const minRadius = Number(options?.minRadius) || 0;

        // Prevent division by zero or negative step
        if (minRadius >= maxRadius) return model;

        const step = (maxRadius - minRadius) / safeCount;
        const checkBounds = options?.checkBounds !== false; // Default to TRUE (clip)

        for (let i = 1; i <= safeCount; i++) {
            const r = minRadius + i * step;
            if (r > 0) {
                if (checkBounds) {
                    // Manual clipping to rectangle
                    const arcs = getClippedCircleTrimming(cx, cy, r, safeWidth, safeHeight);
                    arcs.forEach((path, idx) => {
                        model.paths![`c_${i}_${idx}`] = path;
                    });
                } else {
                    // No clipping - full circle
                    const circle = new MakerJs.paths.Circle([cx, cy], r);
                    model.paths![`c_${i}`] = circle;
                }
            }
        }

        return model;
    }


    /**
     * Spiral pattern
     */
    static Spiral(
        turns: number,
        width: number,
        height: number,
        options?: {
            centerX?: number,
            centerY?: number,
            pointsPerTurn?: number,
            startRadius?: number,
            direction?: 'cw' | 'ccw'
        }
    ): MakerJs.IModel {
        const model: MakerJs.IModel = { paths: {} };

        // Validate width and height
        const safeWidth = Number(width);
        const safeHeight = Number(height);
        if (!isFinite(safeWidth) || !isFinite(safeHeight) || safeWidth <= 0 || safeHeight <= 0) {
            console.warn(`Spiral: Invalid dimensions (width=${width}, height=${height}), returning empty model`);
            return model;
        }

        const cx = (options?.centerX ?? 0.5) * safeWidth;
        const cy = (options?.centerY ?? 0.5) * safeHeight;
        const maxRadius = Math.min(safeWidth, safeHeight) / 2;
        const startRadius = options?.startRadius ?? 0;
        const pointsPerTurn = options?.pointsPerTurn ?? 36;
        const direction = options?.direction === 'ccw' ? -1 : 1;

        const totalPoints = turns * pointsPerTurn;
        const radiusStep = (maxRadius - startRadius) / totalPoints;
        const angleStep = (2 * Math.PI) / pointsPerTurn * direction;

        let prevPoint: MakerJs.IPoint = [cx + startRadius, cy];

        for (let i = 1; i <= totalPoints; i++) {
            const angle = i * angleStep;
            const r = startRadius + i * radiusStep;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            const currentPoint: MakerJs.IPoint = [x, y];

            model.paths![`sp_${i}`] = new MakerJs.paths.Line(prevPoint, currentPoint);
            prevPoint = currentPoint;
        }

        return model;
    }

    /**
     * Radial lines emanating from center
     */
    static Radial(
        count: number,
        width: number,
        height: number,
        options?: {
            centerX?: number,
            centerY?: number,
            innerRadius?: number, // 0-1, normalized to min dimension
            outerRadius?: number  // 0-1, normalized to min dimension
        }
    ): MakerJs.IModel {
        const model: MakerJs.IModel = { paths: {} };

        // Validate width and height
        const safeWidth = Number(width);
        const safeHeight = Number(height);
        if (!isFinite(safeWidth) || !isFinite(safeHeight) || safeWidth <= 0 || safeHeight <= 0) {
            console.warn(`Radial: Invalid dimensions (width=${width}, height=${height}), returning empty model`);
            return model;
        }

        const cx = (options?.centerX ?? 0.5) * safeWidth;
        const cy = (options?.centerY ?? 0.5) * safeHeight;
        const scale = Math.min(safeWidth, safeHeight) / 2;
        const innerR = (options?.innerRadius ?? 0) * scale;
        const outerR = (options?.outerRadius ?? 1) * scale;

        const angleStep = (2 * Math.PI) / count;

        for (let i = 0; i < count; i++) {
            const angle = i * angleStep;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            const x1 = cx + innerR * cos;
            const y1 = cy + innerR * sin;
            const x2 = cx + outerR * cos;
            const y2 = cy + outerR * sin;

            model.paths![`r_${i}`] = new MakerJs.paths.Line([x1, y1], [x2, y2]);
        }

        return model;
    }

    /**
     * Wave pattern - sinusoidal horizontal lines
     */
    static Waves(
        count: number,
        width: number,
        height: number,
        options?: {
            amplitude?: number,    // Wave height
            frequency?: number,    // Waves per width
            phase?: number,        // Starting phase (0-1)
            segments?: number      // Line segments per wave
        }
    ): MakerJs.IModel {
        const model: MakerJs.IModel = { paths: {} };

        // Validate width and height
        const safeWidth = Number(width);
        const safeHeight = Number(height);
        if (!isFinite(safeWidth) || !isFinite(safeHeight) || safeWidth <= 0 || safeHeight <= 0) {
            console.warn(`Waves: Invalid dimensions (width=${width}, height=${height}), returning empty model`);
            return model;
        }

        const amplitude = options?.amplitude ?? safeHeight / (count * 4);
        const frequency = options?.frequency ?? 3;
        const phase = (options?.phase ?? 0) * Math.PI * 2;
        const segments = options?.segments ?? 50;
        const stepY = safeHeight / count;

        for (let row = 0; row <= count; row++) {
            const baseY = row * stepY;
            const segWidth = safeWidth / segments;

            for (let seg = 0; seg < segments; seg++) {
                const x1 = seg * segWidth;
                const x2 = (seg + 1) * segWidth;
                const angle1 = (x1 / safeWidth) * frequency * Math.PI * 2 + phase;
                const angle2 = (x2 / safeWidth) * frequency * Math.PI * 2 + phase;
                const y1 = baseY + Math.sin(angle1) * amplitude;
                const y2 = baseY + Math.sin(angle2) * amplitude;

                model.paths![`w_${row}_${seg}`] = new MakerJs.paths.Line([x1, y1], [x2, y2]);
            }
        }
        return model;
    }

    /**
     * Gilbert Curve (Generalized Randomized Hilbert Curve)
     * Fills a generic rectangle.
     */
    static Gilbert(
        width: number,
        height: number,
        options?: {
            scale?: number; // Size of the grid cells.
        }
    ): MakerJs.IModel {
        const model: MakerJs.IModel = { paths: {} };
        const safeWidth = Number(width);
        const safeHeight = Number(height);

        if (safeWidth <= 0 || safeHeight <= 0) return model;

        const scale = Math.max(0.1, options?.scale || 10);

        // Calculate grid dimensions
        const cols = Math.max(1, Math.floor(safeWidth / scale));
        const rows = Math.max(1, Math.floor(safeHeight / scale));

        const points: MakerJs.IPoint[] = [];

        // Center the pattern
        const actualW = cols * scale;
        const actualH = rows * scale;
        const offsetX = (safeWidth - actualW) / 2;
        const offsetY = (safeHeight - actualH) / 2;

        const sgn = (mathX: number) => mathX > 0 ? 1 : (mathX < 0 ? -1 : 0);

        // Generalized Hilbert Curve recursive function
        const gilbert = (x: number, y: number, ax: number, ay: number, bx: number, by: number) => {
            const w = Math.abs(ax + ay);
            const h = Math.abs(bx + by);
            const da = sgn(ax + ay);
            const db = sgn(bx + by);

            if (h === 1) {
                // Line along A
                const dx = sgn(ax);
                const dy = sgn(ay);
                for (let i = 0; i < w; i++)
                    points.push([offsetX + (x + i * dx + 0.5) * scale, offsetY + (y + i * dy + 0.5) * scale]);
                return;
            }
            if (w === 1) {
                // Line along B
                const dx = sgn(bx);
                const dy = sgn(by);
                for (let i = 0; i < h; i++)
                    points.push([offsetX + (x + i * dx + 0.5) * scale, offsetY + (y + i * dy + 0.5) * scale]);
                return;
            }

            // Split
            let ax2 = Math.floor(w / 2) * sgn(ax);
            let ay2 = Math.floor(w / 2) * sgn(ay);
            let bx2 = Math.floor(h / 2) * sgn(bx);
            let by2 = Math.floor(h / 2) * sgn(by);

            // Remainder vectors
            let axRem = ax - ax2;
            let ayRem = ay - ay2;
            let bxRem = bx - bx2;
            let byRem = by - by2;

            if (w > h) {
                // Split A axis
                gilbert(x, y, bx, by, ax2, ay2);
                gilbert(x + ax2, y + ay2, axRem, ayRem, bx, by);
            } else {
                // Split B axis
                gilbert(x, y, ax, ay, bx2, by2);
                gilbert(
                    x + bx2 + ax,
                    y + by2 + ay,
                    -ax,
                    -ay,
                    bxRem,
                    byRem
                );
            }
        };

        // Start recursion
        gilbert(0, 0, cols, 0, 0, rows);

        const chain: MakerJs.IModel = { paths: {} };
        for (let i = 0; i < points.length - 1; i++) {
            chain.paths![`s_${i}`] = new MakerJs.paths.Line(points[i], points[i + 1]);
        }

        return chain;
    }

    /**
     * Slices a 3D Gyroid at z.
     */
    static Gyroid(
        width: number,
        height: number,
        options?: {
            scale?: number;     // Zoom.
            z?: number;         // Z-slice
            threshold?: number; // Line thickness (creates double contour)
        }
    ): MakerJs.IModel {
        const model: MakerJs.IModel = { paths: {} };
        const safeWidth = Number(width);
        const safeHeight = Number(height);

        if (safeWidth <= 0 || safeHeight <= 0) return model;

        const scaleParam = Math.max(0.01, options?.scale || 1);
        const scaleVal = scaleParam * 0.2; // Scaling factor for math
        const z = (options?.z || 0) * scaleVal;
        const threshold = Math.min(0.9, Math.max(0, options?.threshold || 0)); // 0 = single line, >0 = double line

        // Calculate resolution to avoid aliasing
        // Period is roughly 2PI / scaleVal.
        // We want at least 10 samples per period.
        const period = 2 * Math.PI / scaleVal;
        const res = Math.max(1, Math.min(10, Math.floor(period / 10)));

        // Function
        const getVal = (x: number, y: number) => {
            const sx = x * scaleVal;
            const sy = y * scaleVal;
            return Math.sin(sx) * Math.cos(sy) + Math.sin(sy) * Math.cos(z) + Math.sin(z) * Math.cos(sx);
        };

        // If threshold == 0, simple 0-iso (marching squares for >0)
        // If threshold > 0, we want band between -th and +th? 
        // Or lines at -th and +th.

        const targets = threshold > 0 ? [-threshold, threshold] : [0];

        targets.forEach((targetIso, targetIdx) => {
            const cols = Math.ceil(safeWidth / res);
            const rows = Math.ceil(safeHeight / res);

            for (let j = 0; j < rows; j++) {
                for (let i = 0; i < cols; i++) {
                    const x0 = i * res;
                    const y0 = j * res;
                    const x1 = (i + 1) * res;
                    const y1 = (j + 1) * res;

                    // Get values relative to targetIso
                    const v0 = getVal(x0, y0) - targetIso;
                    const v1 = getVal(x1, y0) - targetIso;
                    const v2 = getVal(x1, y1) - targetIso;
                    const v3 = getVal(x0, y1) - targetIso;

                    const b0 = v0 > 0 ? 1 : 0;
                    const b1 = v1 > 0 ? 2 : 0;
                    const b2 = v2 > 0 ? 4 : 0;
                    const b3 = v3 > 0 ? 8 : 0;
                    const type = b0 | b1 | b2 | b3;

                    if (type === 0 || type === 15) continue;

                    const lerp = (va: number, vb: number, posA: number, posB: number) => {
                        if (Math.abs(vb - va) < 0.0001) return posA;
                        return posA + (0 - va) / (vb - va) * (posB - posA);
                    };

                    const ptT = [lerp(v0, v1, x0, x1), y0] as MakerJs.IPoint;
                    const ptR = [x1, lerp(v1, v2, y0, y1)] as MakerJs.IPoint;
                    const ptB = [lerp(v3, v2, x0, x1), y1] as MakerJs.IPoint;
                    const ptL = [x0, lerp(v0, v3, y0, y1)] as MakerJs.IPoint;

                    const addLine = (currP1: MakerJs.IPoint, currP2: MakerJs.IPoint) => {
                        model.paths![`g_${targetIdx}_${i}_${j}_${Math.random()}`] = new MakerJs.paths.Line(currP1, currP2);
                    };

                    switch (type) {
                        case 1: case 14: addLine(ptL, ptT); break;
                        case 2: case 13: addLine(ptT, ptR); break;
                        case 3: case 12: addLine(ptL, ptR); break;
                        case 4: case 11: addLine(ptR, ptB); break;
                        case 5: addLine(ptL, ptT); addLine(ptR, ptB); break;
                        case 6: case 9: addLine(ptT, ptB); break;
                        case 7: case 8: addLine(ptL, ptB); break;
                        case 10: addLine(ptL, ptB); addLine(ptT, ptR); break;
                    }
                }
            }
        });

        return model;
    }

    /**
     * Honeycomb (Hexagonal Grid)
     */
    /**
     * Honeycomb (Hexagonal Grid)
     */
    static Honeycomb(
        width: number,
        height: number,
        options?: {
            radius?: number;
            gap?: number;
            rotation?: number; // Rotation in degrees
        }
    ): MakerJs.IModel {
        const model: MakerJs.IModel = { models: {}, paths: {} };
        const safeWidth = Number(width);
        const safeHeight = Number(height);
        const r = options?.radius || 10;
        const gap = options?.gap || 0;
        const rotation = (options?.rotation || 0) * Math.PI / 180; // Convert to radians

        const effectiveR = r + gap;
        const w = Math.sqrt(3) * effectiveR;
        const vertStep = 1.5 * effectiveR;
        const horzStep = w;

        // Calculate grid bounds
        // Expand slightly to ensure we cover edges
        const cols = Math.ceil(safeWidth / horzStep) + 2;
        const rows = Math.ceil(safeHeight / vertStep) + 2;

        const isConnected = gap <= 0.01;

        // For connected honeycomb, we track unique edges to avoid double-drawing
        const edges = new Map<string, MakerJs.IPath>();
        const edgeKey = (p1: MakerJs.IPoint, p2: MakerJs.IPoint) => {
            // Round to avoid float precision issues specific to checking equality
            const precision = 3;
            const x1 = Number(p1[0].toFixed(precision));
            const y1 = Number(p1[1].toFixed(precision));
            const x2 = Number(p2[0].toFixed(precision));
            const y2 = Number(p2[1].toFixed(precision));

            // Sort points to make key canonical (directionless)
            if (x1 < x2 || (x1 === x2 && y1 < y2)) {
                return `${x1},${y1}|${x2},${y2}`;
            } else {
                return `${x2},${y2}|${x1},${y1}`;
            }
        };

        let idx = 0;

        for (let j = -1; j <= rows; j++) {
            // Serpentine order for separated hexes to minimize travel
            // (For connected hexes, the order matters less as we are collecting edges, 
            // but might as well keep it for consistency or potential slight optimization in map insertion)
            const isEvenRow = j % 2 === 0;
            const iStart = -2;
            const iEnd = cols;

            // Create range array
            const iRange: number[] = [];
            for (let i = iStart; i <= iEnd; i++) iRange.push(i);

            // Reverse for serpentine if needed (only matters for separated mode output order)
            // If connected, we are just building a Set, so order is irrelevant for output.
            if (!isEvenRow && !isConnected) {
                iRange.reverse();
            }

            for (const i of iRange) {
                const xOffset = (j % 2 !== 0) ? w / 2 : 0;
                const cx = i * horzStep + xOffset;
                const cy = j * vertStep;

                // Bounds check - allow partial hexes if they overlap the drawing area
                // Check if center is reasonably close to bounds
                if (cx < -r * 2 || cx > safeWidth + r * 2 || cy < -r * 2 || cy > safeHeight + r * 2) continue;

                // Calculate vertices
                const points: MakerJs.IPoint[] = [];
                for (let k = 0; k < 6; k++) {
                    const ang = (30 + 60 * k) * Math.PI / 180 + rotation;
                    points.push([
                        cx + r * Math.cos(ang),
                        cy + r * Math.sin(ang)
                    ]);
                }

                if (isConnected) {
                    // Add each edge to map
                    for (let k = 0; k < 6; k++) {
                        const p1 = points[k];
                        const p2 = points[(k + 1) % 6];

                        // Check if edge is within bounds (simplified clipping)
                        // If both points are way outside, skip? 
                        // Real logic: If we want to support clipping properly, we rely on the implementation 
                        // to handle it later or we should check bounds.
                        // For now, we add all generating edges and relying on 'clip' modifier later if user wants clipping.
                        // But we should at least check if the edge is arguably relevant to the canvas.

                        const key = edgeKey(p1, p2);
                        if (!edges.has(key)) {
                            edges.set(key, new MakerJs.paths.Line(p1, p2));
                        }
                    }
                } else {
                    // Separated - create closed hexagon model
                    const hex = new MakerJs.models.ConnectTheDots(true, points);
                    model.models![`h_${idx++}`] = hex;
                }
            }
        }

        if (isConnected) {
            // Convert collected edges to paths
            let edgeIdx = 0;
            edges.forEach((line) => {
                model.paths![`e_${edgeIdx++}`] = line;
            });
        }

        return model;
    }

    /**
     * Phyllotaxis (Sunflower Spiral)
     */
    static Phyllotaxis(
        width: number,
        height: number,
        options?: {
            count?: number;
            spacing?: number;
            flower?: number;
            size?: number; // Point size
        }
    ): MakerJs.IModel {
        const model: MakerJs.IModel = { paths: {} };
        const count = options?.count || 500;
        const c = options?.spacing || 5;
        const angleDeg = options?.flower || 137.5;
        const angleRad = angleDeg * Math.PI / 180;
        const pointSize = options?.size || 0; // 0 = auto

        const cx = width / 2;
        const cy = height / 2;

        for (let n = 0; n < count; n++) {
            const phi = n * angleRad;
            const r = c * Math.sqrt(n);

            const x = cx + r * Math.cos(phi);
            const y = cy + r * Math.sin(phi);

            const seedRadius = pointSize > 0 ? pointSize : Math.max(0.5, c / 3);
            model.paths![`p_${n}`] = new MakerJs.paths.Circle([x, y], seedRadius);
        }
        return model;
    }

    /**
     * Isometric Grid (Triangles)
     */
    static IsometricGrid(
        width: number,
        height: number,
        options?: {
            size?: number;
        }
    ): MakerJs.IModel {
        const model: MakerJs.IModel = { models: {} };
        const size = options?.size || 20;

        // An Isometric grid is composed of 3 sets of parallel lines: 0, 60, 120 degrees.
        // All intersecting at common points.

        // Set 1: Horizontal (0 deg)
        // Calculate spacing.
        // For a triangle grid of side L (size), height is sqrt(3)/2 * L.
        // The horizontal lines are spaced by this height.
        const heightTri = (Math.sqrt(3) / 2) * size;

        // We reuse the Hatching generator logic but need to be careful about line count/spacing.
        // Hatching takes "count" over the diagonal.
        // We want specific spacing.
        // Let's implement manually using Hatching's underlying clipping logic but controlling precise spacing.

        // Actually, Hatching(count) calculates spacing = diag / count.
        // We want spacing = heightTri.
        // So count = diag / heightTri.
        const diag = Math.hypot(width, height);
        const count = Math.ceil(diag / heightTri);

        // 0 degrees
        model.models!['iso_0'] = Patterns.Hatching(count, width, height, { angle: 0 });

        // 60 degrees
        model.models!['iso_60'] = Patterns.Hatching(count, width, height, { angle: 60 });

        // 120 degrees
        model.models!['iso_120'] = Patterns.Hatching(count, width, height, { angle: 120 });

        return model;
    }

    /**
     * Diagonal hatching
     */

    static Hatching(
        count: number,
        width: number,
        height: number,
        options?: {
            angle?: number,       // Degrees, default 45
            bidirectional?: boolean  // Cross-hatch
        }
    ): MakerJs.IModel {
        const model: MakerJs.IModel = { paths: {} };

        // Validate width and height
        const safeWidth = Number(width);
        const safeHeight = Number(height);
        if (!isFinite(safeWidth) || !isFinite(safeHeight) || safeWidth <= 0 || safeHeight <= 0) {
            console.warn(`Hatching: Invalid dimensions (width=${width}, height=${height}), returning empty model`);
            return model;
        }

        const angle = (options?.angle ?? 45) * Math.PI / 180;
        const bidirectional = options?.bidirectional ?? false;

        // Calculate line spacing
        const diag = Math.hypot(safeWidth, safeHeight);
        const spacing = diag / count;

        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        // Liang-Barsky line clipping algorithm
        const clipLine = (x1: number, y1: number, x2: number, y2: number): [number, number, number, number] | null => {
            let t0 = 0, t1 = 1;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const p = [-dx, dx, -dy, dy];
            const q = [x1 - 0, safeWidth - x1, y1 - 0, safeHeight - y1];

            for (let i = 0; i < 4; i++) {
                if (p[i] === 0) {
                    if (q[i] < 0) return null; // Parallel and outside
                } else {
                    const t = q[i] / p[i];
                    if (p[i] < 0) {
                        if (t > t1) return null;
                        if (t > t0) t0 = t;
                    } else {
                        if (t < t0) return null;
                        if (t < t1) t1 = t;
                    }
                }
            }

            if (t0 > t1) return null;

            return [
                x1 + t0 * dx,
                y1 + t0 * dy,
                x1 + t1 * dx,
                y1 + t1 * dy
            ];
        };

        // Generate parallel lines
        const generateLines = (ang: number, prefix: string) => {
            const c = Math.cos(ang);
            const s = Math.sin(ang);
            const perpC = -s;
            const perpS = c;

            // Start from corner and move perpendicular to line direction
            for (let i = -count; i <= count * 2; i++) {
                const offset = i * spacing;
                const startX = safeWidth / 2 + perpC * offset;
                const startY = safeHeight / 2 + perpS * offset;

                // Extend line in both directions
                const x1 = startX - c * diag;
                const y1 = startY - s * diag;
                const x2 = startX + c * diag;
                const y2 = startY + s * diag;

                // Clip line to bounds using Liang-Barsky algorithm
                const clipped = clipLine(x1, y1, x2, y2);
                if (clipped) {
                    model.paths![`${prefix}_${i}`] = new MakerJs.paths.Line(
                        [clipped[0], clipped[1]],
                        [clipped[2], clipped[3]]
                    );
                }
            }
        };

        generateLines(angle, 'h');
        if (bidirectional) {
            generateLines(-angle, 'hb');
        }

        return model;
    }

    /**
     * Flow Field
     * Traces paths through a noise field
     */
    static FlowField(
        width: number,
        height: number,
        options?: {
            count?: number;
            stepSize?: number;
            steps?: number;
            noiseScale?: number;
            distortion?: number;
            noiseType?: string;
            octaves?: number;
            persistence?: number;
            lacunarity?: number;
            seed?: number;
        }
    ): MakerJs.IModel {
        const model: MakerJs.IModel = { paths: {} };
        const safeWidth = Number(width);
        const safeHeight = Number(height);

        if (safeWidth <= 0 || safeHeight <= 0) return model;

        const count = options?.count || 500;
        const stepSize = options?.stepSize || 1;
        const maxSteps = options?.steps || 100;
        const noiseScale = options?.noiseScale || 0.002;
        const distortion = options?.distortion || 1;
        const seed = options?.seed || 0;
        const noiseType = options?.noiseType || 'simplex';

        // Noise Params
        const noiseParams = {
            scale: noiseScale,
            octaves: options?.octaves || 1,
            persistence: options?.persistence || 0.5,
            lacunarity: options?.lacunarity || 2,
            distortion: 0 // Not relevant for flow field angle itself usually, or we could use it?
            // Actually 'distortion' param in options acts as 'Angle Scale' here.
        };

        // Use our NoisePatterns class
        const noise = new NoisePatterns(seed);

        // Simple seeded random for starting positions
        const rng = seededRandom(seed);

        for (let i = 0; i < count; i++) {
            let x = rng() * safeWidth;
            let y = rng() * safeHeight;

            const points: MakerJs.IPoint[] = [[x, y]];

            for (let s = 0; s < maxSteps; s++) {
                // Get value from noise
                const n = noise.get(noiseType as any, x, y, noiseParams, seed);

                // Map to angle
                // Noise is typically 0..1 (from noise.get)
                // Map to 0..2PI
                const angle = n * Math.PI * 2 * distortion;

                const nextX = x + Math.cos(angle) * stepSize;
                const nextY = y + Math.sin(angle) * stepSize;

                // Stop if out of bounds
                if (nextX < 0 || nextX > safeWidth || nextY < 0 || nextY > safeHeight) {
                    break;
                }

                points.push([nextX, nextY]);
                x = nextX;
                y = nextY;
            }

            if (points.length > 1) {
                // Use ConnectTheDots to create the path
                // We store each line as a separate model to ensure it's treated as a polyline if possible,
                // or just a path if ConnectTheDots returns a single path (it returns a model with paths usually).
                model.models = model.models || {};
                model.models[`line_${i}`] = new MakerJs.models.ConnectTheDots(false, points);
            }
        }

        return model;
    }

    /**
     * Superformula
     * Generates complex organic shapes
     */
    static Superformula(
        width: number,
        height: number,
        options?: {
            radius?: number;
            m?: number;
            n1?: number;
            n2?: number;
            n3?: number;
            a?: number;
            b?: number;
            stepSize?: number;
            count?: number;
            scaleStep?: number;
            rotateStep?: number;
            morphStep?: number;
        }
    ): MakerJs.IModel {
        const model: MakerJs.IModel = { models: {} };
        const safeWidth = Number(width);
        const safeHeight = Number(height);
        const cx = safeWidth / 2;
        const cy = safeHeight / 2;

        let currentRadius = options?.radius || 50;
        const m = options?.m ?? 0;
        let n1 = options?.n1 || 1;
        let n2 = options?.n2 || 1;
        let n3 = options?.n3 || 1;
        const a = options?.a || 1;
        const b = options?.b || 1;

        const count = Math.max(1, options?.count || 1);
        const scaleStep = options?.scaleStep || 0.9;
        const rotateStep = (options?.rotateStep || 0) * (Math.PI / 180); // Convert to radians
        const morphStep = options?.morphStep || 0;

        let currentRotation = 0;

        // Resolution
        const numPoints = 1000; // Optimal resolution
        const phiStep = (Math.PI * 2) / numPoints;

        for (let k = 0; k < count; k++) {
            const points: MakerJs.IPoint[] = [];

            for (let i = 0; i <= numPoints; i++) {
                const phi = i * phiStep;

                // Superformula: r = (|cos(m*phi/4)/a|^n2 + |sin(m*phi/4)/b|^n3)^(-1/n1)
                let t1 = Math.cos(m * phi / 4) / a;
                t1 = Math.abs(t1);
                t1 = Math.pow(t1, n2);

                let t2 = Math.sin(m * phi / 4) / b;
                t2 = Math.abs(t2);
                t2 = Math.pow(t2, n3);

                const r = Math.pow(t1 + t2, -1 / n1);

                if (!isFinite(r)) continue;

                const finalR = r * currentRadius;

                // Apply rotation
                const theta = phi + currentRotation;

                const x = cx + finalR * Math.cos(theta);
                const y = cy + finalR * Math.sin(theta);

                points.push([x, y]);
            }

            if (points.length > 2) {
                model.models![`shape_${k}`] = new MakerJs.models.ConnectTheDots(true, points);
            }

            // Update state for next iteration
            currentRadius *= scaleStep;
            currentRotation += rotateStep;
            n1 = Math.max(0.01, n1 + morphStep);
            n2 = Math.max(0.01, n2 + morphStep);
            n3 = Math.max(0.01, n3 + morphStep);

            // Stop if too small
            if (currentRadius < 1) break;
        }

        return model;
    }

    /**
     * Truchet Tiles
     * Grid-based patterns with random rotations
     */
    static Truchet(
        width: number,
        height: number,
        options?: {
            tileSize?: number;
            style?: 'arcs' | 'lines' | 'checkered';
            seed?: number;
            radiusFactor?: number;
        }
    ): MakerJs.IModel {
        const model: MakerJs.IModel = { models: {} };
        // Fallback for debugging: if width/height are suspiciously small or missing
        const safeWidth = Number(width) > 0 ? Number(width) : 500;
        const safeHeight = Number(height) > 0 ? Number(height) : 500;

        console.log(`[Truchet] Input: ${width}x${height}, Safe: ${safeWidth}x${safeHeight}, Tile: ${options?.tileSize}`);
        const tileSize = Math.max(1, options?.tileSize || 50);
        const style = options?.style || 'arcs';
        const seed = options?.seed || 0;
        const radiusFactor = options?.radiusFactor || 0.5;

        const cols = Math.ceil(safeWidth / tileSize);
        const rows = Math.ceil(safeHeight / tileSize);

        const rng = seededRandom(seed);

        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                const x = i * tileSize;
                const y = j * tileSize;

                // Random orientation: 0, 1, 2, 3 (times 90 degrees)
                const orientation = Math.floor(rng() * 4);

                // Create tile content
                const tileModel: MakerJs.IModel = { paths: {} };
                // The radius for arcs. A factor of 0.5 means the arcs connect midpoints of the tile edges.
                const half = tileSize * radiusFactor;

                if (style === 'arcs') {
                    // Standard Smith Truchet: Two arcs
                    // The "standard" connects midpoints, which is radius = 0.5 * tileSize.
                    // Varying this creates separate unconnected arcs or overlapping ones.
                    tileModel.paths!.arc1 = new MakerJs.paths.Arc([0, 0], half, 0, 90);
                    tileModel.paths!.arc2 = new MakerJs.paths.Arc([tileSize, tileSize], half, 180, 270);

                } else if (style === 'lines') {
                    // Diagonal lines connecting edge midpoints
                    tileModel.paths!.line1 = new MakerJs.paths.Line([0, half], [half, 0]);
                    tileModel.paths!.line2 = new MakerJs.paths.Line([tileSize, half], [half, tileSize]);

                } else if (style === 'checkered') {
                    // Simple diagonal for test
                    tileModel.paths!.line1 = new MakerJs.paths.Line([0, 0], [tileSize, tileSize]);
                }

                // Rotate tile
                if (orientation > 0) {
                    MakerJs.model.rotate(tileModel, orientation * 90, [tileSize / 2, tileSize / 2]);
                }

                // Move to position
                MakerJs.model.move(tileModel, [x, y]);

                // CRITICAL: Bake the move into the geometry so it persists through modifiers that ignore 'origin'
                MakerJs.model.originate(tileModel, [0, 0]);

                model.models![`tile_${i}_${j}`] = tileModel;
            }
        }

        return model;
    }

    /**
     * Circle Packing
     * Fills space with non-overlapping circles
     */
    static CirclePacking(
        width: number,
        height: number,
        options?: {
            minRadius?: number;
            maxRadius?: number;
            padding?: number;
            count?: number; // Number of attempts
            seed?: number;
        }
    ): MakerJs.IModel {
        const model: MakerJs.IModel = { paths: {} };
        const safeWidth = Number(width) > 0 ? Number(width) : 500;
        const safeHeight = Number(height) > 0 ? Number(height) : 500;

        const minRadius = options?.minRadius ?? 2;
        const maxRadius = options?.maxRadius ?? 50;
        const padding = options?.padding ?? 2;
        const attempts = options?.count || 1000;
        const seed = options?.seed || 0;

        const rng = seededRandom(seed);
        const circles: { x: number, y: number, r: number }[] = [];

        // Try to place circles
        for (let i = 0; i < attempts; i++) {
            const x = rng() * safeWidth;
            const y = rng() * safeHeight;

            // Initial safe radius (distance to walls)
            let safeR = Math.min(
                x,
                y,
                safeWidth - x,
                safeHeight - y
            );

            // Subtract padding logic
            safeR = safeR - padding;

            if (safeR < minRadius) continue;

            // Check against all existing circles
            let intersect = false;
            for (const c of circles) {
                const dx = x - c.x;
                const dy = y - c.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Distance to surface of existing circle
                const distToSurface = dist - c.r - padding;

                if (distToSurface < minRadius) {
                    intersect = true;
                    break;
                }

                // Shrink safeR if this neighbor is closer than current safeR
                if (distToSurface < safeR) {
                    safeR = distToSurface;
                }
            }

            if (!intersect && safeR >= minRadius) {
                // Place circle
                const r = Math.min(maxRadius, safeR);
                circles.push({ x, y, r });

                model.paths![`c_${i}`] = new MakerJs.paths.Circle([x, y], r);
            }
        }

        return model;
    }

    /**
     * Voronoi Diagram
     * Cellular noise patterns
     */
    static Voronoi(
        width: number,
        height: number,
        options?: {
            count?: number;
            padding?: number;
            relaxation?: number;
            seed?: number;
        }
    ): MakerJs.IModel {
        const model: MakerJs.IModel = { models: {} };
        const safeWidth = Number(width) > 0 ? Number(width) : 500;
        const safeHeight = Number(height) > 0 ? Number(height) : 500;

        const count = options?.count || 50;
        const padding = options?.padding || 0;
        const relaxation = options?.relaxation || 0;
        const seed = options?.seed || 0;

        const rng = seededRandom(seed);
        let points: { x: number, y: number }[] = [];

        // Generate random points
        for (let i = 0; i < count; i++) {
            points.push({
                x: rng() * safeWidth,
                y: rng() * safeHeight
            });
        }

        // Half-plane clipper helper
        const clipByHalfPlane = (subject: [number, number][], normal: { x: number, y: number }, pOnPlane: { x: number, y: number }): [number, number][] => {
            const output: [number, number][] = [];
            if (subject.length === 0) return output;

            const isInside = (p: [number, number]) => {
                // Plane equation: (P - PlanePoint) . Normal <= 0
                return ((p[0] - pOnPlane.x) * normal.x + (p[1] - pOnPlane.y) * normal.y) <= 0;
            };

            const intersect = (p1: [number, number], p2: [number, number]): [number, number] => {
                const lineDir = { x: p2[0] - p1[0], y: p2[1] - p1[1] };
                const dotNum = (pOnPlane.x - p1[0]) * normal.x + (pOnPlane.y - p1[1]) * normal.y;
                const dotDenom = lineDir.x * normal.x + lineDir.y * normal.y;
                if (Math.abs(dotDenom) < 1e-9) return p1; // Parallel
                const t = dotNum / dotDenom;
                return [p1[0] + t * lineDir.x, p1[1] + t * lineDir.y];
            };

            for (let i = 0; i < subject.length; i++) {
                const curr = subject[i];
                const prev = subject[(i + subject.length - 1) % subject.length];

                const currIn = isInside(curr);
                const prevIn = isInside(prev);

                if (currIn) {
                    if (!prevIn) {
                        output.push(intersect(prev, curr));
                    }
                    output.push(curr);
                } else if (prevIn) {
                    output.push(intersect(prev, curr));
                }
            }
            return output;
        };

        const computePolygons = (currentPoints: { x: number, y: number }[], applyPadding: boolean) => {
            const polygons: [number, number][][] = [];

            for (let i = 0; i < currentPoints.length; i++) {
                const site = currentPoints[i];

                // Start with canvas rectangle
                let poly: [number, number][] = [
                    [0, 0],
                    [safeWidth, 0],
                    [safeWidth, safeHeight],
                    [0, safeHeight]
                ];

                // Clip against all other points
                for (let j = 0; j < currentPoints.length; j++) {
                    if (i === j) continue;

                    const neighbor = currentPoints[j];

                    // Normal points from Site to Neighbor
                    const dx = neighbor.x - site.x;
                    const dy = neighbor.y - site.y;
                    const len = Math.sqrt(dx * dx + dy * dy);

                    if (len < 1e-6) continue; // Coincident points

                    const normal = { x: dx / len, y: dy / len };

                    // Midpoint
                    let midX = site.x + dx * 0.5;
                    let midY = site.y + dy * 0.5;

                    // Apply padding: move midpoint CLOSER to site by padding/2
                    if (applyPadding && padding > 0) {
                        midX -= normal.x * (padding / 2);
                        midY -= normal.y * (padding / 2);
                    }

                    poly = clipByHalfPlane(poly, normal, { x: midX, y: midY });
                    if (poly.length < 3) break;
                }
                polygons.push(poly);
            }
            return polygons;
        };

        // Lloyd's relaxation loop
        for (let iter = 0; iter <= relaxation; iter++) {
            const isLast = iter === relaxation;
            // Only apply padding on the VERY LAST iteration to get the visual gaps.
            // During relaxation, we want cells to pack tightly to find true centroids.
            const polys = computePolygons(points, isLast);

            if (isLast) {
                // Generate Model
                polys.forEach((poly, i) => {
                    if (poly.length >= 3) {
                        model.models![`cell_${i}`] = new MakerJs.models.ConnectTheDots(true, poly);
                    }
                });
            } else {
                // Move points to centroids
                points = polys.map((poly, i) => {
                    if (poly.length < 3) return points[i]; // Keep original if degenerate

                    // Compute polygon centroid
                    let signedArea = 0;
                    let cx = 0;
                    let cy = 0;
                    for (let j = 0; j < poly.length; j++) {
                        const x0 = poly[j][0];
                        const y0 = poly[j][1];
                        const x1 = poly[(j + 1) % poly.length][0];
                        const y1 = poly[(j + 1) % poly.length][1];
                        const a = x0 * y1 - x1 * y0;
                        signedArea += a;
                        cx += (x0 + x1) * a;
                        cy += (y0 + y1) * a;
                    }
                    signedArea *= 0.5;
                    if (Math.abs(signedArea) < 1e-6) return points[i];
                    cx /= (6 * signedArea);
                    cy /= (6 * signedArea);

                    // Constrain to bounds (though centroid of clipped poly should be inside)
                    cx = Math.max(0, Math.min(safeWidth, cx));
                    cy = Math.max(0, Math.min(safeHeight, cy));

                    return { x: cx, y: cy };
                });
            }
        }

        return model;
    }
}

// Helper function for geometric clipping
function getClippedCircleTrimming(cx: number, cy: number, r: number, w: number, h: number): MakerJs.IPath[] {
    const paths: MakerJs.IPath[] = [];
    const angles: number[] = [];

    const eps = 0.0001;
    const addIntersects = (fixedCoord: number, isX: boolean) => {
        const centerFixed = isX ? cx : cy;
        const centerOther = isX ? cy : cx;
        const limitOther = isX ? h : w;

        const dist = fixedCoord - centerFixed;
        if (Math.abs(dist) > r) return; // No intersection

        // Determine intersection coords
        const delta = Math.sqrt(Math.max(0, r * r - dist * dist));
        const val1 = centerOther + delta;
        const val2 = centerOther - delta;

        [val1, val2].forEach(val => {
            if (val >= -eps && val <= limitOther + eps) {
                const x = isX ? fixedCoord : val;
                const y = isX ? val : fixedCoord;
                let ang = Math.atan2(y - cy, x - cx) * 180 / Math.PI;
                if (ang < 0) ang += 360;
                angles.push(ang);
            }
        });
    };

    // Check all 4 boundaries
    addIntersects(0, true); // Left
    addIntersects(w, true); // Right
    addIntersects(0, false); // Bottom
    addIntersects(h, false); // Top

    // Sort angles
    angles.sort((a, b) => a - b);

    // Filter duplicates
    const uniqueAngles: number[] = [];
    if (angles.length > 0) {
        uniqueAngles.push(angles[0]);
        for (let i = 1; i < angles.length; i++) {
            if (Math.abs(angles[i] - angles[i - 1]) > eps) {
                uniqueAngles.push(angles[i]);
            }
        }

        // Check wrap around duplicate (e.g. 0 and 360)
        if (Math.abs(uniqueAngles[0] + 360 - uniqueAngles[uniqueAngles.length - 1]) < eps) {
            // Effectively same angle, but keep sorted list logic
        }
    }

    // Logic to add arc if midpoint is inside
    const checkAndAddArc = (start: number, end: number) => {
        let isWrapped = end < start;
        let mid = (start + end) / 2;

        if (isWrapped) {
            mid = (start + end + 360) / 2;
        }

        const mx = cx + r * Math.cos(mid * Math.PI / 180);
        const my = cy + r * Math.sin(mid * Math.PI / 180);

        if (mx >= -eps && mx <= w + eps && my >= -eps && my <= h + eps) {
            // Inside - add arc
            if (isWrapped) {
                // Split into two arcs to satisfy MakerJs SVG export (start > end issue)
                // 1. start -> 360
                // 2. 0 -> end
                // Only add if length > 0.001 (epsilon)
                if (Math.abs(360 - start) > 0.001) {
                    paths.push(new MakerJs.paths.Arc([cx, cy], r, start, 360));
                }
                if (Math.abs(end - 0) > 0.001) {
                    paths.push(new MakerJs.paths.Arc([cx, cy], r, 0, end));
                }
            } else {
                paths.push(new MakerJs.paths.Arc([cx, cy], r, start, end));
            }
        }
    };

    if (uniqueAngles.length === 0) {
        // No intersections: either fully inside or fully outside
        // Check arbitrary point (angle 0)
        const tx = cx + r;
        const ty = cy;
        if (tx >= -eps && tx <= w + eps && ty >= -eps && ty <= h + eps) {
            // Fully inside
            const circle = new MakerJs.paths.Circle([cx, cy], r);
            (circle as any).startAngle = 0;
            paths.push(circle);
        }
    } else {
        // Form intervals
        for (let i = 0; i < uniqueAngles.length; i++) {
            const current = uniqueAngles[i];
            const next = uniqueAngles[(i + 1) % uniqueAngles.length];
            checkAndAddArc(current, next);
        }
    }
    return paths;
}
