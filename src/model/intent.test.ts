// src/model/intent.test.ts
import { describe, expect, it } from "bun:test";
import { TransitionError, assertTransition, canDecideProposal, canTransition } from "./intent";

describe("intent transitions", () => {
  it("allows the spec's transitions and nothing else", () => {
    expect(canTransition("open", "closed")).toBe(true);
    expect(canTransition("closed", "accepted")).toBe(true);
    expect(canTransition("accepted", "landed")).toBe(true);
    expect(canTransition("open", "shelved")).toBe(true);
    expect(canTransition("closed", "shelved")).toBe(true);
    expect(canTransition("open", "accepted")).toBe(false);
    expect(canTransition("landed", "open")).toBe(false);
    expect(canTransition("accepted", "shelved")).toBe(false);
    expect(canTransition("shelved", "open")).toBe(false);
  });
  it("throws a TransitionError with both states in the message", () => {
    expect(() => assertTransition("landed", "open")).toThrow(TransitionError);
    expect(() => assertTransition("landed", "open")).toThrow("landed -> open");
  });
  it("only open proposals can be decided", () => {
    expect(canDecideProposal("open")).toBe(true);
    expect(canDecideProposal("accepted")).toBe(false);
    expect(canDecideProposal("rejected")).toBe(false);
    expect(canDecideProposal("superseded")).toBe(false);
  });
});
