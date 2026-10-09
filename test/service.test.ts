// test/service.test.ts
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { Db } from "../src/db/db";
import { Armature, ServiceError } from "../src/service";
import { FakeArtifacts } from "./fake-artifacts";

let fake: FakeArtifacts;
let svc: Armature;
let subscribed: string[];

beforeEach(() => {
  fake = new FakeArtifacts();
  subscribed = [];
  svc = new Armature(new Db(env.DB), fake, async (repo) => { subscribed.push(repo); return `sub-${repo}`; }, "armature");
});

const slug = () => `p${crypto.randomUUID().slice(0, 8)}`;

describe("projects and intents", () => {
  it("creates the repo, subscribes to its pushes, and reads the doctrine from main", async () => {
    const s = slug();
    const project = await svc.createProject(s);
    expect(fake.repos.has(s)).toBe(true);
    expect(subscribed).toEqual([s]);
    expect(project.subscription_id).toBe(`sub-${s}`);
    fake.commit(s, "main", { "ARMATURE.md": "# Rules\n" });
    const view = await svc.projectView(s);
    expect(view?.doctrine).toBe("# Rules\n");
  });
});

describe("exchanges", () => {
  it("sets direction from kind and records an event", async () => {
    const project = await svc.createProject(slug());
    const intent = await svc.createIntent(project.id, "T", "B");
    const q = await svc.fileExchange({ intentId: intent.id, kind: "question", body: "Why?", author: "challenger" });
    expect(q.direction).toBe("to_pilot");
    const r = await svc.fileExchange({ intentId: intent.id, kind: "reply", body: "Because.", author: "pilot", replyTo: q.id });
    expect(r.direction).toBe("to_crew");
    const events = await svc.changesSince(project.slug, 0);
    expect(events.map((e) => e.kind)).toEqual(["project.created", "intent.created", "exchange.filed", "exchange.filed"]);
  });
  it("dismissing a poke with a reason files the reason as a reply", async () => {
    const project = await svc.createProject(slug());
    const intent = await svc.createIntent(project.id, "T", "B");
    const poke = await svc.fileExchange({ intentId: intent.id, kind: "poke", tag: "heads_up", body: "Missed a test.", author: "watcher" });
    await svc.setTaken(poke.id, false, "Covered in the next chapter.");
    const view = await svc.intentView(intent.id);
    const reply = view!.exchanges.find((e) => e.reply_to === poke.id);
    expect(reply?.body).toBe("Covered in the next chapter.");
    expect(view!.exchanges.find((e) => e.id === poke.id)?.taken).toBe(false);
  });
});

describe("closing", () => {
  it("closes with questions unanswered and keeps them listed", async () => {
    const project = await svc.createProject(slug());
    const intent = await svc.createIntent(project.id, "T", "B");
    await svc.fileExchange({ intentId: intent.id, kind: "question", body: "Really?", author: "challenger" });
    const closed = await svc.closeChallenge(intent.id);
    expect(closed.state).toBe("closed");
    const view = await svc.intentView(intent.id);
    expect(view!.unanswered).toHaveLength(1);
  });
});

