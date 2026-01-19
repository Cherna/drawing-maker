import MakerJs from 'makerjs';
import { PipelineStep, CanvasConfig } from '../types';
import { Patterns } from '../lib/patterns';
import { Effects } from '../lib/effects';
import { Layout } from '../lib/layout';
import { Masks } from '../lib/masks';

type GeneratorFn = (params: any, ctx: CanvasConfig) => MakerJs.IModel | Promise<MakerJs.IModel>;
type ModifierFn = (model: MakerJs.IModel, params: any, ctx: CanvasConfig, mask?: (x: number, y: number) => number) => Promise<MakerJs.IModel | void> | MakerJs.IModel | void;

const GENERATORS: Record<string, GeneratorFn> = {
    'stripes': (params, ctx) => {
        const bounds = Layout.getDrawArea(ctx.width, ctx.height, ctx.margin);
        return Patterns.Stripes(params.lines || 50, bounds.width, bounds.height);
    }
};

const MODIFIERS: Record<string, ModifierFn> = {
    'resample': (model, params) => {
        return Effects.resample(model, params.res || 5);
    },
    'noise': (model, params, ctx, mask) => {
        Effects.noise(model, params, mask);
    },
    'trim': (model, params, ctx, mask) => {
        Effects.trim(model, params.threshold || 0.5, mask || (() => 1));
    },
    'rotate': (model, params, ctx) => {
        const bounds = Layout.getDrawArea(ctx.width, ctx.height, ctx.margin);
        const origin = [bounds.width / 2, bounds.height / 2];
        MakerJs.model.rotate(model, params.rotation || 0, origin);
    },
    'move': (model, params) => {
        MakerJs.model.move(model, [params.x || 0, params.y || 0]);
    },
    'clone': async (model, params, ctx) => {
        let clone = MakerJs.cloneObject(model);

        if (params.steps && Array.isArray(params.steps)) {
            const bounds = Layout.getDrawArea(ctx.width, ctx.height, ctx.margin);
            const localBounds = { x: 0, y: 0, width: bounds.width, height: bounds.height };

            for (const step of params.steps) {
                if (MODIFIERS[step.tool]) {
                    const maskFn = step.mask ? Masks.create(step.mask, localBounds) : undefined;
                    const result = await MODIFIERS[step.tool](clone, step.params, ctx, maskFn);
                    if (result) {
                        clone = result;
                    }
                }
            }
        }

        if (!model.models) model.models = {};
        const id = `clone_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        model.models[id] = clone;
    }
};

export class Pipeline {
    static async execute(steps: PipelineStep[], ctx: CanvasConfig): Promise<MakerJs.IModel> {
        let currentModel: MakerJs.IModel | null = null;
        const bounds = Layout.getDrawArea(ctx.width, ctx.height, ctx.margin);
        const localBounds = { x: 0, y: 0, width: bounds.width, height: bounds.height };

        for (const step of steps) {
            console.log(`Pipeline: Executing ${step.tool}...`);

            // 1. Generator
            if (GENERATORS[step.tool]) {
                const model = await GENERATORS[step.tool](step.params, ctx);
                if (currentModel) {
                    currentModel = {
                        models: {
                            prev: currentModel,
                            new: model
                        }
                    };
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

                const maskFn = step.mask ? Masks.create(step.mask, localBounds) : undefined;
                const result = await MODIFIERS[step.tool](currentModel, step.params, ctx, maskFn);

                if (result) {
                    currentModel = result;
                }
                continue;
            }

            console.warn(`Pipeline Warning: Unknown tool '${step.tool}'`);
        }

        if (!currentModel) {
            return { models: {} };
        }

        // Apply margin offset at the very end
        MakerJs.model.move(currentModel, [bounds.x, bounds.y]);

        return currentModel;
    }
}
