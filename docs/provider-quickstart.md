# Provider quickstart

You run a real-world service (mail, courier, filing, printing) and already have, or can add, an MCP server. This is the shortest path to ILOP 0.2.

## 1. Keep your tools; map them

Do not rename reviewed tools. Decide which of yours is `quote`, `prepare`, `status` (required) and `check`, `authorize`, `proof` (optional). Mark `quote`, `check`, `status` with `readOnlyHint: true`.

## 2. Map your states

Write a table from your status words to the ten ILOP states. Anything unmapped becomes `ilop_state: null` plus `OUTCOME_UNCERTAIN`. Decide what your execution event is (for mail: the carrier scan; for a courier: the pickup). `executed` is true only once that event is in `events`.

## 3. Return the envelope

Add `structuredContent.ilop` to every tool result. Copy the envelope logic from [`reference-adapter/courier-adapter.mjs`](../reference-adapter/courier-adapter.mjs): it is about 60 lines and imports nothing but `node:crypto`. Replace the four functions marked `PROVIDER` with calls to your systems.

## 4. Approval on your own page

`prepare` returns `approval_url` on your domain. The page shows the exact document or job, destination, service and total; establishes the person independently (email code, sign-in); records an Approval; holds payment; captures when your partner accepts.

## 5. Publish the manifest

Serve `/.well-known/ilop.json`, generated from the same code that builds `tools/list`. Validate with [`schema/ilop-manifest.schema.json`](../schema/ilop-manifest.schema.json).

## 6. Test

```sh
git clone https://github.com/Piloxa/ilop && cd ilop && npm ci
npm test
node conformance/runner/run.mjs --live https://your.domain
```

Then add your own captured envelopes to `examples/` (redacted) and your journeys to `conformance/fixtures/traces/`, and claim `contract` level.

## Things that will fail review

- `executed: true` because you sent the job, not because it happened.
- A status lookup that works with an order number alone.
- `authorize` in the manifest when the tool is not served, or `user_approved: true` treated as consent.
- Retrying a submission after a timeout instead of reconciling.
- A delivery date or receipt filled in before the source reported it.
