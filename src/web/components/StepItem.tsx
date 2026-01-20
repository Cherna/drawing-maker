import { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem } from './ui/select';
import { useConfigStore } from '../store/config-store';
import { PipelineStep } from '../../types';
import { TOOL_DEFINITIONS, GENERATORS, MODIFIERS } from '../lib/tool-definitions';
import StepParams from './StepParams';
import NestedStepsEditor from './NestedStepsEditor';
import { X, ChevronUp, ChevronDown, Copy } from 'lucide-react';
import { cn } from '../lib/utils';

interface StepItemProps {
  step: PipelineStep;
  index: number;
}

export default function StepItem({ step, index }: StepItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const updateStep = useConfigStore((state) => state.updateStep);
  const removeStep = useConfigStore((state) => state.removeStep);
  const moveStep = useConfigStore((state) => state.moveStep);
  const addStep = useConfigStore((state) => state.addStep);
  const steps = useConfigStore((state) => state.config.params?.steps || []);

  const toolDef = TOOL_DEFINITIONS[step.tool];
  const hasNestedSteps = step.tool === 'duplicate' || step.tool === 'layer' || step.tool === 'clone';
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

    updateStep(index, {
      tool: newTool,
      params: newParams,
      mask: newToolDef?.hasMask ? undefined : step.mask,
    });
  };

  const handleDuplicate = () => {
    addStep({ ...step }, index + 1);
  };

  const availableTools = isGenerator ? GENERATORS : MODIFIERS;

  return (
    <Card className={cn('relative', hasNestedSteps && 'border-primary/50')}>
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
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleDuplicate}
              title="Duplicate step"
            >
              <Copy className="h-3 w-3" />
            </Button>
            {index > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => moveStep(index, index - 1)}
                title="Move up"
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
            )}
            {index < steps.length - 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => moveStep(index, index + 1)}
                title="Move down"
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={() => removeStep(index)}
              title="Remove step"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {hasNestedSteps && (
          <div className="text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded">
            {step.tool === 'duplicate' && 'Duplicates drawing and applies nested steps'}
            {step.tool === 'layer' && 'Creates a layer with sub-pipeline'}
            {step.tool === 'clone' && 'Creates a clone with sub-pipeline'}
          </div>
        )}

        {isExpanded && (
          <div className="space-y-3 pt-2 border-t border-border">
            {hasNestedSteps ? (
              <NestedStepsEditor step={step} stepIndex={index} />
            ) : (
              <StepParams step={step} index={index} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
