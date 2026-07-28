export type CanvasOperation = {
  type: string;
  args: unknown[];
};

type GradientRecorder = {
  addColorStop: (offset: number, color: string) => void;
};

export type RecordedGradient = {
  kind: "linear" | "radial";
  args: number[];
  stops: Array<{ offset: number; color: string }>;
};

export class RecordedPath2D {
  readonly operations: CanvasOperation[] = [];

  constructor(source?: Path2D | string) {
    if (source instanceof RecordedPath2D) {
      this.operations.push(
        ...source.operations.map((operation) => ({
          type: operation.type,
          args: [...operation.args],
        })),
      );
    } else if (typeof source === "string") {
      this.operations.push({ type: "svgPath", args: [source] });
    }
  }

  moveTo(x: number, y: number): void {
    this.operations.push({ type: "moveTo", args: [x, y] });
  }

  lineTo(x: number, y: number): void {
    this.operations.push({ type: "lineTo", args: [x, y] });
  }

  closePath(): void {
    this.operations.push({ type: "closePath", args: [] });
  }

  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    counterclockwise = false,
  ): void {
    this.operations.push({
      type: "arc",
      args: [x, y, radius, startAngle, endAngle, counterclockwise],
    });
  }

  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    counterclockwise = false,
  ): void {
    this.operations.push({
      type: "ellipse",
      args: [
        x,
        y,
        radiusX,
        radiusY,
        rotation,
        startAngle,
        endAngle,
        counterclockwise,
      ],
    });
  }

  roundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radii?: number | DOMPointInit | Iterable<number | DOMPointInit>,
  ): void {
    this.operations.push({
      type: "roundRect",
      args: [x, y, width, height, radii],
    });
  }

  addPath(path: Path2D): void {
    this.operations.push({ type: "addPath", args: [path] });
  }
}

export type CanvasRecorder = {
  ctx: CanvasRenderingContext2D;
  operations: CanvasOperation[];
  gradients: RecordedGradient[];
  surfaces: CanvasRecorder[];
  count: (type: string) => number;
  find: (type: string) => CanvasOperation[];
  paths: (type?: "fill" | "stroke" | "clip") => RecordedPath2D[];
};

type SharedRecorderState = {
  surfaces: CanvasRecorder[];
  ownerDocument: {
    createElement: (tagName: string) => HTMLCanvasElement;
  };
};

function installRecordedPath2D(): void {
  if (typeof globalThis.Path2D === "function") {
    return;
  }
  Object.defineProperty(globalThis, "Path2D", {
    configurable: true,
    writable: true,
    value: RecordedPath2D,
  });
}

