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
        const cx = bounds.x + (params.center?.[0] ?? 0.5) * bounds.width;
        const cy = bounds.y + (params.center?.[1] ?? 0.5) * bounds.height;
        const radius = (params.radius ?? 0.5) * Math.min(bounds.width, bounds.height);
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
            // Apply offset to input coordinates
            // Since x,y are in mm (or relative to canvas logic), adding offset moves the pattern.
            // If scale is small (frequency high), offset might need to be large to move significantly?
            // "Move the mask so it moves where it applies" -> Translation.
            // patterns.get usually takes "scaled" coords inside, but here we pass raw coords and it scales them.
            // Wait, patterns.get does: this.noise2D(x * scale, y * scale).
            // So if we simply add to x: patterns.get(x + offsetX, ...) -> noise((x + offsetX) * scale)
            // This is correct for "moving the origin".
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
     * Params: scale (size of squares), softness (0 = hard edges, 1 = gradient)
     */
    static checker(params: any, bounds: Box): MaskFn {
        const scaleX = params.scaleX ?? params.scale ?? 0.1;
        const scaleY = params.scaleY ?? params.scale ?? 0.1;
        const softness = params.softness ?? 0;

        return (x, y) => {
            const fx = x * scaleX;
            const fy = y * scaleY;

            if (softness === 0) {
                // Hard edges
                const ix = Math.floor(fx);
                const iy = Math.floor(fy);
                return (ix + iy) % 2 === 0 ? 1 : 0;
            } else {
                // Soft edges using sine
                const vx = (Math.sin(fx * Math.PI * 2) + 1) / 2;
                const vy = (Math.sin(fy * Math.PI * 2) + 1) / 2;
                const blend = (1 - softness);
                const hard = ((Math.floor(fx) + Math.floor(fy)) % 2 === 0) ? 1 : 0;
                return hard * blend + vx * vy * softness;
            }
        };
    }
}
