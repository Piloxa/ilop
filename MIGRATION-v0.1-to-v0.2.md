# Moving from ILOP 0.1 to 0.2

This guide is for a provider that published a 0.1 manifest or 0.1-shaped results. The reference implementation (Piloxa) went through these same steps; see [docs/piloxa-reference-mapping.md](docs/piloxa-reference-mapping.md).

## 1. Fix `executed`

In 0.1 many providers set `executed` from their own "sent to partner" flag. In 0.2:

| Your order is | `ilop_state` | `executed` |
|---|---|---|
| accepted by the partner, no carrier scan yet | `ACCEPTED` | `false` |
| scanned in by the carrier | `EXECUTED` | `true` |
| delivered | `COMPLETED` | `true` |
| returned, refused, unclaimed | `EXCEPTION` | `true` |
| you cannot tell whether the partner took it | `AUTHORIZED` | `null`, plus `error.code: OUTCOME_UNCERTAIN` |

Keep your own legacy field (for example `mailed`) if clients rely on it. Add the ILOP envelope beside it; do not change the old field's meaning.

## 2. Put the envelope under `structuredContent.ilop`

Leave your existing result fields where they are. Add one object:

```json
"ilop": {
  "ilop_version": "0.2", "operation": "status", "action": "mail.certified.us",
  "order_id": "<id prepare returned>", "ilop_state": "ACCEPTED", "provider_state": "VENDOR_ACCEPTED",
  "state_meaning": "...", "charged": true, "executed": false,
  "payment_status": "CAPTURED", "fulfillment_status": "PARTNER_ACCEPTED",
  "requires_human_approval": true, "approval_mode": "provider_hosted",
  "events": [], "evidence": [], "observed_at": "2026-11-17T16:00:00.000Z"
}
```

Validate it with [`schema/ilop-order.schema.json`](schema/ilop-order.schema.json).

## 3. Keep `order_id` stable

Use the id `prepare` returned for the life of the order. If your partner or job system has another id, put it in `provider_reference`. `quote` and `check` return `order_id: null`.

## 4. Replace `failure` with a typed `error`

```json
"error": { "code": "OUTCOME_UNCERTAIN", "human_message": "...", "retryable": false,
           "safe_next_action": "Call status; do not pay again.", "side_effect_status": "payment_held_fulfillment_unknown",
           "correlation_id": "...", "observed_at": "..." }
```

Map your internal codes to the 16 ILOP codes in SPEC section 6.6. Anything you cannot map is `INTERNAL_ERROR` with your code kept in your own fields.

## 5. Add provenance to events and proofs

Each event needs a `source` with `system`, `reported_by` and `third_party_authenticated`. If you relay carrier data through a print partner, `reported_by` is the partner, `relayed_by` is you, and `third_party_authenticated` is `false`. Set `occurred_at` to the time the source gave, or `null`. Do not copy your own observation time into it.

## 6. Update the manifest

Required for 0.2: `mcp.protocol_versions` (only versions you actually serve), `tool_annotations` (copied from your live `tools/list`), `capability_revision`. Remove `authorize` from `tools` unless the tool is actually served; if it is, add `features.in_chat_authorization` with `listed: true` and its conditions. Generate the file from the same code that builds `tools/list`, so they cannot drift.

## 7. Status access

If status worked by order id alone, stop: SPEC section 9. Scope it to the session, a provider-minted status handle, or a signed-in account.

## 8. Run the harness

```sh
npm ci
npm test                                   # offline: schemas, traces, your captured examples
node conformance/runner/run.mjs --live https://your.domain   # read-only live checks
```

Claim the conformance level you actually ran (SPEC section 12).
