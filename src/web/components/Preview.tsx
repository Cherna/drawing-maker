import { Loader2, AlertCircle } from 'lucide-react';
import SVGCanvas from './SVGCanvas';

interface PreviewProps {
  svg?: string;
  isLoading: boolean;
  error?: Error | null;
}

import { useConfigStore } from '../store/config-store';

export default function Preview({ svg, isLoading, error }: PreviewProps) {
  const strokeWidth = useConfigStore((state) => state.config.canvas.strokeWidth);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-muted/20">
      <div className="border-b border-border bg-card px-6 py-3">
        {/* ... header content ... */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Preview</h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isLoading && (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Generating...</span>
              </>
            )}
            {!isLoading && !error && svg && (
              <span className="text-green-600 dark:text-green-400">Ready</span>
            )}
            {error && (
              <span className="flex items-center gap-1 text-destructive">
                <AlertCircle className="h-3 w-3" />
                Error
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main content area - must fill remaining space */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        {/* ... loading/error states ... */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Generating preview...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div className="text-center">
                <p className="font-semibold text-destructive">Error generating preview</p>
                <p className="text-sm text-muted-foreground">{error.message}</p>
              </div>
            </div>
          </div>
        )}

        {!isLoading && !error && svg && (
          <SVGCanvas svg={svg} strokeWidth={strokeWidth} />
        )}

        {!isLoading && !error && !svg && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-muted-foreground">Configure your drawing to see preview</p>
          </div>
        )}
      </div>
    </div>
  );
}
