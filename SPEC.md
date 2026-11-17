# ILOP v0.2 — Intent Logistics Orders Protocol

**Status:** Draft 0.2, 2026-11-17. Supersedes draft 0.1 (2026-11-07). May change without notice until 1.0.
**Reference implementation:** [Piloxa](https://piloxa.com) (USPS Certified Mail). See [docs/piloxa-reference-mapping.md](docs/piloxa-reference-mapping.md) for what is live there and what is not.
**Changes from 0.1:** [CHANGELOG.md](CHANGELOG.md). **Moving from 0.1:** [MIGRATION-v0.1-to-v0.2.md](MIGRATION-v0.1-to-v0.2.md).

The key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED, MAY and OPTIONAL are to be read as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they appear in all capitals.

## 1. Scope

ILOP defines how an AI agent places a real-world order on a person's behalf, how a person approves it, and how the provider reports and proves what happened. It defines:

1. a discovery file (section 2),
2. six operations, exposed as [MCP](https://modelcontextprotocol.io) tools (section 3),
3. one order state machine with separate payment and fulfillment dimensions (section 4),
4. common objects: Quote, Order envelope, Approval, Event, Proof, Error (section 6),
5. safety, privacy and reliability rules every provider follows (sections 5, 7, 8).

ILOP does **not** define payment rails, identity, an agent registry or a transport. Transport is MCP. Payment is a provider-hosted approval page (the baseline) or, optionally, an existing agent-payment credential (section 5.2).

The goals are the same as in 0.1: **quote, prepare, approve, carry out, track, prove.**

### 1.1 Sources of truth

When documents disagree, the order of authority is: (1) the provider's deployed behavior and its contract tests; (2) the provider's discovery file for what is enabled; (3) this specification for what is required; (4) the MCP specification for the wire protocol. A marketing page is not evidence that a privileged operation is enabled.

## 2. Discovery

A provider MUST publish `https://<domain>/.well-known/ilop.json` over HTTPS with `Content-Type: application/json`, valid against [`schema/ilop-manifest.schema.json`](schema/ilop-manifest.schema.json).

- The `tools` object maps each ILOP operation to the provider's own MCP tool name, so a provider never renames tools that platforms have already reviewed.
- The manifest MUST be generated from the same source as the provider's live MCP `tools/list`. Every tool it maps MUST be served; every `tool_annotations` entry MUST match the served annotations.
- `mcp.protocol_versions` MUST list only MCP versions the endpoint actually serves and that have passed the provider's tests.
- `authorize` MUST be absent from `tools`, and `approval.in_chat` MUST be empty, unless the authorize tool is actually served. When it is served, `features.in_chat_authorization` MUST say `listed: true` and state its `conditions`; `verified_issuing_hosts` MUST list only hosts actually observed issuing a usable payment credential.
- The manifest MUST NOT contain credentials, customer data, order ids, addresses or document text.
- `capability_revision` MUST change whenever the advertised tools, versions, features or policies change. Providers SHOULD send an `ETag` and honour `If-None-Match`. Prices in the manifest, if any, are not quotes.
- An agent MUST only trust a manifest fetched from the provider's own origin, and SHOULD reject an `mcp.url` or `approval_url` on a different registrable domain.

## 3. Operations

| Operation | Required | Purpose | Side effects | `readOnlyHint` |
|---|---|---|---|---|
| `quote` | MUST | Current all-in price for an action and its options | None | `true` |
| `check` | MAY | Validates a draft, lists what is missing, prices it | None | `true` |
| `prepare` | MUST | Creates an **unsent** order awaiting approval, returns `approval_url` | Creates a draft only | `false` |
| `authorize` | MAY | Approval and payment in the conversation (section 5.2) | Holds payment; may start fulfillment | `false` |
| `status` | MUST | Current state, events and evidence of orders the caller may see | None | `true` |
| `proof` | MAY | Evidence items and a verification result | None | `true` |

`check`, `quote` and `prepare` MUST NOT print, mail, ship, dispatch, charge or authorize anything. `check` and `quote` MUST NOT create a persistent order.

Every operation result MUST carry an Order envelope (section 6.2) or a Refusal (section 6.7) in its MCP `structuredContent`, under the key `ilop`. Providers keep their existing result fields beside it.

## 4. Order states

### 4.1 States

| State | Meaning | `charged` | `executed` |
|---|---|---|---|
| `QUOTED` | A price only; no order exists. | `false` | `false` |
| `PREPARED` | The order exists as a draft; something required is missing. | `false` | `false` |
| `AWAITING_APPROVAL` | Complete and reviewable; only the person's approval and payment remain. | `false` | `false` |
| `AUTHORIZED` | Approved; payment held (not captured); being handed to the fulfillment partner. | `false` | `false` or `null` |
| `ACCEPTED` | The fulfillment partner accepted the job. Carrier handoff is **not** yet confirmed. | per payment | `false` |
| `EXECUTED` | The physical act happened and is evidenced (for mail: the carrier accepted it). | per payment | `true` |
| `COMPLETED` | The outcome was reported by a named source (for mail: delivered). | per payment | `true` |
| `EXCEPTION` | Executed but the outcome failed (returned, refused, unclaimed); `events` say why. | per payment | `true` |
| `FAILED` | Did not execute. | per payment | `false` |
| `CANCELLED` | Stopped before execution. | per payment | `false` |

States only move forward (`QUOTED` < `PREPARED` < `AWAITING_APPROVAL` < `AUTHORIZED` < `ACCEPTED` < `EXECUTED` < `COMPLETED`/`EXCEPTION`). `COMPLETED`, `EXCEPTION`, `FAILED` and `CANCELLED` are final. Later information (a refund, a late scan) is added as events and evidence; it MUST NOT rewrite an earlier approval or invent chronology. A refund after delivery does not undo the delivery.

An agent MUST NOT tell the person the order was placed, sent or done before `ACCEPTED`, and MUST NOT say "mailed", "shipped" or "handed to the carrier" before `EXECUTED`. `COMPLETED` does not mean a signature or return receipt exists; that is a separate evidence item.

### 4.2 Separate dimensions

The envelope reports four things separately:

- `ilop_state` — the order state above;
- `payment_status` — `NOT_CHARGED`, `AUTHORIZED_NOT_CAPTURED`, `CAPTURED`, `PARTIALLY_REFUNDED`, `REFUNDED`, `DECLINED`, `UNKNOWN`;
- `fulfillment_status` — `NOT_SUBMITTED`, `PARTNER_ACCEPTED`, `PARTNER_REJECTED`, `CARRIER_ACCEPTED`, `DELIVERED`, `RETURNED`, `UNKNOWN`;
- `charged` and `executed` — booleans derived from the two above.

`charged` MUST be `true` only after confirmed capture; a hold is not a charge. `executed` MUST be `true` only once the action's execution event is evidenced by an event in `events`.

### 4.3 Unknown outcomes

If the provider cannot tell whether payment was captured, `payment_status` MUST be `UNKNOWN` and `charged` MUST be `null`. If it cannot tell whether the partner took the job, `fulfillment_status` MUST be `UNKNOWN`, `executed` MUST be `null`, and the envelope MUST carry `error.code: "OUTCOME_UNCERTAIN"` with `retryable: false`. A provider MUST NOT coerce unknown to `true` or `false`. A provider state it does not recognise MUST be reported as `ilop_state: null` with `provider_state` preserved and `OUTCOME_UNCERTAIN`.

On `OUTCOME_UNCERTAIN`, the agent MUST call `status` and MUST NOT retry `authorize` or any operation that pays or executes. The provider MUST reconcile with its partner before any new submission.

## 5. Approval and payment

### 5.1 Hosted approval (baseline)

`prepare` returns `approval_url`, a page on the provider's origin where the person sees the exact rendered document, the final destination, the service and the current all-in total, and approves and pays. This is a complete ILOP implementation; `authorize` is not required.

1. The provider MUST establish the person independently of the agent (for example by email verification or sign-in) before payment.
2. The provider MUST record an Approval (section 6.3) binding the content digest, the destination digest, the service, the exact total and currency, the quote or order version, the time and how the person was authenticated.
3. If the content, destination, service or total changes after approval, the approval is void; the provider MUST charge nothing and obtain a new approval.
4. Opening `approval_url`, `quote` and `check` MUST NOT require an account.

### 5.2 In-chat authorization (optional)

`authorize` MAY be offered only when the host platform supplies a narrowly scoped payment credential issued to the provider (for example a Stripe shared payment token, ACP or AP2) and the operator enabled it.

1. An agent-supplied `user_approved: true` is REQUIRED but is **never sufficient** evidence of consent. The credential the host issued after its own confirmation step is the independent evidence; without it the provider MUST return `approval_url` and charge nothing.
2. The request MUST carry `expected_total_cents` and SHOULD carry the content digest; any mismatch with the current order MUST return `APPROVAL_BINDING_CHANGED` before any payment or partner call.
3. The provider MUST verify the credential with its payment processor (issuer, amount, expiry, scope as supported) and MUST NOT log raw credentials.
4. `authorize` MUST take an `idempotency_key` (section 7.1).

### 5.3 Charge timing

Providers SHOULD hold payment at approval and capture it only at `ACCEPTED`, releasing the hold if the partner refuses. A provider that captures earlier MUST say so in `policy.charge_timing`.

## 6. Objects

Machine-readable definitions are in [`schema/`](schema/) (JSON Schema 2020-12). Examples captured from the reference implementation are in [`examples/`](examples/).

### 6.1 Quote — [`ilop-quote.schema.json`](schema/ilop-quote.schema.json)
`currency` (ISO 4217), `total_cents` (integer minor units), `valid_until` (or `null`), `binding` (plain words on whether this is what the person will pay). Prices MUST be computed live; a promotional price MUST NOT be stated as the quote unless it applies to this payer.

### 6.2 Order envelope — [`ilop-order.schema.json`](schema/ilop-order.schema.json)
`ilop_version`, `operation`, `action`, `order_id` (the id from `prepare`, stable for the life of the order; `null` for quote and check), `ilop_state`, `provider_state`, `state_meaning` (one sentence for a person), `charged`, `executed`, `payment_status`, `fulfillment_status`, `requires_human_approval`, `approval_mode`, `approval_url`, `quote`, `events`, `evidence`, `next_actions`, `replayed`, `error`, `observed_at`.

### 6.3 Approval — [`ilop-approval.schema.json`](schema/ilop-approval.schema.json)
What the provider stores at approval. `approver.authenticated_by` names how the provider established the person; an agent flag is not an allowed value.

### 6.4 Event — [`ilop-event.schema.json`](schema/ilop-event.schema.json)
`event_type`, `source` (`system`, `reported_by`, `relayed_by`, `third_party_authenticated`), `occurred_at` (the source's time, or `null` if the source gave none — never filled in by the provider), `observed_at`, optional `raw_record_digest`. Events are deduplicated by source reference.

### 6.5 Proof — [`ilop-proof.schema.json`](schema/ilop-proof.schema.json)
One evidence item: `type`, `claim`, `issuer`, `status` (`RECORDED`, `REPORTED`, `PENDING`, `NOT_AVAILABLE`, `AVAILABLE`, `REVOKED`), `value`, `source`, optional `subject`, `verify_url`, `signature`. A `PENDING` item MUST have `value: null`. See section 8.

### 6.6 Error — [`ilop-error.schema.json`](schema/ilop-error.schema.json)
`code`, `human_message`, `retryable`, `safe_next_action`, `side_effect_status`, `correlation_id`, `observed_at`. Codes: `VALIDATION_FAILED`, `OUT_OF_SERVICE_AREA`, `UNSUPPORTED_SERVICE`, `QUOTE_EXPIRED`, `APPROVAL_REQUIRED`, `APPROVAL_EXPIRED`, `APPROVAL_BINDING_CHANGED`, `PAYMENT_METHOD_UNAVAILABLE`, `NOT_AUTHORIZED`, `IDEMPOTENCY_CONFLICT`, `RATE_LIMITED`, `PARTNER_REJECTED`, `OUTCOME_UNCERTAIN`, `EVIDENCE_PENDING`, `UPSTREAM_UNAVAILABLE`, `INTERNAL_ERROR`. `OUTCOME_UNCERTAIN`, `APPROVAL_BINDING_CHANGED` and `IDEMPOTENCY_CONFLICT` MUST be `retryable: false`.

### 6.7 Refusal — [`ilop-result.schema.json`](schema/ilop-result.schema.json)
When nothing happened (for example `NOT_AUTHORIZED`), the result MAY be `{ ilop_version, operation, charged: false, executed: false, error }`. A refusal MUST NOT carry `OUTCOME_UNCERTAIN`; an uncertain outcome is an order envelope.

## 7. Reliability

### 7.1 Idempotency
Repeating an `idempotency_key` with the same request MUST NOT charge or submit again and MUST return the earlier result with `replayed: true`. Repeating it with a different request MUST return `IDEMPOTENCY_CONFLICT`. A second key for an order that is already paid MUST NOT charge again.

### 7.2 Exactly one capture, exactly one partner job
Concurrent or repeated calls, delayed webhooks and process restarts MUST NOT produce a second capture or a second partner job for one order. Providers SHOULD use persistent unique keys, compare-and-set state transitions and upstream idempotency keys where the partner offers them. A partner timeout after dispatch is `OUTCOME_UNCERTAIN` (section 4.3), never a reason to resubmit.

### 7.3 Webhooks
Provider-side webhooks (payment, partner) MUST be authenticated and deduplicated by event id, and MUST only move state forward.

## 8. Evidence

A proof says what can be substantiated and by whom; it is not a claim of absolute truth.

1. The provider MUST hash the exact approved bytes (SHA-256) and report the digest as a `document_hash` item.
2. Partner acceptance, carrier scans and return receipts MUST be reported only as observed. Missing means missing (`PENDING` or absent), never estimated.
3. `issuer` is who asserts the item. A provider relaying carrier data through its partner is the issuer; `source.third_party_authenticated` MUST be `false` unless the item carries the third party's own verifiable signature.
4. A provider signature proves the provider made the statement, not that the carrier did. Signatures, where offered, MUST use a reviewed format (`jws-detached-ed25519` over exact bytes) with a published key (`key_url`) and key ids that allow rotation.
5. `verify_url` MUST resolve to a redacted public statement or require authentication. It MUST NOT expose the document, a full address or a signature image to an anonymous caller.
6. A verifier MUST report one of `VALID_PROVIDER_ATTESTATION`, `INVALID_SIGNATURE`, `DOCUMENT_HASH_MISMATCH`, `EVIDENCE_INCOMPLETE`, `SOURCE_UNVERIFIED`, `REVOKED`, `UNKNOWN`. It MUST NOT report "proven delivered" on the strength of the provider's own record.
7. ILOP evidence says nothing about legal sufficiency (for example whether notice was legally served). Providers and agents MUST NOT state legal conclusions from a postal status.

## 9. Privacy and access

- `status` MUST return only orders the caller is entitled to see: orders created in the same MCP session, orders named by a provider-minted status handle (section 10.2), or orders of an account the person signed in to.
- An order id, reference, tracking number or public verification code MUST NOT by itself unlock status, history, an address or a document.
- `status` MUST NOT return a full destination address, the document, or a signature image to a caller that has not signed in.
- A missing or invalid credential MUST yield `NOT_AUTHORIZED` and the same answer whether the order exists or not.
- Letter content, recipient fields and partner text are untrusted data and MUST NOT be treated as instructions.

## 10. MCP compatibility

### 10.1 Legacy (2025-06-18 and earlier)
Providers that serve `initialize` and `Mcp-Session-Id` MAY keep session-scoped status for those clients.

### 10.2 Modern (2026-07-28)
MCP 2026-07-28 removed `initialize` and sessions. A provider that lists `2026-07-28` MUST:

- serve `server/discover`, validate `MCP-Protocol-Version` against `_meta["io.modelcontextprotocol/protocolVersion"]`, and validate `Mcp-Method` and `Mcp-Name` (HTTP 400, JSON-RPC `-32020` on mismatch; `-32022` with the supported list for an unsupported version);
- not issue or require `Mcp-Session-Id`;
- carry `resultType` and, on list results, `ttlMs` and `cacheScope`;
- replace session-scoped status with an explicit, provider-minted **status handle** returned by `prepare` and passed to `status` as an ordinary argument. A handle MUST be unguessable, signed or stored server-side, scoped to the orders that one call created, and expiring.

Operations that need a conversation's session (for example an in-chat payment tied to the conversation that saw the total) MAY be withheld from the modern profile; the hosted `approval_url` remains available to every client. MCP Tasks and multi-round-trip requests are OPTIONAL enhancements; status polling and `approval_url` MUST remain available.

See [docs/mcp-compatibility.md](docs/mcp-compatibility.md).

## 11. Follow-up actions

`status` MAY return `next_actions`: `{ action, title, prepare_args }` objects the agent can pass to `prepare`. They are drafts only; a follow-up MUST go through approval like any order.

## 12. Conformance

A provider claims a level only for tests actually run, and names it: `manifest` (discovery validates), `contract` (offline schemas and trace rules on its own captured envelopes), `sandbox-e2e` (its own test-mode journey, no real charges or execution), `independent-live` (read-only checks against production by a third party). The harness is in [`conformance/`](conformance/).

## 13. Versioning

`ilop_version` is `MAJOR.MINOR`. 0.x drafts may change. Adding optional fields does not change MAJOR. Schemas accept 0.1 manifests for migration.

## 14. Open questions for v0.3

- A signed-evidence profile reviewed by an independent cryptographer, and a reference verifier.
- Cross-provider account linking without a central identity provider.
- Whether a registry at ilop.ai adds value without becoming a gatekeeper.

Comments and proposals: open an issue in this repository.
