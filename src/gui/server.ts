import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { AppConfig, Layer } from '../types';
import { PipelineSketch } from '../sketches/pipeline-sketch';
import { GCodeExporter } from '../core/gcode-exporter';
import { modelToSVG, layersToSVG, modelToSVGWithColor } from '../core/svg-exporter';
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

            // Build layer data map with colors for SVG export
            const layerData = new Map<string, { model: MakerJs.IModel, color: string, opacity?: number }>();
            for (const layer of layers) {
                const model = layerModels.get(layer.id);
                if (model) {
                    layerData.set(layer.id, {
                        model,
                        color: layer.color || '#000000',
                        opacity: layer.opacity
                    });
                }
            }

            const svg = layersToSVG(layerData, previewConfig.canvas);
            res.json({ svg });
        } else {
            // Backward compatibility: use old pipeline for non-layered configs
            const sketch = new PipelineSketch();
            const model = await sketch.generate(previewConfig.canvas, previewConfig.params);
            const svg = modelToSVG(model, previewConfig.canvas);
            res.json({ svg });
        }
    } catch (error: any) {
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

            const svg = modelToSVGWithColor(model, config.canvas, layer.color || '#000000', layer.opacity);
            const gcode = GCodeExporter.export(model, config.gcode);

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
                            svg: modelToSVGWithColor(model, config.canvas, layer.color || '#000000', layer.opacity),
                            gcode: GCodeExporter.export(model, config.gcode),
                            name: layer.name
                        };
                    }
                }

                res.json({ layers: layerExports });
            } else {
                // Export combined (default)
                const layerData = new Map<string, { model: MakerJs.IModel, color: string, opacity?: number }>();
                for (const layer of layers) {
                    const model = layerModels.get(layer.id);
                    if (model) {
                        layerData.set(layer.id, {
                            model,
                            color: layer.color || '#000000',
                            opacity: layer.opacity
                        });
                    }
                }

                const svg = layersToSVG(layerData, config.canvas);
                const gcode = GCodeExporter.exportLayers(layerModels, config.gcode);

                res.json({ svg, gcode });
            }
        } else {
            // Backward compatibility: use old pipeline for non-layered configs
            const sketch = new PipelineSketch();
            const model = await sketch.generate(config.canvas, config.params);
            const svg = modelToSVG(model, config.canvas);
            const gcode = GCodeExporter.export(model, config.gcode);

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
        const { filename, config } = req.body;
        if (!filename || !config) {
            return res.status(400).json({ error: 'Filename and config are required' });
        }

        const safeFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
        const filePath = path.join(SKETCHES_DIR, safeFilename);

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

app.listen(PORT, () => {
    if (process.env.NODE_ENV === 'production') {
        console.log(`🎨 Drawing Maker server running at http://localhost:${PORT}`);
    } else {
        console.log(`🎨 Drawing Maker API server running at http://localhost:${PORT}`);
        console.log(`   React app available at http://localhost:5173`);
    }
});
