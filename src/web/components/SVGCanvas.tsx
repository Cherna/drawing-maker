import { useEffect, useRef, useState, useCallback, useLayoutEffect, useMemo } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';

interface SVGCanvasProps {
  svg?: string;
}

export default function SVGCanvas({ svg }: SVGCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 20; // Increased from 5 to allow up to 2000% zoom

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

  // Use refs for high-frequency updates to avoid re-renders
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });

  // Sync refs with state when state changes (e.g. via buttons)
  useEffect(() => {
    transformRef.current = { scale, x: offset.x, y: offset.y };
  }, [scale, offset]);

  // Update DOM directly
  const updateTransform = () => {
    if (!contentRef.current) return;
    const { scale, x, y } = transformRef.current;
    contentRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  };

  // Attach non-passive wheel listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;

      const prevScale = transformRef.current.scale;
      const newScale = Math.max(0.1, Math.min(20, prevScale + delta));

      transformRef.current.scale = newScale;
      updateTransform();

      // Throttle state update for UI
      if (requestAnimationFrameRef.current) return;
      requestAnimationFrameRef.current = requestAnimationFrame(() => {
        setScale(newScale); // Sync React state for UI numbers
        requestAnimationFrameRef.current = null;
      });
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  // Refs for tracking animation frame
  const requestAnimationFrameRef = useRef<number | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest('button')) {
      setIsPanning(true);
      setPanStart({
        x: e.clientX - transformRef.current.x,
        y: e.clientY - transformRef.current.y
      });
      e.preventDefault();
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const newX = e.clientX - panStart.x;
      const newY = e.clientY - panStart.y;

      transformRef.current.x = newX;
      transformRef.current.y = newY;
      updateTransform();

      // We don't necessarily need to update React state for every mouse move frame if we don't use it elsewhere
      // But we do need it for the 'isPanning' logic consistency if we pause
    }
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      // Sync final state
      setOffset({ x: transformRef.current.x, y: transformRef.current.y });
    }
  }, [isPanning]);

  const handleZoomIn = () => {
    setScale(prev => Math.min(MAX_ZOOM, prev * 1.2));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(MIN_ZOOM, prev / 1.2));
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
        className="h-full w-full flex items-center justify-center transform-gpu"
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          ref={contentRef}
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
