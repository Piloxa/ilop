# ADR 0003: unknown is a value, never coerced

**Status:** accepted, 2026-11-17

**Context.** After a partner timeout the provider genuinely does not know whether the job exists. Reporting `false` invites a retry and a second job; reporting `true` is a false claim.

**Decision.** `charged` and `executed` may be `null`, `payment_status` and `fulfillment_status` may be `UNKNOWN`, and the envelope carries `OUTCOME_UNCERTAIN` with `retryable: false`. The agent calls `status`; the provider reconciles.

**Consequences.** Agents must handle a third value. Schemas forbid a definite boolean beside an unknown status.
