import { env, exports } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import type { Armature } from "../src/service";
import { route } from "../src/router";

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
    expect(created.status).toBe(200);
    const shown = await created.text();
    expect(shown).toContain(`Write token for this repo, shown once: <code>tok-create-${slug}</code>.`);
    expect(shown).toContain(`Push your code with <code>git push https://x:tok-create-${slug}@fake.artifacts/armature/${slug}.git main</code>.`);
    expect(shown.indexOf("Write token")).toBeLessThan(shown.indexOf("<h2>Blueprint</h2>"));
    expect(shown.split("<!doctype html>").length).toBe(2);
    await exports.default.fetch(`https://armature.test/p/${slug}/vision`, form({ vision: "A <b>bold</b> plan." }));
    const made = await exports.default.fetch(`https://armature.test/p/${slug}/intents`, form({ title: "First", body: "Do it." }));
    const intentUrl = made.headers.get("location")!;
    expect(intentUrl).toMatch(/^\/i\/[0-9a-f-]{36}$/);
    const page = await (await exports.default.fetch(`https://armature.test/p/${slug}`, { headers: seat })).text();
    expect(page).toContain("A &lt;b&gt;bold&lt;/b&gt; plan.");
    expect(page).toContain("published with the chapter");
    expect(page).toContain(">First<");
    expect(page).toContain("open");
    expect(page).not.toContain("tok-create-");
    expect(page.split("<!doctype html>").length).toBe(2);
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
  it("takes or dismisses a poke with its own reason, and says so", async () => {
    const slug = `f${crypto.randomUUID().slice(0, 6)}`;
    await exports.default.fetch("https://armature.test/projects", form({ slug }));
    const made = await exports.default.fetch(`https://armature.test/p/${slug}/intents`, form({ title: "T", body: "B" }));
    const intentId = made.headers.get("location")!.split("/").pop()!;
    const { armature } = (await import("../src/index")).buildApp(env);
    const poke = await armature.fileExchange({ intentId, kind: "poke", tag: "heads_up", author: "watcher", body: "Look here." });
    await exports.default.fetch(`https://armature.test/i/${intentId}/verdict`, form({ exchange_id: poke.id, taken: "no", reason: "Covered later." }));
    const page = await (await exports.default.fetch(`https://armature.test/i/${intentId}`, { headers: seat })).text();
    expect(page).toContain("dismissed");
    expect(page).toContain("Covered later.");
  });
  it("verifies a landing from the intent page once main holds the accepted commit", async () => {
    const slug = `h${crypto.randomUUID().slice(0, 6)}`;
    await exports.default.fetch("https://armature.test/projects", form({ slug }));
    const made = await exports.default.fetch(`https://armature.test/p/${slug}/intents`, form({ title: "T", body: "B" }));
    const intentId = made.headers.get("location")!.split("/").pop()!;
    const { armature } = (await import("../src/index")).buildApp(env);
    const fake = (globalThis as { __fakeArtifacts?: import("./fake-artifacts").FakeArtifacts }).__fakeArtifacts!;
    await armature.closeChallenge(intentId);
    const { fork } = await armature.requestFork(intentId, "builder-a");
    const commit = fake.commit(fork.fork_repo, "main", { "a.ts": "1" });
    const { proposal } = await armature.fileProposal({ intentId, limb: "builder-a", commit, paths: ["a.ts"], evidence: "ok" });
    await armature.accept(intentId, proposal.id);
    const page = await (await exports.default.fetch(`https://armature.test/i/${intentId}`, { headers: seat })).text();
    expect(page).toContain(`<form class="inline" method="post" action="/i/${intentId}/verify"><button>Verify landing</button></form>`);
    const early = await exports.default.fetch(`https://armature.test/i/${intentId}/verify`, form({}));
    expect(early.status).toBe(409);
    expect(await early.text()).toContain("main does not contain the accepted commit yet");
    fake.copyCommit(fork.fork_repo, commit, slug, "main");
    const verified = await exports.default.fetch(`https://armature.test/i/${intentId}/verify`, form({}));
    expect(verified.status).toBe(302);
    const after = await (await exports.default.fetch(`https://armature.test/i/${intentId}`, { headers: seat })).text();
    expect(after).toContain(`landed ${commit.slice(0, 12)}`);
    expect(after).not.toContain("Verify landing");
  });
  it("turns any other error into an escaped 500 page and logs it", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const slug = `k${crypto.randomUUID().slice(0, 6)}`;
    await exports.default.fetch("https://armature.test/projects", form({ slug }));
    const again = await exports.default.fetch("https://armature.test/projects", form({ slug }));
    expect(again.status).toBe(500);
    expect(await again.text()).toContain("<h1>Refused</h1><p>");
    const broken = { listProjects: async () => { throw new Error("<b>gone</b>"); } } as unknown as Armature;
    const res = await route(new Request("https://armature.test/", { headers: seat }), env, broken);
    expect(res.status).toBe(500);
    expect(await res.text()).toContain("<h1>Refused</h1><p>&lt;b&gt;gone&lt;/b&gt;</p>");
    expect(logged).toHaveBeenCalledTimes(2);
    logged.mockRestore();
  });
  it("refuses an illegal move with an escaped 409 page", async () => {
    const slug = `g${crypto.randomUUID().slice(0, 6)}`;
    await exports.default.fetch("https://armature.test/projects", form({ slug }));
    const made = await exports.default.fetch(`https://armature.test/p/${slug}/intents`, form({ title: "T", body: "B" }));
    const intentId = made.headers.get("location")!.split("/").pop()!;
    await exports.default.fetch(`https://armature.test/i/${intentId}/close`, form({}));
    const again = await exports.default.fetch(`https://armature.test/i/${intentId}/close`, form({}));
    expect(again.status).toBe(409);
    expect(await again.text()).toContain("closed -&gt; closed");
  });
});
