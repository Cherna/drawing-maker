// API base URL
const API_BASE = window.location.origin;

// Default config structure
let config = {
    sketch: 'pipeline',
    outputBaseName: 'drawing',
    canvas: {
        width: 200,
        height: 300,
        margin: 20
    },
    gcode: {
        feedRate: 2000,
        zUp: 5,
        zDown: 0
    },
    params: {
        seed: Math.floor(Math.random() * 10000),
        steps: [
            {
                tool: 'stripes',
                params: { lines: 100 }
            },
            {
                tool: 'resample',
                params: { res: 1.0 }
            },
            {
                tool: 'noise',
                params: { scale: 0.05, magnitude: 5 }
            }
        ]
    }
};

let previewTimeout = null;
let isLoading = false;

// Tool definitions for UI
const TOOL_DEFINITIONS = {
    // Generators
    'stripes': {
        category: 'generator',
        label: 'Stripes',
        params: [
            { key: 'lines', label: 'Lines', type: 'number', min: 1, max: 500, step: 1, default: 100 }
        ]
    },
    'vertical-stripes': {
        category: 'generator',
        label: 'Vertical Stripes',
        params: [
            { key: 'lines', label: 'Lines', type: 'number', min: 1, max: 500, step: 1, default: 100 }
        ]
    },
    'grid': {
        category: 'generator',
        label: 'Grid',
        params: [
            { key: 'lines', label: 'Lines (X&Y)', type: 'number', min: 1, max: 200, step: 1, default: 20 },
            { key: 'linesX', label: 'Lines X', type: 'number', min: 1, max: 200, step: 1 },
            { key: 'linesY', label: 'Lines Y', type: 'number', min: 1, max: 200, step: 1 }
        ]
    },
    'spiral': {
        category: 'generator',
        label: 'Spiral',
        params: [
            { key: 'turns', label: 'Turns', type: 'number', min: 1, max: 100, step: 1, default: 10 },
            { key: 'pointsPerTurn', label: 'Points/Turn', type: 'number', min: 10, max: 200, step: 1, default: 36 }
        ]
    },
    'concentric': {
        category: 'generator',
        label: 'Concentric Circles',
        params: [
            { key: 'count', label: 'Count', type: 'number', min: 1, max: 200, step: 1, default: 20 }
        ]
    },
    'radial': {
        category: 'generator',
        label: 'Radial Lines',
        params: [
            { key: 'count', label: 'Count', type: 'number', min: 3, max: 360, step: 1, default: 36 }
        ]
    },
    'waves': {
        category: 'generator',
        label: 'Waves',
        params: [
            { key: 'lines', label: 'Lines', type: 'number', min: 1, max: 200, step: 1, default: 30 },
            { key: 'amplitude', label: 'Amplitude', type: 'number', min: 0, max: 50, step: 0.1 },
            { key: 'frequency', label: 'Frequency', type: 'number', min: 0.1, max: 10, step: 0.1, default: 3 }
        ]
    },
    'hatching': {
        category: 'generator',
        label: 'Hatching',
        params: [
            { key: 'lines', label: 'Lines', type: 'number', min: 1, max: 200, step: 1, default: 30 },
            { key: 'angle', label: 'Angle', type: 'number', min: 0, max: 180, step: 1, default: 45 },
            { key: 'bidirectional', label: 'Cross-hatch', type: 'boolean', default: false }
        ]
    },
    // Modifiers
    'resample': {
        category: 'modifier',
        label: 'Resample',
        params: [
            { key: 'res', label: 'Resolution', type: 'number', min: 0.1, max: 10, step: 0.1, default: 1.0 }
        ]
    },
    'noise': {
        category: 'modifier',
        label: 'Noise',
        params: [
            { key: 'scale', label: 'Scale', type: 'number', min: 0.001, max: 0.5, step: 0.001, default: 0.05 },
            { key: 'magnitude', label: 'Magnitude', type: 'number', min: 0, max: 50, step: 0.1, default: 5 },
            { key: 'axis', label: 'Axis', type: 'select', options: ['both', 'x', 'y'], default: 'both' },
            { key: 'octaves', label: 'Octaves', type: 'number', min: 1, max: 8, step: 1, default: 1 },
            { key: 'seed', label: 'Seed', type: 'number', min: 0, max: 99999, step: 1 }
        ],
        hasMask: true
    },
    'trim': {
        category: 'modifier',
        label: 'Trim',
        params: [
            { key: 'threshold', label: 'Threshold', type: 'number', min: 0, max: 1, step: 0.01, default: 0.5 },
            { key: 'seed', label: 'Seed', type: 'number', min: 0, max: 99999, step: 1 }
        ],
        hasMask: true
    },
    'scale': {
        category: 'modifier',
        label: 'Scale',
        params: [
            { key: 'scale', label: 'Scale', type: 'number', min: 0.1, max: 5, step: 0.01, default: 1 },
            { key: 'x', label: 'Scale X', type: 'number', min: 0.1, max: 5, step: 0.01 },
            { key: 'y', label: 'Scale Y', type: 'number', min: 0.1, max: 5, step: 0.01 }
        ]
    },
    'rotate': {
        category: 'modifier',
        label: 'Rotate',
        params: [
            { key: 'rotation', label: 'Degrees', type: 'number', min: -360, max: 360, step: 1, default: 0 }
        ]
    },
    'warp': {
        category: 'modifier',
        label: 'Warp',
        params: [
            { key: 'type', label: 'Type', type: 'select', options: ['bulge', 'pinch', 'twist', 'wave'], default: 'bulge' },
            { key: 'strength', label: 'Strength', type: 'number', min: 0, max: 50, step: 0.5, default: 10 },
            { key: 'frequency', label: 'Frequency', type: 'number', min: 0.001, max: 0.5, step: 0.001 }
        ],
        hasMask: true
    },
    'clone': {
        category: 'modifier',
        label: 'Clone',
        params: []
    }
};

