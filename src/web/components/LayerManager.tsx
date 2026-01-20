import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { useConfigStore } from '../store/config-store';
import { PipelineStep } from '../../types';
import { X, Plus, Copy } from 'lucide-react';
import StepItem from './StepItem';

interface Layer {
  id: string;
  name: string;
  steps: PipelineStep[];
  startIndex: number; // Index in main steps array where this layer starts
}

export default function LayerManager() {
  const steps = useConfigStore((state) => state.config.params?.steps || []);
  const addStep = useConfigStore((state) => state.addStep);
  const removeStep = useConfigStore((state) => state.removeStep);
  const updateStep = useConfigStore((state) => state.updateStep);

  // Parse steps to identify layers
  const parseLayers = (): { baseSteps: PipelineStep[], layers: Layer[] } => {
    const baseSteps: PipelineStep[] = [];
    const layers: Layer[] = [];
    let currentLayer: Layer | null = null;

    steps.forEach((step, index) => {
      if (step.tool === 'duplicate') {
        // Create new layer starting at this point
        const layerId = step.params?.id || `layer_${layers.length + 1}`;
        currentLayer = {
          id: layerId,
          name: `Layer ${layers.length + 1}`,
          steps: [],
          startIndex: index,
        };
        layers.push(currentLayer);
        baseSteps.push(step);
      } else if (step.tool === 'merge') {
        // End current layer
        if (currentLayer) {
          baseSteps.push(step);
          currentLayer = null;
        } else {
          baseSteps.push(step);
        }
      } else if (currentLayer) {
        // Step belongs to current layer
        currentLayer.steps.push(step);
      } else {
        // Step belongs to base layer
        baseSteps.push(step);
      }
    });

    return { baseSteps, layers };
  };

  const { baseSteps, layers } = parseLayers();

  const handleCreateLayer = () => {
    // Add a duplicate step at the end of current steps
    const duplicateStep: PipelineStep = {
      tool: 'duplicate',
      params: { id: `layer_${layers.length + 1}` },
    };
    addStep(duplicateStep);
    
    // Optionally add a merge step after (user can remove if they want to keep layers separate)
    // For now, layers auto-merge at the end, so we don't need explicit merge
  };

  const handleDuplicateLayer = (layer: Layer) => {
    // Add a duplicate step that copies everything up to this layer
    const duplicateStep: PipelineStep = {
      tool: 'duplicate',
      params: { id: `layer_${layers.length + 1}` },
    };
    addStep(duplicateStep, layer.startIndex + 1);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">Layers</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCreateLayer}
          title="Create new layer from current state"
        >
          <Plus className="h-4 w-4 mr-1" />
          New Layer
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Base Layer */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground px-2">Base Layer</div>
          {baseSteps.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2">No steps in base layer.</p>
          ) : (
            <div className="space-y-1">
              {steps.map((step, index) => {
                // Only show base steps (not layer steps)
                const isBaseStep = !step.tool || (step.tool !== 'duplicate' && step.tool !== 'merge');
                if (!isBaseStep) return null;
                
                const isInLayer = layers.some(l => {
                  const layerSteps = steps.slice(l.startIndex + 1);
                  const mergeIndex = layerSteps.findIndex(s => s.tool === 'merge');
                  const layerEnd = mergeIndex >= 0 ? l.startIndex + 1 + mergeIndex : steps.length;
                  return index > l.startIndex && index < layerEnd;
                });
                
                if (isInLayer) return null;
                
                return <StepItem key={index} step={step} index={index} />;
              })}
            </div>
          )}
        </div>

        {/* Additional Layers */}
        {layers.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-border">
            {layers.map((layer) => {
              // Find where this layer ends (merge step or end of steps)
              const layerSteps = steps.slice(layer.startIndex + 1);
              const mergeIndex = layerSteps.findIndex(s => s.tool === 'merge');
              const layerEnd = mergeIndex >= 0 ? layer.startIndex + 1 + mergeIndex : steps.length;
              const layerStepIndices = Array.from({ length: layerEnd - layer.startIndex - 1 }, (_, i) => layer.startIndex + 1 + i);

              return (
                <div key={layer.id} className="border border-primary/30 rounded-lg p-3 bg-primary/5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">{layer.name}</div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleDuplicateLayer(layer)}
                        title="Duplicate this layer"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => {
                          // Remove all steps in this layer plus the duplicate step
                          for (let i = layerEnd - 1; i >= layer.startIndex; i--) {
                            removeStep(i);
                          }
                        }}
                        title="Remove layer"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1 pl-2 border-l-2 border-primary/30">
                    {layerStepIndices.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No steps in this layer.</p>
                    ) : (
                      layerStepIndices.map((idx) => {
                        if (idx >= steps.length) return null;
                        const step = steps[idx];
                        return <StepItem key={idx} step={step} index={idx} />;
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {layers.length === 0 && (
          <p className="text-xs text-muted-foreground px-2">
            No additional layers. Create a layer to duplicate your work and modify it separately.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
