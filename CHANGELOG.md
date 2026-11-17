# Changelog

## 0.2 — 2026-11-17 (draft)

0.2 turns the 0.1 outline into a contract that can be tested. Every MUST in [SPEC.md](SPEC.md) is either enforced by a schema in [`schema/`](schema/), checked by a trace rule in [`conformance/runner/trace-rules.mjs`](conformance/runner/trace-rules.mjs), or listed as untestable offline in [docs/conformance-matrix.md](docs/conformance-matrix.md).

### Breaking

- **`executed` no longer means "the provider sent it to the partner".** 0.1 mapped Piloxa's `mailed` to `executed`. That was wrong: Piloxa says `mailed: true` once the printer accepts the job, before USPS has scanned anything. In 0.2, `executed` is `true` only when the action's execution event (for mail, the carrier's acceptance scan) appears in `events`. An `ACCEPTED` order has `executed: false`.
- **`order_id` is stable from `prepare` onwards** and is `null` for `quote` and `check`. 0.1 let a provider return a different id at status. The provider's own job id goes in the new optional `provider_reference`.
- **`OUTCOME_UNCERTAIN` moved from `failure.code` to `error.code`**, inside a typed error object (`code`, `human_message`, `retryable`, `safe_next_action`, `side_effect_status`, `correlation_id`, `observed_at`). `retryable` MUST be `false`.
- **`user_approved: true` is never sufficient on its own.** 0.1 required it; 0.2 still requires it but says it is not evidence of consent. In-chat authorization needs a payment credential the host issued after its own confirmation step (section 5.2).
- **The manifest requires `mcp.protocol_versions`, `tool_annotations` and `capability_revision`** for `ilop_version: "0.2"`. 0.1 manifests still validate as 0.1.
- **`authorize` moved from SHOULD to MAY.** A hosted approval page is a complete implementation. Advertising `authorize` or `approval.in_chat` when the tool is not served is invalid.

### Added

- Separate `payment_status` and `fulfillment_status` dimensions beside `ilop_state`; `charged` and `executed` are derived from them and may be `null` when the provider cannot tell.
- `ilop_state: null` with `provider_state` preserved for a provider state the mapping does not recognise.
- `EXCEPTION` and `COMPLETED` are final, as `FAILED` and `CANCELLED` were.
- Event provenance: `source.system`, `reported_by`, `relayed_by`, `third_party_authenticated`. `occurred_at` is the source's own time or `null`, never filled in.
- Proof `status` (`RECORDED`, `REPORTED`, `PENDING`, `NOT_AVAILABLE`, `AVAILABLE`, `REVOKED`); a `PENDING` item has no value. Optional detached Ed25519 signatures with a published key.
- Verifier results (`VALID_PROVIDER_ATTESTATION`, `SOURCE_UNVERIFIED`, ...) that never say "proven delivered" from the provider's own record.
- Approval record schema binding content digest, destination digest, service, total, currency, version, time and how the person was authenticated.
- Privacy rules: an order id, tracking number or verification code alone never unlocks status; same answer whether an order exists or not.
- MCP 2026-07-28 rules: stateless profile, provider-minted status handles in place of sessions, header validation.
- Conformance levels (`manifest`, `contract`, `sandbox-e2e`, `independent-live`) so a provider claims only what it ran.
- A conformance runner (117 offline cases), redacted example traces captured from the reference implementation, and a vendor-neutral reference adapter.

### Unchanged

The six steps (quote, prepare, approve, carry out, track, prove), the state names, `/.well-known/ilop.json` as the discovery path, and the rule that tools keep their provider names.

## 0.1 — 2026-11-07 (draft)

First public draft. Five operations, one state machine, a discovery file. Superseded by 0.2.