const MASK_TYPES = ['radial', 'linear', 'border', 'noise', 'turbulence', 'cells', 'waves', 'checker'];

// UI rendering functions
function renderApp() {
    renderCanvasControls();
    renderGCodeControls();
    renderStepsControls();
    renderGlobalParams();
}

function renderCanvasControls() {
    const sidebar = document.getElementById('sidebar');
    let section = sidebar.querySelector('.canvas-section');
    if (!section) {
        section = document.createElement('div');
        section.className = 'sidebar-section canvas-section';
        section.innerHTML = '<h3>Canvas</h3>';
        sidebar.insertBefore(section, sidebar.firstChild);
    }
    
    section.innerHTML = `
        <h3>Canvas</h3>
        <div class="control-group">
            <label>Width (mm)</label>
            <input type="number" id="canvas-width" value="${config.canvas.width}" min="50" max="1000" step="1">
        </div>
        <div class="control-group">
            <label>Height (mm)</label>
            <input type="number" id="canvas-height" value="${config.canvas.height}" min="50" max="1000" step="1">
        </div>
        <div class="control-group">
            <label>Margin (mm)</label>
            <input type="number" id="canvas-margin" value="${Array.isArray(config.canvas.margin) ? config.canvas.margin[0] : config.canvas.margin}" min="0" max="100" step="1">
        </div>
        <div class="control-group">
            <label>Output Name</label>
            <input type="text" id="output-name" value="${config.outputBaseName}">
        </div>
    `;
    
    document.getElementById('canvas-width').addEventListener('input', (e) => {
        config.canvas.width = parseFloat(e.target.value);
        schedulePreview();
    });
    document.getElementById('canvas-height').addEventListener('input', (e) => {
        config.canvas.height = parseFloat(e.target.value);
        schedulePreview();
    });
    document.getElementById('canvas-margin').addEventListener('input', (e) => {
        config.canvas.margin = parseFloat(e.target.value);
        schedulePreview();
    });
    document.getElementById('output-name').addEventListener('input', (e) => {
        config.outputBaseName = e.target.value;
    });
}

