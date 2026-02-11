import React, { useLayoutEffect, useState, useRef } from 'react';
import { useConfigStore } from '../store/config-store';
import { X } from 'lucide-react';

interface RenderedPoint {
    id: string;
    label: string;
    screenX: number;
    screenY: number;
    logicalX: number;
    logicalY: number;
    type: 'canvas' | 'bbox';
}

interface OriginSelectorProps {
    canvasWidth: number;
    canvasHeight: number;
    contentRef: React.RefObject<HTMLDivElement>;
    onClose: () => void;
}

export function OriginSelector({ canvasWidth, canvasHeight, contentRef, onClose }: OriginSelectorProps) {
    const updateGCode = useConfigStore((state) => state.updateGCode);
    const currentOrigin = useConfigStore((state) => ({
        x: state.config.gcode.originX || 0,
        y: state.config.gcode.originY || 0
    }));

    const [renderedPoints, setRenderedPoints] = useState<RenderedPoint[]>([]);
    const overlayRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!contentRef.current || !overlayRef.current) return;

        const svgElement = contentRef.current.querySelector('svg');
        if (!svgElement) return;

        // Force a layout update to ensure we have measurements
        const ctm = svgElement.getScreenCTM();
        if (!ctm) return;

        const overlayRect = overlayRef.current.getBoundingClientRect();

        // Helper to transform SVG local coord to Overlay pixel coord
        const toOverlayCoord = (x: number, y: number) => {
            // Apply SVG Matrix
            const px = x * ctm.a + y * ctm.c + ctm.e;
            const py = x * ctm.b + y * ctm.d + ctm.f;
            // Map to local overlay space
            return {
                x: px - overlayRect.left,
                y: py - overlayRect.top
            };
        };

        const newPoints: RenderedPoint[] = [];

        // 1. Canvas Corners (based on viewBox or canvas size)
        // SVG (0,0) is TL, (W,H) is BR. Cartesian: BL is (0,0)
        // We assume SVG ViewBox (0,0) matches Cartesian (0, Height)
        const vbWidth = svgElement.viewBox.baseVal.width || canvasWidth;
        const vbHeight = svgElement.viewBox.baseVal.height || canvasHeight;

        // TL (Cartesian 0, H) -> SVG (0,0)
        const tl = toOverlayCoord(0, 0);
        newPoints.push({ id: 'canvas-tl', label: 'Canvas TL', screenX: tl.x, screenY: tl.y, logicalX: 0, logicalY: canvasHeight, type: 'canvas' });

        // TR (Cartesian W, H) -> SVG (W, 0)
        const tr = toOverlayCoord(vbWidth, 0);
        newPoints.push({ id: 'canvas-tr', label: 'Canvas TR', screenX: tr.x, screenY: tr.y, logicalX: canvasWidth, logicalY: canvasHeight, type: 'canvas' });

        // BL (Cartesian 0, 0) -> SVG (0, H)
        const bl = toOverlayCoord(0, vbHeight);
        newPoints.push({ id: 'canvas-bl', label: 'Canvas BL', screenX: bl.x, screenY: bl.y, logicalX: 0, logicalY: 0, type: 'canvas' });

        // BR (Cartesian W, 0) -> SVG (W, H)
        const br = toOverlayCoord(vbWidth, vbHeight);
        newPoints.push({ id: 'canvas-br', label: 'Canvas BR', screenX: br.x, screenY: br.y, logicalX: canvasWidth, logicalY: 0, type: 'canvas' });


        // 2. Drawing BBox Corners (if any content)
        try {
            // getBBox gives bounds in SVG user units
            const bbox = svgElement.getBBox();

            // Drawing TL: SVG (x, y) -> Cartesian (x, H - y)
            const dTl = toOverlayCoord(bbox.x, bbox.y);
            newPoints.push({ id: 'bbox-tl', label: 'Drawing TL', screenX: dTl.x, screenY: dTl.y, logicalX: bbox.x, logicalY: canvasHeight - bbox.y, type: 'bbox' });

            // Drawing TR: SVG (x+w, y)
            const dTr = toOverlayCoord(bbox.x + bbox.width, bbox.y);
            newPoints.push({ id: 'bbox-tr', label: 'Drawing TR', screenX: dTr.x, screenY: dTr.y, logicalX: bbox.x + bbox.width, logicalY: canvasHeight - bbox.y, type: 'bbox' });

            // Drawing BL: SVG (x, y+h)
            const dBl = toOverlayCoord(bbox.x, bbox.y + bbox.height);
            newPoints.push({ id: 'bbox-bl', label: 'Drawing BL', screenX: dBl.x, screenY: dBl.y, logicalX: bbox.x, logicalY: canvasHeight - (bbox.y + bbox.height), type: 'bbox' });

            // Drawing BR: SVG (x+w, y+h)
            const dBr = toOverlayCoord(bbox.x + bbox.width, bbox.y + bbox.height);
            newPoints.push({ id: 'bbox-br', label: 'Drawing BR', screenX: dBr.x, screenY: dBr.y, logicalX: bbox.x + bbox.width, logicalY: canvasHeight - (bbox.y + bbox.height), type: 'bbox' });
        } catch (e) {
            // Ignore if empty or error
        }

        setRenderedPoints(newPoints);

    }, [contentRef, canvasWidth, canvasHeight]); // Recalc on mount

    // ESC key handler
    React.useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const handlePointClick = (p: RenderedPoint) => {
        updateGCode({ originX: p.logicalX, originY: p.logicalY });
        onClose();
    };

    return (
        <div
            ref={overlayRef}
            className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm pointer-events-auto overflow-hidden"
            onClick={onClose}
        >
            {/* Instructions panel */}
            <div
                className="absolute top-4 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg p-3 shadow-xl max-w-sm z-10"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold mb-1">Select Origin Point (0,0)</p>
                        <div className="space-y-0.5">
                            <p className="text-[10px] text-muted-foreground flex items-center">
                                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-1.5"></span>
                                Blue = Canvas corners
                            </p>
                            <p className="text-[10px] text-muted-foreground flex items-center">
                                <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1.5"></span>
                                Green = Drawing bbox
                            </p>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1.5 opacity-60">
                            Press ESC to cancel
                        </p>
                    </div>
                    <button
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        onClick={onClose}
                        title="Close (ESC)"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Clickable points */}
            {renderedPoints.map(point => {
                const isSelected = Math.abs(point.logicalX - currentOrigin.x) < 0.1 && Math.abs(point.logicalY - currentOrigin.y) < 0.1;

                return (
                    <div
                        key={point.id}
                        className="absolute flex flex-col items-center pointer-events-auto"
                        style={{
                            left: point.screenX,
                            top: point.screenY,
                            transform: 'translate(-50%, -50%)'
                        }}
                    >
                        {/* Point circle */}
                        <div
                            className="rounded-full cursor-pointer hover:opacity-80 transition-opacity shadow-sm"
                            style={{
                                width: isSelected ? '10px' : '8px',
                                height: isSelected ? '10px' : '8px',
                                backgroundColor: point.type === 'canvas' ? '#3b82f6' : '#10b981',
                                border: '1.5px solid white'
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                handlePointClick(point);
                            }}
                        />
                        {/* Label */}
                        <div
                            className="absolute whitespace-nowrap pointer-events-none select-none"
                            style={{
                                top: '12px',
                                fontSize: '10px',
                                fontWeight: '500',
                                color: 'white',
                                textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                                opacity: 0.9
                            }}
                        >
                            {point.label}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
