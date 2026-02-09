import MakerJs from 'makerjs';

// CSS-style margin: [all] | [vertical, horizontal] | [top, right, bottom, left]
export type MarginConfig = number | [number, number] | [number, number, number, number];

export interface CanvasConfig {
    width: number;
    height: number;
    margin: MarginConfig;
    showAxisIndicator?: boolean;
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
    | 'checker'     // Checkerboard pattern
    | 'marble'      // Marble noise pattern
    | 'simplex'     // Simplex noise
    | 'perlin'      // Perlin noise
    | 'cubes';      // Isometric cubes pattern

// Mask combination operations
export type MaskOp = 'multiply' | 'add' | 'subtract' | 'max' | 'min' | 'screen';

export interface MaskConfig {
    type: MaskType;
    params: any;
    invert?: boolean;
    // Post-processing
    // Post-processing
    threshold?: number;      // Convert to hard edge at this value (0-1)
    contrast?: number;       // Contrast (scaling centers on 0.5)
    brightness?: number;     // Brightness (shift values up/down)
    remap?: [number, number]; // Remap output range [min, max]
    // Combining masks
    op?: MaskOp;             // How to combine with previous mask (default: multiply)
}

// Layer Types

export interface Layer {
    id: string;
    name: string;
    steps: PipelineStep[];
    visible: boolean;    // Required: whether layer is visible/rendered
    color: string;       // Hex color code (e.g., "#FF5733")
    opacity?: number;    // Optional: 0-1 for layer transparency
    strokeWidth?: number; // Optional: stroke width in mm
}

export interface LayerExportOptions {
    mode: 'combined' | 'individual';  // Export all layers together or separately
    format: 'svg' | 'gcode' | 'both';
    layerId?: string;                 // If set, export only this specific layer
}

// Pipeline Types

export interface PipelineStep {
    tool: string; // "stripes", "noise", "rotate"
    params: any;
    mask?: MaskConfig | MaskConfig[]; // Only applies to modifiers
    enabled?: boolean; // If false, step is skipped (muted)
}

export interface PipelineParams {
    steps?: PipelineStep[];        // Flattened steps for backward compatibility
    seed?: number;                // Global seed for reproducibility
    layers?: Layer[];             // Array of layer objects (new layer system)
    activeLayerId?: string;       // Currently selected layer in UI
    globalSteps?: PipelineStep[]; // Steps applied after merging all layers
}

export interface GCodeConfig {
    feedRate: number;
    travelRate: number;
    zUp: number;
    zDown: number;
    zSafe?: number;              // Safe clearance height for long travels (default: 40mm)
    postProcessor?: 'standard' | 'linuxcnc' | 'reprap';
    useArcs?: boolean;           // Use G2/G3 for circular paths (default: false)
    optimizePaths?: boolean;      // Sort paths to minimize travel (default: false)
    joinTolerance?: number;      // Distance in mm to merge adjacent paths (default: 0.1)
    dwellTime?: number;          // Pause in ms after Z-down (default: 0)
    invertX?: boolean;           // Invert X axis (positive becomes negative)
    invertY?: boolean;           // Invert Y axis (positive becomes negative)
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
    exportFormat?: 'svg' | 'gcode' | 'both';
}

export interface SketchMetadata {
    filename: string;
    width: number;
    height: number;
    sizeBytes: number;
    modified: string; // ISO date string
}
