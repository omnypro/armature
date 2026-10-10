// src/model/intent.ts
import type { IntentState, ProposalState } from "../types";

const TRANSITIONS: Record<IntentState, readonly IntentState[]> = {
  open: ["closed", "shelved"],
  closed: ["accepted", "shelved"],
  accepted: ["landed"],
  landed: [],
  shelved: [],
};

export class TransitionError extends Error {
  constructor(from: IntentState, to: IntentState) {
    super(`intent cannot move ${from} -> ${to}`);
    this.name = "TransitionError";
  }
}

export const canTransition = (from: IntentState, to: IntentState): boolean => TRANSITIONS[from].includes(to);

export const assertTransition = (from: IntentState, to: IntentState): void => {
  if (!canTransition(from, to)) throw new TransitionError(from, to);
};

export const canDecideProposal = (state: ProposalState): boolean => state === "open";
