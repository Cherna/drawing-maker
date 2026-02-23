import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

import { Button } from './ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem } from './ui/select';
import { useConfigStore } from '../store/config-store';
import { PipelineStep, Layer } from '../../types';
import LayerStepItem from './LayerStepItem';
import { Plus, Copy, Trash2, Eye, EyeOff, Download, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from './ui/dropdown-menu';
import CollapsibleMenuSection from './ui/collapsible-menu-section';
import { GENERATORS, MODIFIERS, TOOL_DEFINITIONS } from '../lib/tool-definitions';

// Default color palette for new layers
const DEFAULT_COLORS = ['#000000', '#FF5733', '#3357FF', '#33FF57', '#F033FF', '#FFBD33', '#FF33A1', '#33FFF5'];

export default function LayersEditor() {
  const config = useConfigStore((state) => state.config);
  const updateConfig = useConfigStore((state) => state.updateConfig);

  // Initialize layers from steps if not already set up
  const getLayers = (): Layer[] => {
    if (config.params?.layers && Array.isArray(config.params.layers) && config.params.layers.length > 0) {
      return config.params.layers;
    }
    // If no layers exist, create base layer from steps
    return [
      {
        id: 'base',
        name: 'Base Layer',
        steps: config.params?.steps || [],
        visible: true,
        color: '#000000',
        strokeWidth: 0.7
      }
    ];
  };

  const layers: Layer[] = getLayers();

  const activeLayerId = config.params?.activeLayerId || 'base';
  const activeLayer = layers.find(l => l.id === activeLayerId) || layers[0];

  // Convert layers to flat steps format for pipeline execution
  // Only includes visible layers
  const layersToSteps = (layers: Layer[]): PipelineStep[] => {
    const allSteps: PipelineStep[] = [];

    // Add base layer steps (if visible)
    const baseLayer = layers.find(l => l.id === 'base');
    if (baseLayer && baseLayer.visible !== false) {
      allSteps.push(...baseLayer.steps);
    }

    // Add other visible layers as duplicate + their steps
    layers.filter(l => l.id !== 'base' && l.visible !== false).forEach(layer => {
      // Add duplicate step to create layer copy
      allSteps.push({
        tool: 'duplicate',
        params: { id: layer.id },
      });

      // Add layer's steps
      allSteps.push(...layer.steps);
    });

    return allSteps;
  };

  const handleAddStep = (toolName: string) => {
    const toolDef = TOOL_DEFINITIONS[toolName];
    const newParams: any = {};

    if (toolDef) {
      toolDef.params.forEach((param) => {
        if (param.default !== undefined) {
          newParams[param.key] = param.default;
        }
      });
    }

    const newStep: PipelineStep = {
      tool: toolName,
      params: newParams,
    };

    const updatedLayers = layers.map(layer => {
      if (layer.id === activeLayerId) {
        return { ...layer, steps: [...layer.steps, newStep] };
      }
      return layer;
    });

    const flatSteps = layersToSteps(updatedLayers);

    updateConfig({
      params: {
        ...config.params,
        layers: updatedLayers,
        steps: flatSteps,
      }
    });
  };

  const handleUpdateStep = (index: number, updates: Partial<PipelineStep>) => {
    const updatedLayers = layers.map(layer => {
      if (layer.id === activeLayerId) {
        const newSteps = [...layer.steps];
        newSteps[index] = { ...newSteps[index], ...updates };
        return { ...layer, steps: newSteps };
      }
      return layer;
    });

    const flatSteps = layersToSteps(updatedLayers);
    updateConfig({
      params: {
        ...config.params,
        layers: updatedLayers,
        steps: flatSteps,
      }
    });
  };

  const handleRemoveStep = (index: number) => {
    const updatedLayers = layers.map(layer => {
      if (layer.id === activeLayerId) {
        return { ...layer, steps: layer.steps.filter((_, i) => i !== index) };
      }
      return layer;
    });

    const flatSteps = layersToSteps(updatedLayers);
    updateConfig({
      params: {
        ...config.params,
        layers: updatedLayers,
        steps: flatSteps,
      }
    });
  };

  const handleDuplicateStep = (index: number) => {
    const updatedLayers = layers.map(layer => {
      if (layer.id === activeLayerId) {
        const newSteps = [...layer.steps];
        const stepToDuplicate = newSteps[index];
        // Deep clone the step to avoid reference issues
        const duplicatedStep = JSON.parse(JSON.stringify(stepToDuplicate));
        newSteps.splice(index + 1, 0, duplicatedStep);
        return { ...layer, steps: newSteps };
      }
      return layer;
    });

    const flatSteps = layersToSteps(updatedLayers);
    updateConfig({
      params: {
        ...config.params,
        layers: updatedLayers,
        steps: flatSteps,
      }
    });
  };

  const handleMoveStep = (fromIndex: number, toIndex: number) => {
    const updatedLayers = layers.map(layer => {
      if (layer.id === activeLayerId) {
        const newSteps = [...layer.steps];
        const [removed] = newSteps.splice(fromIndex, 1);
        newSteps.splice(toIndex, 0, removed);
        return { ...layer, steps: newSteps };
      }
      return layer;
    });

    const flatSteps = layersToSteps(updatedLayers);
    updateConfig({
      params: {
        ...config.params,
        layers: updatedLayers,
        steps: flatSteps,
      }
    });
  };

  const handleCreateLayer = () => {
    const newLayerId = `layer_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    // Assign a color from the palette, cycling through if needed
    const colorIndex = layers.length % DEFAULT_COLORS.length;
    const newLayer: Layer = {
      id: newLayerId,
      name: `Layer ${layers.length}`,
      steps: [],
      visible: true,
      color: DEFAULT_COLORS[colorIndex],
      strokeWidth: 0.7, // Default stroke width
    };

    const updatedLayers = [...layers, newLayer];
    const flatSteps = layersToSteps(updatedLayers);

    updateConfig({
      params: {
        ...config.params,
        layers: updatedLayers,
        steps: flatSteps,
        activeLayerId: newLayerId,
      }
    });
  };

  const handleDuplicateLayer = () => {
    if (!activeLayer) return;

    const newLayerId = `layer_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newLayer: Layer = {
      id: newLayerId,
      name: `${activeLayer.name} Copy`,
      steps: JSON.parse(JSON.stringify(activeLayer.steps)),
      visible: true,
      color: activeLayer.color || '#000000', // Preserve the original layer's color!
      strokeWidth: activeLayer.strokeWidth, // Preserve stroke width
      opacity: activeLayer.opacity,
    };

    const updatedLayers = [...layers, newLayer];
    const flatSteps = layersToSteps(updatedLayers);

    updateConfig({
      params: {
        ...config.params,
        layers: updatedLayers,
        steps: flatSteps,
        activeLayerId: newLayerId,
      }
    });
  };

  const handleDeleteLayer = (layerId: string) => {
    // Check if we have more than 1 layer to allow deletion
    if (layers.length <= 1) {
      alert("Cannot delete the only layer.");
      return;
    }

    const updatedLayers = layers.filter(l => l.id !== layerId);
    const flatSteps = layersToSteps(updatedLayers);

    updateConfig({
      params: {
        ...config.params,
        layers: updatedLayers,
        steps: flatSteps,
        activeLayerId: activeLayerId === layerId ? 'base' : activeLayerId,
      }
    });
  };

  const handleToggleVisibility = (layerId: string) => {
    const updatedLayers = layers.map(layer => {
      if (layer.id === layerId) {
        return { ...layer, visible: layer.visible === false ? true : false };
      }
      return layer;
    });

    const flatSteps = layersToSteps(updatedLayers);

    updateConfig({
      params: {
        ...config.params,
        layers: updatedLayers,
        steps: flatSteps,
      }
    });
  };

  const handleUpdateLayerColor = (layerId: string, color: string) => {
    const updatedLayers = layers.map(layer =>
      layer.id === layerId ? { ...layer, color } : layer
    );

    const flatSteps = layersToSteps(updatedLayers);
    updateConfig({
      params: {
        ...config.params,
        layers: updatedLayers,
        steps: flatSteps,
      }
    });
  };

  const handleExportLayer = async (layerId: string) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    try {
      const response = await fetch(`/api/export?layerId=${layerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) throw new Error('Export failed');
      const data = await response.json();

      // Download SVG
      const svgBlob = new Blob([data.svg], { type: 'image/svg+xml' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const svgLink = document.createElement('a');
      svgLink.href = svgUrl;
      svgLink.download = `${layer.name.replace(/\s+/g, '_')}.svg`;
      svgLink.click();

      // Download G-Code
      const gcodeBlob = new Blob([data.gcode], { type: 'text/plain' });
      const gcodeUrl = URL.createObjectURL(gcodeBlob);
      const gcodeLink = document.createElement('a');
      gcodeLink.href = gcodeUrl;
      gcodeLink.download = `${layer.name.replace(/\s+/g, '_')}.gcode`;
      gcodeLink.click();

      URL.revokeObjectURL(svgUrl);
      URL.revokeObjectURL(gcodeUrl);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export layer');
    }
  };

  const handleSwitchLayer = (layerId: string) => {
    updateConfig({
      params: {
        ...config.params,
        activeLayerId: layerId,
      }
    });
  };

  const pipelineSteps = activeLayer.steps;
  const isLayerVisible = activeLayer.visible !== false;

  // Modifiers are only allowed if the current layer has at least one generator
  const canAddModifiers = pipelineSteps.some(step => TOOL_DEFINITIONS[step.tool]?.category === 'generator');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">Layers</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateLayer}
            title="Create new empty layer"
          >
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
          {activeLayer && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDuplicateLayer}
              title="Duplicate current layer with all its steps"
            >
              <Copy className="h-4 w-4 mr-1" />
              Duplicate
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Layer List - show all layers with visibility toggle */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Layers</label>
          <div className="space-y-1">
            {layers.map((layer) => {
              const isActive = layer.id === activeLayerId;
              const isVisible = layer.visible !== false;

              return (
                <div
                  key={layer.id}
                  className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${isActive
                    ? 'bg-primary/10 border border-primary/30'
                    : 'bg-muted/30 hover:bg-muted/50 border border-transparent'
                    }`}
                  onClick={() => handleSwitchLayer(layer.id)}
                >
                  {/* Visibility toggle */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleVisibility(layer.id);
                    }}
                    title={isVisible ? 'Hide layer' : 'Show layer'}
                  >
                    {isVisible ? (
                      <Eye className="h-3.5 w-3.5" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>

                  {/* Color picker */}
                  <input
                    type="color"
                    value={layer.color || '#000000'}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleUpdateLayerColor(layer.id, e.target.value);
                    }}
                    className="h-6 w-6 rounded border border-border cursor-pointer shrink-0"
                    title="Change layer color"
                  />

                  {/* Stroke Width input */}
                  <input
                    type="number"
                    min="0.1"
                    max="5.0"
                    step="0.05"
                    value={layer.strokeWidth ?? 0.7}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      // We need a handleUpdateLayerStrokeWidth function or similar
                      // Since I can't add a new function easily in this replace block without context,
                      // I'll inline the update logic or use a new handler if I can add it.
                      // Ideally I'd use updateConfig directly here.
                      const updatedLayers = layers.map(l =>
                        l.id === layer.id ? { ...l, strokeWidth: parseFloat(e.target.value) } : l
                      );
                      updateConfig({
                        params: { ...config.params, layers: updatedLayers, steps: layersToSteps(updatedLayers) }
                      });
                    }}
                    className="h-6 w-12 text-xs px-1 rounded border border-border bg-background shrink-0"
                    title="Stroke Width (mm)"
                  />


                  {/* Layer name */}
                  <span className={`flex-1 text-sm truncate ${!isVisible ? 'text-muted-foreground' : ''}`}>
                    {layer.name}
                  </span>

                  {/* Step count */}
                  <span className="text-xs text-muted-foreground">
                    {layer.steps.length} step{layer.steps.length !== 1 ? 's' : ''}
                  </span>

                  {/* Export button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportLayer(layer.id);
                    }}
                    title="Export this layer"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>

                  {/* Delete button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteLayer(layer.id);
                    }}
                    title="Delete layer"
                    disabled={layers.length <= 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Steps for Active Layer */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              Steps ({activeLayer?.name})
            </label>
            {!isLayerVisible && (
              <span className="text-xs text-amber-500">Hidden</span>
            )}
          </div>
          {pipelineSteps.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              {activeLayerId === 'base'
                ? 'Add a generator to start drawing.'
                : 'Add tools to modify this layer.'}
            </p>
          ) : (
            <div className="space-y-2">
              {pipelineSteps.map((step, index) => (
                <LayerStepItem
                  key={index}
                  step={step}
                  index={index}
                  layerId={activeLayerId}
                  onUpdate={handleUpdateStep}
                  onRemove={handleRemoveStep}
                  onDuplicate={handleDuplicateStep}
                  onMove={handleMoveStep}
                  canMoveUp={index > 0}
                  canMoveDown={index < pipelineSteps.length - 1}
                />
              ))}
            </div>
          )}
        </div>

        {/* Add Step */}
        {/* Add Step */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full h-9 justify-between text-muted-foreground font-normal bg-background">
              + Add step...
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 max-h-[400px] overflow-y-auto">
            <CollapsibleMenuSection title="Generators" defaultExpanded={true}>
              {GENERATORS.map((tool) => (
                <DropdownMenuItem key={tool} onClick={() => handleAddStep(tool)}>
                  {TOOL_DEFINITIONS[tool]?.label || tool}
                </DropdownMenuItem>
              ))}
            </CollapsibleMenuSection>

            {(canAddModifiers || activeLayerId !== 'base') && (
              <CollapsibleMenuSection title="Modifiers" defaultExpanded={true}>
                {canAddModifiers ? (
                  MODIFIERS.filter(t => t !== 'duplicate' && t !== 'merge' && t !== 'layer' && t !== 'clone').map((tool) => (
                    <DropdownMenuItem key={tool} onClick={() => handleAddStep(tool)}>
                      {TOOL_DEFINITIONS[tool]?.label || tool}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <div className="px-2 py-2 text-xs text-muted-foreground italic">
                    Add generators to base layer first to enable modifiers
                  </div>
                )}
              </CollapsibleMenuSection>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Layer explanation */}
        {activeLayerId !== 'base' && (
          <p className="text-xs text-muted-foreground">
            Non-base layers are independent.
            Start by adding a generator (e.g. Stripes, Grid).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
