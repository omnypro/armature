// test/mcp.test.ts
import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/index";

let nextId = 1;
const call = async (name: string, args: Record<string, unknown>, token = "test-pilot-token") => {
  const res = await exports.default.fetch("https://armature.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method: "tools/call", params: { name, arguments: args } }),
  });
  return res;
};
const result = async (res: Response) => {
  const body = await res.text();
  const line = body.split("\n").find((l) => l.startsWith("data:")) ?? body;
  const parsed = JSON.parse(line.replace(/^data:\s*/, ""));
  return JSON.parse(parsed.result.content[0].text);
};

describe("/mcp", () => {
  it("refuses without the seat", async () => {
    expect((await call("intent.list", { slug: "x" }, "nope")).status).toBe(401);
  });
  it("runs the crew's loop: read the project, fork, propose, see the overlap, read the change feed", async () => {
    const { armature } = buildApp(env);
    const slug = `m${crypto.randomUUID().slice(0, 6)}`;
    const project = await armature.createProject(slug);
    await armature.setVision(project.id, "Vision.");
    const intent = await armature.createIntent(project.id, "Do", "It.");
    const q = await result(await call("exchange.file", { intent_id: intent.id, kind: "question", body: "Which it?", author: "challenger" }));
    expect(q.direction).toBe("to_pilot");
    await armature.closeChallenge(intent.id);
    const got = await result(await call("project.get", { slug }));
    expect(got.project.vision).toBe("Vision.");
    expect(got.intents[0].intent.state).toBe("closed");
    const fork = await result(await call("fork.request", { intent_id: intent.id, limb: "builder-a" }));
    expect(fork.remote).toContain(`${slug}--0001--builder-a`);
    expect(typeof fork.token).toBe("string");
    expect(fork.base_commit).toMatch(/^[0-9a-f]{40}$/);
    const fake = (globalThis as { __fakeArtifacts?: import("./fake-artifacts").FakeArtifacts }).__fakeArtifacts!;
    const commit = fake.commit(`${slug}--0001--builder-a`, "main", { "a.ts": "1" });
    const filed = await result(await call("proposal.file", { intent_id: intent.id, limb: "builder-a", commit, paths: ["a.ts"], evidence: "tests pass" }));
    expect(filed.proposal.state).toBe("open");
    const full = await result(await call("intent.get", { intent_id: intent.id }));
    expect(full.proposals[0].proposal.commit).toBe(commit);
    const feed = await result(await call("changes.since", { slug, cursor: 0 }));
    expect(feed.events.map((e: { kind: string }) => e.kind)).toContain("proposal.filed");
    expect(feed.cursor).toBeGreaterThan(0);
    const exported = await result(await call("memoir.export", { intent_id: intent.id }));
    expect(exported.dir).toBe("0001-do");
  });
});
