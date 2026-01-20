import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectTrigger, SelectContent, SelectItem } from './ui/select';
import { useConfigStore } from '../store/config-store';
import { PipelineStep } from '../../types';
import StepItem from './StepItem';
import { GENERATORS, MODIFIERS, TOOL_DEFINITIONS } from '../lib/tool-definitions';

export default function StepsEditor() {
  const steps = useConfigStore((state) => state.config.params?.steps || []);
  const addStep = useConfigStore((state) => state.addStep);
  const hasGenerator = steps.some(step => TOOL_DEFINITIONS[step.tool]?.category === 'generator');

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
    addStep(newStep);
  };

  const allTools = hasGenerator 
    ? [...GENERATORS, ...MODIFIERS]
    : GENERATORS;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">Pipeline Steps</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No steps yet. Select a tool to add one.</p>
        ) : (
          steps.map((step, index) => <StepItem key={index} step={step} index={index} />)
        )}
        
        <Select onValueChange={handleAddTool} disabled={!hasGenerator && allTools.length === 0}>
          <SelectTrigger className="w-full h-9 text-sm">
            <span className="text-muted-foreground">+ Add step...</span>
          </SelectTrigger>
          <SelectContent>
            {!hasGenerator && (
              <>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Generators</div>
                {GENERATORS.map((tool) => (
                  <SelectItem key={tool} value={tool}>
                    {TOOL_DEFINITIONS[tool]?.label || tool}
                  </SelectItem>
                ))}
              </>
            )}
            {hasGenerator && (
              <>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Generators</div>
                {GENERATORS.map((tool) => (
                  <SelectItem key={tool} value={tool}>
                    {TOOL_DEFINITIONS[tool]?.label || tool}
                  </SelectItem>
                ))}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Modifiers</div>
                {MODIFIERS.map((tool) => (
                  <SelectItem key={tool} value={tool}>
                    {TOOL_DEFINITIONS[tool]?.label || tool}
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
        {!hasGenerator && (
          <p className="text-xs text-muted-foreground">Add a generator first, then you can add modifiers.</p>
        )}
      </CardContent>
    </Card>
  );
}
