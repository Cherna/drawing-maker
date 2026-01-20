import { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem } from './ui/select';
import { PipelineStep } from '../../types';
import { TOOL_DEFINITIONS, GENERATORS, MODIFIERS } from '../lib/tool-definitions';
import StepParams from './StepParams';
import { X, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

interface LayerStepItemProps {
  step: PipelineStep;
  index: number;
  layerId: string;
  onUpdate: (index: number, updates: Partial<PipelineStep>) => void;
  onRemove: (index: number) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export default function LayerStepItem({
  step,
  index,
  onUpdate,
  onRemove,
  onMove,
  canMoveUp,
  canMoveDown,
}: LayerStepItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const toolDef = TOOL_DEFINITIONS[step.tool];
  const isLayer = step.tool === 'duplicate' || step.tool === 'layer' || step.tool === 'clone';
  const isGenerator = toolDef?.category === 'generator';

  const handleToolChange = (newTool: string) => {
    const newToolDef = TOOL_DEFINITIONS[newTool];
    const newParams: any = {};
    
    // Set defaults for new tool
    if (newToolDef) {
      newToolDef.params.forEach((param) => {
        if (param.default !== undefined) {
          newParams[param.key] = param.default;
        }
      });
    }

    onUpdate(index, {
      tool: newTool,
      params: newParams,
      mask: newToolDef?.hasMask ? undefined : step.mask,
    });
  };

  const availableTools = isGenerator ? GENERATORS : MODIFIERS;

  return (
    <Card className={cn('relative', isLayer && 'border-primary/50')}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {index + 1}.
          </button>
          <Select value={step.tool} onValueChange={handleToolChange}>
            <SelectTrigger className="flex-1 h-8 text-sm">
              {toolDef?.label || step.tool}
            </SelectTrigger>
            <SelectContent>
              {availableTools.map((tool) => (
                <SelectItem key={tool} value={tool}>
                  {TOOL_DEFINITIONS[tool]?.label || tool}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            {canMoveUp && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onMove(index, index - 1)}
                title="Move up"
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
            )}
            {canMoveDown && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onMove(index, index + 1)}
                title="Move down"
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={() => onRemove(index)}
              title="Remove step"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="space-y-3 pt-2 border-t border-border">
            <StepParams
              step={step}
              index={index}
              onUpdate={(key, value) => {
                onUpdate(index, {
                  params: { ...step.params, [key]: value }
                });
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
