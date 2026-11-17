# Piloxa reference mapping

Piloxa (piloxa.com, USPS Certified Mail, operated by Decentralized Publishing LLC) is the reference implementation. This page says what it does, and how sure we are.

**Status: LIVE on piloxa.com since 2026-11-17 17:08 UTC** (Piloxa PR #191; all eight deployed files sha-matched to `main`). `https://piloxa.com/.well-known/ilop.json` answers 200 and validates against the v0.2 schema, and live tool results carry the `ilop` object. MCP 2026-07-28 is built but switched off, so the live manifest does not list it.

## Tools

| ILOP operation | Piloxa MCP tool | `readOnlyHint` | Notes |
|---|---|---|---|
| `quote` | `quote_certified_letter` | true | live price; stores nothing |
| `check` | `check_certified_letter` | true | page count, what is missing, price; stores nothing |
| `prepare` | `prepare_certified_letter` | false | creates an unsent draft and a review link; never prints, mails, charges or authorizes |
| `authorize` | `authorize_certified_letter` | false | served only while the owner's switch is on and only on legacy MCP; needs a host-issued Stripe shared payment token |
| `status` | `get_certified_letter_status` | true | same conversation, or a status handle on MCP 2026-07-28 |

## States

| Piloxa `transaction_state` | ILOP `ilop_state` | `fulfillment_status` | `executed` |
|---|---|---|---|
| `QUOTED` | `QUOTED` | `NOT_SUBMITTED` | false |
| `PREPARED` | `PREPARED` | `NOT_SUBMITTED` | false |
| `AWAITING_APPROVAL` | `AWAITING_APPROVAL` | `NOT_SUBMITTED` | false |
| `AUTHORIZED` | `AUTHORIZED` | `NOT_SUBMITTED`, or `UNKNOWN` when the printer did not confirm | false, or null |
| `VENDOR_ACCEPTED` | `ACCEPTED` | `PARTNER_ACCEPTED` | **false** (Piloxa's legacy `mailed` is true here; ILOP's `executed` is not) |
| `MAILED` | `EXECUTED` | `CARRIER_ACCEPTED` | true |
| `DELIVERED` | `COMPLETED` | `DELIVERED` | true |
| `RETURNED` | `EXCEPTION` | `RETURNED` | true |
| `FAILED` | `FAILED` | `NOT_SUBMITTED` | false |
| `CANCELLED` | `CANCELLED` | `NOT_SUBMITTED` | false |

Any other provider word yields `ilop_state: null` and `OUTCOME_UNCERTAIN`.

## Payment

| Piloxa `payment_status` | ILOP `payment_status` | `charged` |
|---|---|---|
| `NOT_CREATED`, `PENDING`, `RELEASED`, `CANCELED` | `NOT_CHARGED` | false |
| `AUTHORIZED` | `AUTHORIZED_NOT_CAPTURED` | false |
| `PAID` | `CAPTURED` | true |
| `FAILED` | `DECLINED` | false |
| `REFUNDED` | `REFUNDED` | true |
| anything else | `UNKNOWN` | null |

Charge timing (verified in code): the card is held at approval with manual capture, captured only after the printer (Click2Mail) accepts the job, released if the printer refuses. If the printer does not answer, the hold is kept, a reconciliation event is recorded, and no second job is ever submitted automatically.

**Known gap:** a refund issued later in Stripe is not written back to Piloxa's payment record, so a refunded letter still reads `CAPTURED`. Documented, not fixed.

## Evidence

| Item | Issuer | `third_party_authenticated` | Status |
|---|---|---|---|
| `document_hash` (SHA-256 of the approved PDF) | Piloxa | false | `RECORDED` |
| partner acceptance (an event, `PARTNER_ACCEPTED`, not an evidence item) | Click2Mail, relayed by Piloxa | false | in `events` |
| `verification_page` (redacted public statement at `/v/<code>.json`) | Piloxa | false | `AVAILABLE` |
| `certificate_of_mailing` (Evidence Pack only) | Piloxa | false | advertised; issued as a PDF with the record, not yet listed in the ILOP `evidence` array |
| `carrier_tracking` (USPS tracking number and scans) | Piloxa, relaying Click2Mail, relaying USPS | false | `REPORTED` when scanned, else absent |
| `return_receipt` (signature record) | Piloxa, relaying | false | `PENDING` with `value: null` until it arrives |

Piloxa has a separate signed proof log (Ed25519, key at `/.well-known/piloxa-proof-key.json`). It proves Piloxa made a statement, not that USPS did.

**Known gap:** the public verify page `/v/<code>.json` labels relayed USPS data `issued_by: "USPS"`. Under ILOP 0.2 the issuer is Piloxa. Noted for a later change; the ILOP envelope already reports it correctly.

## MCP versions

| Version | Status |
|---|---|
| 2025-06-18, 2025-03-26, 2024-11-05 | live, unchanged |
| 2026-07-28 | implemented behind the owner switch `mcp_2026_enabled`, **off by default**; the manifest lists it only while the switch is on |

On 2026-07-28 the session-only tools (`authorize_certified_letter`, `complete_checkout`, the My Letters tools) are not offered. The person pays on the review link.

## Switches (owner only, Revenue screen)

| Setting | Default | Effect when off |
|---|---|---|
| `ilop_manifest_enabled` | on | `/.well-known/ilop.json` returns 404 |
| `ilop_v02_fields_enabled` | on | tool results carry no `ilop` object; everything else unchanged |
| `mcp_2026_enabled` | off | 2026-style requests take the legacy path exactly as before |

The in-chat payment switch (`agent_payments_enabled`) is not touched by ILOP work.
