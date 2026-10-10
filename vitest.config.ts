import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(path.join(__dirname, "migrations"));
      return {
        wrangler: { configPath: "./wrangler.test.jsonc" },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations, PILOT_TOKEN: "test-pilot-token", CF_API_TOKEN: "test-cf-token" },
        },
      };
    }),
  ],
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/land.test.ts"],
    setupFiles: ["./test/apply-migrations.ts"],
  },
});
