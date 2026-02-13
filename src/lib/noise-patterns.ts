import { createNoise2D, createNoise3D } from 'simplex-noise';

// Seeded random number generator (mulberry32)
// Seeded random number generator (mulberry32)
export function seededRandom(seed: number) {
    let state = Number(seed);
    return function () {
        let t = state += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

export type NoiseType = 'simplex' | 'perlin' | 'turbulence' | 'marble' | 'cells' | 'curl';

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
    private perm: number[] = [];

    constructor(seed: number = Date.now()) {
        this.rng = seededRandom(seed);
        this.noise2D = createNoise2D(this.rng);
        this.noise3D = createNoise3D(this.rng);

        // Initialize Perlin permutation table
        const p: number[] = [];
        for (let i = 0; i < 256; i++) p[i] = i;

        // Shuffle using seeded rng
        for (let i = 255; i > 0; i--) {
            const r = Math.floor(this.rng() * (i + 1));
            [p[i], p[r]] = [p[r], p[i]];
        }

        // Duplicate
        this.perm = new Array(512);
        for (let i = 0; i < 512; i++) {
            this.perm[i] = p[i & 255];
        }
    }

    // Classic Perlin Noise
    perlin2D(x: number, y: number): number {
        // Find unit grid cell containing point
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;

        // Get relative xy coordinates of point within that cell
        x -= Math.floor(x);
        y -= Math.floor(y);

        // Compute fade curves for each of x, y
        const u = this.fade(x);
        const v = this.fade(y);

        // Hash coordinates of the 4 square corners
        const A = this.perm[X] + Y;
        const B = this.perm[X + 1] + Y;

        // Add blended results from 4 corners of square
        const res = this.lerp(v,
            this.lerp(u, this.grad(this.perm[A], x, y), this.grad(this.perm[B], x - 1, y)),
            this.lerp(u, this.grad(this.perm[A + 1], x, y - 1), this.grad(this.perm[B + 1], x - 1, y - 1))
        );

        return res;
    }

    private fade(t: number): number {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    private lerp(t: number, a: number, b: number): number {
        return a + t * (b - a);
    }

    private grad(hash: number, x: number, y: number): number {
        // Convert lo 4 bits of hash code into 12 gradient directions
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : (h === 12 || h === 14 ? x : 0);
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
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
    cells(x: number, y: number, scale: number, seed: number = 0): number {
        // Debug: log first call to verify seed is being used
        // if (x === 0 && y === 0) {
        //     console.log('[NoisePatterns.cells] seed:', seed);
        // }

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
                const pointX = neighborX + this.pseudoRandom(neighborX, neighborY, seed);
                const pointY = neighborY + this.pseudoRandom(neighborY, neighborX + 1000, seed); // reuse/offset

                const dist = Math.hypot((x * s) - pointX, (y * s) - pointY);
                minDist = Math.min(minDist, dist);
            }
        }

        return Math.min(1, minDist); // Distance field
    }

    // Deterministic pseudo-random float [0, 1] from inputs including seed
    // Using a better hash that's more sensitive to seed changes
    private pseudoRandom(x: number, y: number, seed: number = 0): number {
        // Mix all inputs together with large prime multipliers
        let hash = x * 374761393 + y * 668265263 + seed * 1911520717;
        hash = (hash ^ (hash >>> 13)) * 1274126177;
        hash = hash ^ (hash >>> 16);
        // Convert to [0, 1]
        return Math.abs(hash % 10000) / 10000;
    }

    // Generic FBM
    private fbmGeneric(x: number, y: number, params: NoiseParams, noiseFn: (x: number, y: number) => number): number {
        let t = 0;
        let frequency = params.scale;
        let amplitude = 1;
        let maxVal = 0;

        const octaves = params.octaves || 1;
        const persistence = params.persistence || 0.5;
        const lacunarity = params.lacunarity || 2;

        for (let i = 0; i < octaves; i++) {
            t += noiseFn(x * frequency, y * frequency) * amplitude;
            maxVal += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        return t / maxVal;
    }

    // Curl Noise (Divergence Free)
    // Returns angle 0..1 (representing 0..2PI)
    curl(x: number, y: number, params: NoiseParams): number {
        const eps = 0.001;

        // Potential function (psi)
        // We can use Simplex or Perlin FBM as the potential
        const psi = (x: number, y: number) => {
            // Using FBM for richer curl patterns
            return this.fbmGeneric(x, y, params, (nx, ny) => this.noise2D(nx, ny));
        };

        // Finite difference approximation of gradient
        const n1 = psi(x, y + eps);
        const n2 = psi(x, y - eps);
        const a = (n1 - n2) / (2 * eps); // dPsi/dy

        const n3 = psi(x + eps, y);
        const n4 = psi(x - eps, y);
        const b = (n3 - n4) / (2 * eps); // dPsi/dx

        // Vector field v = (dPsi/dy, -dPsi/dx) = (a, -b)
        const vx = a;
        const vy = -b;

        // Return angle normalized to 0..1
        // atan2 is -PI to PI
        const angle = Math.atan2(vy, vx);
        return (angle + Math.PI) / (2 * Math.PI);
    }

    // General access
    get(type: NoiseType, x: number, y: number, params: NoiseParams, seed?: number): number {
        switch (type) {
            case 'simplex': {
                // FBM for simplex (if octaves=1 it's just simplex)
                // Normalize -1..1 to 0..1
                const val = this.fbmGeneric(x, y, params, (nx, ny) => this.noise2D(nx, ny));
                return (val + 1) / 2;
            }
            case 'perlin': {
                // FBM for perlin
                // Normalize -1..1 to 0..1
                const val = this.fbmGeneric(x, y, params, (nx, ny) => this.perlin2D(nx, ny));
                return (val + 1) / 2;
            }
            case 'turbulence':
                return this.turbulence(x, y, params);
            case 'marble':
                return this.marble(x, y, params);
            case 'curl':
                return this.curl(x, y, params);
            case 'cells':
                return this.cells(x, y, params.scale, seed ?? 0);
            default:
                return (this.simplex(x, y, params.scale) + 1) / 2;
        }
    }
}
