import { useEffect, useRef } from 'react';
import { MaskConfig } from '../../types';
import { Masks } from '../../lib/masks';

interface MaskPreviewProps {
    mask: MaskConfig;
    width?: number;
    height?: number;
}

export default function MaskPreview({ mask, width = 150, height = 150 }: MaskPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Create mask function
        // Use a dummy bounds box of 0,0,1,1 for normalized preview
        // Or closer to aspect ratio?
        const bounds = { x: 0, y: 0, width: width, height: height };

        // We handle errors gracefully if mask creation fails
        let maskFn: ((x: number, y: number) => number) | null = null;
        try {
            maskFn = Masks.create(mask, bounds, mask.params?.seed);
        } catch (e) {
            console.error("Failed to create mask preview:", e);
        }

        if (!maskFn) return;

        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;

        // Draw pixels
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Mask functions expect coordinates in bounds space
                // If we passed width/height to bounds, we pass x,y directly
                const val = maskFn(x, y);

                // Map 0-1 to grayscale
                const v = Math.floor(val * 255);

                const idx = (y * width + x) * 4;
                data[idx] = v;     // R
                data[idx + 1] = v; // G
                data[idx + 2] = v; // B
                data[idx + 3] = 255; // Alpha
            }
        }

        ctx.putImageData(imageData, 0, 0);

    }, [mask, width, height]);

    return (
        <div className="border border-border rounded-md overflow-hidden bg-black shadow-inner">
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                className="block w-full h-auto image-pixelated"
            />
        </div>
    );
}
