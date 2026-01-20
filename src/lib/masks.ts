import { createNoise2D, createNoise3D } from 'simplex-noise';
import { MaskConfig, MaskOp } from '../types';
import { Box } from './layout';

export type MaskFn = (x: number, y: number) => number;

// Seeded random number generator (mulberry32)
function seededRandom(seed: number) {
    return function() {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

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
    
    // Apply threshold (convert to hard edge)
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
            case 'noise':
                fn = Masks.noise(config.params, bounds, seed);
                break;
            case 'turbulence':
                fn = Masks.turbulence(config.params, bounds, seed);
                break;
            case 'cells':
                fn = Masks.cells(config.params, bounds, seed);
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

    /**
     * Simplex noise mask - organic, cloud-like patterns
     * Params: scale (frequency), contrast (1 = normal), bias (shifts midpoint)
     */
    static noise(params: any, bounds: Box, seed: number): MaskFn {
        const scale = params.scale ?? 0.02;
        const contrast = params.contrast ?? 1;
        const bias = params.bias ?? 0;
        const offsetX = params.offsetX ?? 0;
        const offsetY = params.offsetY ?? 0;
        
        // Create seeded noise
        const rng = seededRandom(seed);
        const noise2D = createNoise2D(rng);

        return (x, y) => {
            const nx = (x + offsetX) * scale;
            const ny = (y + offsetY) * scale;
            
            // Noise returns -1 to 1, map to 0-1
            let val = (noise2D(nx, ny) + 1) / 2;
            
            // Apply contrast and bias
            val = (val - 0.5) * contrast + 0.5 + bias;
            
            return Math.max(0, Math.min(1, val));
        };
    }

    /**
     * Turbulence mask - multi-octave fractal noise (like Perlin turbulence)
     * Creates more detailed, natural-looking patterns
     * Params: scale, octaves (layers), persistence (amplitude decay), lacunarity (frequency growth)
     */
    static turbulence(params: any, bounds: Box, seed: number): MaskFn {
        const scale = params.scale ?? 0.02;
        const octaves = params.octaves ?? 4;
        const persistence = params.persistence ?? 0.5;
        const lacunarity = params.lacunarity ?? 2;
        const contrast = params.contrast ?? 1;
        const offsetX = params.offsetX ?? 0;
        const offsetY = params.offsetY ?? 0;
        
        const rng = seededRandom(seed);
        const noise2D = createNoise2D(rng);

        return (x, y) => {
            let value = 0;
            let amplitude = 1;
            let frequency = scale;
            let maxValue = 0;

            for (let i = 0; i < octaves; i++) {
                const nx = (x + offsetX) * frequency;
                const ny = (y + offsetY) * frequency;
                
                value += ((noise2D(nx, ny) + 1) / 2) * amplitude;
                maxValue += amplitude;
                
                amplitude *= persistence;
                frequency *= lacunarity;
            }

            let val = value / maxValue; // Normalize
            val = (val - 0.5) * contrast + 0.5;
            
            return Math.max(0, Math.min(1, val));
        };
    }

    /**
     * Cellular/Voronoi mask - organic cell-like patterns
     * Params: scale, type ('f1' = distance to nearest, 'f2-f1' = cell edges)
     */
    static cells(params: any, bounds: Box, seed: number): MaskFn {
        const scale = params.scale ?? 0.05;
        const cellType = params.type ?? 'f1'; // 'f1', 'f2', 'f2-f1'
        const jitter = params.jitter ?? 1; // How random cell centers are (0-1)
        
        const rng = seededRandom(seed);
        
        // Pre-generate cell center offsets for a grid of cells
        // We'll check a 3x3 neighborhood for each point
        const getOffset = (ix: number, iy: number): [number, number] => {
            // Deterministic offset based on cell coordinates
            const s = ix * 374761393 + iy * 668265263 + seed;
            const ox = ((s * 1013904223) & 0x7FFFFFFF) / 0x7FFFFFFF;
            const oy = ((s * 1664525) & 0x7FFFFFFF) / 0x7FFFFFFF;
            return [(ox - 0.5) * jitter + 0.5, (oy - 0.5) * jitter + 0.5];
        };

        return (x, y) => {
            const px = x * scale;
            const py = y * scale;
            const ix = Math.floor(px);
            const iy = Math.floor(py);
            
            let f1 = Infinity; // Distance to nearest
            let f2 = Infinity; // Distance to second nearest

            // Check 3x3 neighborhood
            for (let di = -1; di <= 1; di++) {
                for (let dj = -1; dj <= 1; dj++) {
                    const [ox, oy] = getOffset(ix + di, iy + dj);
                    const cx = ix + di + ox;
                    const cy = iy + dj + oy;
                    const dist = Math.hypot(px - cx, py - cy);
                    
                    if (dist < f1) {
                        f2 = f1;
                        f1 = dist;
                    } else if (dist < f2) {
                        f2 = dist;
                    }
                }
            }

            let val: number;
            switch (cellType) {
                case 'f2':
                    val = f2;
                    break;
                case 'f2-f1':
                    val = f2 - f1; // Creates cell edges
                    break;
                case 'f1':
                default:
                    val = f1;
            }

            // Normalize (f1 typically ranges 0-0.7, f2-f1 ranges 0-0.5)
            val = Math.min(1, val * 1.5);
            
            return val;
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
