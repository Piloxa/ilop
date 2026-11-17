# ILOP conformance harness

Everything here runs offline, deterministically, with no network, no payment and no physical side effect.

```sh
npm ci
npm test                                         # offline cases
node conformance/runner/run.mjs --json out.json  # also writes pass/fail by case id
node conformance/runner/run.mjs --live https://provider.example   # adds read-only live checks
```

Exit code is 0 only when every case passes.

## What it checks

| Group | Cases | What |
|---|---|---|
| schema | 10 | every schema compiles as JSON Schema 2020-12 in strict mode |
| discovery | D-01..D-13 | manifest positive and negative cases (authorize advertised without the tool, autonomous charging, missing protocol versions, ...) |
| quote | Q-01..Q-10 | quotes create no order, charge nothing, use integer minor units and ISO currency |
| prepare | P-01..P-12 | prepare makes an unsent draft only; digests and URLs well formed |
| approval | A-01..A-18 | hosted and in-chat approval, replays, binding changes, uncertain outcomes, agent-only approval rejected |
| status | S-01..S-14 | every state, events with provenance, unknown provider states |
| evidence | E-01..E-08 | no value on a PENDING proof, issuer and source required, reviewed signature format only |
| mcp | M-01..M-02 | the 2026-07-28 trace, handle-less status refused cleanly |
| trace | T-01..T-12 | rules over one order across time (below) |
| examples | 13 | every captured example obeys every trace rule |
| reference-adapter | R-01..R-05 | an unrelated courier provider passes the same rules |

Case definitions are data: [`cases/schema-cases.json`](cases/schema-cases.json) applies JSON Pointer patches to a known-good example and states whether the result must validate.

## Trace rules

A schema sees one message. These rules see one order across time ([`runner/trace-rules.mjs`](runner/trace-rules.mjs)):

- `forward_only` — state never moves back; `executed` never goes from `true` to `false`.
- `terminal_final` — nothing changes after `COMPLETED`, `EXCEPTION`, `FAILED`, `CANCELLED`.
- `payment_consistency` — `charged` agrees with `payment_status`.
- `no_delivery_after_return` — `COMPLETED` never carries a `CARRIER_RETURNED` event.
- `single_partner_job` — at most one partner job per order.
- `execution_evidenced` — `EXECUTED`/`COMPLETED`/`EXCEPTION` from status carry a carrier event.
- `stable_order_id` — the id from `prepare` never changes.

## Live mode

`--live <origin>` fetches `/.well-known/ilop.json`, then calls only `tools/list`, `quote` and a `status` with a made-up reference. It never calls `prepare`, `authorize` or anything that can charge, mail or create an order. Checks L-01..L-14 cover content type, schema validity, no secrets or ids in the manifest, MCP endpoint on the same origin, every mapped tool served with matching annotations, read-only hints, honest advertising of `authorize`, and (if 2026-07-28 is listed) `server/discover` and header validation.

## Conformance levels

Say which level you ran (SPEC section 12). Passing this offline harness on your own captured envelopes is `contract`. It is not `sandbox-e2e` and not `independent-live`.

## Not checked here

Whether a provider really holds before capturing, really verifies a payment credential, or really deduplicates under concurrency can only be tested against its own system. The reference implementation's tests for those live in its own repository; see [../docs/conformance-matrix.md](../docs/conformance-matrix.md).
