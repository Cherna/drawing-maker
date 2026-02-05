import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { AppConfig, Layer } from '../types';
import { PipelineSketch } from '../sketches/pipeline-sketch';
import { generateGCode, generateGCodeForLayers } from '../core/gcode';
import { modelToSVG, layersToSVG, modelToSVGWithColor, getModelStats, modelToAnimatedSVG } from '../core/svg-exporter';
import { Pipeline } from '../core/pipeline';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Only serve static files in production (when React app is built)
// In development, Vite dev server handles the frontend
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../../dist')));
    // Serve index.html for all non-API routes (SPA routing)
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../../dist/index.html'));
    });
}

// Lightweight preview - uses lower resolution for speed
function createPreviewConfig(config: AppConfig): AppConfig {
    const previewConfig = JSON.parse(JSON.stringify(config)); // Deep clone

    // Reduce resolution for preview
    if (previewConfig.params?.steps) {
        previewConfig.params.steps.forEach((step: any) => {
            if (step.tool === 'resample') {
                if (step.params?.detail) {
                    // Lower detail for preview (less aggressive reduction)
                    step.params.detail = Math.max(0.1, step.params.detail * 0.75);
                } else if (step.params?.res) {
                    // Use higher resolution value (lower detail) for preview
                    step.params.res = Math.max(0.5, step.params.res * 1.5);
                }
            }
            // Reduce line counts for preview
            if (step.tool === 'stripes' || step.tool === 'vertical-stripes') {
                if (step.params?.lines > 100) {
                    step.params.lines = Math.floor(step.params.lines * 0.8);
                }
            }
            if (step.tool === 'grid') {
                if (step.params?.lines > 50) {
                    step.params.lines = Math.floor(step.params.lines / 2);
                }
                if (step.params?.linesX > 50) {
                    step.params.linesX = Math.floor(step.params.linesX / 2);
                }
                if (step.params?.linesY > 50) {
                    step.params.linesY = Math.floor(step.params.linesY / 2);
                }
            }
        });
    }

    return previewConfig;
}

// API: Generate preview (lightweight)

