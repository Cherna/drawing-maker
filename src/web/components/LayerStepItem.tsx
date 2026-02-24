import { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem } from './ui/select';
import { PipelineStep } from '../../types';
import { TOOL_DEFINITIONS, GENERATORS, MODIFIERS } from '../lib/tool-definitions';
import StepParams from './StepParams';
import { X, ChevronUp, ChevronDown, ChevronRight, Eye, EyeOff, Copy } from 'lucide-react';
import { cn } from '../lib/utils';

interface LayerStepItemProps {
  step: PipelineStep;
  index: number;
  layerId: string;
  onUpdate: (index: number, updates: Partial<PipelineStep>) => void;
  onRemove: (index: number) => void;
  onDuplicate: (index: number) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export default function LayerStepItem({
  step,
  index,
  onUpdate,
  onRemove,
  onDuplicate,
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
        // If the new tool has a parameter with the same name as the old tool,
        // preserve the value if it's not empty/default.
        if (step.params[param.key] !== undefined) {
          newParams[param.key] = step.params[param.key];
        } else if (param.default !== undefined) {
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
    <Card className={cn('relative mb-3 border-2 shadow-sm transition-all hover:border-primary/20', isLayer ? 'border-primary/60 bg-secondary/20' : 'bg-secondary/30')}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 -ml-1 mr-1 text-muted-foreground hover:text-foreground p-0"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          <span className="text-xs font-medium text-muted-foreground min-w-[1.5rem]">
            {index + 1}.
          </span>
          <div className="flex-1 flex items-center gap-2">
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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onUpdate(index, { enabled: step.enabled === false })}
              title={step.enabled === false ? "Enable step" : "Mute step"}
            >
              {step.enabled === false ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
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
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => onDuplicate(index)}
              title="Duplicate step"
            >
              <Copy className="h-3 w-3" />
            </Button>
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
          <div className="space-y-3 pt-2 border-t border-border" key={step.tool}>
            <StepParams
              step={step}
              index={index}
              onUpdate={(key, value) => {
                // If key is 'mask', update it on the step root
                if (key === 'mask') {
                  onUpdate(index, { mask: value });
                } else if (key === 'params') {
                  // Special case: update entire params object (handling sync logic from child)
                  onUpdate(index, { params: value });
                } else {
                  // Otherwise update single param
                  onUpdate(index, {
                    params: { ...step.params, [key]: value }
                  });
                }
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
