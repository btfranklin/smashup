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
  let nextRafHandle = 1;
  let nextIdleHandle = 1;
  const rafQueue: Array<{ handle: number; callback: FrameRequestCallback }> = [];
  const idleQueue: Array<{ handle: number; callback: () => void }> = [];

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
    const handle = nextRafHandle;
    nextRafHandle += 1;
    rafQueue.push({ handle, callback });
    return handle;
  });
  const cancelAnimationFrame = vi.fn((handle: number) => {
    const index = rafQueue.findIndex((entry) => entry.handle === handle);
    if (index >= 0) {
      rafQueue.splice(index, 1);
    }
  });
  const scheduleIdleTask = vi.fn((callback: () => void) => {
    const handle = nextIdleHandle;
    nextIdleHandle += 1;
    idleQueue.push({ handle, callback });
    return handle;
  });
  const cancelIdleTask = vi.fn((handle: number) => {
    const index = idleQueue.findIndex((entry) => entry.handle === handle);
    if (index >= 0) {
      idleQueue.splice(index, 1);
    }
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
    cancelAnimationFrame,
    scheduleIdleTask,
    cancelIdleTask,
    exitFullscreen,
    performanceNow: () => now,
    advanceClock(ms: number) {
      now += ms;
    },
    flushAnimationFrames(time = now) {
      const entries = rafQueue.splice(0);
      entries.forEach(({ callback }) => callback(time));
    },
    flushIdleTasks() {
      const entries = idleQueue.splice(0);
      entries.forEach(({ callback }) => callback());
    },
    pendingAnimationFrames() {
      return rafQueue.length;
    },
    pendingIdleTasks() {
      return idleQueue.length;
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
