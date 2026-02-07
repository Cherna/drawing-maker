import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from './ui/dropdown-menu';
import CollapsibleMenuSection from './ui/collapsible-menu-section';
import { ChevronDown } from 'lucide-react';

import { useConfigStore } from '../store/config-store';
import { PipelineStep } from '../../types';
import GlobalStepItem from './GlobalStepItem';
import { MODIFIERS, TOOL_DEFINITIONS } from '../lib/tool-definitions';

export default function GlobalStepsEditor() {
    const steps: PipelineStep[] = useConfigStore((state) => state.config.params?.globalSteps || []);
    const addGlobalStep = useConfigStore((state) => state.addGlobalStep);

    const handleAddTool = (toolName: string) => {
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
        addGlobalStep(newStep);
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-base">Global Modifiers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {steps.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No global modifiers. Add one to affect the entire drawing.</p>
                ) : (
                    steps.map((step, index) => <GlobalStepItem key={index} step={step} index={index} />)
                )}

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full h-9 justify-between text-muted-foreground font-normal bg-background">
                            + Add modifier...
                            <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64 max-h-[400px] overflow-y-auto">
                        <CollapsibleMenuSection title="Modifiers" defaultExpanded={true}>
                            {MODIFIERS.map((tool) => (
                                <DropdownMenuItem key={tool} onClick={() => handleAddTool(tool)}>
                                    {TOOL_DEFINITIONS[tool]?.label || tool}
                                </DropdownMenuItem>
                            ))}
                        </CollapsibleMenuSection>
                    </DropdownMenuContent>
                </DropdownMenu>
            </CardContent>
        </Card>
    );
}
