import { useEffect, useRef, useState, useCallback, useLayoutEffect, useMemo } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';

interface SVGCanvasProps {
  svg?: string;
}

export default function SVGCanvas({ svg }: SVGCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Extract viewBox dimensions (the logical coordinate space)
  const viewBoxDims = useMemo(() => {
    if (!svg) return null;
    
    const viewBoxMatch = svg.match(/viewBox=["']([^"']+)["']/);
    if (viewBoxMatch) {
      const parts = viewBoxMatch[1].trim().split(/[\s,]+/).filter(p => p.length > 0);
      if (parts.length >= 4) {
        const width = parseFloat(parts[2]);
        const height = parseFloat(parts[3]);
        if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
          return { width, height };
        }
      }
    }
    return null;
  }, [svg]);

  // Normalize the SVG: replace mm units with px based on viewBox
  // This ensures the SVG renders at a predictable pixel size
  const normalizedSvg = useMemo(() => {
    if (!svg || !viewBoxDims) return svg;
    
    // Replace width="Xmm" with width="Xpx" (using viewBox dimensions as pixel size)
    let result = svg
      .replace(/width=["'][^"']+mm["']/, `width="${viewBoxDims.width}"`)
      .replace(/height=["'][^"']+mm["']/, `height="${viewBoxDims.height}"`);
    
    return result;
  }, [svg, viewBoxDims]);

  // Measure container size
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Calculate fit when SVG or container size changes
  useEffect(() => {
    if (!viewBoxDims || containerSize.width === 0 || containerSize.height === 0) return;

    const padding = 60;
    const availableWidth = containerSize.width - padding * 2;
    const availableHeight = containerSize.height - padding * 2;

    if (availableWidth <= 0 || availableHeight <= 0) return;

    const scaleX = availableWidth / viewBoxDims.width;
    const scaleY = availableHeight / viewBoxDims.height;
    const newScale = Math.min(scaleX, scaleY); // Scale to fit, allow scaling up

    setScale(newScale);
    setOffset({ x: 0, y: 0 });
  }, [svg, containerSize, viewBoxDims]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const newScale = Math.max(0.1, Math.min(5, scale + delta));
    setScale(newScale);
  }, [scale]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest('button')) {
      setIsPanning(true);
      setPanStart({ 
        x: e.clientX - offset.x, 
        y: e.clientY - offset.y 
      });
      e.preventDefault();
    }
  }, [offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleZoomIn = () => {
    setScale(prev => Math.min(5, prev * 1.2));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(0.1, prev / 1.2));
  };

  const handleReset = () => {
    if (!viewBoxDims || containerSize.width === 0 || containerSize.height === 0) return;

    const padding = 60;
    const availableWidth = containerSize.width - padding * 2;
    const availableHeight = containerSize.height - padding * 2;

    if (availableWidth <= 0 || availableHeight <= 0) return;

    const scaleX = availableWidth / viewBoxDims.width;
    const scaleY = availableHeight / viewBoxDims.height;
    const newScale = Math.min(scaleX, scaleY); // Scale to fit, allow scaling up

    setScale(newScale);
    setOffset({ x: 0, y: 0 });
  };

  if (!svg || !viewBoxDims) return null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Zoom Controls */}
      <div className="absolute right-4 top-4 z-10 flex flex-col gap-2 rounded-lg border border-border bg-card/90 p-2 shadow-lg backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleZoomIn}
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleZoomOut}
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleReset}
          title="Reset View"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <div className="px-2 py-1 text-center text-xs text-muted-foreground">
          {Math.round(scale * 100)}%
        </div>
      </div>

      {/* Canvas - flex centering with transform for pan/zoom */}
      <div
        ref={containerRef}
        className="h-full w-full flex items-center justify-center"
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
          dangerouslySetInnerHTML={{ __html: normalizedSvg }}
        />
      </div>
    </div>
  );
}
