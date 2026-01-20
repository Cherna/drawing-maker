import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem } from './ui/select';
import { useConfigStore } from '../store/config-store';
import { PipelineStep } from '../../types';
import LayerStepItem from './LayerStepItem';
import { Plus, Copy, Trash2, Eye, EyeOff } from 'lucide-react';
import { GENERATORS, MODIFIERS, TOOL_DEFINITIONS } from '../lib/tool-definitions';

interface Layer {
  id: string;
  name: string;
  steps: PipelineStep[];
  visible?: boolean; // undefined = true
}

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
      { id: 'base', name: 'Base Layer', steps: config.params?.steps || [], visible: true }
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
    const newLayerId = `layer_${layers.length}`;
    const newLayer: Layer = {
      id: newLayerId,
      name: `Layer ${layers.length}`,
      steps: [],
      visible: true,
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
    
    const newLayerId = `layer_${layers.length}`;
    const newLayer: Layer = {
      id: newLayerId,
      name: `${activeLayer.name} Copy`,
      steps: JSON.parse(JSON.stringify(activeLayer.steps)),
      visible: true,
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
    if (layerId === 'base') return;
    
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
  
  // Check if base layer has any generators (required for modifiers to make sense)
  const baseLayer = layers.find(l => l.id === 'base');
  const baseHasGenerators = baseLayer?.steps.some(step => 
    TOOL_DEFINITIONS[step.tool]?.category === 'generator'
  ) || false;
  
  // For non-base layers: modifiers are only allowed if base has generators
  // (since non-base layers duplicate the base, so they need something to duplicate)
  const canAddModifiers = activeLayerId === 'base' 
    ? (baseHasGenerators || pipelineSteps.some(step => TOOL_DEFINITIONS[step.tool]?.category === 'generator'))
    : baseHasGenerators; // Non-base layers need base to have generators

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
                  className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                    isActive 
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
                  
                  {/* Layer name */}
                  <span className={`flex-1 text-sm truncate ${!isVisible ? 'text-muted-foreground' : ''}`}>
                    {layer.name}
                  </span>
                  
                  {/* Step count */}
                  <span className="text-xs text-muted-foreground">
                    {layer.steps.length} step{layer.steps.length !== 1 ? 's' : ''}
                  </span>
                  
                  {/* Delete button (not for base) */}
                  {layer.id !== 'base' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteLayer(layer.id);
                      }}
                      title="Delete layer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
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
                  onMove={handleMoveStep}
                  canMoveUp={index > 0}
                  canMoveDown={index < pipelineSteps.length - 1}
                />
              ))}
            </div>
          )}
        </div>

        {/* Add Step */}
        <Select onValueChange={handleAddStep}>
          <SelectTrigger className="w-full h-9 text-sm">
            <span className="text-muted-foreground">
              + Add step...
            </span>
          </SelectTrigger>
          <SelectContent>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Generators</div>
            {GENERATORS.map((tool) => (
              <SelectItem key={tool} value={tool}>
                {TOOL_DEFINITIONS[tool]?.label || tool}
              </SelectItem>
            ))}
            {/* Only show modifiers if they can be used */}
            {canAddModifiers && (
              <>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Modifiers</div>
                {MODIFIERS.filter(t => t !== 'duplicate' && t !== 'merge' && t !== 'layer' && t !== 'clone').map((tool) => (
                  <SelectItem key={tool} value={tool}>
                    {TOOL_DEFINITIONS[tool]?.label || tool}
                  </SelectItem>
                ))}
              </>
            )}
            {!canAddModifiers && activeLayerId !== 'base' && (
              <div className="px-2 py-2 text-xs text-muted-foreground italic">
                Add generators to base layer first to enable modifiers
              </div>
            )}
          </SelectContent>
        </Select>
        
        {/* Layer explanation */}
        {activeLayerId !== 'base' && (
          <p className="text-xs text-muted-foreground">
            Non-base layers start with a copy of all previous layers. 
            Add generators/modifiers to build on top.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
