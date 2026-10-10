// test/fake-artifacts.test.ts
import { describe, expect, it } from "vitest";
import { FakeArtifacts } from "./fake-artifacts";

describe("FakeArtifacts", () => {
  it("forks share history and diverge after a commit", async () => {
    const a = new FakeArtifacts();
    await a.create("proj");
    const base = await a.headCommit("proj", "main");
    await a.fork("proj", "proj--0001--b");
    const c = a.commit("proj--0001--b", "main", { "x.ts": "1" });
    expect(await a.readFile("proj--0001--b", "main", "x.ts")).toBe("1");
    expect(await a.readFile("proj", "main", "x.ts")).toBeNull();
    expect(await a.isAncestor("proj--0001--b", base!, c)).toBe(true);
    expect(await a.isAncestor("proj", c, base!)).toBe(false);
  });

  it("copyCommit carries the whole ancestry into the destination", async () => {
    const a = new FakeArtifacts();
    await a.create("proj");
    const base = await a.headCommit("proj", "main");
    await a.fork("proj", "proj--0001--b");
    const c1 = a.commit("proj--0001--b", "main", { "x.ts": "1" });
    const c2 = a.commit("proj--0001--b", "main", { "y.ts": "2" });
    a.copyCommit("proj--0001--b", c2, "proj", "main");
    expect(await a.headCommit("proj", "main")).toBe(c2);
    expect(await a.isAncestor("proj", base!, c2)).toBe(true);
    expect(await a.isAncestor("proj", c1, c2)).toBe(true);
    expect(await a.readFile("proj", c1, "x.ts")).toBe("1");
    expect(await a.readFile("proj", "main", "y.ts")).toBe("2");
  });
});
