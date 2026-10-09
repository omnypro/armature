// test/auth.test.ts
import { env as workerEnv } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { COOKIE_NAME, isPilot, seatCookie } from "../src/auth";
import type { Env } from "../src/env";

// The generated Cloudflare.Env omits the secrets (PILOT_TOKEN, CF_API_TOKEN).
const env = workerEnv as unknown as Env;

describe("isPilot", () => {
  it("accepts the bearer token", () => {
    const r = new Request("https://a.test/mcp", { headers: { authorization: "Bearer test-pilot-token" } });
    expect(isPilot(r, env)).toBe(true);
  });
  it("accepts the seat cookie", () => {
    const r = new Request("https://a.test/", { headers: { cookie: `${COOKIE_NAME}=test-pilot-token; other=1` } });
    expect(isPilot(r, env)).toBe(true);
  });
  it("rejects a missing, wrong, or prefix token", () => {
    expect(isPilot(new Request("https://a.test/"), env)).toBe(false);
    expect(isPilot(new Request("https://a.test/", { headers: { authorization: "Bearer nope" } }), env)).toBe(false);
    expect(isPilot(new Request("https://a.test/", { headers: { authorization: "Bearer test-pilot" } }), env)).toBe(false);
  });
  it("builds an HttpOnly, Secure, strict cookie", () => {
    expect(seatCookie("abc")).toBe(`${COOKIE_NAME}=abc; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`);
  });
});
