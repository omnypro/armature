// src/model/exchange.test.ts
import { describe, expect, it } from "bun:test";
import type { Exchange } from "../types";
import { blockingChallenges, directionFor, openPokes, unansweredQuestions, withheldIds } from "./exchange";

const ex = (over: Partial<Exchange>): Exchange => ({
  id: over.id ?? crypto.randomUUID(), intent_id: "i", proposal_id: null, limb: null, direction: "to_pilot",
  kind: "question", tag: null, author: "challenger", body: "?", reply_to: null, taken: null, private: false,
  created_at: "2026-10-09T00:00:00Z", ...over,
});

describe("directionFor", () => {
  it("sends questions and pokes to the pilot, challenges and steers to the crew", () => {
    expect(directionFor("question")).toBe("to_pilot");
    expect(directionFor("poke")).toBe("to_pilot");
    expect(directionFor("challenge")).toBe("to_crew");
    expect(directionFor("steer")).toBe("to_crew");
  });
  it("a reply goes the opposite way of what it answers", () => {
    const q = ex({ kind: "question", direction: "to_pilot" });
    const c = ex({ kind: "challenge", direction: "to_crew" });
    expect(directionFor("reply", q)).toBe("to_crew");
    expect(directionFor("reply", c)).toBe("to_pilot");
  });
  it("a reply without a target is an error", () => {
    expect(() => directionFor("reply")).toThrow("reply needs reply_to");
  });
});

describe("unansweredQuestions", () => {
  it("counts a question answered only when the pilot replied to it", () => {
    const q1 = ex({ id: "q1", kind: "question" });
    const q2 = ex({ id: "q2", kind: "question" });
    const crewReply = ex({ kind: "reply", author: "builder", direction: "to_pilot", reply_to: "q1" });
    const pilotReply = ex({ kind: "reply", author: "pilot", direction: "to_crew", reply_to: "q2" });
    expect(unansweredQuestions([q1, q2, crewReply, pilotReply]).map((e) => e.id)).toEqual(["q1"]);
  });
});

describe("blockingChallenges", () => {
  it("a pilot challenge on a proposal blocks until a limb replies", () => {
    const c = ex({ id: "c1", kind: "challenge", author: "pilot", direction: "to_crew", proposal_id: "p1" });
    expect(blockingChallenges([c], "p1").map((e) => e.id)).toEqual(["c1"]);
    const reply = ex({ kind: "reply", author: "builder-a", direction: "to_pilot", reply_to: "c1", proposal_id: "p1" });
    expect(blockingChallenges([c, reply], "p1")).toEqual([]);
    expect(blockingChallenges([c], "p2")).toEqual([]);
  });
});

describe("openPokes", () => {
  it("is every poke the pilot has not taken or dismissed", () => {
    const a = ex({ id: "a", kind: "poke", tag: "heads_up", taken: null });
    const b = ex({ id: "b", kind: "poke", tag: "heads_up", taken: true });
    const c = ex({ id: "c", kind: "poke", tag: "you_should_know", taken: false });
    expect(openPokes([a, b, c]).map((e) => e.id)).toEqual(["a"]);
  });
});

describe("withheldIds", () => {
  it("withholds private exchanges and every reply under them", () => {
    const q = ex({ id: "q", private: true });
    const r1 = ex({ id: "r1", kind: "reply", reply_to: "q" });
    const r2 = ex({ id: "r2", kind: "reply", reply_to: "r1" });
    const other = ex({ id: "o" });
    expect([...withheldIds([q, r1, r2, other])].sort()).toEqual(["q", "r1", "r2"]);
  });
});
