// src/mcp/server.ts
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Armature } from "../service";

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });
const failure = (error: unknown) => ({ isError: true, content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }] });
const guard = <A>(fn: (args: A) => Promise<unknown>) => async (args: A) => { try { return text(await fn(args)); } catch (e) { return failure(e); } };

export const createServer = (armature: Armature): McpServer => {
  const server = new McpServer({ name: "armature", version: "0.1.0" });

  server.registerTool("project.get", {
    description: "The blueprint (vision, intents in flight), the doctrine (ARMATURE.md on main), and the memoir chapter index. Read this before anything else.",
    inputSchema: { slug: z.string() },
  }, guard(async ({ slug }) => { const v = await armature.projectView(slug); if (!v) throw new Error("no such project"); return v; }));

  server.registerTool("intent.list", {
    description: "Intents of a project in order, optionally filtered by state.",
    inputSchema: { slug: z.string(), state: z.enum(["open", "closed", "accepted", "landed", "shelved"]).optional() },
  }, guard(async ({ slug, state }) => { const v = await armature.projectView(slug); if (!v) throw new Error("no such project"); return v.intents.filter((r) => !state || r.intent.state === state); }));

  server.registerTool("intent.get", {
    description: "The full record of one intent: body, exchanges, forks, proposals with diffs and overlaps.",
    inputSchema: { intent_id: z.string() },
  }, guard(async ({ intent_id }) => { const v = await armature.intentView(intent_id); if (!v) throw new Error("no such intent"); return v; }));

  server.registerTool("exchange.file", {
    description: "File a question or a poke to the pilot, or a reply to the pilot's challenge or steer. Pokes need a tag. One sentence, with the evidence.",
    inputSchema: {
      intent_id: z.string(), kind: z.enum(["question", "poke", "reply"]), body: z.string().min(1), author: z.string().min(1),
      tag: z.enum(["heads_up", "you_should_know"]).optional(), proposal_id: z.string().optional(), reply_to: z.string().optional(), limb: z.string().optional(),
    },
  }, guard(async (a) => {
    if (a.author === "pilot") throw new Error('the crew cannot speak as "pilot"');
    return armature.fileExchange({ intentId: a.intent_id, kind: a.kind, body: a.body, author: a.author, tag: a.tag, proposalId: a.proposal_id, replyTo: a.reply_to, limb: a.limb });
  }));

  server.registerTool("fork.request", {
    description: "Fork the project repo for this limb on this intent and mint a write token. The intent's challenge must be closed.",
    inputSchema: { intent_id: z.string(), limb: z.string().min(1) },
  }, guard(async ({ intent_id, limb }) => { const { fork, token } = await armature.requestFork(intent_id, limb); return { remote: fork.fork_remote, repo: fork.fork_repo, token, base_commit: fork.base_commit }; }));

  server.registerTool("proposal.file", {
    description: "File a proposal: the commit on your fork, the touched paths (git diff --name-only base..commit), and the evidence.",
    inputSchema: { intent_id: z.string(), limb: z.string().min(1), commit: z.string().length(40), paths: z.array(z.string()), evidence: z.string().min(1) },
  }, guard(async (a) => armature.fileProposal({ intentId: a.intent_id, limb: a.limb, commit: a.commit, paths: a.paths, evidence: a.evidence })));

  server.registerTool("memoir.export", {
    description: "The chapter files for an intent and the current BLUEPRINT.md, as bin/land writes them.",
    inputSchema: { intent_id: z.string() },
  }, guard(async ({ intent_id }) => armature.exportChapter(intent_id)));

  server.registerTool("changes.since", {
    description: "Events after a cursor: intents created or closed or landed, exchanges filed, forks, proposals, overlaps. Returns the new cursor.",
    inputSchema: { slug: z.string(), cursor: z.number().int().nonnegative() },
  }, guard(async ({ slug, cursor }) => { const events = await armature.changesSince(slug, cursor); return { events, cursor: events.length ? events[events.length - 1].id : cursor }; }));

  return server;
};
