// src/service.ts
import type { ArtifactsPort } from "./artifacts";
import type { Db } from "./db/db";
import { renderUnified } from "./model/diff";
import { blockingChallenges, directionFor, openPokes, unansweredQuestions } from "./model/exchange";
import { assertTransition, canDecideProposal } from "./model/intent";
import { type ChapterFiles, chapterDir, renderChapter } from "./model/memoir";
import { type Overlap, findOverlaps, overlapPokeBody } from "./model/overlap";
import type { ArmatureEvent, Exchange, ExchangeKind, Fork, Intent, Project, Proposal, Tag } from "./types";
import { now } from "./types";

export class ServiceError extends Error {
  constructor(message: string, readonly status = 409) { super(message); this.name = "ServiceError"; }
}

export interface FileExchange { intentId: string; kind: ExchangeKind; body: string; author: string; tag?: Tag; proposalId?: string; replyTo?: string; limb?: string; private?: boolean }
export interface IntentRow { intent: Intent; unanswered: number; openPokes: number; limbs: string[]; openProposals: number; overlaps: number }
export interface ProjectView { project: Project; doctrine: string | null; intents: IntentRow[]; chapters: string[] }
export interface ProposalView { proposal: Proposal; blocking: Exchange[]; overlaps: Overlap[]; diffs: { path: string; diff: string }[] }
export interface IntentView { project: Project; intent: Intent; exchanges: Exchange[]; forks: Fork[]; proposals: ProposalView[]; unanswered: Exchange[]; openPokes: Exchange[] }

const DOCTRINE_PATH = "ARMATURE.md";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

export class Armature {
  constructor(
    private readonly db: Db,
    private readonly artifacts: ArtifactsPort,
    private readonly subscribe: (repo: string) => Promise<string | null>,
    private readonly namespace: string,
  ) {}

  private async intentOr404(id: string): Promise<Intent> {
    const intent = await this.db.getIntent(id);
    if (!intent) throw new ServiceError("no such intent", 404);
    return intent;
  }

  listProjects(): Promise<Project[]> { return this.db.listProjects(); }

  async createProject(slug: string): Promise<Project> {
    if (!/^[a-z0-9][a-z0-9._-]{1,62}$/.test(slug)) throw new ServiceError("slug must be lowercase letters, digits, dots, dashes", 400);
    const repo = await this.artifacts.create(slug);
    const project = await this.db.createProject({ slug, namespace: this.namespace, repo: repo.name, remote: repo.remote });
    const subscriptionId = await this.subscribe(repo.name);
    if (subscriptionId) await this.db.setProjectSubscription(project.id, subscriptionId);
    await this.db.recordEvent(project.id, "project.created", project.id);
    return { ...project, subscription_id: subscriptionId };
  }

  async setVision(projectId: string, vision: string): Promise<void> {
    await this.db.setVision(projectId, vision);
    await this.db.recordEvent(projectId, "vision.edited", projectId);
  }

  async createIntent(projectId: string, title: string, body: string): Promise<Intent> {
    if (!title.trim()) throw new ServiceError("an intent needs a title", 400);
    const intent = await this.db.createIntent(projectId, title.trim(), body);
    await this.db.recordEvent(projectId, "intent.created", intent.id);
    return intent;
  }

  async fileExchange(input: FileExchange): Promise<Exchange> {
    const intent = await this.intentOr404(input.intentId);
    if (!input.body.trim()) throw new ServiceError("an exchange needs a body", 400);
    const replyTo = input.replyTo ? await this.db.getExchange(input.replyTo) : null;
    if (input.kind === "reply" && !replyTo) throw new ServiceError("reply_to does not exist", 400);
    if (input.kind === "poke" && !input.tag) throw new ServiceError("a poke needs a tag", 400);
    const exchange = await this.db.createExchange({
      intent_id: intent.id, proposal_id: input.proposalId ?? replyTo?.proposal_id ?? null, limb: input.limb ?? null,
      direction: directionFor(input.kind, replyTo ?? undefined), kind: input.kind, tag: input.kind === "poke" ? input.tag! : null,
      author: input.author, body: input.body, reply_to: replyTo?.id ?? null, taken: null, private: input.private ?? false,
    });
    await this.db.recordEvent(intent.project_id, "exchange.filed", exchange.id, `${exchange.kind}:${exchange.author}`);
    return exchange;
  }

