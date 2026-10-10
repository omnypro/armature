// src/model/diff.ts
import { createTwoFilesPatch } from "diff";

export const renderUnified = (path: string, before: string | null, after: string | null): string => {
  if (before === after) return `(no changes in ${path})\n`;
  const oldName = before === null ? "/dev/null" : `a/${path}`;
  const newName = after === null ? "/dev/null" : `b/${path}`;
  return createTwoFilesPatch(oldName, newName, before ?? "", after ?? "", "", "", { context: 3 });
};
