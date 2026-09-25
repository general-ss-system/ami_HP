import { defineConfig } from "vitest/config";

// CMS クライアントなど、Astro に依存しないロジックの単体テスト用。
export default defineConfig({
  define: {
    __PREVIEW_BUILD__: "false",
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
