import MakerJs from 'makerjs';
import { Jimp } from 'jimp';
import sharp from 'sharp';
import { CanvasConfig } from '../../types';

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
        canvas: CanvasConfig,
        options: ExperimentalHatchingParams
    ): Promise<MakerJs.IModel> {
        const { width, height } = canvas;
        const model: MakerJs.IModel = { paths: {}, models: {} };

        if (!options.densityMap) {
            return model;
        }

        try {
            const b64Parts = options.densityMap.split(',');
            const base64Data = b64Parts.length > 1 ? b64Parts[1] : options.densityMap;
            const rawBuffer = Buffer.from(base64Data, 'base64');

            let sharpInstance = sharp(rawBuffer)
                .toColorspace('srgb')
                .ensureAlpha();

            if (options.blur && options.blur > 0) {
                sharpInstance = sharpInstance.blur(options.blur);
            }

            const cleanBuffer = await sharpInstance
                .toFormat('png')
                .toBuffer();

            const image = await Jimp.read(cleanBuffer);
            image.greyscale();

            const steps = Math.floor(Math.max(2, options.shadingSteps || 5));
            image.posterize(steps);

            const processedBase64 = await image.getBase64('image/png');

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

            // Embed as pseudo-model for svg-exporter.ts
            const rasterModel: any = {
                layer: 'raster',
                origin: [0, 0],
                rasterData: {
                    base64: processedBase64,
                    width: imgW,
                    height: imgH,
                    x: startX,
                    // The SVG exporter expects Cartesian Y (bottom-up).
                    // Image space startY is from Top. 
                    // To center it, we subtract from full canvas height.
                    y: height - (startY + imgH)
                }
            };

            model.models!['raster_preview'] = rasterModel as MakerJs.IModel;
        } catch (err) {
            console.error("ExperimentalHatching Error:", err);
        }

        return model;
    }
}
