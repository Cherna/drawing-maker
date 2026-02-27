import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { AppConfig, Layer } from '../types';
import { PipelineSketch } from '../sketches/pipeline-sketch';
import { generateGCode, generateGCodeForLayers, computeGCodeStats } from '../core/gcode';
import { modelToSVG, layersToSVG, modelToSVGWithColor, getModelStats, modelToAnimatedSVG } from '../core/svg-exporter';
import { Pipeline } from '../core/pipeline';

const app = express();
const PORT = 3333;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
        previewConfig.params.steps?.forEach((step: any) => {
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
            const layerModels = await Pipeline.executeLayered(layers, previewConfig.canvas, previewConfig.params.seed, previewConfig.gcode);

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
            const stats = computeGCodeStats(finalModel, previewConfig);
            res.json({ svg, stats });
        } else {
            // Backward compatibility: use old pipeline for non-layered configs
            const model = await Pipeline.execute(previewConfig.params.steps || [], previewConfig.canvas, previewConfig.params.seed, previewConfig.gcode);
            const svg = modelToSVG(model, previewConfig.canvas);
            const stats = computeGCodeStats(model, previewConfig);
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
            const layerModels = await Pipeline.executeLayered(layers, config.canvas, config.params.seed, config.gcode);

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
            const model = await Pipeline.execute(config.params.steps || [], config.canvas, config.params.seed, config.gcode);
            const svg = modelToSVG(model, config.canvas);
            const gcode = generateGCode(model, config, config.gcode.postProcessor || 'standard');

            res.json({ svg, gcode });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

import sharp from 'sharp';

const SKETCHES_DIR = path.join(__dirname, '../../sketches');
const THUMBNAILS_DIR = path.join(SKETCHES_DIR, '_thumbnails');

if (!fs.existsSync(SKETCHES_DIR)) {
    fs.mkdirSync(SKETCHES_DIR);
}
if (!fs.existsSync(THUMBNAILS_DIR)) {
    fs.mkdirSync(THUMBNAILS_DIR);
}

// Helper: Generate thumbnail PNG
async function generateThumbnail(config: AppConfig): Promise<Buffer> {
    const previewConfig = createPreviewConfig(config);
    const layers = previewConfig.params?.layers as Layer[] | undefined;

    let finalModel: MakerJs.IModel = { models: {} };
    const layerData = new Map<string, { model: MakerJs.IModel, color: string, opacity?: number, strokeWidth?: number }>();

    if (layers && layers.length > 0) {
        const layerModels = await Pipeline.executeLayered(layers, previewConfig.canvas, previewConfig.params.seed, previewConfig.gcode);

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

        if (previewConfig.params.globalSteps && previewConfig.params.globalSteps.length > 0) {
            finalModel = await Pipeline.executeOnModel(finalModel, previewConfig.params.globalSteps, previewConfig.canvas, previewConfig.params.seed);
            // Re-map modified models back to layerData for SVG generation
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
    } else {
        const model = await Pipeline.execute(previewConfig.params.steps || [], previewConfig.canvas, previewConfig.params.seed, previewConfig.gcode);
        finalModel = model;
        layerData.set('default', { model, color: '#000000' });
    }

    const svg = layersToSVG(layerData, previewConfig.canvas);
    return sharp(Buffer.from(svg)).png().resize(800).toBuffer();
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

        // Generate and save thumbnail
        try {
            const pngBuffer = await generateThumbnail(config);
            const thumbPath = path.join(THUMBNAILS_DIR, safeFilename.replace('.json', '.png'));
            const oldSvgPath = path.join(THUMBNAILS_DIR, safeFilename.replace('.json', '.svg'));

            // Clean up old SVG if it exists
            if (fs.existsSync(oldSvgPath)) {
                fs.unlinkSync(oldSvgPath);
            }

            fs.writeFileSync(thumbPath, pngBuffer);
            console.log(`Saved thumbnail to ${thumbPath}`);
        } catch (err) {
            console.error('Failed to generate thumbnail during save:', err);
        }

        res.json({ success: true, filename: safeFilename });
    } catch (error: any) {
        console.error('Save error:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: List sketches
app.get('/api/sketches', async (req, res) => {
    try {
        const files = fs.readdirSync(SKETCHES_DIR)
            .filter(f => f.endsWith('.json'))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        const sketches = files.map(filename => {
            try {
                const filePath = path.join(SKETCHES_DIR, filename);
                const stats = fs.statSync(filePath);
                const content = fs.readFileSync(filePath, 'utf8');
                const config = JSON.parse(content);

                return {
                    filename,
                    width: config.canvas?.width || 0,
                    height: config.canvas?.height || 0,
                    sizeBytes: stats.size,
                    modified: stats.mtime
                };
            } catch (e) {
                console.error(`Failed to parse sketch ${filename}:`, e);
                return {
                    filename,
                    width: 0,
                    height: 0,
                    sizeBytes: 0,
                    modified: new Date(0)
                };
            }
        });

        res.json({ files: sketches });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// API: Serve thumbnail
app.get('/api/thumbnails/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const thumbPath = path.join(THUMBNAILS_DIR, filename);

        if (fs.existsSync(thumbPath)) {
            res.sendFile(thumbPath);
        } else {
            res.status(404).send('Thumbnail not found');
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// API: Regenerate thumbnails
app.post('/api/regenerate-thumbnails', async (req, res) => {
    try {
        const files = fs.readdirSync(SKETCHES_DIR).filter(f => f.endsWith('.json'));
        let count = 0;
        let errors = 0;

        console.log(`Starting batch thumbnail generation for ${files.length} sketches...`);

        for (const file of files) {
            try {
                const sketchPath = path.join(SKETCHES_DIR, file);
                const thumbPath = path.join(THUMBNAILS_DIR, file.replace('.json', '.png'));
                const oldSvgPath = path.join(THUMBNAILS_DIR, file.replace('.json', '.svg'));

                // Clean up old SVG if it exists
                if (fs.existsSync(oldSvgPath)) {
                    fs.unlinkSync(oldSvgPath);
                }

                // Smart incremental generation:
                // If thumbnail exists and is newer than the sketch, skip it
                if (fs.existsSync(thumbPath)) {
                    const sketchStats = fs.statSync(sketchPath);
                    const thumbStats = fs.statSync(thumbPath);

                    if (thumbStats.mtime > sketchStats.mtime) {
                        // Thumbnail is up to date
                        continue;
                    }
                }

                const content = fs.readFileSync(sketchPath, 'utf8');
                const config = JSON.parse(content);
                const pngBuffer = await generateThumbnail(config);

                fs.writeFileSync(thumbPath, pngBuffer);
                count++;
                if (count % 5 === 0) console.log(`Generated ${count}/${files.length}...`);
            } catch (err) {
                console.error(`Failed to generate thumbnail for ${file}:`, err);
                errors++;
            }
        }

        console.log(`Thumbnail generation complete. Generated: ${count}, Errors: ${errors}`);
        res.json({ success: true, count, errors });
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

        // Cleanup thumbnails
        const thumbPng = path.join(THUMBNAILS_DIR, filename.replace('.json', '.png'));
        const thumbSvg = path.join(THUMBNAILS_DIR, filename.replace('.json', '.svg'));

        if (fs.existsSync(thumbPng)) fs.unlinkSync(thumbPng);
        if (fs.existsSync(thumbSvg)) fs.unlinkSync(thumbSvg);

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
            const layerModels = await Pipeline.executeLayered(layers, config.canvas, config.params.seed, config.gcode);
            model = { models: {} };
            for (const [id, layerModel] of layerModels) {
                model.models![id] = layerModel;
            }
        } else {
            model = await Pipeline.execute(config.params.steps || [], config.canvas, config.params.seed, config.gcode);
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
