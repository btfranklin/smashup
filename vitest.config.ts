import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    environmentMatchGlobs: [
      ["tests/bootstrap.spec.ts", "jsdom"],
      ["tests/audio.spec.ts", "jsdom"],
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/main.ts", "src/game/types.ts"],
    },
  },
});
