// src/model/overlap.ts
export interface Overlap { a: string; b: string; paths: string[] }
interface WithPaths { id: string; paths: string[] }

export const findOverlaps = (candidate: WithPaths, others: WithPaths[]): Overlap[] => {
  const mine = new Set(candidate.paths);
  const out: Overlap[] = [];
  for (const other of others) {
    if (other.id === candidate.id) continue;
    const shared = Array.from(new Set(other.paths)).filter((p) => mine.has(p)).sort();
    if (shared.length > 0) out.push({ a: candidate.id, b: other.id, paths: shared });
  }
  return out;
};

export const overlapPokeBody = (overlap: Overlap, limbA: string, limbB: string): string =>
  `${limbA} and ${limbB} both touch ${overlap.paths.join(", ")}; one of these proposals will need a rebase.`;
