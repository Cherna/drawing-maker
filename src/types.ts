import MakerJs from 'makerjs';

// CSS-style margin: [all] | [vertical, horizontal] | [top, right, bottom, left]
export type MarginConfig = number | [number, number] | [number, number, number, number];

export interface CanvasConfig {
    width: number;
    height: number;
    margin: MarginConfig;
}

// Mask types - geometric and procedural
export type MaskType = 
    | 'radial'      // Circular gradient
    | 'linear'      // Linear gradient
    | 'border'      // Edge feathering
    | 'noise'       // Simplex noise
    | 'turbulence'  // Multi-octave fractal noise
    | 'cells'       // Voronoi/cellular pattern
    | 'waves'       // Sine wave pattern
    | 'checker';    // Checkerboard pattern

// Mask combination operations
export type MaskOp = 'multiply' | 'add' | 'subtract' | 'max' | 'min' | 'screen';

export interface MaskConfig {
    type: MaskType;
    params: any;
    invert?: boolean;
    // Post-processing
    threshold?: number;      // Convert to hard edge at this value (0-1)
    remap?: [number, number]; // Remap output range [min, max]
    // Combining masks
    op?: MaskOp;             // How to combine with previous mask (default: multiply)
}

// Pipeline Types

export interface PipelineStep {
    tool: string; // "stripes", "noise", "rotate"
    params: any;
    mask?: MaskConfig | MaskConfig[]; // Only applies to modifiers
}

export interface PipelineParams {
    steps: PipelineStep[];
    seed?: number; // Global seed for reproducibility
}

export interface GCodeConfig {
    feedRate: number;
    zUp: number;
    zDown: number;
}

export interface SketchGenerator {
    generate(canvas: CanvasConfig, params: any): MakerJs.IModel | Promise<MakerJs.IModel>;
}

export interface AppConfig {
    sketch: string; // Name of the sketch to run
    outputBaseName: string; // e.g., "drawing"
    canvas: CanvasConfig;
    gcode: GCodeConfig;
    params: any; // Sketch specific parameters
}
