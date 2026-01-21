import { createNoise2D, createNoise3D } from 'simplex-noise';

// Seeded random number generator (mulberry32)
export function seededRandom(seed: number) {
    return function () {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

export type NoiseType = 'simplex' | 'perlin' | 'turbulence' | 'marble' | 'cells';

export interface NoiseParams {
    scale: number;
    octaves?: number;
    persistence?: number; // Amplitude decay (default 0.5)
    lacunarity?: number;  // Frequency growth (default 2)
    seed?: number;
    distortion?: number;  // For marble
    axis?: 'x' | 'y' | 'z'; // For cells/voronoi metric
}

export class NoisePatterns {
    private noise2D: (x: number, y: number) => number;
    private noise3D: (x: number, y: number, z: number) => number;
    private rng: () => number;

    constructor(seed: number = Date.now()) {
        this.rng = seededRandom(seed);
        this.noise2D = createNoise2D(this.rng);
        this.noise3D = createNoise3D(this.rng);
    }

    // Basic Simplex Noise (-1 to 1)
    simplex(x: number, y: number, scale: number = 0.05): number {
        return this.noise2D(x * scale, y * scale);
    }

    // Turbulence (sum of absolute noise values) (0 to 1 approx)
    turbulence(x: number, y: number, params: NoiseParams): number {
        let t = 0;
        let frequency = params.scale;
        let amplitude = 1;
        let maxVal = 0;

        const octaves = params.octaves || 4;
        const persistence = params.persistence || 0.5;
        const lacunarity = params.lacunarity || 2;

        for (let i = 0; i < octaves; i++) {
            t += Math.abs(this.noise2D(x * frequency, y * frequency)) * amplitude;
            maxVal += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        return t / maxVal;
    }

    // FBM (Fractal Brownian Motion) (-1 to 1 approx)
    fbm(x: number, y: number, params: NoiseParams): number {
        let t = 0;
        let frequency = params.scale;
        let amplitude = 1;
        let maxVal = 0;

        const octaves = params.octaves || 4;
        const persistence = params.persistence || 0.5;
        const lacunarity = params.lacunarity || 2;

        for (let i = 0; i < octaves; i++) {
            t += this.noise2D(x * frequency, y * frequency) * amplitude;
            maxVal += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        return t / maxVal;
    }

    // Marble (sin of x + turbulence)
    marble(x: number, y: number, params: NoiseParams): number {
        const turb = this.turbulence(x, y, { ...params, scale: params.scale * 3 }); // Higher freq for distortion
        const distortion = params.distortion || 10;

        // Marble usually uses one axis + noise
        const val = x * params.scale + turb * distortion;
        return (Math.sin(val) + 1) / 2;
    }

    // Cellular / Voronoi (distance to closest point)
    // Basic implementation using a grid
    cells(x: number, y: number, scale: number): number {
        const s = scale * 0.5; // Adjust scale to match others roughly
        const xi = Math.floor(x * s);
        const yi = Math.floor(y * s);

        let minDist = 1.0;

        for (let yOffset = -1; yOffset <= 1; yOffset++) {
            for (let xOffset = -1; xOffset <= 1; xOffset++) {
                const neighborX = xi + xOffset;
                const neighborY = yi + yOffset;

                // Random point inside the neighbor cell
                // We use our seeded RNG, but we need it to be deterministic per cell coordinates.
                // A simple hash function allows random access:
                const pointX = neighborX + this.pseudoRandom(neighborX, neighborY);
                const pointY = neighborY + this.pseudoRandom(neighborY, neighborX + 1000); // reuse/offset

                const dist = Math.hypot((x * s) - pointX, (y * s) - pointY);
                minDist = Math.min(minDist, dist);
            }
        }

        return Math.min(1, minDist); // Distance field
    }

    // Deterministic pseudo-random float [0, 1] from inputs
    private pseudoRandom(x: number, y: number): number {
        let n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
        return n - Math.floor(n);
    }

    // General access
    get(type: NoiseType, x: number, y: number, params: NoiseParams): number {
        switch (type) {
            case 'simplex':
            case 'perlin': // Simplex is often used as better Perlin
                return (this.simplex(x, y, params.scale) + 1) / 2; // Normalize -1..1 to 0..1
            case 'turbulence':
                return this.turbulence(x, y, params);
            case 'marble':
                return this.marble(x, y, params);
            case 'cells':
                return this.cells(x, y, params.scale);
            default:
                return (this.simplex(x, y, params.scale) + 1) / 2;
        }
    }
}
