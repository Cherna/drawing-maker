import MakerJs from 'makerjs';

export class Patterns {
    static Grid(rows: number, cols: number, width: number, height: number): MakerJs.IModel {
        const model: MakerJs.IModel = { paths: {} };
        const rowHeight = height / rows;
        const colWidth = width / cols;

        // Horizontals
        for (let i = 0; i <= rows; i++) {
            const y = i * rowHeight;
            model.paths![`h_${i}`] = new MakerJs.paths.Line([0, y], [width, y]);
        }

        // Verticals
        for (let i = 0; i <= cols; i++) {
            const x = i * colWidth;
            model.paths![`v_${i}`] = new MakerJs.paths.Line([x, 0], [x, height]);
        }

        return model;
    }

    static Stripes(count: number, width: number, height: number): MakerJs.IModel {
        const model: MakerJs.IModel = { paths: {} };
        const step = height / count;

        for (let i = 0; i <= count; i++) {
            const y = i * step;
            model.paths![`s_${i}`] = new MakerJs.paths.Line([0, y], [width, y]);
        }

        return model;
    }
}

export class Shapes {
    static Rectangle(w: number, h: number): MakerJs.IModel {
        return new MakerJs.models.Rectangle(w, h);
    }

    static Circle(r: number): MakerJs.IModel {
        return new MakerJs.models.Oval(2 * r, 2 * r); // MakerJs Circle is basically Oval or Ellipse
    }
}