describe("forks and proposals", () => {
  it("forks per limb, mints a write token, and flags overlaps with a poke from armature", async () => {
    const project = await svc.createProject(slug());
    const intent = await svc.createIntent(project.id, "T", "B");
    await svc.closeChallenge(intent.id);
    const a = await svc.requestFork(intent.id, "builder-a");
    const b = await svc.requestFork(intent.id, "builder-b");
    expect(a.fork.fork_repo).toBe(`${project.slug}--0001--builder-a`);
    expect(a.token.startsWith("tok-")).toBe(true);
    expect(fake.tokens.at(-1)).toEqual({ repo: b.fork.fork_repo, scope: "write" });
    const ca = fake.commit(a.fork.fork_repo, "main", { "src/x.ts": "a" });
    const cb = fake.commit(b.fork.fork_repo, "main", { "src/x.ts": "b", "src/y.ts": "b" });
    const first = await svc.fileProposal({ intentId: intent.id, limb: "builder-a", commit: ca, paths: ["src/x.ts"], evidence: "ok" });
    expect(first.overlaps).toEqual([]);
    const second = await svc.fileProposal({ intentId: intent.id, limb: "builder-b", commit: cb, paths: ["src/x.ts", "src/y.ts"], evidence: "ok" });
    expect(second.overlaps).toEqual([{ a: second.proposal.id, b: first.proposal.id, paths: ["src/x.ts"] }]);
    const view = await svc.intentView(intent.id);
    const poke = view!.exchanges.find((e) => e.kind === "poke" && e.author === "armature");
    expect(poke?.body).toBe("builder-b and builder-a both touch src/x.ts; one of these proposals will need a rebase.");
    expect(poke?.tag).toBe("heads_up");
  });
  it("refuses a fork before the challenge is closed", async () => {
    const project = await svc.createProject(slug());
    const intent = await svc.createIntent(project.id, "T", "B");
    await expect(svc.requestFork(intent.id, "builder-a")).rejects.toThrow(ServiceError);
  });
});

describe("accept and land", () => {
  async function ready() {
    const project = await svc.createProject(slug());
    const intent = await svc.createIntent(project.id, "Ship", "It.");
    await svc.closeChallenge(intent.id);
    const { fork } = await svc.requestFork(intent.id, "builder-a");
    const commit = fake.commit(fork.fork_repo, "main", { "src/x.ts": "a" });
    const { proposal } = await svc.fileProposal({ intentId: intent.id, limb: "builder-a", commit, paths: ["src/x.ts"], evidence: "ok" });
    return { project, intent, fork, commit, proposal };
  }
  it("blocks accept while a pilot challenge is unanswered, then allows it", async () => {
    const { intent, proposal } = await ready();
    const c = await svc.fileExchange({ intentId: intent.id, kind: "challenge", body: "Why x?", author: "pilot", proposalId: proposal.id });
    await expect(svc.accept(intent.id, proposal.id)).rejects.toThrow("answer");
    await svc.fileExchange({ intentId: intent.id, kind: "reply", body: "Because y.", author: "builder-a", replyTo: c.id, proposalId: proposal.id });
    const accepted = await svc.accept(intent.id, proposal.id);
    expect(accepted.state).toBe("accepted");
    expect(accepted.accepted_proposal_id).toBe(proposal.id);
  });
  it("marks landed when the push descends from the accepted commit, ignores duplicates, records strays", async () => {
    const { project, intent, fork, commit, proposal } = await ready();
    await svc.accept(intent.id, proposal.id);
    fake.copyCommit(fork.fork_repo, commit, project.slug, "main");
    const landing = fake.commit(project.slug, "main", { "memoir/0001-ship/intent.md": "..." });
    expect(await svc.markLanded(project.slug, landing, [{ id: landing, parents: [commit] }], false)).toBe("landed");
    expect(await svc.markLanded(project.slug, landing, [{ id: landing, parents: [commit] }], false)).toBe("ignored");
    const after = await svc.intentView(intent.id);
    expect(after!.intent.state).toBe("landed");
    expect(after!.intent.commit_ref).toBe(landing);
    const stray = fake.commit(project.slug, "main", { "z": "1" });
    const other = await svc.createIntent(project.id, "Next", "Thing.");
    await svc.closeChallenge(other.id);
    expect(await svc.markLanded(project.slug, stray, [{ id: stray, parents: ["f".repeat(40)] }], false)).toBe("stray");
  });
  it("exports a chapter with the blueprint", async () => {
    const { project, intent } = await ready();
    await svc.setVision(project.id, "One pilot.");
    const files = await svc.exportChapter(intent.id);
    expect(files.dir).toBe("0001-ship");
    expect(files.blueprint).toBe("# Blueprint\n\nOne pilot.\n");
  });
});
