import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

const seat = { cookie: "armature_seat=test-pilot-token" };
const form = (data: Record<string, string>, headers: Record<string, string> = seat) =>
  ({ method: "POST", headers: { ...headers, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(data).toString(), redirect: "manual" as const });

describe("the seat", () => {
  it("sends an unauthenticated browser to /login and refuses an API call with 401", async () => {
    const page = await exports.default.fetch("https://armature.test/", { redirect: "manual" });
    expect(page.status).toBe(302);
    expect(page.headers.get("location")).toBe("/login");
    const api = await exports.default.fetch("https://armature.test/api/intent/x");
    expect(api.status).toBe(401);
    expect(await api.text()).toBe("");
  });
  it("sets the cookie on a correct token and not on a wrong one", async () => {
    const ok = await exports.default.fetch("https://armature.test/login", form({ token: "test-pilot-token" }, {}));
    expect(ok.status).toBe(302);
    expect(ok.headers.get("set-cookie")).toContain("armature_seat=test-pilot-token");
    const bad = await exports.default.fetch("https://armature.test/login", form({ token: "nope" }, {}));
    expect(bad.status).toBe(401);
    expect(bad.headers.get("set-cookie")).toBeNull();
  });
});

describe("pages", () => {
  it("creates a project, writes the vision, files an intent, and shows the table", async () => {
    const slug = `c${crypto.randomUUID().slice(0, 6)}`;
    const created = await exports.default.fetch("https://armature.test/projects", form({ slug }));
    expect(created.status).toBe(302);
    expect(created.headers.get("location")).toBe(`/p/${slug}`);
    await exports.default.fetch(`https://armature.test/p/${slug}/vision`, form({ vision: "A <b>bold</b> plan." }));
    const made = await exports.default.fetch(`https://armature.test/p/${slug}/intents`, form({ title: "First", body: "Do it." }));
    const intentUrl = made.headers.get("location")!;
    expect(intentUrl).toMatch(/^\/i\/[0-9a-f-]{36}$/);
    const page = await (await exports.default.fetch(`https://armature.test/p/${slug}`, { headers: seat })).text();
    expect(page).toContain("A &lt;b&gt;bold&lt;/b&gt; plan.");
    expect(page).toContain("published with the chapter");
    expect(page).toContain(">First<");
    expect(page).toContain("open");
  });
  it("shows unanswered questions, lets the pilot reply, close, and mark private", async () => {
    const slug = `d${crypto.randomUUID().slice(0, 6)}`;
    await exports.default.fetch("https://armature.test/projects", form({ slug }));
    const made = await exports.default.fetch(`https://armature.test/p/${slug}/intents`, form({ title: "T", body: "B" }));
    const intentId = made.headers.get("location")!.split("/").pop()!;
    const { armature } = (await import("../src/index")).buildApp(env);
    const q = await armature.fileExchange({ intentId, kind: "question", body: "Why though?", author: "challenger" });
    let page = await (await exports.default.fetch(`https://armature.test/i/${intentId}`, { headers: seat })).text();
    expect(page).toContain("Why though?");
    expect(page).toContain("1 unanswered");
    await exports.default.fetch(`https://armature.test/i/${intentId}/reply`, form({ reply_to: q.id, body: "Because." }));
    await exports.default.fetch(`https://armature.test/i/${intentId}/private`, form({ exchange_id: q.id, private: "yes" }));
    const closed = await exports.default.fetch(`https://armature.test/i/${intentId}/close`, form({}));
    expect(closed.status).toBe(302);
    page = await (await exports.default.fetch(`https://armature.test/i/${intentId}`, { headers: seat })).text();
    expect(page).toContain("Because.");
    expect(page).toContain("0 unanswered");
    expect(page).toContain("private");
    expect(page).toContain("closed");
  });
  it("serves the intent record and the export as JSON for bin/land", async () => {
    const slug = `e${crypto.randomUUID().slice(0, 6)}`;
    await exports.default.fetch("https://armature.test/projects", form({ slug }));
    const made = await exports.default.fetch(`https://armature.test/p/${slug}/intents`, form({ title: "Land me", body: "B" }));
    const intentId = made.headers.get("location")!.split("/").pop()!;
    const record = await (await exports.default.fetch(`https://armature.test/api/intent/${intentId}`, { headers: { authorization: "Bearer test-pilot-token" } })).json() as { intent: { state: string } };
    expect(record.intent.state).toBe("open");
    const exported = await (await exports.default.fetch(`https://armature.test/api/intent/${intentId}/export`, { headers: { authorization: "Bearer test-pilot-token" } })).json() as { dir: string };
    expect(exported.dir).toBe("0001-land-me");
  });
});
