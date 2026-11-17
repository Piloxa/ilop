# ADR 0002: `executed` means the physical act is evidenced

**Status:** accepted, 2026-11-17 (reverses 0.1)

**Context.** 0.1 mapped Piloxa's `mailed` to `executed`. Piloxa sets `mailed` when the print partner accepts the job, before USPS has it. Agents told people "mailed" a day or more early.

**Decision.** `executed` is true only when the action's execution event (carrier acceptance for mail) is in `events`. Partner acceptance is `ACCEPTED`, `executed: false`.

**Consequences.** Providers keep their legacy flags beside the envelope. A trace rule (`execution_evidenced`) catches violations.
