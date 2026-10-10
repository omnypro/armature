// src/model/memoir.ts
import type { Exchange, Fork, Intent, Project, Proposal } from "../types";
import { withheldIds } from "./exchange";

export interface ChapterInput { project: Project; intent: Intent; exchanges: Exchange[]; proposals: Proposal[]; forks: Fork[] }
export interface ChapterFiles { dir: string; files: Record<"intent.md" | "exchanges.md" | "proposals.md", string>; blueprint: string }

export const chapterDir = (seq: number, title: string): string => {
  const slug = title.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${String(seq).padStart(4, "0")}-${slug}`;
};

const describe = (e: Exchange): string => {
  const kind = e.kind === "poke" && e.tag ? `poke (${e.tag})` : e.kind;
  const to = e.direction === "to_pilot" ? "to the pilot" : e.limb ? `to ${e.limb}` : "to the crew";
  return `${kind}, from ${e.author}, ${to}`;
};

const renderIntent = (i: Intent): string =>
  [
    "---", `seq: ${i.seq}`, `title: ${i.title}`, `state: ${i.state}`, `created: ${i.created_at}`,
    `closed: ${i.closed_at ?? ""}`, `accepted: ${i.accepted_at ?? ""}`, `landed: ${i.landed_at ?? ""}`, `commit: ${i.commit_ref ?? ""}`,
    "---", "", `# ${i.title}`, "", i.body, "",
  ].join("\n");

const renderExchanges = (all: Exchange[]): string => {
  const withheld = withheldIds(all);
  const visible = all.filter((e) => !withheld.has(e.id));
  const replies = (id: string) => visible.filter((r) => r.kind === "reply" && r.reply_to === id);
  const thread = (id: string, depth: number): string[] =>
    replies(id).flatMap((r) => [...`${r.author} replied: ${r.body}`.split("\n").map((line) => `${"> ".repeat(depth)}${line}`), "", ...thread(r.id, depth + 1)]);
  const roots = visible.filter((e) => e.kind !== "reply");
  const parts: string[] = ["# Exchanges", ""];
  for (const root of roots) {
    parts.push(`## ${describe(root)}`, "", root.body, "");
    if (root.kind === "question" && !replies(root.id).some((r) => r.author === "pilot")) {
      const answered = all.some((r) => r.kind === "reply" && r.reply_to === root.id && r.author === "pilot");
      parts.push(answered ? "> answered; the reply withheld by the pilot" : "> unanswered", "");
    }
    if (root.kind === "poke") parts.push(root.taken === true ? "> taken by the pilot" : root.taken === false ? "> dismissed by the pilot" : "> not decided", "");
    parts.push(...thread(root.id, 1));
  }
  if (withheld.size > 0) parts.push(`${withheld.size} exchange${withheld.size === 1 ? "" : "s"} withheld by the pilot.`, "");
  return parts.join("\n");
};

const renderProposals = (proposals: Proposal[], forks: Fork[]): string => {
  const parts: string[] = ["# Proposals", ""];
  for (const p of proposals) {
    const fork = forks.find((f) => f.fork_repo === p.fork_repo);
    parts.push(`## ${p.limb}, ${p.commit.slice(0, 12)}, ${p.state}`, "");
    parts.push(`Fork: ${p.fork_repo} (base ${p.base_commit.slice(0, 12)}${fork?.last_push_at ? `, last push ${fork.last_push_at}` : ""})`);
    parts.push(`Paths: ${p.paths.join(", ")}`, "", "Evidence:", "", p.evidence, "");
  }
  if (proposals.length === 0) parts.push("No proposals were filed.", "");
  return parts.join("\n");
};

export const renderChapter = (input: ChapterInput): ChapterFiles => ({
  dir: chapterDir(input.intent.seq, input.intent.title),
  files: {
    "intent.md": renderIntent(input.intent),
    "exchanges.md": renderExchanges(input.exchanges),
    "proposals.md": renderProposals(input.proposals, input.forks),
  },
  blueprint: `# Blueprint\n\n${input.project.vision}\n`,
});
