# Example Configurations

This document describes the example configuration files included with Drawing Maker.

## Quick Start Examples

### `default.json`
**Purpose:** Simple starting point  
Basic stripes with noise and clone/rotate to create moiré interference patterns.

```bash
npm run dev
# Then open the Web UI and select 'default.json' from the Load Config dropdown
```

### `pipeline_demo.json`
**Purpose:** Basic pipeline workflow  
Shows the core workflow: generate → resample → noise → clone/rotate.

### `moire_demo.json`
**Purpose:** Moire pattern using layer system  
Demonstrates the `layer` modifier to create interference patterns by duplicating and rotating layers.

## Mask Examples

### `feather_demo.json`
**Purpose:** Radial feathering effect  
Uses `trim` with an inverted radial mask to fade edges.

### `complex_feather_demo.json`
**Purpose:** Border feathering with uneven rates  
Demonstrates the `border` mask type for asymmetric edge fading.

## Layer System Examples

### `moire_demo.json`
**Purpose:** Moire pattern with layer system  
Demonstrates creating moire interference patterns using the `layer` modifier. Creates a base pattern (stripes + noise), duplicates it, and rotates the duplicate to create interference.

Key features demonstrated:
- `layer` modifier for creating separate layers
- Layer system for moire patterns
- Combining layers with transforms

## Advanced Examples

### `noise_mask_demo.json`
**Purpose:** Procedural masking with turbulence  
Shows how to use **noise-based masks** to create organic trimming patterns. The `turbulence` mask generates multi-octave fractal noise, and `threshold: 0.5` converts it to a hard edge.

Key features demonstrated:
- `turbulence` mask type
- `threshold` for hard edges
- Seeded randomness for reproducibility

### `spiral_demo.json`
**Purpose:** Spiral generator with radial mask  
Shows the `spiral` generator combined with a radial mask that applies more noise to the outer edges.

Key features demonstrated:
- `spiral` generator
- `radial` mask with `falloff: smooth`
- Inverted mask to affect edges more than center

### `combined_masks_demo.json`
**Purpose:** Complex mask combinations  
Demonstrates combining multiple masks with different operations:
- `cells` mask for organic cell patterns
- `turbulence` mask with radial mask using `op: max`
- Cross-hatching generator

Key features demonstrated:
- Multiple mask combination
- `cells` (Voronoi) mask type
- Mask operations (`multiply`, `max`)
- `remap` to adjust mask range

## Running Examples

1. Start the application:
   ```bash
   npm run dev
   ```
2. Open `http://localhost:5173`
3. Use the **Load Config** dropdown in the sidebar to select any of these examples.
4. The drawing will automatically render. You can then tweak parameters in real-time.

Output files are saved to `drawings/` as both SVG and G-Code.

## Creating Your Own

1. Start with `default.json` and modify
2. Add a `seed` for reproducible results
3. Experiment with different generators (`stripes`, `grid`, `spiral`, `concentric`, `radial`, `waves`, `hatching`)
4. Add masks to modifiers for spatial control
5. Try procedural masks (`noise`, `turbulence`, `cells`) for organic effects
6. Combine masks with `op` to create complex effects

See `PIPELINE_API.md` for complete documentation.
