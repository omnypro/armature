// src/artifacts.ts
export interface RepoRef { name: string; remote: string; defaultBranch: string; token: string | null }

export interface ArtifactsPort {
  create(name: string): Promise<RepoRef>;
  fork(source: string, target: string): Promise<RepoRef>;
  createToken(repo: string, scope: "read" | "write", ttlSeconds: number): Promise<{ plaintext: string; expiresAt: string }>;
  readFile(repo: string, ref: string, path: string): Promise<string | null>;
  headCommit(repo: string, ref: string): Promise<string | null>;
  // First-parent ancestry only, within the most recent 1000 commits; landings are linear so this is sufficient.
  isAncestor(repo: string, ancestor: string, head: string): Promise<boolean>;
}

// Field names on ArtifactsCommitMetadata, read from worker-configuration.d.ts
// in Task 1 step 8. Change this constant if the generated type differs.
const COMMIT_HASH_FIELD = "hash";

const hashOf = (commit: unknown): string => (commit as Record<string, string>)[COMMIT_HASH_FIELD];

export const realArtifacts = (artifacts: Artifacts): ArtifactsPort => ({
  async create(name) {
    const created = await artifacts.create(name, { setDefaultBranch: "main" });
    return { name: created.name, remote: created.remote, defaultBranch: created.defaultBranch, token: created.token ?? null };
  },
  async fork(source, target) {
    using repo = await artifacts.get(source);
    const forked = await repo.fork(target, { defaultBranchOnly: true });
    return { name: forked.name, remote: forked.remote, defaultBranch: forked.defaultBranch, token: forked.token ?? null };
  },
  async createToken(repoName, scope, ttlSeconds) {
    using repo = await artifacts.get(repoName);
    const token = await repo.createToken(scope, ttlSeconds);
    return { plaintext: token.plaintext, expiresAt: String(token.expiresAt) };
  },
  async readFile(repoName, ref, path) {
    using repo = await artifacts.get(repoName);
    const blob = await repo.readFile({ ref, path });
    return blob === null ? null : await blob.text();
  },
  async headCommit(repoName, ref) {
    using repo = await artifacts.get(repoName);
    const log = await repo.log({ ref, limit: 1 });
    return log.length === 0 ? null : hashOf(log[0]);
  },
  async isAncestor(repoName, ancestor, head) {
    if (ancestor === head) return true;
    using repo = await artifacts.get(repoName);
    const log = await repo.log({ ref: head, limit: 1000 });
    return log.some((c) => hashOf(c) === ancestor);
  },
});
