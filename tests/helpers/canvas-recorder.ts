export type CanvasOperation = {
  type: string;
  args: unknown[];
};

type GradientRecorder = {
  addColorStop: (offset: number, color: string) => void;
};

export function createCanvasRecorder() {
  const operations: CanvasOperation[] = [];
  const gradients: Array<{
    kind: "linear" | "radial";
    args: number[];
    stops: Array<{ offset: number; color: string }>;
  }> = [];

  function record(type: string, ...args: unknown[]) {
    operations.push({ type, args });
  }

  function createGradient(kind: "linear" | "radial", args: number[]): GradientRecorder {
    const gradient = { kind, args, stops: [] as Array<{ offset: number; color: string }> };
    gradients.push(gradient);
    record(kind === "linear" ? "createLinearGradient" : "createRadialGradient", ...args);
    return {
      addColorStop(offset: number, color: string) {
        gradient.stops.push({ offset, color });
        record("addColorStop", offset, color);
      },
    };
  }

  const ctx = {
    canvas: { width: 1500, height: 900 },
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    shadowColor: "",
    shadowBlur: 0,
    save() {
      record("save");
    },
    restore() {
      record("restore");
    },
    translate(x: number, y: number) {
      record("translate", x, y);
    },
    scale(x: number, y: number) {
      record("scale", x, y);
    },
    rotate(angle: number) {
      record("rotate", angle);
    },
    clearRect(x: number, y: number, width: number, height: number) {
      record("clearRect", x, y, width, height);
    },
    drawImage(...args: unknown[]) {
      record("drawImage", ...args);
    },
    fillRect(x: number, y: number, width: number, height: number) {
      record("fillRect", x, y, width, height);
    },
    strokeRect(x: number, y: number, width: number, height: number) {
      record("strokeRect", x, y, width, height);
    },
    beginPath() {
      record("beginPath");
    },
    moveTo(x: number, y: number) {
      record("moveTo", x, y);
    },
    lineTo(x: number, y: number) {
      record("lineTo", x, y);
    },
    closePath() {
      record("closePath");
    },
    arc(x: number, y: number, radius: number, start: number, end: number) {
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
    ) {
      record("ellipse", x, y, radiusX, radiusY, rotation, start, end);
    },
    roundRect(x: number, y: number, width: number, height: number, radius: unknown) {
      record("roundRect", x, y, width, height, radius);
    },
    fill() {
      record("fill");
    },
    stroke() {
      record("stroke");
    },
    clip() {
      record("clip");
    },
    setLineDash(segments: number[]) {
      record("setLineDash", ...segments);
    },
    fillText(text: string, x: number, y: number) {
      record("fillText", text, x, y);
    },
    strokeText(text: string, x: number, y: number) {
      record("strokeText", text, x, y);
    },
    createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
      return createGradient("linear", [x0, y0, x1, y1]);
    },
    createRadialGradient(
      x0: number,
      y0: number,
      r0: number,
      x1: number,
      y1: number,
      r1: number,
    ) {
      return createGradient("radial", [x0, y0, r0, x1, y1, r1]);
    },
  };

  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    operations,
    gradients,
    count(type: string) {
      return operations.filter((operation) => operation.type === type).length;
    },
    find(type: string) {
      return operations.filter((operation) => operation.type === type);
    },
  };
}
