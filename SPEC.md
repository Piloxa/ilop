# ILOP v0.1 — Intent Logistics Orders Protocol

**Status:** Draft 0.1, 2026-11-07. May change without notice until 1.0.
**Reference implementation:** [Piloxa](https://piloxa.com) (USPS Certified Mail).

The key words MUST, MUST NOT, SHOULD and MAY are to be read as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## 1. Scope

ILOP defines how an AI agent places a real-world order on a person's behalf and how the provider proves it was carried out. It defines:

1. a discovery file,
2. five operations, exposed as [MCP](https://modelcontextprotocol.io) tools,
3. one order state machine,
4. common objects: Quote, Order, Approval, Event, Proof,
5. safety rules every provider follows.

ILOP does **not** define payment rails, identity or transport. Transport is MCP. Payment is either a provider-hosted approval page or an existing agent-payment protocol (for example the Agentic Commerce Protocol, AP2, or a Stripe shared payment token).

## 2. Discovery

A provider MUST publish `https://<domain>/.well-known/ilop.json`, valid against [`schema/ilop-manifest.schema.json`](schema/ilop-manifest.schema.json). See [`examples/ilop.json`](examples/ilop.json).

The `tools` object maps each ILOP operation to the provider's own MCP tool name, so a provider never has to rename tools that platforms have already reviewed.

## 3. Operations

| Operation | Required | Purpose | Side effects |
|---|---|---|---|
| `quote` | MUST | Exact all-in price for an action and its options | None (read-only) |
| `check` | MAY | Validates a draft, lists what is missing, prices it | None (read-only) |
| `prepare` | MUST | Creates an order awaiting approval and returns `approval_url` | Nothing charged, nothing executed |
| `authorize` | SHOULD | Approval and payment inside the conversation for a prepared order | Holds payment; charges on acceptance |
| `status` | MUST | Current state, events and proof of an order | None (read-only) |

Read-only operations MUST declare MCP `readOnlyHint: true`.

Every operation result MUST include:

- `ilop_state` — one of the states in section 4,
- `charged` — boolean, whether money has been taken,
- `executed` — boolean, whether the physical act has happened,
- `state_meaning` — one sentence, written for a person.

## 4. Order states

| State | Meaning |
|---|---|
| `QUOTED` | A price only; no order exists. |
| `PREPARED` | The order exists; something is still missing. |
| `AWAITING_APPROVAL` | Complete; only the person's approval and payment remain. |
| `AUTHORIZED` | Approved; payment held; the job is being handed to the fulfillment partner. |
| `ACCEPTED` | The fulfillment partner accepted the job. |
| `EXECUTED` | The physical act happened (handed to the carrier, filed, served). |
| `COMPLETED` | The outcome was recorded (delivered, signed, stamped). |
| `EXCEPTION` | Executed but did not reach the outcome; `reason` says why. |
| `FAILED` | Did not execute; `refund` says what happened to the money. |
| `CANCELLED` | Stopped before execution. |

States only move forward. `FAILED` and `CANCELLED` are final.

An agent MUST NOT tell the person the order was placed, sent or done before `ACCEPTED`.

## 5. Safety rules

1. **Human approval.** `authorize` MUST require `user_approved: true` and the exact `expected_total_cents`, and SHOULD record `approval_statement`, the words the person said yes to. Without an in-chat payment credential the provider MUST return `approval_url` and charge nothing.
2. **Binding.** If the price, the content fingerprint (`content_sha256`) or the destination changed since approval, the provider MUST charge nothing and require a new approval.
3. **Idempotency.** `authorize` MUST take an `idempotency_key`. Repeating a key MUST NOT charge again and MUST return the earlier result with `replayed: true`. Repeating a key with different contents MUST be refused.
4. **Charge on acceptance.** Providers SHOULD hold payment and capture it only at `ACCEPTED`, releasing the hold if the partner refuses.
5. **Uncertain outcome.** If the provider cannot tell whether the partner accepted, it MUST return `failure.code: "OUTCOME_UNCERTAIN"`. The agent MUST then call `status` and MUST NOT retry `authorize`.
6. **Plain truth.** Every result carries `ilop_state`, `charged`, `executed` and `state_meaning`.
7. **No account to look.** `quote`, `check` and opening `approval_url` MUST NOT require an account.

## 6. Objects

- **Quote:** `action`, `options`, `total_cents`, `currency`, `breakdown` (partner cost and service fee), `valid_until`.
- **Order:** `order_id`, `reference` (human-readable), `ilop_state`, `action`, `destination` (redacted in status replies), `content_sha256`, `total_cents`, `approval_url`.
- **Approval:** `expected_total_cents`, `approval_statement`, `approved_at`, `channel` (`hosted_page` or `in_chat`), `payment_method` (`acp`, `ap2`, `stripe_shared_payment_token`, `card`).
- **Event:** `at`, `ilop_state`, `source` (`provider`, `partner` or `carrier`), `detail`.
- **Proof:** `type` (one of the action's `proof_types`), `issued_by`, `at`, `value` (for example a tracking number), `url`, `content_sha256`, `verify_url`. A proof SHOULD be checkable by a third party without signing in.

## 7. Follow-up actions

`status` MAY return `next_actions`, a list of `{ "action", "title", "prepare_args" }` objects the agent can pass straight to `prepare`. Example: a final notice offered after a reply-by date passes with no answer.

## 8. Privacy and security

- `status` MUST NOT return a full destination address to an anonymous caller.
- Without sign-in, `status` MUST only return orders created in the same conversation.
- Payment credentials MUST be limited to one order and its approved amount.

## 9. Versioning

`ilop_version` is `MAJOR.MINOR`. 0.x drafts may change. Adding optional fields does not change MAJOR.

## 10. Reference implementation mapping (Piloxa)

| ILOP | Piloxa today |
|---|---|
| `quote` / `check` / `prepare` / `authorize` / `status` | `quote_certified_letter` / `check_certified_letter` / `prepare_certified_letter` / `authorize_certified_letter` / `get_certified_letter_status` |
| `order_id` | `mailing_id` |
| `executed` | `mailed` |
| `ilop_state` | `transaction_state` (`VENDOR_ACCEPTED`→`ACCEPTED`, `MAILED`→`EXECUTED`, `DELIVERED`→`COMPLETED`, `RETURNED`→`EXCEPTION`; others identical) |
| `content_sha256` | `document_sha256` |
| `verify_url` | `https://piloxa.com/v/` |

Piloxa already enforces rules 1–7. Not yet published: `/.well-known/ilop.json`, the `ilop_state` and `executed` aliases, a `proof` list in `status`, and `next_actions`.

## 11. Open questions for v0.2

- Signed proofs, so a court or third party can trust a record without asking the provider.
- Status across conversations, with sign-in.
- A provider registry at ilop.ai, so agents can find who performs a given action in a given place.

Comments and proposals: open an issue in this repository.
