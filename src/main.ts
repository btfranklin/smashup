import "./style.css";

import { bootstrapApp } from "./app/bootstrap";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("App root missing.");
}

bootstrapApp({ appRoot: app });

declare global {
  interface Window {
    advanceTime?: (ms: number) => void;
    render_game_to_text?: () => string;
  }
}
