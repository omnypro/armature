// test/db.test.ts
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { Db } from "../src/db/db";

describe("Db", () => {
  it("creates a project and numbers intents from 1", async () => {
    const db = new Db(env.DB);
    const project = await db.createProject({ slug: "demo", namespace: "armature", repo: "demo", remote: "https://x/demo.git" });
    expect(project.slug).toBe("demo");
    const a = await db.createIntent(project.id, "First", "Do the first thing.");
    const b = await db.createIntent(project.id, "Second", "Do the second thing.");
    expect(a.seq).toBe(1);
    expect(b.seq).toBe(2);
    expect(a.state).toBe("open");
    const listed = await db.listIntents(project.id);
    expect(listed.map((i) => i.seq)).toEqual([1, 2]);
  });

  it("round-trips proposal paths as an array", async () => {
    const db = new Db(env.DB);
    const project = await db.createProject({ slug: "paths", namespace: "armature", repo: "paths", remote: "https://x/paths.git" });
    const intent = await db.createIntent(project.id, "T", "B");
    const proposal = await db.createProposal({
      intent_id: intent.id, limb: "builder-a", fork_repo: "paths--0001--builder-a", fork_remote: "https://x/f.git",
      base_commit: "a".repeat(40), commit: "b".repeat(40), paths: ["src/a.ts", "src/b.ts"], evidence: "ran tests",
    });
    const read = await db.getProposal(proposal.id);
    expect(read?.paths).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("stores private as a boolean and defaults it to false", async () => {
    const db = new Db(env.DB);
    const project = await db.createProject({ slug: "priv", namespace: "armature", repo: "priv", remote: "https://x/priv.git" });
    const intent = await db.createIntent(project.id, "T", "B");
    const e = await db.createExchange({ intent_id: intent.id, proposal_id: null, limb: null, direction: "to_pilot", kind: "question", tag: null, author: "challenger", body: "Why?", reply_to: null, taken: null, private: false });
    expect((await db.getExchange(e.id))?.private).toBe(false);
    await db.setPrivate(e.id, true);
    expect((await db.getExchange(e.id))?.private).toBe(true);
  });

  it("records events with increasing ids and reads them after a cursor", async () => {
    const db = new Db(env.DB);
    const project = await db.createProject({ slug: "ev", namespace: "armature", repo: "ev", remote: "https://x/ev.git" });
    await db.recordEvent(project.id, "intent.created", "i1");
    await db.recordEvent(project.id, "exchange.filed", "e1");
    const all = await db.eventsSince(project.id, 0);
    expect(all.map((e) => e.kind)).toEqual(["intent.created", "exchange.filed"]);
    const later = await db.eventsSince(project.id, all[0].id);
    expect(later.map((e) => e.kind)).toEqual(["exchange.filed"]);
  });

  it("marks a push seen once and reports it as a repeat afterwards", async () => {
    const db = new Db(env.DB);
    expect(await db.markPushSeen("r", "a".repeat(40))).toBe(true);
    expect(await db.markPushSeen("r", "a".repeat(40))).toBe(false);
  });
});
