import { Button } from './ui/button';
import { useConfigStore } from '../store/config-store';
import { useExport, useConfigs } from '../hooks/use-api';
import { Download, Loader2, FileText } from 'lucide-react';

export default function Header() {
  const config = useConfigStore((state) => state.config);
  const { mutate: exportDrawing, isPending } = useExport();
  const { data: configsData } = useConfigs();

  const handleExport = () => {
    exportDrawing(config);
  };

  const handleLoadConfig = () => {
    if (!configsData?.configs?.length) return;
    
    const configNames = configsData.configs.map((c: any) => c.name);
    const selected = prompt(`Available configs:\n${configNames.join('\n')}\n\nEnter config name:`);
    
    if (selected) {
      const configData = configsData.configs.find((c: any) => c.name === selected);
      if (configData) {
        useConfigStore.getState().setConfig(configData.config);
      }
    }
  };

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
      <h1 className="text-2xl font-bold">🎨 Drawing Maker</h1>
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={handleLoadConfig} disabled={!configsData}>
          <FileText className="mr-2 h-4 w-4" />
          Load Config
        </Button>
        <Button onClick={handleExport} disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export G-Code & SVG
        </Button>
      </div>
    </header>
  );
}