function renderGCodeControls() {
    const sidebar = document.getElementById('sidebar');
    let section = sidebar.querySelector('.gcode-section');
    if (!section) {
        section = document.createElement('div');
        section.className = 'sidebar-section gcode-section';
        sidebar.appendChild(section);
    }
    
    section.innerHTML = `
        <h3>G-Code Settings</h3>
        <div class="control-group">
            <label>Feed Rate</label>
            <input type="number" id="gcode-feedrate" value="${config.gcode.feedRate}" min="100" max="10000" step="100">
        </div>
        <div class="control-group">
            <label>Z Up</label>
            <input type="number" id="gcode-zup" value="${config.gcode.zUp}" min="0" max="100" step="0.1">
        </div>
        <div class="control-group">
            <label>Z Down</label>
            <input type="number" id="gcode-zdown" value="${config.gcode.zDown}" min="0" max="100" step="0.1">
        </div>
    `;
    
    document.getElementById('gcode-feedrate').addEventListener('input', (e) => {
        config.gcode.feedRate = parseFloat(e.target.value);
    });
    document.getElementById('gcode-zup').addEventListener('input', (e) => {
        config.gcode.zUp = parseFloat(e.target.value);
    });
    document.getElementById('gcode-zdown').addEventListener('input', (e) => {
        config.gcode.zDown = parseFloat(e.target.value);
    });
}

function renderGlobalParams() {
    const sidebar = document.getElementById('sidebar');
    let section = sidebar.querySelector('.global-section');
    if (!section) {
        section = document.createElement('div');
        section.className = 'sidebar-section global-section';
        sidebar.appendChild(section);
    }
    
    section.innerHTML = `
        <h3>Global</h3>
        <div class="control-group">
            <label>Seed</label>
            <div class="control-row">
                <input type="number" id="global-seed" value="${config.params.seed || 0}" min="0" max="99999" step="1">
                <button onclick="randomizeSeed()">🎲</button>
            </div>
        </div>
    `;
    
    document.getElementById('global-seed').addEventListener('input', (e) => {
        config.params.seed = parseInt(e.target.value);
        schedulePreview();
    });
}

function randomizeSeed() {
    config.params.seed = Math.floor(Math.random() * 10000);
    document.getElementById('global-seed').value = config.params.seed;
    schedulePreview();
}

function renderStepsControls() {
    const sidebar = document.getElementById('sidebar');
    let section = sidebar.querySelector('.steps-section');
    if (!section) {
        section = document.createElement('div');
        section.className = 'sidebar-section steps-section';
        sidebar.appendChild(section);
    }
    
    section.innerHTML = '<h3>Pipeline Steps</h3>';
    
    config.params.steps.forEach((step, index) => {
        section.appendChild(createStepControl(step, index));
    });
    
    const addBtn = document.createElement('button');
    addBtn.className = 'add-step-btn';
    addBtn.textContent = '+ Add Step';
    addBtn.onclick = () => addStep();
    section.appendChild(addBtn);
}

