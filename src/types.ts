// src/types.ts
export type IntentState = "open" | "closed" | "accepted" | "landed" | "shelved";
export type ProposalState = "open" | "accepted" | "rejected" | "superseded";
export type ExchangeKind = "question" | "poke" | "challenge" | "steer" | "reply";
export type Direction = "to_pilot" | "to_crew";
export type Tag = "heads_up" | "you_should_know";

export interface Project {
  id: string; slug: string; vision: string; namespace: string; repo: string;
  remote: string; subscription_id: string | null; created_at: string;
}
export interface Intent {
  id: string; project_id: string; seq: number; title: string; body: string;
  state: IntentState; accepted_proposal_id: string | null; commit_ref: string | null;
  created_at: string; closed_at: string | null; accepted_at: string | null; landed_at: string | null;
}
export interface Exchange {
  id: string; intent_id: string; proposal_id: string | null; limb: string | null;
  direction: Direction; kind: ExchangeKind; tag: Tag | null; author: string; body: string;
  reply_to: string | null; taken: boolean | null; private: boolean; created_at: string;
}
export interface Proposal {
  id: string; intent_id: string; limb: string; fork_repo: string; fork_remote: string;
  base_commit: string; commit: string; paths: string[]; evidence: string;
  state: ProposalState; created_at: string; decided_at: string | null;
}
export interface Fork {
  id: string; intent_id: string; limb: string; fork_repo: string; fork_remote: string;
  base_commit: string; subscription_id: string | null; created_at: string; last_push_at: string | null;
}
export interface ArmatureEvent {
  id: number; project_id: string; kind: string; ref_id: string; detail: string; created_at: string;
}
export const now = (): string => new Date().toISOString();
export const newId = (): string => crypto.randomUUID();
