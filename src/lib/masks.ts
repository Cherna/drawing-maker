import { MaskConfig, MaskOp } from '../types';
import { Box } from './layout';
import { NoisePatterns, NoiseParams } from './noise-patterns';

export type MaskFn = (x: number, y: number) => number;

// Combine two mask values with an operation
function combineMasks(a: number, b: number, op: MaskOp): number {
    switch (op) {
        case 'multiply': return a * b;
        case 'add': return Math.min(1, a + b);
        case 'subtract': return Math.max(0, a - b);
        case 'max': return Math.max(a, b);
        case 'min': return Math.min(a, b);
        case 'screen': return 1 - (1 - a) * (1 - b); // Like Photoshop screen blend
        default: return a * b;
    }
}

// Apply post-processing to mask value
function postProcess(val: number, config: MaskConfig): number {
    let result = val;

    // Apply contrast
    if (config.contrast !== undefined && config.contrast !== 1) {
        // (val - 0.5) * contrast + 0.5 center the contrast around 0.5
        result = (result - 0.5) * config.contrast + 0.5;
    }

    // Apply brightness
    if (config.brightness !== undefined && config.brightness !== 0) {
        result = result + config.brightness;
    }

    // Apply threshold (convert to hard edge)
    // ONLY if explicitly set. This destroys feathering.
    if (config.threshold !== undefined) {
        result = result >= config.threshold ? 1 : 0;
    }

    // Apply remap
    if (config.remap) {
        const [min, max] = config.remap;
        result = min + result * (max - min);
    }

    // Apply invert
    if (config.invert) {
        result = 1 - result;
    }

    return Math.max(0, Math.min(1, result));
}

export class Masks {
    /**
     * Create a mask function from config.
     * Supports single mask, array of masks (combined), and various operations.
     */
    static create(config: MaskConfig | MaskConfig[], bounds: Box, seed?: number): MaskFn {
        if (Array.isArray(config)) {
            // Multiple masks - combine them
            if (config.length === 0) return () => 1;

            const fns = config.map(c => Masks.createSingle(c, bounds, seed));
            const ops = config.map(c => c.op || 'multiply');

            return (x, y) => {
                let result = fns[0](x, y);
                for (let i = 1; i < fns.length; i++) {
                    result = combineMasks(result, fns[i](x, y), ops[i]);
                }
                return result;
            };
        }

        return Masks.createSingle(config, bounds, seed);
    }

    /**
     * Create a single mask function
     */
    static createSingle(config: MaskConfig, bounds: Box, globalSeed?: number): MaskFn {
        const seed = config.params?.seed ?? globalSeed ?? Date.now();
        let fn: MaskFn;

        if (['noise', 'turbulence', 'simplex', 'perlin', 'marble', 'cells'].includes(config.type)) {
            fn = Masks.pattern(config.type, config.params, bounds, seed);
        } else {
            switch (config.type) {
                case 'radial':
                    fn = Masks.radial(config.params, bounds);
                    break;
                case 'linear':
                    fn = Masks.linear(config.params, bounds);
                    break;
                case 'border':
                    fn = Masks.border(config.params, bounds);
                    break;
                case 'waves':
                    fn = Masks.waves(config.params, bounds);
                    break;
                case 'checker':
                    fn = Masks.checker(config.params, bounds);
                    break;
                case 'cubes':
                    fn = Masks.cubes(config.params, bounds);
                    break;
                default:
                    fn = () => 1;
            }
        }

        // Wrap with post-processing
        return (x, y) => postProcess(fn(x, y), config);
    }

    // ==================== GEOMETRIC MASKS ====================

    /**
     * Radial gradient mask - circular falloff from center
     * Params: center [x, y] (0-1), radius (0-1), falloff ('linear' | 'smooth' | 'sharp')
     */
    static radial(params: any, bounds: Box): MaskFn {
        // Scale controls size (1 = default, 2 = twice as large, 0.5 = half size)
        const scale = params.scale ?? 1;
        // Offset moves the pattern in canvas units (mm)
        const offsetX = params.offsetX ?? 0;
        const offsetY = params.offsetY ?? 0;

        // Center position (0-1 normalized, then offset applied)
        const baseCx = bounds.x + (params.center?.[0] ?? 0.5) * bounds.width;
        const baseCy = bounds.y + (params.center?.[1] ?? 0.5) * bounds.height;
        const cx = baseCx + offsetX;
        const cy = baseCy + offsetY;

        // Radius is scaled
        const baseRadius = (params.radius ?? 0.5) * Math.min(bounds.width, bounds.height);
        const radius = baseRadius * scale;
        const falloff = params.falloff ?? 'linear';

        return (x, y) => {
            const dist = Math.hypot(x - cx, y - cy);
            let val = 1 - (dist / radius);
            val = Math.max(0, Math.min(1, val));

            // Apply falloff curve
            if (falloff === 'smooth') {
                val = val * val * (3 - 2 * val); // Smoothstep
            } else if (falloff === 'sharp') {
                val = val * val; // Quadratic
            }

            return val;
        };
    }