function createStepControl(step, index) {
    const div = document.createElement('div');
    div.className = 'step-controls';
    
    const toolDef = TOOL_DEFINITIONS[step.tool] || { category: 'unknown', label: step.tool, params: [] };
    
    div.innerHTML = `
        <div class="step-header">
            <select class="step-tool" data-index="${index}">
                ${Object.keys(TOOL_DEFINITIONS).map(key => 
                    `<option value="${key}" ${key === step.tool ? 'selected' : ''}>${TOOL_DEFINITIONS[key].label}</option>`
                ).join('')}
            </select>
            <button onclick="removeStep(${index})" title="Remove">×</button>
        </div>
        <div class="step-params" data-index="${index}"></div>
        ${toolDef.hasMask ? `<div class="step-mask" data-index="${index}"></div>` : ''}
    `;
    
    const toolSelect = div.querySelector('.step-tool');
    toolSelect.addEventListener('change', (e) => {
        step.tool = e.target.value;
        step.params = {};
        step.mask = undefined;
        renderStepsControls();
        schedulePreview();
    });
    
    renderStepParams(div.querySelector('.step-params'), step, index);
    if (toolDef.hasMask) {
        renderStepMask(div.querySelector('.step-mask'), step, index);
    }
    
    return div;
}

function renderStepParams(container, step, index) {
    const toolDef = TOOL_DEFINITIONS[step.tool];
    if (!toolDef) return;
    
    toolDef.params.forEach(paramDef => {
        const value = step.params[paramDef.key] !== undefined 
            ? step.params[paramDef.key] 
            : paramDef.default !== undefined ? paramDef.default : '';
        
        const group = document.createElement('div');
        group.className = 'control-group';
        
        if (paramDef.type === 'boolean') {
            group.innerHTML = `
                <label>
                    <input type="checkbox" 
                           data-index="${index}" 
                           data-param="${paramDef.key}"
                           ${value ? 'checked' : ''}>
                    ${paramDef.label}
                </label>
            `;
            group.querySelector('input').addEventListener('change', (e) => {
                step.params[paramDef.key] = e.target.checked;
                schedulePreview();
            });
        } else if (paramDef.type === 'select') {
            group.innerHTML = `
                <label>${paramDef.label}</label>
                <select data-index="${index}" data-param="${paramDef.key}">
                    ${paramDef.options.map(opt => 
                        `<option value="${opt}" ${opt === value ? 'selected' : ''}>${opt}</option>`
                    ).join('')}
                </select>
            `;
            group.querySelector('select').addEventListener('change', (e) => {
                step.params[paramDef.key] = e.target.value;
                schedulePreview();
            });
        } else {
            group.innerHTML = `
                <label>${paramDef.label}</label>
                <input type="${paramDef.type}" 
                       data-index="${index}" 
                       data-param="${paramDef.key}"
                       value="${value}"
                       ${paramDef.min !== undefined ? `min="${paramDef.min}"` : ''}
                       ${paramDef.max !== undefined ? `max="${paramDef.max}"` : ''}
                       ${paramDef.step !== undefined ? `step="${paramDef.step}"` : ''}>
            `;
            const input = group.querySelector('input');
            input.addEventListener('input', (e) => {
                step.params[paramDef.key] = paramDef.type === 'number' 
                    ? parseFloat(e.target.value) || 0
                    : e.target.value;
                schedulePreview();
            });
        }
        
        container.appendChild(group);
    });
}

function renderStepMask(container, step, index) {
    container.innerHTML = `
        <div class="control-group">
            <label>Mask</label>
            <select class="mask-type" data-index="${index}">
                <option value="">None</option>
                ${MASK_TYPES.map(type => 
                    `<option value="${type}" ${step.mask?.type === type ? 'selected' : ''}>${type}</option>`
                ).join('')}
            </select>
        </div>
        <div class="mask-params" data-index="${index}"></div>
    `;
    
    const maskSelect = container.querySelector('.mask-type');
    maskSelect.addEventListener('change', (e) => {
        if (e.target.value) {
            step.mask = { type: e.target.value, params: {} };
        } else {
            step.mask = undefined;
        }
        renderStepsControls();
        schedulePreview();
    });
    
    if (step.mask) {
        // Simple mask params UI (can be expanded)
        const maskParams = container.querySelector('.mask-params');
        maskParams.innerHTML = `
            <div class="control-group">
                <label>Scale</label>
                <input type="number" 
                       data-index="${index}" 
                       data-param="scale"
                       value="${step.mask.params.scale || 0.02}"
                       min="0.001" max="1" step="0.001">
            </div>
            <div class="control-group">
                <label>
                    <input type="checkbox" 
                           data-index="${index}" 
                           data-param="invert"
                           ${step.mask.invert ? 'checked' : ''}>
                    Invert
                </label>
            </div>
        `;
        
        maskParams.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', (e) => {
                const key = input.dataset.param;
                if (input.type === 'checkbox') {
                    step.mask[key] = input.checked;
                } else {
                    step.mask.params[key] = parseFloat(input.value);
                }
                schedulePreview();
            });
        });
    }
}

