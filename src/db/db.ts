// src/db/db.ts
import type { ArmatureEvent, Direction, Exchange, ExchangeKind, Fork, Intent, IntentState, Project, Proposal, ProposalState, Tag } from "../types";
import { newId, now } from "../types";

type Row = Record<string, unknown>;

const toProposal = (r: Row): Proposal => ({
  id: r.id as string, intent_id: r.intent_id as string, limb: r.limb as string,
  fork_repo: r.fork_repo as string, fork_remote: r.fork_remote as string,
  base_commit: r.base_commit as string, commit: r.commit_hash as string,
  paths: JSON.parse(r.paths as string) as string[], evidence: r.evidence as string,
  state: r.state as ProposalState, created_at: r.created_at as string, decided_at: (r.decided_at as string) ?? null,
});

const toExchange = (r: Row): Exchange => ({
  id: r.id as string, intent_id: r.intent_id as string, proposal_id: (r.proposal_id as string) ?? null,
  limb: (r.limb as string) ?? null, direction: r.direction as Direction, kind: r.kind as ExchangeKind,
  tag: (r.tag as Tag) ?? null, author: r.author as string, body: r.body as string,
  reply_to: (r.reply_to as string) ?? null,
  taken: r.taken === null || r.taken === undefined ? null : r.taken === 1,
  private: r.private === 1,
  created_at: r.created_at as string,
});

export class Db {
  constructor(private readonly d1: D1Database) {}

  // Projects
  async createProject(p: { slug: string; namespace: string; repo: string; remote: string }): Promise<Project> {
    const project: Project = { id: newId(), slug: p.slug, vision: "", namespace: p.namespace, repo: p.repo, remote: p.remote, subscription_id: null, created_at: now() };
    await this.d1.prepare("INSERT INTO projects (id, slug, vision, namespace, repo, remote, subscription_id, created_at) VALUES (?,?,?,?,?,?,?,?)")
      .bind(project.id, project.slug, project.vision, project.namespace, project.repo, project.remote, null, project.created_at).run();
    return project;
  }
  getProjectBySlug(slug: string): Promise<Project | null> {
    return this.d1.prepare("SELECT * FROM projects WHERE slug = ?").bind(slug).first<Project>();
  }
  getProject(id: string): Promise<Project | null> {
    return this.d1.prepare("SELECT * FROM projects WHERE id = ?").bind(id).first<Project>();
  }
  getProjectByRepo(repo: string): Promise<Project | null> {
    return this.d1.prepare("SELECT * FROM projects WHERE repo = ?").bind(repo).first<Project>();
  }
  async listProjects(): Promise<Project[]> {
    return (await this.d1.prepare("SELECT * FROM projects ORDER BY created_at").all<Project>()).results;
  }
  async setVision(id: string, vision: string): Promise<void> {
    await this.d1.prepare("UPDATE projects SET vision = ? WHERE id = ?").bind(vision, id).run();
  }
  async setProjectSubscription(id: string, subscriptionId: string | null): Promise<void> {
    await this.d1.prepare("UPDATE projects SET subscription_id = ? WHERE id = ?").bind(subscriptionId, id).run();
  }

  // Intents
  async createIntent(projectId: string, title: string, body: string): Promise<Intent> {
    const next = await this.d1.prepare("SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM intents WHERE project_id = ?").bind(projectId).first<{ seq: number }>();
    const intent: Intent = {
      id: newId(), project_id: projectId, seq: next?.seq ?? 1, title, body, state: "open",
      accepted_proposal_id: null, commit_ref: null, created_at: now(), closed_at: null, accepted_at: null, landed_at: null,
    };
    await this.d1.prepare("INSERT INTO intents (id, project_id, seq, title, body, state, created_at) VALUES (?,?,?,?,?,?,?)")
      .bind(intent.id, intent.project_id, intent.seq, intent.title, intent.body, intent.state, intent.created_at).run();
    return intent;
  }
  getIntent(id: string): Promise<Intent | null> {
    return this.d1.prepare("SELECT * FROM intents WHERE id = ?").bind(id).first<Intent>();
  }
  async listIntents(projectId: string, state?: IntentState): Promise<Intent[]> {
    const stmt = state
      ? this.d1.prepare("SELECT * FROM intents WHERE project_id = ? AND state = ? ORDER BY seq").bind(projectId, state)
      : this.d1.prepare("SELECT * FROM intents WHERE project_id = ? ORDER BY seq").bind(projectId);
    return (await stmt.all<Intent>()).results;
  }
  async updateIntent(id: string, patch: Partial<Pick<Intent, "state" | "accepted_proposal_id" | "commit_ref" | "closed_at" | "accepted_at" | "landed_at">>): Promise<void> {
    const keys = Object.keys(patch) as (keyof typeof patch)[];
    if (keys.length === 0) return;
    const sets = keys.map((k) => `${k} = ?`).join(", ");
    await this.d1.prepare(`UPDATE intents SET ${sets} WHERE id = ?`).bind(...keys.map((k) => patch[k] ?? null), id).run();
  }

