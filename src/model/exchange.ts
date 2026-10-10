// src/model/exchange.ts
import type { Direction, Exchange, ExchangeKind } from "../types";

export const directionFor = (kind: ExchangeKind, replyTo?: Exchange): Direction => {
  switch (kind) {
    case "question":
    case "poke":
      return "to_pilot";
    case "challenge":
    case "steer":
      return "to_crew";
    case "reply":
      if (!replyTo) throw new Error("reply needs reply_to");
      return replyTo.direction === "to_pilot" ? "to_crew" : "to_pilot";
  }
};

const repliesTo = (exchanges: Exchange[], id: string): Exchange[] => exchanges.filter((e) => e.kind === "reply" && e.reply_to === id);

export const unansweredQuestions = (exchanges: Exchange[]): Exchange[] =>
  exchanges.filter((e) => e.kind === "question" && !repliesTo(exchanges, e.id).some((r) => r.author === "pilot"));

export const blockingChallenges = (exchanges: Exchange[], proposalId: string): Exchange[] =>
  exchanges.filter(
    (e) => e.kind === "challenge" && e.proposal_id === proposalId && !repliesTo(exchanges, e.id).some((r) => r.author !== "pilot"),
  );

export const openPokes = (exchanges: Exchange[]): Exchange[] => exchanges.filter((e) => e.kind === "poke" && e.taken === null);

export const withheldIds = (exchanges: Exchange[]): Set<string> => {
  const withheld = new Set(exchanges.filter((e) => e.private).map((e) => e.id));
  let grew = true;
  while (grew) {
    grew = false;
    for (const e of exchanges) {
      if (e.reply_to && withheld.has(e.reply_to) && !withheld.has(e.id)) {
        withheld.add(e.id);
        grew = true;
      }
    }
  }
  return withheld;
};
