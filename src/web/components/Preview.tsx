import { Loader2, AlertCircle } from 'lucide-react';
import SVGCanvas from './SVGCanvas';

interface PreviewProps {
  svg?: string;
  isLoading: boolean;
  error?: Error | null;
}

export default function Preview({ svg, isLoading, error }: PreviewProps) {

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-muted/20">
      <div className="border-b border-border bg-card px-6 py-3">
        {/* ... header content ... */}
        <div className="flex items-center justify-between min-h-[24px]">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold">Preview</h2>
            {isLoading && (
              <div className="flex items-center gap-2 bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="font-medium text-xs">Generating...</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
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
        {/* Loading spinner overlay - only show centered when no content yet */}
        {isLoading && !svg && (
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

        {/* Show content even while loading (non-blocking update) */}
        {!error && svg && (
          <SVGCanvas svg={svg} />
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