    /**
     * Linear gradient mask
     * Params: angle (degrees), offset (0-1 shifts gradient)
     */
    static linear(params: any, bounds: Box): MaskFn {
        const angleRad = (params.angle ?? 0) * (Math.PI / 180);
        const offset = params.offset ?? 0;
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y + bounds.height / 2;
        const maxExt = Math.hypot(bounds.width, bounds.height) / 2;

        return (x, y) => {
            const dx = x - cx;
            const dy = y - cy;
            const proj = dx * cos + dy * sin;
            const val = (proj / maxExt) * 0.5 + 0.5 + offset;
            return Math.max(0, Math.min(1, val));
        };
    }

    /**
     * Border feather mask - fades from edges
     * Params: top, right, bottom, left (0-1), centerRadius (0-1)
     */
    static border(params: any, bounds: Box): MaskFn {
        const topFeather = (params.top ?? 0.2) * bounds.height;
        const rightFeather = (params.right ?? 0.2) * bounds.width;
        const bottomFeather = (params.bottom ?? 0.2) * bounds.height;
        const leftFeather = (params.left ?? 0.2) * bounds.width;
        const centerRadius = (params.centerRadius ?? 0) * Math.min(bounds.width, bounds.height);
        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y + bounds.height / 2;

        return (x, y) => {
            if (centerRadius > 0) {
                const distFromCenter = Math.hypot(x - cx, y - cy);
                if (distFromCenter < centerRadius) return 1.0;
            }

            const distToTop = (bounds.y + bounds.height) - y;
            const distToBottom = y - bounds.y;
            const distToRight = (bounds.x + bounds.width) - x;
            const distToLeft = x - bounds.x;

            const topVal = topFeather > 0 ? Math.min(1, Math.max(0, distToTop / topFeather)) : 1;
            const bottomVal = bottomFeather > 0 ? Math.min(1, Math.max(0, distToBottom / bottomFeather)) : 1;
            const rightVal = rightFeather > 0 ? Math.min(1, Math.max(0, distToRight / rightFeather)) : 1;
            const leftVal = leftFeather > 0 ? Math.min(1, Math.max(0, distToLeft / leftFeather)) : 1;

            return topVal * bottomVal * rightVal * leftVal;
        };
    }

    // ==================== PROCEDURAL MASKS ====================

    static pattern(type: string, params: any, bounds: Box, seed: number): MaskFn {
        const patterns = new NoisePatterns(seed);
        const noiseParams: NoiseParams = {
            scale: params.scale || 0.05,
            octaves: params.octaves || 1,
            persistence: params.persistence || 0.5,
            lacunarity: params.lacunarity || 2,
            distortion: params.distortion,
        };

        const offsetX = params.offsetX || 0;
        const offsetY = params.offsetY || 0;

        return (x, y) => {
            const targetType = type === 'noise' ? 'simplex' : type;
            // Apply offset to input coordinates for translation.
            return patterns.get(targetType as any, x + offsetX, y + offsetY, noiseParams, seed);
        };
    }

    /**
     * Wave pattern mask - sine wave stripes
     * Params: scale (frequency), angle (direction), waveform ('sine', 'square', 'triangle')
     */
    static waves(params: any, bounds: Box): MaskFn {
        const scale = params.scale ?? 0.1;
        const angle = (params.angle ?? 0) * (Math.PI / 180);
        const waveform = params.waveform ?? 'sine';
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        return (x, y) => {
            // Project onto wave direction
            const t = (x * cos + y * sin) * scale * Math.PI * 2;

            let val: number;
            switch (waveform) {
                case 'square':
                    val = Math.sin(t) > 0 ? 1 : 0;
                    break;
                case 'triangle':
                    val = Math.abs(((t / Math.PI) % 2) - 1);
                    break;
                case 'sine':
                default:
                    val = (Math.sin(t) + 1) / 2;
            }

            return val;
        };
    }

