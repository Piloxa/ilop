# ADR 0005: hosted approval is the baseline; in-chat authorization is optional

**Status:** accepted, 2026-11-17

**Context.** As of November 2026 the reference implementation has not observed any chat host supply a usable provider-scoped payment credential to its MCP server (ChatGPT's programme is invite-only; Claude does not offer one). Its in-chat tool is served but unused. An agent-supplied `user_approved: true` is not consent.

**Decision.** `authorize` moved from SHOULD to MAY. A provider with only a hosted approval page is fully conformant. A provider that serves `authorize` must advertise it with conditions, and must not advertise it otherwise.

**Consequences.** Every ILOP order can be approved by a real person on a page the provider controls, regardless of host.