function addStep() {
    config.params.steps.push({
        tool: 'stripes',
        params: {}
    });
    renderStepsControls();
    schedulePreview();
}

function removeStep(index) {
    config.params.steps.splice(index, 1);
    renderStepsControls();
    schedulePreview();
}

// Preview and export
function schedulePreview() {
    if (previewTimeout) clearTimeout(previewTimeout);
    previewTimeout = setTimeout(() => {
        updatePreview();
    }, 300); // 300ms debounce
}

async function updatePreview() {
    if (isLoading) return;
    isLoading = true;
    
    const status = document.getElementById('status');
    const preview = document.getElementById('preview');
    
    status.textContent = 'Generating preview...';
    status.className = 'status loading';
    
    try {
        const response = await fetch(`${API_BASE}/api/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Preview failed');
        }
        
        const data = await response.json();
        preview.innerHTML = data.svg;
        status.textContent = 'Preview ready';
        status.className = 'status';
    } catch (error) {
        status.textContent = `Error: ${error.message}`;
        status.className = 'status error';
        preview.innerHTML = `<div class="preview-placeholder">Error: ${error.message}</div>`;
    } finally {
        isLoading = false;
    }
}

async function exportDrawing() {
    const exportBtn = document.getElementById('export-btn');
    exportBtn.disabled = true;
    exportBtn.textContent = 'Exporting...';
    
    try {
        const response = await fetch(`${API_BASE}/api/export`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Export failed');
        }
        
        const data = await response.json();
        
        // Download SVG
        const svgBlob = new Blob([data.svg], { type: 'image/svg+xml' });
        const svgUrl = URL.createObjectURL(svgBlob);
        const svgLink = document.createElement('a');
        svgLink.href = svgUrl;
        svgLink.download = `${config.outputBaseName}.svg`;
        svgLink.click();
        
        // Download G-Code
        const gcodeBlob = new Blob([data.gcode], { type: 'text/plain' });
        const gcodeUrl = URL.createObjectURL(gcodeBlob);
        const gcodeLink = document.createElement('a');
        gcodeLink.href = gcodeUrl;
        gcodeLink.download = `${config.outputBaseName}.gcode`;
        gcodeLink.click();
        
        alert('Files downloaded!');
    } catch (error) {
        alert(`Export failed: ${error.message}`);
    } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = 'Export G-Code & SVG';
    }
}

async function loadConfig() {
    try {
        const response = await fetch(`${API_BASE}/api/configs`);
        const data = await response.json();
        
        const configNames = data.configs.map(c => c.name);
        const selected = prompt(`Available configs:\n${configNames.join('\n')}\n\nEnter config name:`);
        if (!selected) return;
        
        const configData = data.configs.find(c => c.name === selected);
        if (!configData) {
            alert('Config not found');
            return;
        }
        
        config = configData.config;
        renderApp();
        schedulePreview();
    } catch (error) {
        alert(`Failed to load configs: ${error.message}`);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    renderApp();
    schedulePreview();
    
    document.getElementById('export-btn').addEventListener('click', exportDrawing);
    document.getElementById('load-config-btn').addEventListener('click', loadConfig);
});

// Expose functions globally for inline handlers
window.randomizeSeed = randomizeSeed;
window.removeStep = removeStep;
