import { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem } from './ui/select';
import { useConfigStore } from '../store/config-store';
import { PipelineStep } from '../../types';
import { TOOL_DEFINITIONS, MODIFIERS } from '../lib/tool-definitions';
import StepParams from './StepParams';
import { X, ChevronUp, ChevronDown, Copy } from 'lucide-react';
import { cn } from '../lib/utils';

interface GlobalStepItemProps {
    step: PipelineStep;
    index: number;
}

export default function GlobalStepItem({ step, index }: GlobalStepItemProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const updateGlobalStep = useConfigStore((state) => state.updateGlobalStep);
    const removeGlobalStep = useConfigStore((state) => state.removeGlobalStep);
    const addGlobalStep = useConfigStore((state) => state.addGlobalStep);
    const globalSteps = useConfigStore((state) => state.config.params?.globalSteps || []);

    const toolDef = TOOL_DEFINITIONS[step.tool];
    // We generally don't support nested steps in global modifiers for simplicity first, 
    // but if we did, we'd need a GlobalNestedStepsEditor. 
    // Let's stick to flat modifiers for now as per plan (implicit).

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

        updateGlobalStep(index, {
            tool: newTool,
            params: newParams,
            mask: newToolDef?.hasMask ? undefined : step.mask,
        });
    };

    const handleDuplicate = () => {
        addGlobalStep({ ...step });
        // Note: addGlobalStep appends to end, manual move might be needed if they want it adjacent
    };

    // Only allow modifiers
    const availableTools = MODIFIERS;

    const handleUpdateParams = (key: string, value: any) => {
        // If key is 'mask', we update mask
        if (key === 'mask') {
            updateGlobalStep(index, { mask: value });
        } else if (key === 'params') {
            // Full params update
            updateGlobalStep(index, { params: value });
        } else {
            // Single param update
            updateGlobalStep(index, { params: { ...step.params, [key]: value } });
        }
    };

    // Move logic for global steps?
    // I didn't verify if I added moveGlobalStep action.
    // I checked config-store.ts edit, I added: add, update, remove. NOT move.
    // So I cannot implement move up/down yet without store support.
    // I will skip move buttons or implement array swap locally?
    // Local swap is risky with Zustand temporal.
    // I will comment out move buttons for now or assume I add logic to store later.
    // Or I can update the store right now to add `moveGlobalStep`.

    return (
        <Card className="relative">
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
                        {/* Move buttons omitted as store action not implemented yet */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => removeGlobalStep(index)}
                            title="Remove step"
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                </div>

                {isExpanded && (
                    <div className="space-y-3 pt-2 border-t border-border">
                        <StepParams step={step} index={index} onUpdate={handleUpdateParams} />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
