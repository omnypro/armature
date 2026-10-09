import { env } from "cloudflare:workers";
import { createExecutionContext, createMessageBatch, getQueueResult } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker, { buildApp } from "../src/index";
import { Db } from "../src/db/db";

const pushed = (repo: string, after: string, parents: string[]) => ({
  type: "cf.artifacts.repo.pushed",
  source: { type: "artifacts.repo", namespace: "armature", repoName: repo },
  payload: { ref: "refs/heads/main", before: "0".repeat(40), after, commits: [{ id: after, message: "x", messageTruncated: false, timestamp: "2026-10-09T00:00:00Z", author: { name: "a", email: "a@x" }, committer: { name: "a", email: "a@x" }, parents }], totalCommitsCount: 1, commitsTruncated: false },
  metadata: { accountId: "acct", eventSubscriptionId: "s", eventSchemaVersion: 1, eventTimestamp: "2026-10-09T00:00:00Z" },
});

describe("queue consumer", () => {
  it("marks an accepted intent landed on a push to the project repo, and touches a fork on a push to it", async () => {
    const { armature } = buildApp(env);
    const fake = (globalThis as { __fakeArtifacts?: import("./fake-artifacts").FakeArtifacts }).__fakeArtifacts!;
    const slug = `q${crypto.randomUUID().slice(0, 6)}`;
    const { project } = await armature.createProject(slug);
    const intent = await armature.createIntent(project.id, "Land", "It.");
    await armature.closeChallenge(intent.id);
    const { fork } = await armature.requestFork(intent.id, "builder-a");
    const commit = fake.commit(fork.fork_repo, "main", { "a": "1" });
    const { proposal } = await armature.fileProposal({ intentId: intent.id, limb: "builder-a", commit, paths: ["a"], evidence: "ok" });
    await armature.accept(intent.id, proposal.id);
    const landing = "9".repeat(40);
    const batch = createMessageBatch("armature-events", [
      { id: "m1", timestamp: new Date(), body: pushed(fork.fork_repo, commit, ["1".repeat(40)]), attempts: 1 },
      { id: "m2", timestamp: new Date(), body: pushed(slug, landing, [commit]), attempts: 1 },
      { id: "m3", timestamp: new Date(), body: pushed(slug, landing, [commit]), attempts: 1 },
    ]);
    const ctx = createExecutionContext();
    await worker.queue(batch, env, ctx);
    const outcome = await getQueueResult(batch, ctx);
    expect(outcome.ackAll || outcome.explicitAcks.length === 3).toBe(true);
    const after = await new Db(env.DB).getIntent(intent.id);
    expect(after?.state).toBe("landed");
    expect(after?.commit_ref).toBe(landing);
    expect((await new Db(env.DB).getForkByRepo(fork.fork_repo))?.last_push_at).not.toBeNull();
  });
});