app.post('/api/preview', async (req, res) => {
    try {
        const config: AppConfig = req.body;
        const previewConfig = createPreviewConfig(config);

        // Check if we have a layer-based configuration
        const layers = previewConfig.params?.layers as Layer[] | undefined;

        if (layers && layers.length > 0) {
            // New layer-aware rendering
            const layerModels = await Pipeline.executeLayered(layers, previewConfig.canvas, previewConfig.params.seed);

            // Build layer data for rendering
            const layerData = new Map<string, { model: MakerJs.IModel, color: string, opacity?: number, strokeWidth?: number }>();
            let finalModel: MakerJs.IModel = { models: {} };

            for (const layer of layers) {
                if (!layer.visible) continue;

                const model = layerModels.get(layer.id);
                if (!model) continue;

                layerData.set(layer.id, {
                    model,
                    color: layer.color || '#000000',
                    opacity: layer.opacity,
                    strokeWidth: layer.strokeWidth
                });

                finalModel.models![layer.id] = model;
            }

            // Apply global modifiers if present
            if (previewConfig.params.globalSteps && previewConfig.params.globalSteps.length > 0) {
                finalModel = await Pipeline.executeOnModel(finalModel, previewConfig.params.globalSteps, previewConfig.canvas, previewConfig.params.seed);

                // Update layerData with modified models so they appear in the SVG
                if (finalModel.models) {
                    for (const layer of layers) {
                        if (finalModel.models[layer.id]) {
                            const data = layerData.get(layer.id);
                            if (data) {
                                data.model = finalModel.models[layer.id];
                            }
                        }
                    }
                }
            }

            const svg = layersToSVG(layerData, previewConfig.canvas);
            const stats = getModelStats(finalModel);
            res.json({ svg, stats });
        } else {
            // Backward compatibility: use old pipeline for non-layered configs
            const sketch = new PipelineSketch();
            const model = await sketch.generate(previewConfig.canvas, previewConfig.params);
            const svg = modelToSVG(model, previewConfig.canvas);
            const stats = getModelStats(model);
            res.json({ svg, stats });
        }
    } catch (error: any) {
        console.error('Preview error:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ error: error.message });
    }
});

// API: Full export (high quality)
app.post('/api/export', async (req, res) => {
    try {
        const config: AppConfig = req.body;
        const exportMode = req.query.mode as 'combined' | 'individual' | undefined;
        const layerId = req.query.layerId as string | undefined;

        const layers = config.params?.layers as Layer[] | undefined;

        // If specific layer requested
        if (layerId && layers) {
            const layer = layers.find(l => l.id === layerId);
            if (!layer) {
                res.status(404).json({ error: `Layer '${layerId}' not found` });
                return;
            }

            // Process just this layer
            const layerModels = await Pipeline.executeLayered([layer], config.canvas, config.params.seed);
            const model = layerModels.get(layer.id);

            if (!model) {
                res.status(500).json({ error: `Failed to process layer '${layer.name}'` });
                return;
            }

            const svg = modelToSVGWithColor(model, config.canvas, layer.color || '#000000', layer.opacity, layer.strokeWidth);
            const gcode = generateGCode(model, config, config.gcode.postProcessor || 'standard');

            res.json({ svg, gcode, layerName: layer.name });
            return;
        }

        // Check if we have a layer-based configuration
        if (layers && layers.length > 0) {
            // New layer-aware export
            const layerModels = await Pipeline.executeLayered(layers, config.canvas, config.params.seed);

            if (exportMode === 'individual') {
                // Export each layer separately
                const layerExports: { [key: string]: { svg: string, gcode: string, name: string } } = {};

                for (const layer of layers) {
                    const model = layerModels.get(layer.id);
                    if (model) {
                        layerExports[layer.id] = {
                            svg: modelToSVGWithColor(model, config.canvas, layer.color || '#000000', layer.opacity, layer.strokeWidth),
                            gcode: generateGCode(model, config, config.gcode.postProcessor || 'standard'),
                            name: layer.name
                        };
                    }
                }

                res.json({ layers: layerExports });
            } else {
                // Export combined (default)
                // Export combined (default)
                const layerData = new Map<string, { model: MakerJs.IModel, color: string, opacity?: number, strokeWidth?: number }>();

                // Container for global modifiers
                let finalModel: MakerJs.IModel = { models: {} };
                for (const [id, model] of layerModels) {
                    finalModel.models![id] = model;
                }

                // Apply global modifiers if present
                if (config.params.globalSteps && config.params.globalSteps.length > 0) {
                    finalModel = await Pipeline.executeOnModel(finalModel, config.params.globalSteps, config.canvas, config.params.seed);
                }

                // Reconstruct layer data from final model
                if (finalModel.models) {
                    for (const layer of layers) {
                        if (finalModel.models[layer.id]) {
                            layerData.set(layer.id, {
                                model: finalModel.models[layer.id],
                                color: layer.color || '#000000',
                                opacity: layer.opacity,
                                strokeWidth: layer.strokeWidth
                            });
                        }
                    }
                    // Add any extra models created by global modifiers
                    for (const key in finalModel.models) {
                        if (!layerData.has(key)) {
                            layerData.set(key, {
                                model: finalModel.models[key],
                                color: '#000000',
                                opacity: 1,
                                strokeWidth: 1
                            });
                        }
                    }
                } else {
                    // Flattened or simple model
                    layerData.set('combined', {
                        model: finalModel,
                        color: '#000000'
                    });
                }

                const svg = layersToSVG(layerData, config.canvas);

                // For GCode, we should probably use the finalModel directly if we want a single file
                // But generateGCodeForLayers expects a Map.
                // We can use the reconstructed layerData map (which contains models).
                // Convert layerData values back to Map<string, IModel>
                const gcodeModels = new Map<string, MakerJs.IModel>();
                layerData.forEach((val, key) => gcodeModels.set(key, val.model));

                const gcode = generateGCodeForLayers(gcodeModels, config, config.gcode.postProcessor || 'standard');

                res.json({ svg, gcode });


            }
        } else {
            // Backward compatibility: use old pipeline for non-layered configs
            const sketch = new PipelineSketch();
            const model = await sketch.generate(config.canvas, config.params);
            const svg = modelToSVG(model, config.canvas);
            const gcode = generateGCode(model, config, config.gcode.postProcessor || 'standard');

            res.json({ svg, gcode });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

const SKETCHES_DIR = path.join(__dirname, '../../sketches');
if (!fs.existsSync(SKETCHES_DIR)) {
    fs.mkdirSync(SKETCHES_DIR);
}

// API: Save sketch
app.post('/api/save', async (req, res) => {
    try {
        const { filename, config, overwrite } = req.body;
        if (!filename || !config) {
            return res.status(400).json({ error: 'Filename and config are required' });
        }

        let baseName = filename.replace(/\.json$/, '');
        let safeFilename = `${baseName}.json`;
        let filePath = path.join(SKETCHES_DIR, safeFilename);

        // Auto-increment if file exists AND overwrite is not true
        if (fs.existsSync(filePath) && !overwrite) {
            let counter = 1;
            while (true) {
                const nextName = `${baseName}${counter}.json`;
                const nextPath = path.join(SKETCHES_DIR, nextName);
                if (!fs.existsSync(nextPath)) {
                    safeFilename = nextName;
                    filePath = nextPath;
                    break;
                }
                counter++;
            }
        }

        fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
        console.log(`Saved sketch to ${filePath}`);

        res.json({ success: true, filename: safeFilename });
    } catch (error: any) {
        console.error('Save error:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: List sketches
app.get('/api/sketches', async (req, res) => {
    try {
        const files = fs.readdirSync(SKETCHES_DIR).filter(f => f.endsWith('.json'));
        res.json({ files });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// API: Load sketch
app.get('/api/sketches/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(SKETCHES_DIR, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Sketch not found' });
        }

        const content = fs.readFileSync(filePath, 'utf8');
        res.json(JSON.parse(content));
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// API: Delete sketch
app.delete('/api/sketches/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(SKETCHES_DIR, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Sketch not found' });
        }

        fs.unlinkSync(filePath);
        console.log(`Deleted sketch: ${filePath}`);
        res.json({ success: true, filename });
    } catch (error: any) {
        console.error('Delete error:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: Export animated SVG
app.post('/api/export-animated', async (req, res) => {
    try {
        const config: AppConfig = req.body;
        const layers = config.params?.layers as Layer[] | undefined;

        let model: MakerJs.IModel;

        if (layers && layers.length > 0) {
            const layerModels = await Pipeline.executeLayered(layers, config.canvas, config.params.seed);
            model = { models: {} };
            for (const [id, layerModel] of layerModels) {
                model.models![id] = layerModel;
            }
        } else {
            const sketch = new PipelineSketch();
            model = await sketch.generate(config.canvas, config.params);
        }

        const animatedSvg = modelToAnimatedSVG(model, config.canvas, {
            duration: 10,
            stagger: 0.05
        });

        res.json({ svg: animatedSvg });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    if (process.env.NODE_ENV === 'production') {
        console.log(`🎨 Drawing Maker server running at http://localhost:${PORT}`);
    } else {
        console.log(`🎨 Drawing Maker API server running at http://localhost:${PORT}`);
        console.log(`   React app available at http://localhost:5173`);
    }
});
