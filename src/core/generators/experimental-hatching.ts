import MakerJs from 'makerjs';
import { Jimp } from 'jimp';
import sharp from 'sharp';

export class ExperimentalHatchingParams {
    densityMap?: string;
    normalMap?: string;
    shadingSteps?: number;
    density?: number;
    baseAngle?: number;
    crossHatch?: boolean;
    crossHatchChance?: number;
    threshold?: number;
    scale?: number;
    offsetX?: number;
    offsetY?: number;
    flipX?: boolean;
    flipY?: boolean;
    densityCurve?: number;
    drawContour?: boolean;
    contourThreshold?: number;
    blur?: number;
}

export class ExperimentalHatching {
    static async generate(
        width: number,
        height: number,
        options: ExperimentalHatchingParams
    ): Promise<MakerJs.IModel> {
        const model: MakerJs.IModel = { paths: {}, models: {} };

        if (!options.densityMap) {
            return model;
        }

        const b64Parts = options.densityMap.split(',');
        const base64Data = b64Parts.length > 1 ? b64Parts[1] : options.densityMap;
        const rawBuffer = Buffer.from(base64Data, 'base64');

        // Jimp's PNG chunk parser historically crashes on raw browser Data URIs.
        // We use Sharp to decode and re-encode an absolutely clean PNG buffer.
        const cleanBuffer = await sharp(rawBuffer).toFormat('png').toBuffer();

        // Initialize Jimp
        const image = await Jimp.read(cleanBuffer);

        // Apply Blur if requested
        if (options.blur && options.blur > 0) {
            image.blur(options.blur);
        }

        // Apply Greyscale & Posterize
        image.greyscale();

        const steps = Math.floor(Math.max(2, options.shadingSteps || 5));
        image.posterize(steps);

        // Convert back to Base64 PNG
        const processedBase64 = await image.getBase64('image/png');

        // Extract dimension logic
        const dWidth = image.bitmap.width;
        const dHeight = image.bitmap.height;

        const userScale = options.scale ?? 1;
        const userOffsetX = options.offsetX ?? 0;
        const userOffsetY = options.offsetY ?? 0;

        const baseScale = Math.max(width / dWidth, height / dHeight);
        const scale = baseScale * userScale;

        const imgW = dWidth * scale;
        const imgH = dHeight * scale;

        const startX = (width - imgW) / 2 + (userOffsetX * width / 100);
        const startY = (height - imgH) / 2 + (userOffsetY * height / 100);

        // We embed the raster rendering parameters into a pseudo-model
        // MakerJs natively ignores unknown properties on models during iteration,
        // so we can slip a custom object in here to be plucked out by `svg-exporter.ts`.
        const rasterModel: any = {
            layer: 'raster',
            rasterData: {
                base64: processedBase64,
                width: imgW,
                height: imgH,
                x: startX,
                y: startY
            }
        };

        model.models!['raster_preview'] = rasterModel as MakerJs.IModel;

        return model;
    }
}
