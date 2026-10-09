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
2. `wrangler d1 create armature`, paste the id into `wrangler.jsonc`.
3. `wrangler queues create armature-events`, paste the queue id into
   `EVENTS_QUEUE_ID`.
4. `wrangler secret put PILOT_TOKEN` (any long string: your seat).
5. `wrangler secret put CF_API_TOKEN` (Queues Edit, Artifacts Read).
6. `wrangler d1 migrations apply armature --remote && wrangler deploy`
7. Open the Worker URL, enter your token, create a project. Push your code
   to the remote it shows. Connect the repo to Workers Builds in the
   dashboard if you want `main` to deploy.
8. Point your agents at `<worker-url>/mcp` with `Authorization: Bearer
   <token>`, and hand each one a file from `crew/`.
9. When you accept a proposal, run `bin/land <slug> <intent-id>` with the
   variables listed at the top of that script.

## Tests

`bun run test` runs the unit tests, the landing script test, and the
Workers tests.

## Licence

MIT. Copyright © 2026 Omnyist Productions, LLC.
