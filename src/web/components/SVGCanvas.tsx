import { useEffect, useRef, useState, useCallback, useLayoutEffect, useMemo } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Scan } from 'lucide-react';
import { Button } from './ui/button';
import { useConfigStore } from '../store/config-store';
import { OriginSelector } from './OriginSelector';

interface SVGCanvasProps {
  svg?: string;
  strokeWidth?: number;
}

export default function SVGCanvas({ svg, strokeWidth = 0.4 }: SVGCanvasProps) {
  const gcode = useConfigStore((state) => state.config.gcode);
  const canvas = useConfigStore((state) => state.config.canvas);
  const updateGCode = useConfigStore((state) => state.updateGCode);
  const showOriginSelector = useConfigStore((state) => state.showOriginSelector);
  const setShowOriginSelector = useConfigStore((state) => state.setShowOriginSelector);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 20;

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

    // Do not override stroke-width globally anymore.
    // Layers now handle their own stroke widths.

    // Safety check for empty SVGs
    if (!result.includes('<svg')) {
      return result;
    }

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
  const hasFitted = useRef(false);

  // We need to compare specific dimensions to avoid re-triggering on object identity changes
  const dimsStr = viewBoxDims ? `${viewBoxDims.width},${viewBoxDims.height}` : '';

  useEffect(() => {
    if (!viewBoxDims || containerSize.width === 0 || containerSize.height === 0) return;

    if (hasFitted.current) return;

    const padding = 60;
    const availableWidth = containerSize.width - padding * 2;
    const availableHeight = containerSize.height - padding * 2;

    if (availableWidth <= 0 || availableHeight <= 0) return;

    const scaleX = availableWidth / viewBoxDims.width;
    const scaleY = availableHeight / viewBoxDims.height;
    const newScale = Math.min(scaleX, scaleY);

    setScale(newScale);
    setOffset({ x: 0, y: 0 });
    hasFitted.current = true;
  }, [dimsStr, containerSize.width, containerSize.height]);

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

  const handleRealSize = () => {
    // 1mm = 96/25.4 px (CSS pixels)
    // We assume the internal unit of the SVG is mm
    // To display at "real physical size", we scale 1 unit (1mm) to 96/25.4 CSS pixels
    setScale(96 / 25.4);
    setOffset({ x: 0, y: 0 });
  };

  const handleReset = () => {
    if (!viewBoxDims || containerSize.width === 0 || containerSize.height === 0) return;

    const padding = 60;
    const availableWidth = containerSize.width - padding * 2;
    const availableHeight = containerSize.height - padding * 2;

    if (availableWidth <= 0 || availableHeight <= 0) return;

    const scaleX = availableWidth / viewBoxDims.width;
    const scaleY = availableHeight / viewBoxDims.height;
    const newScale = Math.min(scaleX, scaleY);

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
          onClick={handleRealSize}
          title="Real Size (1:1)"
        >
          <Scan className="h-4 w-4" />
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

      {/* Axis Indicator (Fixed Overlay) */}
      {useConfigStore.getState().config.canvas.showAxisIndicator !== false && (
        <div
          className="absolute left-6 top-6 z-20 pointer-events-none p-4 rounded-xl border border-border bg-card/70 shadow-2xl backdrop-blur-md overflow-hidden"
          style={{ width: '100px', height: '100px' }}
        >
          <svg width="100%" height="100%" viewBox="0 0 100 100">
            <defs>
              <marker id="arrow-red" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                <path d="M0,0 L6,2 L0,4 Z" fill="#ef4444" />
              </marker>
              <marker id="arrow-green" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                <path d="M0,0 L6,2 L0,4 Z" fill="#22c55e" />
              </marker>
            </defs>

            {/* Origin at center to allow inversion in all directions */}
            <g transform="translate(50, 50)">
              <circle cx="0" cy="0" r="2.5" fill="currentColor" className="text-muted-foreground/50" />

              {/* When swapAxes is enabled, X becomes vertical and Y becomes horizontal */}
              {!gcode.swapAxes ? (
                <>
                  {/* X Axis (Red) - Horizontal */}
                  <line
                    x1="0" y1="0"
                    x2={gcode.invertX ? -22 : 22} y2="0"
                    stroke="#ef4444"
                    strokeWidth="3"
                    strokeLinecap="round"
                    markerEnd="url(#arrow-red)"
                  />
                  <text
                    x={gcode.invertX ? -32 : 32}
                    y="4"
                    fontSize="11"
                    fill="#ef4444"
                    fontWeight="bold"
                    textAnchor="middle"
                  >X</text>

                  {/* Y Axis (Green) - Vertical */}
                  <line
                    x1="0" y1="0"
                    x2="0" y2={gcode.invertY ? -22 : 22}
                    stroke="#22c55e"
                    strokeWidth="3"
                    strokeLinecap="round"
                    markerEnd="url(#arrow-green)"
                  />
                  <text
                    x="0"
                    y={gcode.invertY ? -32 : 40}
                    fontSize="11"
                    fill="#22c55e"
                    fontWeight="bold"
                    textAnchor="middle"
                  >Y</text>
                </>
              ) : (
                <>
                  {/* X Axis (Red) - Vertical (swapped from Y position) */}
                  <line
                    x1="0" y1="0"
                    x2="0" y2={gcode.invertX ? -22 : 22}
                    stroke="#ef4444"
                    strokeWidth="3"
                    strokeLinecap="round"
                    markerEnd="url(#arrow-red)"
                  />
                  <text
                    x="0"
                    y={gcode.invertX ? -32 : 40}
                    fontSize="11"
                    fill="#ef4444"
                    fontWeight="bold"
                    textAnchor="middle"
                  >X</text>

                  {/* Y Axis (Green) - Horizontal (swapped from X position) */}
                  <line
                    x1="0" y1="0"
                    x2={gcode.invertY ? -22 : 22} y2="0"
                    stroke="#22c55e"
                    strokeWidth="3"
                    strokeLinecap="round"
                    markerEnd="url(#arrow-green)"
                  />
                  <text
                    x={gcode.invertY ? -32 : 32}
                    y="4"
                    fontSize="11"
                    fill="#22c55e"
                    fontWeight="bold"
                    textAnchor="middle"
                  >Y</text>
                </>
              )}
            </g>
          </svg>
          <div className="absolute bottom-2 left-0 right-0 text-center text-[10px] font-mono tracking-wider text-muted-foreground uppercase opacity-40">Origin</div>
        </div>
      )}

      {/* Persistent Origin Indicator - shows when origin is not at (0,0) */}
      {(gcode.originX !== 0 || gcode.originY !== 0) && (
        <div
          className="absolute top-16 left-4 bg-card/90 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 shadow-lg flex items-center gap-2 z-30 cursor-pointer hover:bg-card transition-colors"
          onClick={() => updateGCode({ originX: 0, originY: 0 })}
          title="Click to reset origin to (0,0)"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
          <div className="text-[10px] font-mono">
            <span className="text-muted-foreground">Origin:</span>
            <span className="ml-1 text-foreground font-semibold">
              ({(gcode.originX || 0).toFixed(1)}, {(gcode.originY || 0).toFixed(1)})
            </span>
            <span className="ml-0.5 text-muted-foreground">mm</span>
          </div>
        </div>
      )}

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
            position: 'relative'
          }}
        >
          <div dangerouslySetInnerHTML={{ __html: normalizedSvg || '' }} />
        </div>
      </div>

      {/* Origin Selector Overlay */}
      {showOriginSelector && (
        <OriginSelector
          canvasWidth={canvas.width}
          canvasHeight={canvas.height}
          contentRef={contentRef}
          onClose={() => setShowOriginSelector(false)}
        />
      )}
    </div>
  );
}
