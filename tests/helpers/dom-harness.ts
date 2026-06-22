import { vi } from "vitest";

import { createCanvasRecorder } from "./canvas-recorder";

type RectLike = DOMRect & { toJSON: () => Record<string, never> };

export function createDomHarness() {
  document.body.innerHTML = '<div id="app"></div>';
  const appRoot = document.querySelector<HTMLDivElement>("#app");
  if (!appRoot) {
    throw new Error("App root missing in jsdom harness.");
  }

  const canvas = createCanvasRecorder();
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalRect = HTMLElement.prototype.getBoundingClientRect;
  let fullscreenElement: Element | null = null;
  let width = 1200;
  let height = 900;
  let now = 0;
  const rafQueue: FrameRequestCallback[] = [];

  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get() {
      return fullscreenElement;
    },
  });

  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: vi.fn(() => canvas.ctx),
  });

  Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value() {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        width,
        height,
        toJSON: () => ({}),
      } satisfies RectLike;
    },
  });

  const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    rafQueue.push(callback);
    return rafQueue.length;
  });

  const exitFullscreen = vi.fn(async () => {
    fullscreenElement = null;
  });
  Object.defineProperty(document, "exitFullscreen", {
    configurable: true,
    value: exitFullscreen,
  });

  function attachFullscreenStub(frame: HTMLElement | null) {
    if (!frame) {
      return;
    }
    Object.defineProperty(frame, "requestFullscreen", {
      configurable: true,
      value: vi.fn(async () => {
        fullscreenElement = frame;
      }),
    });
  }

  return {
    appRoot,
    canvas,
    requestAnimationFrame,
    exitFullscreen,
    performanceNow: () => now,
    advanceClock(ms: number) {
      now += ms;
    },
    flushAnimationFrames(time = now) {
      const callbacks = rafQueue.splice(0);
      callbacks.forEach((callback) => callback(time));
    },
    setContainerSize(nextWidth: number, nextHeight: number) {
      width = nextWidth;
      height = nextHeight;
    },
    attachFullscreenStub,
    cleanup() {
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        value: originalGetContext,
      });
      Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
        configurable: true,
        value: originalRect,
      });
      Reflect.deleteProperty(document, "fullscreenElement");
      Reflect.deleteProperty(document, "exitFullscreen");
    },
  };
}
