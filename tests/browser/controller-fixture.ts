import { createAppController, type AppController } from "../../src/app/bootstrap";

const appRoot = document.querySelector<HTMLDivElement>("#fixture-root");
if (!appRoot) {
  throw new Error("Controller fixture root missing.");
}

let controller: AppController | null = null;

window.controllerFixture = {
  create() {
    if (controller) {
      throw new Error("Destroy the current controller before creating another.");
    }
    controller = createAppController({ appRoot });
  },
  async destroy() {
    await controller?.destroy();
    controller = null;
  },
  snapshot() {
    return {
      active: controller !== null,
      mode: controller?.state.mode ?? null,
      hooksInstalled:
        typeof window.advanceTime === "function" &&
        typeof window.render_game_to_text === "function",
    };
  },
};

declare global {
  interface Window {
    controllerFixture: {
      create: () => void;
      destroy: () => Promise<void>;
      snapshot: () => {
        active: boolean;
        mode: string | null;
        hooksInstalled: boolean;
      };
    };
  }
}
