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
            minRadius?: number // Starting radius, default 0
        }
    ): MakerJs.IModel {
        const model: MakerJs.IModel = { paths: {} };
        const cx = (options?.centerX ?? 0.5) * width;
        const cy = (options?.centerY ?? 0.5) * height;
        const maxRadius = Math.min(width, height) / 2;
        const minRadius = options?.minRadius ?? 0;
        const step = (maxRadius - minRadius) / count;

        for (let i = 1; i <= count; i++) {
            const r = minRadius + i * step;
            model.paths![`c_${i}`] = new MakerJs.paths.Circle([cx, cy], r);
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
        const cx = (options?.centerX ?? 0.5) * width;
        const cy = (options?.centerY ?? 0.5) * height;
        const maxRadius = Math.min(width, height) / 2;
        const startRadius = options?.startRadius ?? 0;
        const pointsPerTurn = options?.pointsPerTurn ?? 36;
        const direction = options?.direction === 'ccw' ? -1 : 1;
        
        const totalPoints = turns * pointsPerTurn;
        const radiusStep = (maxRadius - startRadius) / totalPoints;
        const angleStep = (2 * Math.PI) / pointsPerTurn * direction;

        let prevX = cx + startRadius;
        let prevY = cy;

        for (let i = 1; i <= totalPoints; i++) {
            const angle = i * angleStep;
            const r = startRadius + i * radiusStep;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            
            model.paths![`sp_${i}`] = new MakerJs.paths.Line([prevX, prevY], [x, y]);
            prevX = x;
            prevY = y;
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
        const cx = (options?.centerX ?? 0.5) * width;
        const cy = (options?.centerY ?? 0.5) * height;
        const scale = Math.min(width, height) / 2;
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
        const amplitude = options?.amplitude ?? height / (count * 4);
        const frequency = options?.frequency ?? 3;
        const phase = (options?.phase ?? 0) * Math.PI * 2;
        const segments = options?.segments ?? 50;
        const stepY = height / count;

        for (let row = 0; row <= count; row++) {
            const baseY = row * stepY;
            const segWidth = width / segments;
            
            for (let seg = 0; seg < segments; seg++) {
                const x1 = seg * segWidth;
                const x2 = (seg + 1) * segWidth;
                const angle1 = (x1 / width) * frequency * Math.PI * 2 + phase;
                const angle2 = (x2 / width) * frequency * Math.PI * 2 + phase;
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
        const angle = (options?.angle ?? 45) * Math.PI / 180;
        const bidirectional = options?.bidirectional ?? false;
        
        // Calculate line spacing
        const diag = Math.hypot(width, height);
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
                const startX = width / 2 + perpC * offset;
                const startY = height / 2 + perpS * offset;
                
                // Extend line in both directions
                const x1 = startX - c * diag;
                const y1 = startY - s * diag;
                const x2 = startX + c * diag;
                const y2 = startY + s * diag;
                
                // Clip to bounds (simple)
                if ((x1 < 0 && x2 < 0) || (x1 > width && x2 > width)) continue;
                if ((y1 < 0 && y2 < 0) || (y1 > height && y2 > height)) continue;
                
                model.paths![`${prefix}_${i}`] = new MakerJs.paths.Line(
                    [Math.max(0, Math.min(width, x1)), Math.max(0, Math.min(height, y1))],
                    [Math.max(0, Math.min(width, x2)), Math.max(0, Math.min(height, y2))]
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
