import { exports } from "cloudflare:workers";
import { expect, it } from "vitest";

it("answers /health", async () => {
  const response = await exports.default.fetch("https://armature.test/health");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
});
