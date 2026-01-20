import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { AppConfig } from '../types';
import { PipelineSketch } from '../sketches/pipeline-sketch';
import { GCodeExporter } from '../core/gcode-exporter';
import { modelToSVG } from '../core/svg-exporter';

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
            if (step.tool === 'resample' && step.params?.res) {
                // Use 2x lower resolution for preview
                step.params.res = Math.max(0.5, step.params.res * 2);
            }
            // Reduce line counts for preview
            if (step.tool === 'stripes' || step.tool === 'vertical-stripes') {
                if (step.params?.lines > 100) {
                    step.params.lines = Math.floor(step.params.lines / 2);
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
        
        const sketch = new PipelineSketch();
        const model = await sketch.generate(previewConfig.canvas, previewConfig.params);
        const svg = modelToSVG(model, previewConfig.canvas);
        
        res.json({ svg });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// API: Full export (high quality)
app.post('/api/export', async (req, res) => {
    try {
        const config: AppConfig = req.body;
        
        const sketch = new PipelineSketch();
        const model = await sketch.generate(config.canvas, config.params);
        const svg = modelToSVG(model, config.canvas);
        const gcode = GCodeExporter.export(model, config.gcode);
        
        res.json({ svg, gcode });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// API: Load config file
app.get('/api/configs', async (req, res) => {
    try {
        const configsDir = path.join(__dirname, '../../configs');
        const files = fs.readdirSync(configsDir).filter(f => f.endsWith('.json'));
        const configs = files.map(file => {
            const content = fs.readFileSync(path.join(configsDir, file), 'utf8');
            return { name: file, config: JSON.parse(content) };
        });
        res.json({ configs });
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