  async setTaken(exchangeId: string, taken: boolean, reason?: string): Promise<void> {
    const poke = await this.db.getExchange(exchangeId);
    if (!poke || poke.kind !== "poke") throw new ServiceError("not a poke", 400);
    await this.db.setTaken(poke.id, taken);
    if (reason?.trim()) await this.fileExchange({ intentId: poke.intent_id, kind: "reply", body: reason, author: "pilot", replyTo: poke.id });
    const intent = await this.intentOr404(poke.intent_id);
    await this.db.recordEvent(intent.project_id, taken ? "poke.taken" : "poke.dismissed", poke.id);
  }

  async setPrivate(exchangeId: string, isPrivate: boolean): Promise<void> {
    const exchange = await this.db.getExchange(exchangeId);
    if (!exchange) throw new ServiceError("no such exchange", 404);
    const intent = await this.intentOr404(exchange.intent_id);
    if (intent.state === "landed") throw new ServiceError("the chapter has landed; the memoir is append-only");
    await this.db.setPrivate(exchange.id, isPrivate);
  }

  async closeChallenge(intentId: string): Promise<Intent> {
    const intent = await this.intentOr404(intentId);
    assertTransition(intent.state, "closed");
    await this.db.updateIntent(intent.id, { state: "closed", closed_at: now() });
    await this.db.recordEvent(intent.project_id, "intent.closed", intent.id);
    return (await this.db.getIntent(intent.id))!;
  }

  async shelve(intentId: string): Promise<Intent> {
    const intent = await this.intentOr404(intentId);
    assertTransition(intent.state, "shelved");
    await this.db.updateIntent(intent.id, { state: "shelved" });
    await this.db.recordEvent(intent.project_id, "intent.shelved", intent.id);
    return (await this.db.getIntent(intent.id))!;
  }

