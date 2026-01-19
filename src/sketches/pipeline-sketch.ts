import MakerJs from 'makerjs';
import { SketchGenerator, CanvasConfig, PipelineParams } from '../types';
import { Pipeline } from '../core/pipeline';

export class PipelineSketch implements SketchGenerator {
    async generate(canvas: CanvasConfig, params: PipelineParams): Promise<MakerJs.IModel> {
        return Pipeline.execute(params.steps, canvas);
    }
}
