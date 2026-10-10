# Armature

A Git platform for one builder and their crew of agents, on Cloudflare
Workers and Artifacts.

We build stuff for ourselves and hope you like it too.

## What it is

You write what you want, in your words. The crew challenges it before anyone
writes code. Each agent works on its own fork and files proposals with
evidence. You read the diff, argue back, steer mid-flight, and decide what
lands. Everything said along the way is kept in the repository as the
project's memoir.

Strong software requires empathy.

## Who it is for

A builder who has the vision and reads code, and wants a crew that pushes
back. It is not for typing a sentence and receiving a product: the cockpit
shows diffs, not summaries.

Armature runs no model. The crew is whatever agents you run, on your
machine, talking to Armature over MCP. Their quality is yours.

## Words

- **Blueprint**: the vision and the intents in flight. What the crew follows.
- **Memoir**: the chapters that landed, under `memoir/`. What remains.
- **Pilot**: you. **Limb**: one agent on one fork. **Crew**: all of them.
- **Exchange**: anything said about an intent, in either direction.
- **Proposal**: a limb's commit, its touched paths, its evidence.

## Run it

1. `bun install`
2. `bunx wrangler d1 create armature`, paste the id into `wrangler.jsonc`.
3. `bunx wrangler queues create armature-events`, then paste the queue id
   from `bunx wrangler queues info armature-events` into `EVENTS_QUEUE_ID`.
4. `bunx wrangler secret put PILOT_TOKEN` (any long string: your seat).
5. `bunx wrangler secret put CF_API_TOKEN` (Queues Edit, Artifacts Read).
6. Set `CF_ACCOUNT_ID` in `wrangler.jsonc` to your account id from
   `bunx wrangler whoami`.
7. `bunx wrangler d1 migrations apply armature --remote && bunx wrangler deploy`
8. Open the Worker URL, enter your token, create a project. The project
   page shows the repo's write token once; push your code to the remote it
   shows with that token. For later pushes, issue a new one with
   `bunx wrangler artifacts repos issue-token <slug> --namespace armature --scope write --ttl 604800 --json`.
   Connect the repo to Workers Builds in the dashboard if you want `main` to
   deploy.
9. Point your agents at `<worker-url>/mcp` with `Authorization: Bearer
   <token>`, and hand each one a file from `crew/`.
10. When you accept a proposal, run `bin/land <slug> <intent-id>` with the
    variables listed at the top of that script.

The reference deployment, Armature's own: the Worker at
https://armature.omnyist.workers.dev, the project repo `armature` in the
`armature` namespace, mirrored to https://github.com/omnypro/armature.

## Tests

`bun run test` runs the unit tests, the landing script test, and the
Workers tests. Run `bun run types` once before `bun run typecheck` on a
fresh clone.

## Licence

MIT. Copyright © 2026 Omnyist Productions, LLC.
