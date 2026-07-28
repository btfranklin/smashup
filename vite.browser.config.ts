import path from "node:path";

import { defineConfig } from "vite";

const root = process.cwd();

export default defineConfig({
  build: {
    outDir: "output/browser-build",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: path.resolve(root, "index.html"),
        "tests/browser/controller-fixture": path.resolve(
          root,
          "tests/browser/controller-fixture.html",
        ),
      },
    },
  },
});
