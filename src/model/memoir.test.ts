// src/model/memoir.test.ts
import { describe, expect, it } from "bun:test";
import type { Exchange, Fork, Intent, Project, Proposal } from "../types";
import { chapterDir, renderChapter } from "./memoir";

const project: Project = { id: "P", slug: "armature", vision: "Build the suit.\n\nFor one pilot.", namespace: "armature", repo: "armature", remote: "https://x/armature.git", subscription_id: null, created_at: "2026-10-09T00:00:00Z" };
const intent: Intent = { id: "I", project_id: "P", seq: 1, title: "Scaffold the Worker", body: "A health route and nothing else.", state: "landed", accepted_proposal_id: "p1", commit_ref: "c".repeat(40), created_at: "2026-10-09T01:00:00Z", closed_at: "2026-10-09T02:00:00Z", accepted_at: "2026-10-09T03:00:00Z", landed_at: "2026-10-09T04:00:00Z" };
const ex = (over: Partial<Exchange>): Exchange => ({ id: "e", intent_id: "I", proposal_id: null, limb: null, direction: "to_pilot", kind: "question", tag: null, author: "challenger", body: "?", reply_to: null, taken: null, private: false, created_at: "2026-10-09T01:30:00Z", ...over });
const proposals: Proposal[] = [{ id: "p1", intent_id: "I", limb: "builder-a", fork_repo: "armature--0001--builder-a", fork_remote: "https://x/f.git", base_commit: "a".repeat(40), commit: "b".repeat(40), paths: ["src/index.ts"], evidence: "bun run test passed, 1 test.", state: "accepted", created_at: "2026-10-09T02:30:00Z", decided_at: "2026-10-09T03:00:00Z" }];
const forks: Fork[] = [{ id: "f", intent_id: "I", limb: "builder-a", fork_repo: "armature--0001--builder-a", fork_remote: "https://x/f.git", base_commit: "a".repeat(40), subscription_id: null, created_at: "2026-10-09T02:00:00Z", last_push_at: "2026-10-09T02:30:00Z" }];

describe("chapterDir", () => {
  it("pads the sequence and slugs the title", () => {
    expect(chapterDir(1, "Scaffold the Worker")).toBe("0001-scaffold-the-worker");
    expect(chapterDir(12, "  Fix: the  cockpit's table! ")).toBe("0012-fix-the-cockpits-table");
  });
});

describe("renderChapter", () => {
  it("writes the intent verbatim with frontmatter", () => {
    const out = renderChapter({ project, intent, exchanges: [], proposals, forks });
    expect(out.dir).toBe("0001-scaffold-the-worker");
    expect(out.files["intent.md"]).toBe(
      ["---", "seq: 1", "title: Scaffold the Worker", "state: landed", "created: 2026-10-09T01:00:00Z", "closed: 2026-10-09T02:00:00Z", "accepted: 2026-10-09T03:00:00Z", "landed: 2026-10-09T04:00:00Z", `commit: ${"c".repeat(40)}`, "---", "", "# Scaffold the Worker", "", "A health route and nothing else.", ""].join("\n"),
    );
  });
  it("marks unanswered questions and withholds private exchanges with a count", () => {
    const q1 = ex({ id: "q1", body: "Why a health route first?" });
    const a1 = ex({ id: "a1", kind: "reply", author: "pilot", direction: "to_crew", reply_to: "q1", body: "So the deploy can be checked." });
    const q2 = ex({ id: "q2", body: "What about auth?" });
    const secret = ex({ id: "s", kind: "reply", author: "pilot", direction: "to_crew", reply_to: "q2", body: "not for the record", private: true });
    const poke = ex({ id: "k", kind: "poke", tag: "heads_up", author: "watcher", body: "The route has no test.", taken: true });
    const q3 = ex({ id: "q3", body: "Which region?" });
    const out = renderChapter({ project, intent, exchanges: [q1, a1, q2, secret, poke, q3], proposals, forks });
    const md = out.files["exchanges.md"];
    expect(md).toContain("## question, from challenger, to the pilot\n\nWhy a health route first?\n\n> pilot replied: So the deploy can be checked.");
    expect(md).toContain("## question, from challenger, to the pilot\n\nWhat about auth?\n\n> answered; the reply withheld by the pilot\n");
    expect(md).toContain("## question, from challenger, to the pilot\n\nWhich region?\n\n> unanswered\n");
    expect(md).toContain("## poke (heads_up), from watcher, to the pilot\n\nThe route has no test.\n\n> taken by the pilot");
    expect(md).not.toContain("not for the record");
    expect(md).toContain("1 exchange withheld by the pilot.");
  });
  it("quotes a reply thread at any depth, every line of every reply", () => {
    const c = ex({ id: "c", kind: "challenge", author: "pilot", direction: "to_crew", limb: "builder-a", body: "Why x?" });
    const r1 = ex({ id: "r1", kind: "reply", author: "builder-a", direction: "to_pilot", reply_to: "c", body: "Because y." });
    const r2 = ex({ id: "r2", kind: "reply", author: "pilot", direction: "to_crew", reply_to: "r1", body: "Fine.\n\nBut add a test." });
    const r3 = ex({ id: "r3", kind: "reply", author: "builder-a", direction: "to_pilot", reply_to: "r2", body: "Added." });
    const out = renderChapter({ project, intent, exchanges: [c, r1, r2, r3], proposals, forks });
    expect(out.files["exchanges.md"]).toBe(
      ["# Exchanges", "", "## challenge, from pilot, to builder-a", "", "Why x?", "", "> builder-a replied: Because y.", "", "> > pilot replied: Fine.", "> > ", "> > But add a test.", "", "> > > builder-a replied: Added.", ""].join("\n"),
    );
  });
  it("lists proposals with their fate and evidence", () => {
    const out = renderChapter({ project, intent, exchanges: [], proposals, forks });
    expect(out.files["proposals.md"]).toContain(`## builder-a, ${"b".repeat(40).slice(0, 12)}, accepted`);
    expect(out.files["proposals.md"]).toContain("Paths: src/index.ts");
    expect(out.files["proposals.md"]).toContain("bun run test passed, 1 test.");
  });
  it("renders the blueprint as the vision verbatim under a heading", () => {
    const out = renderChapter({ project, intent, exchanges: [], proposals, forks });
    expect(out.blueprint).toBe("# Blueprint\n\nBuild the suit.\n\nFor one pilot.\n");
  });
});