  async requestFork(intentId: string, limb: string): Promise<{ fork: Fork; token: string }> {
    const intent = await this.intentOr404(intentId);
    if (intent.state !== "closed") throw new ServiceError(`the challenge is ${intent.state}; a fork needs it closed`);
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(limb)) throw new ServiceError("limb names are lowercase letters, digits, dashes", 400);
    const project = (await this.db.getProject(intent.project_id))!;
    const target = `${project.repo}--${String(intent.seq).padStart(4, "0")}--${limb}`;
    const existing = await this.db.getForkByRepo(target);
    if (existing) {
      const token = await this.artifacts.createToken(target, "write", TOKEN_TTL_SECONDS);
      return { fork: existing, token: token.plaintext };
    }
    const base = await this.artifacts.headCommit(project.repo, "main");
    if (!base) throw new ServiceError("the project repo has no main yet; push it first");
    const forked = await this.artifacts.fork(project.repo, target);
    const subscriptionId = await this.subscribe(target);
    const fork = await this.db.createFork({ intent_id: intent.id, limb, fork_repo: forked.name, fork_remote: forked.remote, base_commit: base, subscription_id: subscriptionId });
    const token = await this.artifacts.createToken(target, "write", TOKEN_TTL_SECONDS);
    await this.db.recordEvent(project.id, "fork.created", fork.id, limb);
    return { fork, token: token.plaintext };
  }

  async fileProposal(input: { intentId: string; limb: string; commit: string; paths: string[]; evidence: string }): Promise<{ proposal: Proposal; overlaps: Overlap[] }> {
    const intent = await this.intentOr404(input.intentId);
    if (intent.state !== "closed") throw new ServiceError(`the intent is ${intent.state}; proposals need it closed`);
    const forks = await this.db.listForks(intent.id);
    const fork = forks.find((f) => f.limb === input.limb);
    if (!fork) throw new ServiceError("this limb has no fork on this intent", 400);
    if (!/^[0-9a-f]{40}$/.test(input.commit)) throw new ServiceError("commit must be a 40-char sha", 400);
    const previous = (await this.db.listProposals(intent.id)).filter((p) => p.limb === input.limb && p.state === "open");
    for (const p of previous) await this.db.setProposalState(p.id, "superseded");
    const proposal = await this.db.createProposal({
      intent_id: intent.id, limb: input.limb, fork_repo: fork.fork_repo, fork_remote: fork.fork_remote,
      base_commit: fork.base_commit, commit: input.commit, paths: input.paths, evidence: input.evidence,
    });
    const others = (await this.db.listOpenProposalsForProject(intent.project_id)).filter((p) => p.id !== proposal.id);
    const overlaps = findOverlaps(proposal, others);
    for (const overlap of overlaps) {
      const other = others.find((p) => p.id === overlap.b)!;
      await this.fileExchange({ intentId: intent.id, kind: "poke", tag: "heads_up", author: "armature", proposalId: proposal.id, body: overlapPokeBody(overlap, proposal.limb, other.limb) });
      if (other.intent_id !== intent.id) {
        await this.fileExchange({ intentId: other.intent_id, kind: "poke", tag: "heads_up", author: "armature", proposalId: other.id, body: overlapPokeBody(overlap, proposal.limb, other.limb) });
      }
    }
    await this.db.recordEvent(intent.project_id, "proposal.filed", proposal.id, input.limb);
    return { proposal, overlaps };
  }

  async accept(intentId: string, proposalId: string): Promise<Intent> {
    const intent = await this.intentOr404(intentId);
    assertTransition(intent.state, "accepted");
    const proposal = await this.db.getProposal(proposalId);
    if (!proposal || proposal.intent_id !== intent.id) throw new ServiceError("no such proposal on this intent", 404);
    if (!canDecideProposal(proposal.state)) throw new ServiceError(`proposal is ${proposal.state}`);
    const exchanges = await this.db.listExchanges(intent.id);
    const blocking = blockingChallenges(exchanges, proposal.id);
    if (blocking.length > 0) throw new ServiceError(`${blocking.length} challenge${blocking.length === 1 ? "" : "s"} still need an answer from ${proposal.limb}`);
    await this.db.setProposalState(proposal.id, "accepted");
    for (const p of await this.db.listProposals(intent.id)) if (p.id !== proposal.id && p.state === "open") await this.db.setProposalState(p.id, "superseded");
    await this.db.updateIntent(intent.id, { state: "accepted", accepted_proposal_id: proposal.id, accepted_at: now() });
    await this.db.recordEvent(intent.project_id, "proposal.accepted", proposal.id);
    return (await this.db.getIntent(intent.id))!;
  }

  async reject(proposalId: string): Promise<void> {
    const proposal = await this.db.getProposal(proposalId);
    if (!proposal) throw new ServiceError("no such proposal", 404);
    if (!canDecideProposal(proposal.state)) throw new ServiceError(`proposal is ${proposal.state}`);
    await this.db.setProposalState(proposal.id, "rejected");
    const intent = await this.intentOr404(proposal.intent_id);
    await this.db.recordEvent(intent.project_id, "proposal.rejected", proposal.id);
  }

  async markLanded(repo: string, after: string, pushed: { id: string; parents: string[] }[], truncated: boolean): Promise<"landed" | "stray" | "ignored"> {
    if (await this.db.pushSeen(repo, after)) return "ignored";
    const project = await this.db.getProjectByRepo(repo);
    if (!project) return "ignored";
    let landed = 0;
    for (const intent of await this.db.listIntents(project.id, "accepted")) {
      const proposal = intent.accepted_proposal_id ? await this.db.getProposal(intent.accepted_proposal_id) : null;
      if (!proposal) continue;
      const inPayload = pushed.some((c) => c.id === proposal.commit || c.parents.includes(proposal.commit));
      const descends = inPayload || (truncated && (await this.artifacts.isAncestor(repo, proposal.commit, after)));
      if (!descends) continue;
      assertTransition(intent.state, "landed");
      await this.db.updateIntent(intent.id, { state: "landed", commit_ref: after, landed_at: now() });
      await this.db.recordEvent(project.id, "intent.landed", intent.id, after);
      landed++;
    }
    if (landed === 0) await this.db.recordEvent(project.id, "push.stray", after, repo);
    await this.db.markPushSeen(repo, after);
    return landed > 0 ? "landed" : "stray";
  }

  async exportChapter(intentId: string): Promise<ChapterFiles> {
    const intent = await this.intentOr404(intentId);
    const project = (await this.db.getProject(intent.project_id))!;
    return renderChapter({ project, intent, exchanges: await this.db.listExchanges(intent.id), proposals: await this.db.listProposals(intent.id), forks: await this.db.listForks(intent.id) });
  }

  async projectView(slug: string): Promise<ProjectView | null> {
    const project = await this.db.getProjectBySlug(slug);
    if (!project) return null;
    const doctrine = await this.artifacts.readFile(project.repo, "main", DOCTRINE_PATH);
    const openProposals = await this.db.listOpenProposalsForProject(project.id);
    const intents: IntentRow[] = [];
    for (const intent of await this.db.listIntents(project.id)) {
      const exchanges = await this.db.listExchanges(intent.id);
      const forks = await this.db.listForks(intent.id);
      const mine = openProposals.filter((p) => p.intent_id === intent.id);
      const overlaps = mine.reduce((n, p) => n + findOverlaps(p, openProposals).length, 0);
      intents.push({ intent, unanswered: unansweredQuestions(exchanges).length, openPokes: openPokes(exchanges).length, limbs: forks.map((f) => f.limb), openProposals: mine.length, overlaps });
    }
    const chapters = intents.filter((r) => r.intent.state === "landed").map((r) => chapterDir(r.intent.seq, r.intent.title));
    return { project, doctrine, intents, chapters };
  }

  async intentView(intentId: string): Promise<IntentView | null> {
    const intent = await this.db.getIntent(intentId);
    if (!intent) return null;
    const project = (await this.db.getProject(intent.project_id))!;
    const exchanges = await this.db.listExchanges(intent.id);
    const forks = await this.db.listForks(intent.id);
    const openAll = await this.db.listOpenProposalsForProject(project.id);
    const proposals: ProposalView[] = [];
    for (const proposal of await this.db.listProposals(intent.id)) {
      const diffs: { path: string; diff: string }[] = [];
      for (const path of proposal.paths) {
        const before = await this.artifacts.readFile(proposal.fork_repo, proposal.base_commit, path);
        const after = await this.artifacts.readFile(proposal.fork_repo, proposal.commit, path);
        diffs.push({ path, diff: renderUnified(path, before, after) });
      }
      proposals.push({ proposal, blocking: blockingChallenges(exchanges, proposal.id), overlaps: proposal.state === "open" ? findOverlaps(proposal, openAll) : [], diffs });
    }
    return { project, intent, exchanges, forks, proposals, unanswered: unansweredQuestions(exchanges), openPokes: openPokes(exchanges) };
  }

  async changesSince(slug: string, cursor: number): Promise<ArmatureEvent[]> {
    const project = await this.db.getProjectBySlug(slug);
    if (!project) throw new ServiceError("no such project", 404);
    return this.db.eventsSince(project.id, cursor);
  }
}
