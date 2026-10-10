// src/model/overlap.test.ts
import { describe, expect, it } from "bun:test";
import { findOverlaps, overlapPokeBody } from "./overlap";

describe("findOverlaps", () => {
  it("returns the shared paths between the candidate and each other proposal", () => {
    const result = findOverlaps({ id: "p3", paths: ["src/a.ts", "src/b.ts", "README.md"] }, [
      { id: "p1", paths: ["src/b.ts", "src/c.ts"] },
      { id: "p2", paths: ["docs/x.md"] },
    ]);
    expect(result).toEqual([{ a: "p3", b: "p1", paths: ["src/b.ts"] }]);
  });
  it("returns nothing for an empty or duplicate-only path list", () => {
    expect(findOverlaps({ id: "p1", paths: [] }, [{ id: "p2", paths: ["x"] }])).toEqual([]);
    expect(findOverlaps({ id: "p1", paths: ["x", "x"] }, [{ id: "p2", paths: ["y"] }])).toEqual([]);
  });
  it("never compares a proposal with itself", () => {
    expect(findOverlaps({ id: "p1", paths: ["x"] }, [{ id: "p1", paths: ["x"] }])).toEqual([]);
  });
});

describe("overlapPokeBody", () => {
  it("is one sentence naming both limbs and the paths", () => {
    const body = overlapPokeBody({ a: "p3", b: "p1", paths: ["src/b.ts"] }, "builder-a", "builder-b");
    expect(body).toBe("builder-a and builder-b both touch src/b.ts; one of these proposals will need a rebase.");
  });
});
