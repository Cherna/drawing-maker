
import MakerJs from 'makerjs';

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
    static Grid(countX: number, countY: number, width: number, height: number): MakerJs.IModel {
        const model: MakerJs.IModel = { paths: {} };
        const stepX = width / countX;
        const stepY = height / countY;

        // Horizontal lines
        for (let i = 0; i <= countY; i++) {
            const y = i * stepY;
            model.paths![`h_${i}`] = new MakerJs.paths.Line([0, y], [width, y]);
        }

        // Vertical lines
        for (let i = 0; i <= countX; i++) {
            const x = i * stepX;
            model.paths![`v_${i}`] = new MakerJs.paths.Line([x, 0], [x, height]);
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

                // Clip to bounds (simple)
                if ((x1 < 0 && x2 < 0) || (x1 > safeWidth && x2 > safeWidth)) continue;
                if ((y1 < 0 && y2 < 0) || (y1 > safeHeight && y2 > safeHeight)) continue;

                model.paths![`${prefix}_${i}`] = new MakerJs.paths.Line(
                    [Math.max(0, Math.min(safeWidth, x1)), Math.max(0, Math.min(safeHeight, y1))],
                    [Math.max(0, Math.min(safeWidth, x2)), Math.max(0, Math.min(safeHeight, y2))]
                );
            }
        };

        generateLines(angle, 'h');
        if (bidirectional) {
            generateLines(-angle, 'hb');
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
