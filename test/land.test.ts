// test/land.test.ts  (run with: bun test test/land.test.ts)
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

const root = mkdtempSync(join(tmpdir(), "land-"));
const project = join(root, "project.git");
const fork = join(root, "fork.git");
let server: ReturnType<typeof Bun.serve>;
let commit = "";

beforeAll(async () => {
  await $`git init -q --bare -b main ${project}`;
  const w = join(root, "w");
  await $`git init -q -b main ${w}`;
  writeFileSync(join(w, "a.txt"), "base\n");
  await $`git -C ${w} -c user.name=t -c user.email=t@t add a.txt`;
  await $`git -C ${w} -c user.name=t -c user.email=t@t commit -q -m base.`;
  await $`git -C ${w} push -q ${project} main`;
  await $`git clone -q --bare ${project} ${fork}`;
  const f = join(root, "fw");
  await $`git clone -q ${fork} ${f}`;
  writeFileSync(join(f, "a.txt"), "changed\n");
  await $`git -C ${f} -c user.name=t -c user.email=t@t commit -qam change.`;
  await $`git -C ${f} push -q origin main`;
  commit = (await $`git -C ${f} rev-parse HEAD`.text()).trim();
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      if (req.headers.get("authorization") !== "Bearer t") return new Response(null, { status: 401 });
      if (url.pathname === "/api/intent/i1") return Response.json({ intent: { state: "accepted", accepted_proposal_id: "p1", title: "Change a.", seq: 1 }, project: { remote: `file://${project}` }, proposals: [{ proposal: { id: "p1", commit, fork_remote: `file://${fork}` } }] });
      if (url.pathname === "/api/intent/i2") return Response.json({ intent: { state: "open", accepted_proposal_id: null, title: "Open one", seq: 2 }, project: { remote: `file://${project}` }, proposals: [] });
      if (url.pathname === "/api/intent/i1/export") return Response.json({ dir: "0001-change-a", blueprint: "# Blueprint\n\nV.\n", files: { "intent.md": "I\n", "exchanges.md": "E\n", "proposals.md": "P\n" } });
      return new Response("nf", { status: 404 });
    },
  });
});
afterAll(() => server.stop());

const landEnv = () => ({
  ...process.env, ARMATURE_MIRROR: "", ARMATURE_URL: `http://localhost:${server.port}`, ARMATURE_TOKEN: "t", ARMATURE_FORK_TOKEN: "x", ARMATURE_PROJECT_TOKEN: "x",
  GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t",
});

describe("bin/land", () => {
  it("fetches the accepted commit, commits the chapter on top, and pushes main", async () => {
    const out = await $`sh bin/land demo i1`.env(landEnv()).text();
    expect(out).toMatch(/^landed [0-9a-f]{40} for intent 0001/);
    const log = await $`git --git-dir ${project} log --format=%s main`.text();
    expect(log.split("\n")[0]).toBe("Land intent 0001: Change a.");
    expect(log).toContain("change.");
    expect((await $`git --git-dir ${project} log -1 --format=%an main`.text()).trim()).toBe("t");
    expect(readFileSync("bin/land", "utf8")).not.toContain("user.name");
    const files = await $`git --git-dir ${project} ls-tree -r --name-only main`.text();
    expect(files).toContain("memoir/0001-change-a/exchanges.md");
    expect(files).toContain("BLUEPRINT.md");
    const blueprint = await $`git --git-dir ${project} show main:BLUEPRINT.md`.text();
    expect(blueprint.endsWith("\n") && !blueprint.endsWith("\n\n")).toBe(true);
    expect(blueprint).toBe("# Blueprint\n\nV.\n");
    expect(await $`git --git-dir ${project} show main:memoir/0001-change-a/exchanges.md`.text()).toBe("E\n");
  });
  it("refuses when the intent is not accepted", async () => {
    const env = landEnv();
    const r = await $`sh bin/land demo i2`.env(env).nothrow().quiet();
    expect(r.exitCode).toBe(2);
    expect(r.stderr.toString()).toContain("intent is open, not accepted");
    const missing = await $`sh bin/land demo nope`.env(env).nothrow().quiet();
    expect(missing.exitCode).not.toBe(0);
  });
});