    /**
     * Checker pattern mask - checkerboard grid
     * Params: scale (size of squares), softness (0 = hard edges, 1 = gradient feathering)
     */
    static checker(params: any, bounds: Box): MaskFn {
        // Scale controls checker size (higher = smaller squares, default 0.1)
        const baseScaleX = params.scaleX ?? params.scale ?? 0.1;
        const baseScaleY = params.scaleY ?? params.scale ?? 0.1;
        // Pattern scale multiplier (1 = default, 2 = twice as dense, 0.5 = half)
        const patternScale = params.patternScale ?? 1;
        const scaleX = baseScaleX * patternScale;
        const scaleY = baseScaleY * patternScale;
        // Offset moves the pattern in canvas units (mm)
        const offsetX = params.offsetX ?? 0;
        const offsetY = params.offsetY ?? 0;
        // Softness: 0 = hard edges, 1 = maximum feathering (gradient to edge)
        const softness = params.softness ?? 0;

        return (x, y) => {
            // Apply offset before scaling
            const fx = (x + offsetX) * scaleX;
            const fy = (y + offsetY) * scaleY;

            // Get which square we're in and position within that square (0-1)
            const ix = Math.floor(fx);
            const iy = Math.floor(fy);
            const localX = fx - ix; // 0-1 within the square
            const localY = fy - iy; // 0-1 within the square

            // Base checker value (0 or 1)
            const isWhite = (ix + iy) % 2 === 0;

            if (softness === 0) {
                return isWhite ? 1 : 0;
            }

            // Distance from center of square (0 at center, ~0.707 at corners)
            const centerX = localX - 0.5;
            const centerY = localY - 0.5;

            // Use max of abs distances for square-shaped falloff (Chebyshev distance)
            const distFromCenter = Math.max(Math.abs(centerX), Math.abs(centerY));

            // distFromCenter is 0 at center, 0.5 at edges
            // Map to a feather value: 1 at center, feathering toward edges
            // The softness parameter controls how much of the square is feathered
            // softness=0: no feathering, softness=1: feather from center to edge

            const featherStart = 0.5 - softness * 0.5; // Where feathering starts (0 to 0.5)
            let featherVal: number;

            if (distFromCenter < featherStart) {
                featherVal = 1; // Full intensity in center
            } else {
                // Smooth falloff from featherStart to 0.5
                const t = (distFromCenter - featherStart) / (0.5 - featherStart);
                featherVal = 1 - t; // Linear falloff to edge
                featherVal = Math.max(0, Math.min(1, featherVal));
            }

            // For white squares: featherVal goes from 1 (center) to 0 (edge)
            // For black squares: invert
            return isWhite ? featherVal : (1 - featherVal);
        };
    }
    /**
     * Cubes pattern mask - isometric cubes with 3 shades
     * Params: scale (size), offsetX, offsetY
     */
    static cubes(params: any, bounds: Box): MaskFn {
        const scale = (params.scale === 0) ? 0.1 : (params.scale ?? 0.1);
        const offsetX = params.offsetX ?? 0;
        const offsetY = params.offsetY ?? 0;
        const jitter = params.jitter ?? 0;
        const rotation = (params.rotation ?? 0) * Math.PI / 180;
        const spacing = params.spacing ?? 0;
        const bevel = params.bevel ?? false;

        // Seeded RNG for jitter
        const seed = params.seed ?? 0;
        const rng = (x: number, y: number) => {
            let h = Math.imul(x ^ seed, 1597334677);
            h = Math.imul(h ^ y, 3812015801);
            return ((h ^ h >>> 16) >>> 0) / 4294967296;
        };

        return (x, y) => {
            // 1. Initial Offset
            let px = (x + offsetX);
            let py = (y + offsetY);

            // 2. Rotation
            if (rotation !== 0) {
                const cos = Math.cos(rotation);
                const sin = Math.sin(rotation);
                const rx = px * cos - py * sin;
                const ry = px * sin + py * cos;
                px = rx;
                py = ry;
            }

            // 3. Scale
            px *= scale;
            py *= scale;

            // 4. Distortion (Slope/Bevel) - applied at the end

            // 5. Hex Grid (Axial Coordinates)
            // Pointy-topped
            const sqrt3 = Math.sqrt(3);
            const q = (sqrt3 / 3 * px - 1 / 3 * py);
            const r = (2 / 3 * py);

            // 6. Round to nearest hex
            let hq = Math.round(q);
            let hr = Math.round(r);
            let hs = -hq - hr; // s = -q - r

            // Cube rounding
            const dq = Math.abs(hq - q);
            const dr = Math.abs(hr - r);
            const ds = Math.abs(hs - (-q - r));

            if (dq > dr && dq > ds) hq = -hr - hs;
            else if (dr > ds) hr = -hq - hs;

            // 7. Calculate Grid Center (Unjittered)
            let cx = sqrt3 * hq + sqrt3 / 2 * hr;
            let cy = 3 / 2 * hr;

            // 8. Apply Jitter
            if (jitter > 0) {
                const jx = (rng(hq, hr) - 0.5) * 2;
                const jy = (rng(hr, hq) - 0.5) * 2;
                cx += jx * jitter;
                cy += jy * jitter;
            }

            // 9. Determine Position
            const dx = px - cx;
            const dy = py - cy;

            // 10. Spacing & Distance
            // Max radius approx 1.0 (corners)
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (spacing > 0) {
                if (dist > (1 - spacing) * 0.866) {
                    return 0.5; // Gap
                }
            }

            // 11. Determine Face
            const angle = Math.atan2(dy, dx);
            const deg = angle * 180 / Math.PI;
            const normDeg = (deg + 360) % 360;

            let val = 0.5;
            if (normDeg >= 210 && normDeg < 330) val = 1.0;      // Top
            else if (normDeg >= 90 && normDeg < 210) val = 0.5;  // Left
            else val = 0.0;                                      // Right

            // 12. Apply Distortion (Slope/Bevel)
            // Smooths the transition between faces by pulling values towards 0.5 (neutral) at the edges
            if (bevel) {
                // Normalize dist roughly (0 to 1)
                const d = Math.min(1, dist * 1.15); // 1.15 approx 1/0.866 (apothem to corner ratio)
                // Lerp towards 0.5
                val = val + (0.5 - val) * d;
            }

            return val;
        };
    }
}
