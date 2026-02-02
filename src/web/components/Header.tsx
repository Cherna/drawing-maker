import { Button } from './ui/button';
import { useConfigStore } from '../store/config-store';
import { useExport } from '../hooks/use-api';
import { Download, Loader2 } from 'lucide-react';

import { useEffect } from 'react';
import { useStore } from 'zustand';
import { Undo, Redo } from 'lucide-react';

export default function Header() {
  const config = useConfigStore((state) => state.config);
  const { mutate: exportDrawing, isPending } = useExport();

  // Access the temporal store (zundo middleware)
  const temporal = (useConfigStore as any).temporal;
  // Use the standard useStore hook to subscribe to the temporal store
  const { undo, redo, pastStates, futureStates } = useStore(temporal, (state: any) => state);

  const canUndo = pastStates.length > 0;
  const canRedo = futureStates.length > 0;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          if (canRedo) redo();
        } else {
          if (canUndo) undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        if (canRedo) redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, undo, redo]);

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">DRWNG MKER</h1>
        <div className="flex items-center gap-1 border-l border-border pl-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => undo()}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => redo()}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={() => exportDrawing({ ...config, exportFormat: 'svg' })}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export SVG
        </Button>
        <Button
          onClick={() => exportDrawing({ ...config, exportFormat: 'gcode' })}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export G-Code
        </Button>
      </div>
    </header>
  );
}
