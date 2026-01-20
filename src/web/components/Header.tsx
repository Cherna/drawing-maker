import { Button } from './ui/button';
import { useConfigStore } from '../store/config-store';
import { useExport } from '../hooks/use-api';
import { Download, Loader2 } from 'lucide-react';

export default function Header() {
  const config = useConfigStore((state) => state.config);
  const { mutate: exportDrawing, isPending } = useExport();

  const handleExport = () => {
    exportDrawing(config);
  };

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
      <h1 className="text-2xl font-bold">🎨 Drawing Maker</h1>
      <div className="flex items-center gap-3">
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
