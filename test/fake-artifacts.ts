// test/fake-artifacts.ts
import type { ArtifactsPort, RepoRef } from "../src/artifacts";

interface Commit { hash: string; parent: string | null; files: Map<string, string> }
interface Repo { ref: RepoRef; heads: Map<string, string>; commits: Map<string, Commit> }

let counter = 0;
const fakeHash = (): string => (++counter).toString(16).padStart(40, "0");

export class FakeArtifacts implements ArtifactsPort {
  repos = new Map<string, Repo>();
  tokens: { repo: string; scope: string }[] = [];

  async create(name: string): Promise<RepoRef> {
    const ref = { name, remote: `https://fake.artifacts/armature/${name}.git`, defaultBranch: "main", token: `tok-create-${name}` };
    const root: Commit = { hash: fakeHash(), parent: null, files: new Map() };
    this.repos.set(name, { ref, heads: new Map([["main", root.hash]]), commits: new Map([[root.hash, root]]) });
    return ref;
  }
  async fork(source: string, target: string): Promise<RepoRef> {
    const src = this.repos.get(source);
    if (!src) throw new Error(`no repo ${source}`);
    const ref = { name: target, remote: `https://fake.artifacts/armature/${target}.git`, defaultBranch: "main", token: `tok-fork-${target}` };
    this.repos.set(target, { ref, heads: new Map(src.heads), commits: new Map(src.commits) });
    return ref;
  }
  async createToken(repo: string, scope: "read" | "write") {
    this.tokens.push({ repo, scope });
    return { plaintext: `tok-${repo}-${scope}-${this.tokens.length}`, expiresAt: "2099-01-01T00:00:00Z" };
  }
  async readFile(repoName: string, ref: string, path: string): Promise<string | null> {
    const repo = this.repos.get(repoName);
    if (!repo) return null;
    const hash = repo.heads.get(ref) ?? ref;
    return repo.commits.get(hash)?.files.get(path) ?? null;
  }
  async headCommit(repoName: string, ref: string): Promise<string | null> {
    return this.repos.get(repoName)?.heads.get(ref) ?? null;
  }
  async isAncestor(repoName: string, ancestor: string, head: string): Promise<boolean> {
    const repo = this.repos.get(repoName);
    if (!repo) return false;
    let cursor: string | null = repo.heads.get(head) ?? head;
    while (cursor) {
      if (cursor === ancestor) return true;
      cursor = repo.commits.get(cursor)?.parent ?? null;
    }
    return false;
  }
  // Test helpers
  commit(repoName: string, ref: string, files: Record<string, string>): string {
    const repo = this.repos.get(repoName);
    if (!repo) throw new Error(`no repo ${repoName}`);
    const parentHash = repo.heads.get(ref) ?? null;
    const parent = parentHash ? repo.commits.get(parentHash) : undefined;
    const next: Commit = { hash: fakeHash(), parent: parentHash, files: new Map(parent?.files ?? []) };
    for (const [k, v] of Object.entries(files)) next.files.set(k, v);
    repo.commits.set(next.hash, next);
    repo.heads.set(ref, next.hash);
    return next.hash;
  }
  copyCommit(from: string, hash: string, to: string, ref: string): void {
    const source = this.repos.get(from);
    const dst = this.repos.get(to);
    if (!source?.commits.has(hash) || !dst) throw new Error("copyCommit: missing repo or commit");
    let cursor: string | null = hash;
    while (cursor && !dst.commits.has(cursor)) {
      const commit: Commit | undefined = source.commits.get(cursor);
      if (!commit) break;
      dst.commits.set(cursor, commit);
      cursor = commit.parent;
    }
    dst.heads.set(ref, hash);
  }
}
