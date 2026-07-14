import { expect, test as base } from "@playwright/test";
import type { Page } from "@playwright/test";

type BrowserErrors = {
  console: string[];
  page: string[];
  requests: string[];
};

export const test = base.extend<{ browserErrors: BrowserErrors }>({
  browserErrors: [
    async ({ page }, use) => {
      const errors: BrowserErrors = {
        console: [],
        page: [],
        requests: [],
      };
      page.on("console", (message) => {
        if (message.type() === "error") {
          errors.console.push(message.text());
        }
      });
      page.on("pageerror", (error) => errors.page.push(error.message));
      page.on("requestfailed", (request) => {
        errors.requests.push(
          `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "unknown failure"}`,
        );
      });

      await use(errors);

      expect(errors.page, "unexpected browser page errors").toEqual([]);
      expect(errors.console, "unexpected browser console errors").toEqual([]);
      expect(errors.requests, "unexpected browser request failures").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";

export async function readGamePayload(page: Page) {
  return page.evaluate(() => {
    if (!window.render_game_to_text) {
      throw new Error("render_game_to_text hook is unavailable.");
    }
    return JSON.parse(window.render_game_to_text()) as Record<string, unknown>;
  });
}
