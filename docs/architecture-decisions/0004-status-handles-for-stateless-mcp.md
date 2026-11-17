# ADR 0004: status handles replace sessions on MCP 2026-07-28

**Status:** accepted, 2026-11-17

**Context.** MCP 2026-07-28 removed `initialize` and `Mcp-Session-Id`. Session-scoped status ("letters this conversation prepared") has nothing to attach to. Status by order id alone would leak other people's orders.

**Decision.** `prepare` returns a provider-minted, signed, scoped, expiring `status_handle`; `status` requires it on the stateless profile. Session-bound operations (in-chat payment) may be withheld there; the hosted approval page works for everyone.

**Consequences.** Agents must keep the handle. Providers serve both MCP eras side by side.
