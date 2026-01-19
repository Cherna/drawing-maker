import { MaskConfig } from '../types';
import { Box } from './layout';

export type MaskFn = (x: number, y: number) => number;

export class Masks {
    static create(config: MaskConfig | MaskConfig[], bounds: Box): MaskFn {
        if (Array.isArray(config)) {
            const fns = config.map(c => Masks.create(c, bounds));
            return (x, y) => {
                let val = 1;
                for (const f of fns) val *= f(x, y);
                return val;
            };
        }

        let fn: MaskFn;

        switch (config.type) {
            case 'radial':
                fn = Masks.radial(config.params, bounds);
                break;
            case 'linear':
                fn = Masks.linear(config.params, bounds);
                break;
            default:
                fn = () => 1; // Default to full intensity
        }

        if (config.invert) {
            return (x, y) => 1 - fn(x, y);
        }
        return fn;
    }

    // Params: center: [0.5, 0.5] (normalized), radius: 0.5 (normalized)
    static radial(params: any, bounds: Box): MaskFn {
        const cx = bounds.x + (params.center?.[0] ?? 0.5) * bounds.width;
        const cy = bounds.y + (params.center?.[1] ?? 0.5) * bounds.height;
        const radius = (params.radius ?? 0.5) * Math.min(bounds.width, bounds.height);

        return (x, y) => {
            const dist = Math.hypot(x - cx, y - cy);
            // Linear falloff for now. Could be smoothstep.
            const val = 1 - (dist / radius);
            return Math.max(0, Math.min(1, val));
        };
    }

    // Params: angle (degrees), full intensity at one side?
    // Simple gradient: from 0 to 1 along an axis
    static linear(params: any, bounds: Box): MaskFn {
        const angleRad = (params.angle ?? 0) * (Math.PI / 180);
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);

        // Center of bounds
        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y + bounds.height / 2;

        return (x, y) => {
            // Project point onto gradient vector
            // Normalize relative to bounds?
            // Let's keep it simple: Gradient across the bounding box size
            const dx = x - cx;
            const dy = y - cy;

            const proj = dx * cos + dy * sin;

            // Map projection to 0..1 based on size
            const maxExt = Math.hypot(bounds.width, bounds.height) / 2;
            const val = (proj / maxExt) * 0.5 + 0.5;

            return Math.max(0, Math.min(1, val));
        };
    }
}
