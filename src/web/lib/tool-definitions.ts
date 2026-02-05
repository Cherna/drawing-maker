export interface ToolParamDef {
  key: string;
  label: string;
  type: 'number' | 'text' | 'select' | 'boolean';
  min?: number;
  max?: number;
  step?: number;
  default?: any;
  options?: string[];
  showIf?: (params: any) => boolean;
}

export interface ToolDefinition {
  category: 'generator' | 'modifier';
  label: string;
  params: ToolParamDef[];
  hasMask?: boolean;
  deprecated?: boolean;
}

export const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  // Generators
  'stripes': {
    category: 'generator',
    label: 'Stripes',
    params: [
      { key: 'lines', label: 'Lines', type: 'number', min: 1, max: 500, step: 1, default: 100 },
    ],
  },
  'vertical-stripes': {
    category: 'generator',
    label: 'Vertical Stripes',
    params: [
      { key: 'lines', label: 'Lines', type: 'number', min: 1, max: 500, step: 1, default: 100 },
    ],
  },
  'grid': {
    category: 'generator',
    label: 'Grid',
    params: [
      { key: 'lines', label: 'Lines (X&Y)', type: 'number', min: 1, max: 200, step: 1, default: 20 },
      { key: 'linesX', label: 'Lines X', type: 'number', min: 1, max: 200, step: 1 },
      { key: 'linesY', label: 'Lines Y', type: 'number', min: 1, max: 200, step: 1 },
    ],
  },
  'spiral': {
    category: 'generator',
    label: 'Spiral',
    params: [
      { key: 'turns', label: 'Turns', type: 'number', min: 1, max: 100, step: 1, default: 10 },
      { key: 'pointsPerTurn', label: 'Points/Turn', type: 'number', min: 10, max: 200, step: 1, default: 36 },
    ],
  },
  'concentric': {
    category: 'generator',
    label: 'Concentric Circles',
    params: [
      { key: 'count', label: 'Count', type: 'number', min: 1, max: 200, step: 1, default: 20 },
      { key: 'checkBounds', label: 'Clip Bounds', type: 'boolean', default: true },
    ],
  },
  'radial': {
    category: 'generator',
    label: 'Radial Lines',
    params: [
      { key: 'count', label: 'Count', type: 'number', min: 3, max: 360, step: 1, default: 36 },
    ],
  },
  'waves': {
    category: 'generator',
    label: 'Waves',
    params: [
      { key: 'lines', label: 'Lines', type: 'number', min: 1, max: 200, step: 1, default: 30 },
      { key: 'amplitude', label: 'Amplitude', type: 'number', min: 0, max: 50, step: 0.1 },
      { key: 'frequency', label: 'Frequency', type: 'number', min: 0.1, max: 10, step: 0.1, default: 3 },
    ],
  },
  'gilbert': {
    category: 'generator',
    label: 'Hilbert Curve',
    params: [
      { key: 'scale', label: 'Scale', type: 'number', min: 1, max: 100, step: 0.1, default: 10 },
    ],
  },
  'gyroid': {
    category: 'generator',
    label: 'Gyroid',
    params: [
      { key: 'scale', label: 'Scale', type: 'number', min: 0.1, max: 5, step: 0.1, default: 1 },
      { key: 'z', label: 'Z Slice', type: 'number', min: 0, max: 100, step: 0.1, default: 0 },
      { key: 'threshold', label: 'Threshold', type: 'number', min: 0, max: 0.5, step: 0.01, default: 0.1 },
    ],
  },
  'honeycomb': {
    category: 'generator',
    label: 'Honeycomb',
    params: [
      { key: 'radius', label: 'Radius', type: 'number', min: 1, max: 100, step: 0.1, default: 10 },
      { key: 'gap', label: 'Gap', type: 'number', min: 0, max: 50, step: 0.1, default: 0 },
      { key: 'rotation', label: 'Rotation', type: 'number', min: 0, max: 360, step: 1, default: 0 },
    ],
  },
  'phyllotaxis': {
    category: 'generator',
    label: 'Phyllotaxis',
    params: [
      { key: 'count', label: 'Count', type: 'number', min: 10, max: 2000, step: 10, default: 500 },
      { key: 'spacing', label: 'Spacing', type: 'number', min: 1, max: 20, step: 0.1, default: 5 },
      { key: 'flower', label: 'Angle', type: 'number', min: 0, max: 360, step: 0.1, default: 137.5 },
      { key: 'size', label: 'Point Size', type: 'number', min: 0, max: 20, step: 0.1, default: 0 },
    ],
  },
  'isometric': {
    category: 'generator',
    label: 'Isometric Grid',
    params: [
      { key: 'size', label: 'Size', type: 'number', min: 5, max: 100, step: 1, default: 20 },
    ],
  },
  'flow-field': {
    category: 'generator',
    label: 'Flow Field',
    params: [
      { key: 'count', label: 'Line Count', type: 'number', min: 10, max: 10000, step: 10, default: 500 },
      { key: 'steps', label: 'Line Length', type: 'number', min: 10, max: 10000, step: 10, default: 500 },
      { key: 'stepSize', label: 'Step Size', type: 'number', min: 0.1, max: 20, step: 0.1, default: 1 },
      { key: 'noiseScale', label: 'Noise Scale', type: 'number', min: 0.0001, max: 0.1, step: 0.0001, default: 0.002 },
      { key: 'distortion', label: 'Distortion', type: 'number', min: 0.1, max: 5, step: 0.1, default: 1 },
    ],
  },
  'superformula': {
    category: 'generator',
    label: 'Superformula',
    params: [
      { key: 'radius', label: 'Radius', type: 'number', min: 1, max: 200, step: 0.1, default: 50 },
      { key: 'm', label: 'Symmetry (m)', type: 'number', min: 0, max: 20, step: 0.5, default: 6 },
      { key: 'n1', label: 'Shape (n1)', type: 'number', min: 0.1, max: 50, step: 0.1, default: 1 },
      { key: 'n2', label: 'Shape (n2)', type: 'number', min: 0.1, max: 50, step: 0.1, default: 1 },
      { key: 'n3', label: 'Shape (n3)', type: 'number', min: 0.1, max: 50, step: 0.1, default: 1 },
      { key: 'a', label: 'Semi-axis (a)', type: 'number', min: 0.1, max: 10, step: 0.1, default: 1 },
      { key: 'b', label: 'Semi-axis (b)', type: 'number', min: 0.1, max: 10, step: 0.1, default: 1 },
      { key: 'count', label: 'Count', type: 'number', min: 1, max: 50, step: 1, default: 1 },
      { key: 'scaleStep', label: 'Scale Factor', type: 'number', min: 0.1, max: 1.5, step: 0.05, default: 0.9 },
      { key: 'rotateStep', label: 'Rotation Step', type: 'number', min: -180, max: 180, step: 5, default: 0 },
      { key: 'morphStep', label: 'Morph Step', type: 'number', min: -1, max: 1, step: 0.1, default: 0 },
    ],
  },
  'hatching': {
    category: 'generator',
    label: 'Hatching',
    params: [
      { key: 'lines', label: 'Lines', type: 'number', min: 1, max: 200, step: 1, default: 30 },
      { key: 'angle', label: 'Angle', type: 'number', min: 0, max: 180, step: 1, default: 45 },
      { key: 'bidirectional', label: 'Cross-hatch', type: 'boolean', default: false },
    ],
  },
  // Modifiers
  'clip': {
    category: 'modifier',
    label: 'Clip',
    params: [
      { key: 'top', label: 'Top Margin', type: 'number', min: 0, max: 100, step: 1, default: 0 },
      { key: 'right', label: 'Right Margin', type: 'number', min: 0, max: 100, step: 1, default: 0 },
      { key: 'bottom', label: 'Bottom Margin', type: 'number', min: 0, max: 100, step: 1, default: 0 },
      { key: 'left', label: 'Left Margin', type: 'number', min: 0, max: 100, step: 1, default: 0 },
    ],
  },
  'resample': {
    category: 'modifier',
    label: 'Resample',
    params: [
      { key: 'detail', label: 'Detail', type: 'number', min: 0.1, max: 20, step: 0.1, default: 1.0 },
    ],
  },
  'glitch1': {
    category: 'modifier',
    label: 'Glitch 1',
    params: [
      { key: 'iterations', label: 'Iterations', type: 'number', min: 1, max: 20, step: 1, default: 1 },
      { key: 'factor', label: 'Factor', type: 'number', min: 0.1, max: 1, step: 0.05, default: 0.5 },
    ],
  },
  'glitch2': {
    category: 'modifier',
    label: 'Glitch 2',
    params: [
      { key: 'iterations', label: 'Iterations', type: 'number', min: 1, max: 20, step: 1, default: 3 },
      { key: 'factor', label: 'Factor', type: 'number', min: 0.1, max: 2, step: 0.05, default: 0.5 },
    ],
  },
  'move': {
    category: 'modifier',
    label: 'Move',
    params: [
      { key: 'x', label: 'X (mm)', type: 'number', min: -500, max: 500, step: 1, default: 0 },
      { key: 'y', label: 'Y (mm)', type: 'number', min: -500, max: 500, step: 1, default: 0 },
    ],
  },
  'mirror': {
    category: 'modifier',
    label: 'Mirror',
    params: [
      { key: 'axis', label: 'Axis', type: 'select', options: ['x', 'y'], default: 'x' },
    ],
  },
  'array': {
    category: 'modifier',
    label: 'Array',
    params: [
      { key: 'count', label: 'Count', type: 'number', min: 1, max: 50, step: 1, default: 2 },
      { key: 'x', label: 'O. Set X', type: 'number', min: -200, max: 200, step: 1, default: 10 },
      { key: 'y', label: 'O. Set Y', type: 'number', min: -200, max: 200, step: 1, default: 0 },
    ],
  },

  'trim': {
    category: 'modifier',
    label: 'Trim',
    hasMask: true,
    params: [
      { key: 'threshold', label: 'Threshold', type: 'number', min: 0, max: 1, step: 0.01, default: 0.5 },
      { key: 'seed', label: 'Seed', type: 'number', min: 0, max: 99999, step: 1 },
    ],
  },
  'scale': {
    category: 'modifier',
    label: 'Scale',
    params: [
      { key: 'uniform', label: 'Uniform', type: 'boolean', default: true },
      { key: 'x', label: 'Scale X', type: 'number', min: 0.1, max: 5, step: 0.01, default: 1 },
      { key: 'y', label: 'Scale Y', type: 'number', min: 0.1, max: 5, step: 0.01, default: 1 },
    ],
  },
  'rotate': {
    category: 'modifier',
    label: 'Rotate',
    params: [
      { key: 'rotation', label: 'Degrees', type: 'number', min: -360, max: 360, step: 1, default: 0 },
    ],
  },
  'warp': {
    category: 'modifier',
    label: 'Warp',
    hasMask: true,
    params: [
      { key: 'type', label: 'Type', type: 'select', options: ['bulge', 'pinch', 'twist', 'wave', 'simplex', 'perlin', 'turbulence', 'marble', 'cells'], default: 'bulge' },
      { key: 'strength', label: 'Strength', type: 'number', min: 0, max: 50, step: 0.5, default: 10 },
      {
        key: 'frequency',
        label: 'Frequency / Scale',
        type: 'number',
        min: 0.0001,
        max: 0.5,
        step: 0.0001,
        default: 0.05,
        showIf: (p) => ['wave', 'simplex', 'perlin', 'turbulence', 'marble', 'cells', 'noise'].includes(p.type)
      },
      {
        key: 'octaves',
        label: 'Octaves',
        type: 'number',
        min: 1,
        max: 8,
        step: 1,
        default: 1,
        showIf: (p) => ['turbulence', 'marble', 'cells', 'noise'].includes(p.type)
      },
      {
        key: 'persistence',
        label: 'Persistence',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.5,
        showIf: (p) => ['turbulence', 'marble', 'cells', 'noise'].includes(p.type)
      },
      {
        key: 'lacunarity',
        label: 'Lacunarity',
        type: 'number',
        min: 1,
        max: 4,
        step: 0.1,
        default: 2,
        showIf: (p) => ['turbulence', 'marble', 'cells', 'noise'].includes(p.type)
      },
      {
        key: 'distortion',
        label: 'Distortion',
        type: 'number',
        min: 0,
        max: 50,
        step: 1,
        default: 10,
        showIf: (p) => ['marble'].includes(p.type)
      },
      {
        key: 'offsetX',
        label: 'Offset X',
        type: 'number',
        min: -500,
        max: 500,
        step: 0.1,
        default: 0,
        showIf: (p) => ['wave', 'simplex', 'perlin', 'turbulence', 'marble', 'cells', 'noise'].includes(p.type)
      },
      {
        key: 'offsetY',
        label: 'Offset Y',
        type: 'number',
        min: -500,
        max: 500,
        step: 0.1,
        default: 0,
        showIf: (p) => ['wave', 'simplex', 'perlin', 'turbulence', 'marble', 'cells', 'noise'].includes(p.type)
      },
      { key: 'seed', label: 'Seed', type: 'number', min: 0, max: 99999, step: 1 },
      { key: 'maskContrast', label: 'Mask Contrast', type: 'number', min: 0, max: 5, step: 0.1, default: 1 },
      { key: 'maskBrightness', label: 'Mask Brightness', type: 'number', min: -1, max: 1, step: 0.05, default: 0 },
      // Pattern adjustments
      { key: 'patternContrast', label: 'Pattern Contrast', type: 'number', min: 0, max: 5, step: 0.1, default: 1, showIf: (p) => ['simplex', 'perlin', 'turbulence', 'marble', 'cells', 'noise'].includes(p.type) },
      { key: 'patternBrightness', label: 'Pattern Brightness', type: 'number', min: -1, max: 1, step: 0.05, default: 0, showIf: (p) => ['simplex', 'perlin', 'turbulence', 'marble', 'cells', 'noise'].includes(p.type) },
    ],
  },
  'duplicate': {
    category: 'modifier',
    label: 'Duplicate',
    params: [],
  },
};

export const GENERATORS = Object.keys(TOOL_DEFINITIONS).filter(
  (key) => TOOL_DEFINITIONS[key].category === 'generator'
);

export const MODIFIERS = Object.keys(TOOL_DEFINITIONS).filter(
  (key) => TOOL_DEFINITIONS[key].category === 'modifier' && !TOOL_DEFINITIONS[key].deprecated
);
