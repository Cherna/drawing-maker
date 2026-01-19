import MakerJs from 'makerjs';

// CSS-style margin: [all] | [vertical, horizontal] | [top, right, bottom, left]
export type MarginConfig = number | [number, number] | [number, number, number, number];

export interface CanvasConfig {
    width: number;
    height: number;
    margin: MarginConfig;
}

export interface MaskConfig {
    type: 'radial' | 'linear' | 'noise';
    params: any;
    invert?: boolean;
}

export interface EffectConfig {
    type: string; // e.g. 'noise', 'sinewave'
    params: any;
    mask?: MaskConfig;
}

// Pipeline Types
export type ToolType = 'generator' | 'modifier' | 'transform';

export interface PipelineStep {
    tool: string; // "stripes", "noise", "rotate"
    type?: ToolType; // Optional if tool name is unique or inferred
    params: any;
    mask?: MaskConfig | MaskConfig[]; // Only applies to modifiers
}

export interface PipelineParams {
    steps: PipelineStep[];
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
