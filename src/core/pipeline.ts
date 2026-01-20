import MakerJs from 'makerjs';
import { PipelineStep, CanvasConfig, Layer } from '../types';
import { Patterns } from '../lib/patterns';
import { Effects } from '../lib/effects';
import { Layout, Box } from '../lib/layout';
import { Masks } from '../lib/masks';
import { Transformer } from './transformer';

type GeneratorFn = (params: any, ctx: CanvasConfig, bounds: Box) => MakerJs.IModel | Promise<MakerJs.IModel>;
type ModifierFn = (model: MakerJs.IModel, params: any, ctx: CanvasConfig, bounds: Box, mask?: (x: number, y: number) => number) => Promise<MakerJs.IModel | void> | MakerJs.IModel | void;

/**
 * Deep clone a MakerJs model, ensuring all paths and models are truly independent.
 * MakerJs.cloneObject should do this, but we add an extra safety layer.
 */
function deepCloneModel(model: MakerJs.IModel): MakerJs.IModel {
    const cloned = MakerJs.cloneObject(model);

    // Ensure paths are deeply cloned
    if (cloned.paths && model.paths) {
        const newPaths: { [key: string]: MakerJs.IPath } = {};
        for (const key in model.paths) {
            if (model.paths.hasOwnProperty(key)) {
                newPaths[key] = MakerJs.cloneObject(model.paths[key]);
            }
        }
        cloned.paths = newPaths;
    }

    // Ensure nested models are deeply cloned
    if (cloned.models && model.models) {
        const newModels: { [key: string]: MakerJs.IModel } = {};
        for (const key in model.models) {
            if (model.models.hasOwnProperty(key)) {
                newModels[key] = deepCloneModel(model.models[key]);
            }
        }
        cloned.models = newModels;
    }

    return cloned;
}

// ==================== GENERATORS ====================
const GENERATORS: Record<string, GeneratorFn> = {
    'stripes': (params, ctx, bounds) => {
        return Patterns.Stripes(params.lines || 50, bounds.width, bounds.height);
    },

    'vertical-stripes': (params, ctx, bounds) => {
        return Patterns.VerticalStripes(params.lines || 50, bounds.width, bounds.height);
    },

    'grid': (params, ctx, bounds) => {
        const countX = params.linesX || params.lines || 20;
        const countY = params.linesY || params.lines || 20;
        return Patterns.Grid(countX, countY, bounds.width, bounds.height);
    },

    'concentric': (params, ctx, bounds) => {
        return Patterns.Concentric(params.count || 20, bounds.width, bounds.height, {
            centerX: params.centerX,
            centerY: params.centerY,
            minRadius: params.minRadius
        });
    },

    'spiral': (params, ctx, bounds) => {
        return Patterns.Spiral(params.turns || 10, bounds.width, bounds.height, {
            centerX: params.centerX,
            centerY: params.centerY,
            pointsPerTurn: params.pointsPerTurn || 36,
            startRadius: params.startRadius,
            direction: params.direction
        });
    },

    'radial': (params, ctx, bounds) => {
        return Patterns.Radial(params.count || 36, bounds.width, bounds.height, {
            centerX: params.centerX,
            centerY: params.centerY,
            innerRadius: params.innerRadius,
            outerRadius: params.outerRadius
        });
    },

    'waves': (params, ctx, bounds) => {
        return Patterns.Waves(params.lines || 30, bounds.width, bounds.height, {
            amplitude: params.amplitude,
            frequency: params.frequency,
            phase: params.phase,
            segments: params.segments
        });
    },

    'hatching': (params, ctx, bounds) => {
        return Patterns.Hatching(params.lines || 30, bounds.width, bounds.height, {
            angle: params.angle,
            bidirectional: params.bidirectional
        });
    }
};