function buildRecorder(shared: SharedRecorderState): CanvasRecorder {
  const operations: CanvasOperation[] = [];
  const gradients: RecordedGradient[] = [];

  function record(type: string, ...args: unknown[]): void {
    operations.push({ type, args });
  }

  function createGradient(
    kind: "linear" | "radial",
    args: number[],
  ): GradientRecorder {
    const gradient: RecordedGradient = { kind, args, stops: [] };
    gradients.push(gradient);
    record(
      kind === "linear" ? "createLinearGradient" : "createRadialGradient",
      ...args,
    );
    return {
      addColorStop(offset: number, color: string): void {
        gradient.stops.push({ offset, color });
        record("addColorStop", offset, color);
      },
    };
  }

  const styles: Record<string, unknown> = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    imageSmoothingEnabled: true,
    shadowColor: "",
    shadowBlur: 0,
  };
  const styleStack: Array<Record<string, unknown>> = [];

  const canvas = {
    width: 1500,
    height: 900,
    ownerDocument: shared.ownerDocument,
    getContext(contextId: string) {
      return contextId === "2d" ? ctx : null;
    },
  };

  const ctx: Record<string, unknown> = {
    canvas,
    save(): void {
      styleStack.push({ ...styles });
      record("save");
    },
    restore(): void {
      const restoredStyles = styleStack.pop();
      if (restoredStyles) {
        Object.assign(styles, restoredStyles);
      }
      record("restore");
    },
    translate(x: number, y: number): void {
      record("translate", x, y);
    },
    scale(x: number, y: number): void {
      record("scale", x, y);
    },
    rotate(angle: number): void {
      record("rotate", angle);
    },
    clearRect(x: number, y: number, width: number, height: number): void {
      record("clearRect", x, y, width, height);
    },
    drawImage(...args: unknown[]): void {
      record("drawImage", ...args);
    },
    fillRect(x: number, y: number, width: number, height: number): void {
      record("fillRect", x, y, width, height);
    },
    strokeRect(x: number, y: number, width: number, height: number): void {
      record("strokeRect", x, y, width, height);
    },
    beginPath(): void {
      record("beginPath");
    },
    moveTo(x: number, y: number): void {
      record("moveTo", x, y);
    },
    lineTo(x: number, y: number): void {
      record("lineTo", x, y);
    },
    closePath(): void {
      record("closePath");
    },
    arc(
      x: number,
      y: number,
      radius: number,
      start: number,
      end: number,
    ): void {
      record("arc", x, y, radius, start, end);
    },
    ellipse(
      x: number,
      y: number,
      radiusX: number,
      radiusY: number,
      rotation: number,
      start: number,
      end: number,
    ): void {
      record(
        "ellipse",
        x,
        y,
        radiusX,
        radiusY,
        rotation,
        start,
        end,
      );
    },
    roundRect(
      x: number,
      y: number,
      width: number,
      height: number,
      radius: unknown,
    ): void {
      record("roundRect", x, y, width, height, radius);
    },
    fill(path?: Path2D, fillRule?: CanvasFillRule): void {
      record("fill", path, fillRule);
    },
    stroke(path?: Path2D): void {
      record("stroke", path);
    },
    clip(path?: Path2D, fillRule?: CanvasFillRule): void {
      record("clip", path, fillRule);
    },
    setLineDash(segments: number[]): void {
      record("setLineDash", ...segments);
    },
    fillText(text: string, x: number, y: number): void {
      record("fillText", text, x, y);
    },
    strokeText(text: string, x: number, y: number): void {
      record("strokeText", text, x, y);
    },
    createLinearGradient(
      x0: number,
      y0: number,
      x1: number,
      y1: number,
    ): GradientRecorder {
      return createGradient("linear", [x0, y0, x1, y1]);
    },
    createRadialGradient(
      x0: number,
      y0: number,
      r0: number,
      x1: number,
      y1: number,
      r1: number,
    ): GradientRecorder {
      return createGradient("radial", [x0, y0, r0, x1, y1, r1]);
    },
  };

  for (const property of Object.keys(styles)) {
    Object.defineProperty(ctx, property, {
      configurable: true,
      enumerable: true,
      get() {
        return styles[property];
      },
      set(value: unknown) {
        styles[property] = value;
        record(`set:${property}`, value);
      },
    });
  }

  const recorder: CanvasRecorder = {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    operations,
    gradients,
    surfaces: shared.surfaces,
    count(type: string): number {
      return operations.filter((operation) => operation.type === type).length;
    },
    find(type: string): CanvasOperation[] {
      return operations.filter((operation) => operation.type === type);
    },
    paths(type?: "fill" | "stroke" | "clip"): RecordedPath2D[] {
      const candidates = type
        ? operations.filter((operation) => operation.type === type)
        : operations;
      return candidates.flatMap((operation) =>
        operation.args.filter(
          (argument): argument is RecordedPath2D =>
            argument instanceof RecordedPath2D,
        ),
      );
    },
  };

  return recorder;
}

export function createCanvasRecorder(): CanvasRecorder {
  installRecordedPath2D();
  const surfaces: CanvasRecorder[] = [];
  const shared = {
    surfaces,
    ownerDocument: {
      createElement(tagName: string): HTMLCanvasElement {
        if (tagName.toLowerCase() !== "canvas") {
          throw new Error(`Canvas recorder cannot create <${tagName}>.`);
        }
        const surface = buildRecorder(shared);
        surfaces.push(surface);
        return surface.ctx.canvas as HTMLCanvasElement;
      },
    },
  } satisfies SharedRecorderState;
  return buildRecorder(shared);
}
