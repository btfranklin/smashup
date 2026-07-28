import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "performance.spec.ts",
  outputDir: "output/playwright/performance-results",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: "output/playwright/performance-report",
        open: "never",
      },
    ],
  ],
  use: {
    baseURL: "http://127.0.0.1:4189",
    trace: "off",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: {
    command:
      "npm run build:performance && npm run preview -- --config vite.performance.config.ts --host 127.0.0.1 --port 4189",
    url: "http://127.0.0.1:4189",
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "chromium-performance",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
