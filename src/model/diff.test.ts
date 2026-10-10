// src/model/diff.test.ts
import { describe, expect, it } from "bun:test";
import { renderUnified } from "./diff";

describe("renderUnified", () => {
  it("shows a one-line change with file headers", () => {
    const out = renderUnified("src/a.ts", "const a = 1;\n", "const a = 2;\n");
    expect(out).toContain("--- a/src/a.ts");
    expect(out).toContain("+++ b/src/a.ts");
    expect(out).toContain("-const a = 1;");
    expect(out).toContain("+const a = 2;");
  });
  it("treats null as an added or removed file", () => {
    expect(renderUnified("new.ts", null, "x\n")).toContain("--- /dev/null");
    expect(renderUnified("gone.ts", "x\n", null)).toContain("+++ /dev/null");
  });
  it("says so when nothing changed", () => {
    expect(renderUnified("same.ts", "x\n", "x\n")).toBe("(no changes in same.ts)\n");
  });
});