  // Exchanges
  async createExchange(e: Omit<Exchange, "id" | "created_at">): Promise<Exchange> {
    const exchange: Exchange = { ...e, id: newId(), created_at: now() };
    await this.d1.prepare("INSERT INTO exchanges (id, intent_id, proposal_id, limb, direction, kind, tag, author, body, reply_to, taken, private, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(exchange.id, exchange.intent_id, exchange.proposal_id, exchange.limb, exchange.direction, exchange.kind, exchange.tag, exchange.author, exchange.body, exchange.reply_to, exchange.taken === null ? null : exchange.taken ? 1 : 0, exchange.private ? 1 : 0, exchange.created_at).run();
    return exchange;
  }
  async getExchange(id: string): Promise<Exchange | null> {
    const row = await this.d1.prepare("SELECT * FROM exchanges WHERE id = ?").bind(id).first<Row>();
    return row ? toExchange(row) : null;
  }
  async listExchanges(intentId: string): Promise<Exchange[]> {
    const rows = (await this.d1.prepare("SELECT * FROM exchanges WHERE intent_id = ? ORDER BY created_at, id").bind(intentId).all<Row>()).results;
    return rows.map(toExchange);
  }
  async setTaken(id: string, taken: boolean): Promise<void> {
    await this.d1.prepare("UPDATE exchanges SET taken = ? WHERE id = ?").bind(taken ? 1 : 0, id).run();
  }
  async setPrivate(id: string, isPrivate: boolean): Promise<void> {
    await this.d1.prepare("UPDATE exchanges SET private = ? WHERE id = ?").bind(isPrivate ? 1 : 0, id).run();
  }

  // Proposals
  async createProposal(p: Omit<Proposal, "id" | "state" | "created_at" | "decided_at">): Promise<Proposal> {
    const paths = Array.from(new Set(p.paths));
    const proposal: Proposal = { ...p, paths, id: newId(), state: "open", created_at: now(), decided_at: null };
    await this.d1.prepare("INSERT INTO proposals (id, intent_id, limb, fork_repo, fork_remote, base_commit, commit_hash, paths, evidence, state, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .bind(proposal.id, proposal.intent_id, proposal.limb, proposal.fork_repo, proposal.fork_remote, proposal.base_commit, proposal.commit, JSON.stringify(paths), proposal.evidence, proposal.state, proposal.created_at).run();
    return proposal;
  }
  async getProposal(id: string): Promise<Proposal | null> {
    const row = await this.d1.prepare("SELECT * FROM proposals WHERE id = ?").bind(id).first<Row>();
    return row ? toProposal(row) : null;
  }
  async listProposals(intentId: string): Promise<Proposal[]> {
    const rows = (await this.d1.prepare("SELECT * FROM proposals WHERE intent_id = ? ORDER BY created_at, id").bind(intentId).all<Row>()).results;
    return rows.map(toProposal);
  }
  async listOpenProposalsForProject(projectId: string): Promise<Proposal[]> {
    const rows = (await this.d1.prepare(
      "SELECT p.* FROM proposals p JOIN intents i ON i.id = p.intent_id WHERE i.project_id = ? AND p.state = 'open' ORDER BY p.created_at, p.id",
    ).bind(projectId).all<Row>()).results;
    return rows.map(toProposal);
  }
  async setProposalState(id: string, state: ProposalState): Promise<void> {
    await this.d1.prepare("UPDATE proposals SET state = ?, decided_at = ? WHERE id = ?").bind(state, now(), id).run();
  }

  // Forks
  async createFork(f: Omit<Fork, "id" | "created_at" | "last_push_at">): Promise<Fork> {
    const fork: Fork = { ...f, id: newId(), created_at: now(), last_push_at: null };
    await this.d1.prepare("INSERT INTO forks (id, intent_id, limb, fork_repo, fork_remote, base_commit, subscription_id, created_at) VALUES (?,?,?,?,?,?,?,?)")
      .bind(fork.id, fork.intent_id, fork.limb, fork.fork_repo, fork.fork_remote, fork.base_commit, fork.subscription_id, fork.created_at).run();
    return fork;
  }
  async listForks(intentId: string): Promise<Fork[]> {
    return (await this.d1.prepare("SELECT * FROM forks WHERE intent_id = ? ORDER BY created_at").bind(intentId).all<Fork>()).results;
  }
  getForkByRepo(repo: string): Promise<Fork | null> {
    return this.d1.prepare("SELECT * FROM forks WHERE fork_repo = ?").bind(repo).first<Fork>();
  }
  async touchFork(repo: string): Promise<void> {
    await this.d1.prepare("UPDATE forks SET last_push_at = ? WHERE fork_repo = ?").bind(now(), repo).run();
  }

  // Events (the change feed)
  async recordEvent(projectId: string, kind: string, refId: string, detail = ""): Promise<void> {
    await this.d1.prepare("INSERT INTO events (project_id, kind, ref_id, detail, created_at) VALUES (?,?,?,?,?)").bind(projectId, kind, refId, detail, now()).run();
  }
  async eventsSince(projectId: string, cursor: number, limit = 200): Promise<ArmatureEvent[]> {
    return (await this.d1.prepare("SELECT * FROM events WHERE project_id = ? AND id > ? ORDER BY id LIMIT ?").bind(projectId, cursor, limit).all<ArmatureEvent>()).results;
  }

  // Push idempotency
  async pushSeen(repo: string, after: string): Promise<boolean> {
    const row = await this.d1.prepare("SELECT 1 AS one FROM pushes WHERE repo = ? AND after_hash = ?").bind(repo, after).first();
    return row !== null;
  }

  async markPushSeen(repo: string, after: string): Promise<boolean> {
    const result = await this.d1.prepare("INSERT OR IGNORE INTO pushes (repo, after_hash, seen_at) VALUES (?,?,?)").bind(repo, after, now()).run();
    return result.meta.changes === 1;
  }
}
