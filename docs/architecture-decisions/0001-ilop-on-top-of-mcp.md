# ADR 0001: ILOP is a contract on top of MCP, not a new transport

**Status:** accepted, 2026-11-17

**Context.** Agents already speak MCP. Platforms already review MCP tools by name.

**Decision.** ILOP defines a discovery file, a state machine and objects carried inside MCP `structuredContent.ilop`. Providers keep their own tool names and map them in the manifest.

**Consequences.** No platform has to adopt a new protocol to use an ILOP provider. ILOP inherits MCP's version churn (see ADR 0004).
