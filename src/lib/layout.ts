import { MarginConfig } from '../types';

export interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}

export class Layout {
    static normalizeMargin(margin: MarginConfig): [number, number, number, number] {
        if (typeof margin === 'number') {
            return [margin, margin, margin, margin]; // Top, Right, Bottom, Left
        }
        if (Array.isArray(margin)) {
            if (margin.length === 2) {
                // Vertical (Top/Bottom), Horizontal (Right/Left)
                return [margin[0], margin[1], margin[0], margin[1]];
            }
            if (margin.length === 4) {
                return margin as [number, number, number, number];
            }
        }
        throw new Error(`Invalid margin config: ${JSON.stringify(margin)}`);
    }

    static getDrawArea(width: number, height: number, margin: MarginConfig): Box {
        const [top, right, bottom, left] = Layout.normalizeMargin(margin);
        return {
            x: left,
            y: bottom, // G-Code usually 0,0 is bottom-left. So margin bottom is Y start.
            width: width - (left + right),
            height: height - (top + bottom)
        };
    }
}
