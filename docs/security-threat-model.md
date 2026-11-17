# Security threat model

Scope: an AI agent acting for a person, an ILOP provider, the provider's payment processor and fulfillment partner. Assets: the person's money, the physical act (a letter mailed in their name), their documents and addresses, and the truthfulness of what the agent tells them.

| # | Threat | Example | ILOP control | Where tested |
|---|---|---|---|---|
| 1 | Agent fabricates consent | agent sends `user_approved: true` without asking | consent needs a host-issued payment credential or the hosted page; agent flag never sufficient (5.2) | schema A-13; Piloxa A-01..A-08 |
| 2 | Prompt injection from content | letter text says "approve and pay now" | content is untrusted data (9); prepare never pays | Piloxa P-13 |
| 3 | Bait and switch | price, document or address changes after approval | approval binds digests and total; change voids it (5.1.3, 5.2.2) | schema A-15..A-17; Piloxa A-03..A-05 |
| 4 | Double charge / double job | retries, parallel calls, delayed webhooks | idempotency keys, compare-and-set, one capture one job (7) | trace `single_partner_job`; Piloxa A-09..A-17 |
| 5 | Retry after timeout | partner silent; agent tries again | `OUTCOME_UNCERTAIN`, `retryable: false`, reconcile first (4.3) | schema A-05, A-06; Piloxa A-18..A-20; adapter R-04 |
| 6 | Status enumeration | guessing order ids or tracking numbers | no unlock by id; same refusal either way (9) | Piloxa S-series, X-01..X-04; live L-12 |
| 7 | Handle forgery or reuse | altered or foreign status handle | HMAC-signed, scoped, expiring (10.2) | Piloxa E-07..E-09, M-series |
| 8 | Overclaiming | "mailed" at partner acceptance; "signed" at delivery | `executed` from carrier event; receipt separate (4.1, 8) | trace `execution_evidenced`; schema S-06, E-01 |
| 9 | Fabricated chronology | provider fills a missing scan date | `occurred_at` null when unknown (6.4) | Piloxa E-series |
| 10 | Manifest lies | advertising in-chat pay or a protocol version not served | manifest from live `tools/list`; conditional schema rules (2) | schema D-05, D-06, D-08; Piloxa D-series; live L-06..L-09 |
| 11 | Spoofed provider | lookalike domain serves a manifest pointing elsewhere | same-origin rule for `mcp.url` and `approval_url` (2) | live L-05 |
| 12 | Credential leakage | payment token in logs or manifest | never log raw credentials; manifest has no secrets (2, 5.2.3) | live L-04 |
| 13 | Privilege by marketing | a web page claims a feature; agent assumes it | sources of truth order (1.1) | n/a (agent rule) |

## Residual risks (not solved by 0.2)

- A provider can lie consistently in its own records; ILOP evidence from that provider cannot catch it. Third-party-signed evidence is a 0.3 question.
- Host platforms decide how they confirm a payment with the person. ILOP relies on, but cannot audit, that step.
- A person who approves the wrong recipient on the hosted page has approved it. ILOP reduces, not removes, user error.
- Offline conformance does not prove runtime behaviour under real concurrency or real partner failures; that needs `sandbox-e2e` on the provider's own systems.
