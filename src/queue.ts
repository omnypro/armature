// src/queue.ts
import type { Db } from "./db/db";
import type { Armature } from "./service";

interface PushedEvent {
  type: string;
  source: { type: string; namespace: string; repoName: string };
  payload: { ref: string; before: string; after: string; commits: { id: string; parents: string[] }[]; commitsTruncated: boolean };
}

export const consume = async (batch: MessageBatch, armature: Armature, db: Db): Promise<void> => {
  for (const message of batch.messages) {
    try {
      const event = message.body as PushedEvent;
      if (event?.type === "cf.artifacts.repo.pushed") {
        const repo = event.source.repoName;
        if (await db.getForkByRepo(repo)) {
          await db.touchFork(repo);
        } else if (event.payload.ref === "refs/heads/main") {
          const outcome = await armature.markLanded(repo, event.payload.after, event.payload.commits, event.payload.commitsTruncated);
          console.log("push", repo, event.payload.after.slice(0, 12), outcome);
        }
      }
      message.ack();
    } catch (error) {
      console.error("queue message failed", message.id, error instanceof Error ? error.message : String(error));
      message.retry();
    }
  }
};
