# Implementation Plan - Generative XY Plotter System

**WorkingDirectory**: `c:\Users\chert\Documents\dev\drawing-maker`

This project is a TypeScript-based system to generating G-Code for pen plotters. It combines parametric design (Maker.js) with generative algorithms to create organic computer-generated art.

# Project Overview & Architecture

## Core Philosophy
The system works in a pipeline:
1.  **Source**: Helper functions generate base geometry (Grids, Shapes, Lines).
2.  **Effects**: Modifiers apply algorithms to the geometry (Warp, Noise, Scatter).
3.  **Export**: The final geometry is compiled into G-Code instructions.

## Technical Stack
*   **Geometry**: [Maker.js](https://maker.js.org/).
*   **Generative**: `simplex-noise`, `canvas-sketch-util`.
*   **Runtime**: Node.js + TypeScript.

---

# User API Design (The "Sketch" Interface)

To make applying noise intuitive, we will expose a functional API where you **Define Geometry** first, then **Flow** it through effects.

## 1. Defining Geometry
We will provide wrappers around Maker.js to make standard shapes easy to create.
```typescript
// Create a canvas/group
const sketch = new Sketch();

// Create basic shapes (returns a reference)
const box = sketch.add(new Shapes.Rectangle(100, 100));
const circle = sketch.add(new Shapes.Circle(50));

// Create a Grid of lines (great for noise)
const grid = sketch.add(Patterns.Grid({
    rows: 50, cols: 1, 
    size: [100, 100] 
}));
```

## 2. Applying Noise
Noise needs **Resolution**. A straight line has only 2 points (Start, End). To make it "wavy", we must first **Resample** it into many points.

### The Effect Pipeline
```typescript
// 1. Select what you want to affect (e.g., the grid)
// 2. Resample it: Split lines into 1mm segments
// 3. Apply Noise: Move points based on noise function

Effects.apply(grid, [
    // Step A: Add resolution
    Effects.Resample({ segmentLength: 1 }), 
    
    // Step B: Displace points
    Effects.Noise({
        algorithm: 'simplex', // or 'perlin'
        scale: 0.1,    // "Zoom" level of noise (Frequency)
        magnitude: 10, // How far to move grid points (Amplitude)
        axis: 'y'      // Only move up/down (creates terrain look)
    })
]);
```

### Noise Logic
*   **Scale (Frequency)**: Low number (0.01) = Rolling hills. High number (1.0) = Static fuzz.
*   **Magnitude (Amplitude)**: Low number = Subtle texture. High number = Huge spikes.
*   **Axis**: Lock noise to X or Y to create specific looks (like flowing hair or landscapes).

---

# Implementation Steps

## 1. Project Initialization
#### [NEW] [package.json](file:///c:/Users/chert/Documents/dev/drawing-maker/package.json)
- Dependencies: `makerjs`, `simplex-noise`, `canvas-sketch-util`.
- DevDependencies: `typescript`, `ts-node`, `nodemon`.

## 2. The Generator Core (`src/core`)
#### [NEW] [src/core/gcode-exporter.ts](file:///c:/Users/chert/Documents/dev/drawing-maker/src/core/gcode-exporter.ts)
- Base G-Code string generation.

#### [NEW] [src/core/sketch.ts](file:///c:/Users/chert/Documents/dev/drawing-maker/src/core/sketch.ts)
- Wrapper class to hold the top-level Maker.js model.

## 3. Effects Engine (`src/lib`)

#### [NEW] [src/lib/effects.ts](file:///c:/Users/chert/Documents/dev/drawing-maker/src/lib/effects.ts)
- `resample(model, length)`: Traverses paths, subdivides them.
- `displace(model, fn)`: The low-level mover.
- `noise(options)`: The user-facing noise effect.

#### [NEW] [src/lib/shapes.ts](file:///c:/Users/chert/Documents/dev/drawing-maker/src/lib/shapes.ts)
- Simplified constructors for Rectangle, Circle, Line.

## 4. Verification
#### [NEW] [src/main.ts](file:///c:/Users/chert/Documents/dev/drawing-maker/src/main.ts)
- Will implement the specific `grid` + `noise` example above to verify the API feels right.

## Verification Plan
1.  **Install & Setup**: `npm install`.
2.  **Run Watch**: `npm run dev`.
3.  **Visual Check**: Verify `output.gcode` in a viewer shows a wary grid pattern matching the API settings.
