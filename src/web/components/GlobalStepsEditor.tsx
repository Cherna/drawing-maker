import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectTrigger, SelectContent, SelectItem } from './ui/select';
import { useConfigStore } from '../store/config-store';
import { PipelineStep } from '../../types';
import GlobalStepItem from './GlobalStepItem';
import { MODIFIERS, TOOL_DEFINITIONS } from '../lib/tool-definitions';

export default function GlobalStepsEditor() {
    const steps = useConfigStore((state) => state.config.params?.globalSteps || []);
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

                <Select onValueChange={handleAddTool}>
                    <SelectTrigger className="w-full h-9 text-sm">
                        <span className="text-muted-foreground">+ Add modifier...</span>
                    </SelectTrigger>
                    <SelectContent>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Modifiers</div>
                        {MODIFIERS.map((tool) => (
                            <SelectItem key={tool} value={tool}>
                                {TOOL_DEFINITIONS[tool]?.label || tool}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </CardContent>
        </Card>
    );
}