// ==================== MODIFIERS ====================
const MODIFIERS: Record<string, ModifierFn> = {
    'resample': (model, params) => {
        // Param is 'detail' (0.1 to 10). Resolution (distance) should be inverse.
        // Base resolution unit 1.0. 
        // Detail 1 -> Res 1. Detail 10 -> Res 0.1. Detail 0.1 -> Res 10.
        const detail = params.detail || params.res || 1.0;
        const resolution = 1.0 / Math.max(0.01, detail);
        return Effects.resample(model, resolution);
    },

    'noise': (model, params, ctx, bounds, mask) => {
        Effects.noise(model, {
            scale: params.scale || 0.05,
            magnitude: params.magnitude || 5,
            axis: params.axis,
            seed: params.seed,
            octaves: params.octaves,
            persistence: params.persistence,
            lacunarity: params.lacunarity
        }, mask);
    },

    'trim': (model, params, ctx, bounds, mask) => {
        Effects.trim(model, params.threshold || 0.5, mask || (() => 1), params.seed);
    },

    'scale': (model, params, ctx, bounds) => {
        const origin: [number, number] = [bounds.width / 2, bounds.height / 2];
        Effects.scale(model, params.x || params.scale || 1, params.y, origin);
    },

    'simplify': (model, params) => {
        Effects.simplify(model, params.tolerance || 0.5);
    },

    'rotate': (model, params, ctx, bounds) => {
        const origin = [bounds.width / 2, bounds.height / 2];
        MakerJs.model.rotate(model, params.rotation || 0, origin);
    },

    'move': (model, params) => {
        MakerJs.model.move(model, [params.x || 0, params.y || 0]);
    },

    'mirror': (model, params, ctx, bounds) => {
        const axis = params.axis || 'x';
        const normX = axis === 'x';
        const normY = axis === 'y';

        if (params.center) {
            // Mirror relative to model center (move to origin, mirror, move back)
            const extents = MakerJs.measure.modelExtents(model);
            const cx = (extents.low[0] + extents.high[0]) / 2;
            const cy = (extents.low[1] + extents.high[1]) / 2;
            MakerJs.model.move(model, [-cx, -cy]);
            MakerJs.model.mirror(model, normX, normY);
            MakerJs.model.move(model, [cx, cy]);
        } else {
            // Absolute mirror (flips coordinate)
            MakerJs.model.mirror(model, normX, normY);
        }
    },

    'array': (model, params, ctx, bounds) => {
        const count = Math.max(1, Math.floor(params.count || 2));
        const x = params.x || 0;
        const y = params.y || 0;

        const result: MakerJs.IModel = { models: {} };

        for (let i = 0; i < count; i++) {
            const clone = deepCloneModel(model);
            MakerJs.model.move(clone, [x * i, y * i]);
            result.models![`array_${i}`] = clone;
        }

        return result;
    },

    'warp': (model, params, ctx, bounds, mask) => {
        // Custom warp using parametric function
        // params.type: 'bulge', 'pinch', 'twist', 'wave'
        const type = params.type || 'bulge';
        const strength = params.strength || 10;
        const cx = bounds.width / 2;
        const cy = bounds.height / 2;

        let warpFn: (x: number, y: number) => { dx: number, dy: number };

        switch (type) {
            case 'bulge':
                // Pushes outward from center
                warpFn = (x, y) => {
                    const dx = x - cx;
                    const dy = y - cy;
                    const dist = Math.hypot(dx, dy);
                    const maxDist = Math.hypot(cx, cy);
                    const factor = 1 - (dist / maxDist);
                    return {
                        dx: (dx / (dist || 1)) * factor * strength,
                        dy: (dy / (dist || 1)) * factor * strength
                    };
                };
                break;
            case 'pinch':
                // Pulls toward center
                warpFn = (x, y) => {
                    const dx = x - cx;
                    const dy = y - cy;
                    const dist = Math.hypot(dx, dy);
                    const maxDist = Math.hypot(cx, cy);
                    const factor = dist / maxDist;
                    return {
                        dx: -(dx / (dist || 1)) * factor * strength,
                        dy: -(dy / (dist || 1)) * factor * strength
                    };
                };
                break;
            case 'twist':
                // Rotates around center, more at edges
                warpFn = (x, y) => {
                    const dx = x - cx;
                    const dy = y - cy;
                    const dist = Math.hypot(dx, dy);
                    const maxDist = Math.hypot(cx, cy);
                    const angle = (dist / maxDist) * (strength * Math.PI / 180);
                    const cos = Math.cos(angle);
                    const sin = Math.sin(angle);
                    const newDx = dx * cos - dy * sin;
                    const newDy = dx * sin + dy * cos;
                    return { dx: newDx - dx, dy: newDy - dy };
                };
                break;
            case 'wave':
                // Sinusoidal displacement
                const freq = params.frequency || 0.05;
                warpFn = (x, y) => ({
                    dx: Math.sin(y * freq * Math.PI * 2) * strength,
                    dy: Math.sin(x * freq * Math.PI * 2) * strength * (params.vertical ? 1 : 0)
                });
                break;
            default:
                warpFn = () => ({ dx: 0, dy: 0 });
        }

        Effects.warp(model, warpFn, mask);
    },

    'clone': async (model, params, ctx, bounds) => {
        let clone = deepCloneModel(model);
        const localBounds = { x: 0, y: 0, width: bounds.width, height: bounds.height };

        if (params.steps && Array.isArray(params.steps)) {
            for (const step of params.steps) {
                if (MODIFIERS[step.tool]) {
                    const seed = step.params?.seed ?? params.seed;
                    const maskFn = step.mask ? Masks.create(step.mask, localBounds, seed) : undefined;
                    const result = await MODIFIERS[step.tool](clone, step.params || {}, ctx, localBounds, maskFn);
                    if (result) {
                        clone = result;
                    }
                }
            }
        }

        if (!model.models) model.models = {};
        const id = `clone_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        model.models[id] = clone;
    },

    /**
     * Duplicate: Creates a copy of the current drawing and applies nested modifiers to it.
     * Useful for moire patterns or layered effects.
     * 
     * Example:
     * - duplicate: { steps: [{ tool: 'scale', params: { scale: 0.8 } }, { tool: 'rotate', params: { rotation: 5 } }] }
     * 
     * Creates a duplicate of the drawing up to this point, applies the nested steps to the duplicate,
     * then merges it back with the original.
     */
    'duplicate': async (model, params, ctx, bounds) => {
        // Create a deep copy of the current model (snapshot) - this is completely independent
        let duplicate = deepCloneModel(model);
        const localBounds = { x: 0, y: 0, width: bounds.width, height: bounds.height };

        // Apply nested steps to the duplicate ONLY
        // After each modifier, re-clone to ensure complete isolation
        if (params.steps && Array.isArray(params.steps)) {
            for (const step of params.steps) {
                if (MODIFIERS[step.tool]) {
                    const seed = step.params?.seed ?? params.seed;
                    const maskFn = step.mask ? Masks.create(step.mask, localBounds, seed) : undefined;

                    // Apply modifier to duplicate (works on the isolated copy)
                    const result = await MODIFIERS[step.tool](duplicate, step.params || {}, ctx, localBounds, maskFn);

                    // If modifier returned a new model, use it and ensure it's isolated
                    if (result) {
                        duplicate = deepCloneModel(result);
                    } else {
                        // Modifier mutated in-place, ensure duplicate is still isolated
                        duplicate = deepCloneModel(duplicate);
                    }
                }
            }
        }

        // Now merge the modified duplicate back with the original
        // Both models remain independent - we just combine their paths/models
        const combined: MakerJs.IModel = { paths: {}, models: {} };

        // Copy original paths (unchanged)
        if (model.paths) {
            for (const key in model.paths) {
                if (model.paths.hasOwnProperty(key)) {
                    combined.paths![key] = MakerJs.cloneObject(model.paths[key]);
                }
            }
        }

        // Copy duplicate paths (modified by nested steps)
        if (duplicate.paths) {
            if (!combined.paths) combined.paths = {};
            for (const key in duplicate.paths) {
                if (duplicate.paths.hasOwnProperty(key)) {
                    // Add with unique key to avoid collisions
                    const newKey = `dup_${key}`;
                    combined.paths[newKey] = MakerJs.cloneObject(duplicate.paths[key]);
                }
            }
        }

        // Copy original models
        if (model.models) {
            for (const key in model.models) {
                if (model.models.hasOwnProperty(key)) {
                    combined.models![key] = deepCloneModel(model.models[key]);
                }
            }
        }

        // Copy duplicate models
        if (duplicate.models) {
            if (!combined.models) combined.models = {};
            for (const key in duplicate.models) {
                if (duplicate.models.hasOwnProperty(key)) {
                    combined.models[key] = deepCloneModel(duplicate.models[key]);
                }
            }
        }

        return combined;
    },

    /**
     * Layer: Similar to duplicate, but applies a sub-pipeline to the duplicate.
     * More convenient than duplicate + manual steps.
     * 
     * Example:
     * - layer: { steps: [{ tool: 'rotate', params: { rotation: 5 } }] }
     * Creates a duplicate, applies the steps, then merges it back.
     */
    'layer': async (model, params, ctx, bounds) => {
        // Create duplicate
        let layer = deepCloneModel(model);
        const localBounds = { x: 0, y: 0, width: bounds.width, height: bounds.height };

        // Apply sub-pipeline to layer
        if (params.steps && Array.isArray(params.steps)) {
            for (const step of params.steps) {
                if (MODIFIERS[step.tool]) {
                    const seed = step.params?.seed ?? params.seed;
                    const maskFn = step.mask ? Masks.create(step.mask, localBounds, seed) : undefined;
                    const result = await MODIFIERS[step.tool](layer, step.params || {}, ctx, localBounds, maskFn);
                    if (result) {
                        layer = result;
                    }
                }
            }
        }

        // Add layer to model
        if (!model.models) model.models = {};
        const layerId = params.id || `layer_${Date.now()}`;
        model.models[layerId] = layer;

        return model;
    }
};

// ==================== PIPELINE EXECUTOR ====================
export class Pipeline {
    static async execute(steps: PipelineStep[], ctx: CanvasConfig, globalSeed?: number): Promise<MakerJs.IModel> {
        let currentModel: MakerJs.IModel | null = null;
        const bounds = Layout.getDrawArea(ctx.width, ctx.height, ctx.margin);
        const localBounds = { x: 0, y: 0, width: bounds.width, height: bounds.height };

        for (const step of steps) {
            if (step.enabled === false) {
                console.log(`Pipeline: Skipping muted step ${step.tool}`);
                continue;
            }
            console.log(`Pipeline: Executing ${step.tool}...`);

            // Get seed for this step (from step params, or global)
            const stepSeed = step.params?.seed ?? globalSeed;
            const stepParams = { ...step.params, seed: stepSeed };

            // 1. Generator
            if (GENERATORS[step.tool]) {
                const model = await GENERATORS[step.tool](stepParams, ctx, localBounds);

                if (currentModel) {
                    // Combine models by merging their paths/models
                    const combined: MakerJs.IModel = { paths: {}, models: {} };
                    if (currentModel.paths) Object.assign(combined.paths!, currentModel.paths);
                    if (currentModel.models) Object.assign(combined.models!, currentModel.models);
                    if (model.paths) Object.assign(combined.paths!, model.paths);
                    if (model.models) Object.assign(combined.models!, model.models);
                    currentModel = combined;
                } else {
                    currentModel = model;
                }
                continue;
            }

            // 2. Modifier
            if (MODIFIERS[step.tool]) {
                if (!currentModel) {
                    throw new Error(`Pipeline Error: Cannot apply modifier '${step.tool}' without a base model.`);
                }

                const maskFn = step.mask ? Masks.create(step.mask, localBounds, stepSeed) : undefined;
                const result = await MODIFIERS[step.tool](currentModel, stepParams, ctx, localBounds, maskFn);

                if (result) {
                    // Modifier returned a new model
                    currentModel = result;
                } else {
                    // Modifier mutated in-place (which is fine for base model)
                    // No need to update, currentModel was modified directly
                }
                continue;
            }

            console.warn(`Pipeline Warning: Unknown tool '${step.tool}'. Available generators: ${Object.keys(GENERATORS).join(', ')}. Modifiers: ${Object.keys(MODIFIERS).join(', ')}`);
        }

        if (!currentModel) {
            return { models: {} };
        }

        // Get the bounding box of the model
        const modelExtents = MakerJs.measure.modelExtents(currentModel);
        const modelWidth = modelExtents.high[0] - modelExtents.low[0];
        const modelHeight = modelExtents.high[1] - modelExtents.low[1];
        const modelCenterX = (modelExtents.low[0] + modelExtents.high[0]) / 2;
        const modelCenterY = (modelExtents.low[1] + modelExtents.high[1]) / 2;

        // Calculate scale to fit within draw area (maintaining aspect ratio)
        const padding = 0.98;
        const scaleX = (bounds.width * padding) / modelWidth;
        const scaleY = (bounds.height * padding) / modelHeight;
        const scale = Math.min(scaleX, scaleY, 1.0);

        // Center of draw area (in canvas coordinates)
        const drawCenterX = bounds.x + bounds.width / 2;
        const drawCenterY = bounds.y + bounds.height / 2;

        // Transform all paths: scale and center the model
        Transformer.displace(currentModel, (x, y) => ({
            x: (x - modelCenterX) * scale + drawCenterX,
            y: (y - modelCenterY) * scale + drawCenterY
        }));

        return currentModel;
    }

    /**
     * Process multiple layers independently and return a map of layer models.
     * Each layer is processed through its own pipeline and centered/scaled independently.
     * Only visible layers are processed.
     * 
     * @param layers Array of layer definitions
     * @param ctx Canvas configuration
     * @param globalSeed Optional global seed for reproducibility
     * @returns Map of layer IDs to their processed models
     */
    static async executeLayered(layers: Layer[], ctx: CanvasConfig, globalSeed?: number): Promise<Map<string, MakerJs.IModel>> {
        const result = new Map<string, MakerJs.IModel>();
        const bounds = Layout.getDrawArea(ctx.width, ctx.height, ctx.margin);
        const localBounds = { x: 0, y: 0, width: bounds.width, height: bounds.height };

        // Process each visible layer independently
        for (const layer of layers) {
            if (!layer.visible) {
                console.log(`Pipeline: Skipping hidden layer '${layer.name}'`);
                continue;
            }

            console.log(`Pipeline: Processing layer '${layer.name}' (${layer.steps.length} steps)...`);

            if (layer.steps.length === 0) {
                console.log(`Pipeline: Layer '${layer.name}' has no steps, skipping`);
                continue;
            }

            let currentModel: MakerJs.IModel | null = null;

            // Execute each step in the layer's pipeline
            for (const step of layer.steps) {
                if (step.enabled === false) {
                    console.log(`  - ${step.tool} (MUTED)`);
                    continue;
                }
                console.log(`  - ${step.tool}`);

                // Get seed for this step (from step params, or global)
                const stepSeed = step.params?.seed ?? globalSeed;
                const stepParams = { ...step.params, seed: stepSeed };

                // 1. Generator
                if (GENERATORS[step.tool]) {
                    const model = await GENERATORS[step.tool](stepParams, ctx, localBounds);

                    if (currentModel) {
                        // Combine with existing model
                        const combined: MakerJs.IModel = { paths: {}, models: {} };
                        if (currentModel.paths) Object.assign(combined.paths!, currentModel.paths);
                        if (currentModel.models) Object.assign(combined.models!, currentModel.models);
                        if (model.paths) Object.assign(combined.paths!, model.paths);
                        if (model.models) Object.assign(combined.models!, model.models);
                        currentModel = combined;
                    } else {
                        currentModel = model;
                    }
                    continue;
                }

                // 2. Modifier
                if (MODIFIERS[step.tool]) {
                    if (!currentModel) {
                        throw new Error(`Pipeline Error: Cannot apply modifier '${step.tool}' without a base model in layer '${layer.name}'.`);
                    }

                    const maskFn = step.mask ? Masks.create(step.mask, localBounds, stepSeed) : undefined;
                    const modifierResult = await MODIFIERS[step.tool](currentModel, stepParams, ctx, localBounds, maskFn);

                    if (modifierResult) {
                        // Modifier returned a new model
                        currentModel = modifierResult;
                    }
                    // else: modifier mutated in-place, currentModel already updated
                    continue;
                }

                console.warn(`  Pipeline Warning: Unknown tool '${step.tool}' in layer '${layer.name}'`);
            }

            // If layer produced a model, center and scale it
            if (currentModel && (currentModel.paths || currentModel.models)) {
                // Get the bounding box of the model
                const modelExtents = MakerJs.measure.modelExtents(currentModel);
                const modelWidth = modelExtents.high[0] - modelExtents.low[0];
                const modelHeight = modelExtents.high[1] - modelExtents.low[1];
                const modelCenterX = (modelExtents.low[0] + modelExtents.high[0]) / 2;
                const modelCenterY = (modelExtents.low[1] + modelExtents.high[1]) / 2;

                // Calculate scale to fit within draw area (maintaining aspect ratio)
                const padding = 0.98;
                const scaleX = (bounds.width * padding) / modelWidth;
                const scaleY = (bounds.height * padding) / modelHeight;
                const scale = Math.min(scaleX, scaleY, 1.0);

                // Center of draw area (in canvas coordinates)
                const drawCenterX = bounds.x + bounds.width / 2;
                const drawCenterY = bounds.y + bounds.height / 2;

                // Transform all paths: scale and center the model
                Transformer.displace(currentModel, (x, y) => ({
                    x: (x - modelCenterX) * scale + drawCenterX,
                    y: (y - modelCenterY) * scale + drawCenterY
                }));

                result.set(layer.id, currentModel);
            }
        }

        return result;
    }
}
