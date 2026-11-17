# MCP compatibility

ILOP rides on MCP. Two MCP eras are in use in November 2026, and a provider should serve both.

## Legacy: 2025-06-18 (and 2025-03-26, 2024-11-05)

- `initialize` handshake; the server issues `Mcp-Session-Id`.
- Status MAY be scoped to the session: an agent sees the orders its own conversation prepared.
- Nothing changes for these clients when a provider adopts ILOP 0.2: the `ilop` object is added inside `structuredContent`; existing fields keep their names and meanings.

## Modern: 2026-07-28 (stateless)

What changed in MCP, and what ILOP requires of a provider that lists this version:

| MCP 2026-07-28 | Provider behaviour |
|---|---|
| No `initialize`, no sessions | do not issue or require `Mcp-Session-Id` |
| Version in `_meta["io.modelcontextprotocol/protocolVersion"]` and the `MCP-Protocol-Version` header | both required and equal, else HTTP 400, JSON-RPC `-32020` |
| `Mcp-Method` header on every request; `Mcp-Name` on `tools/call`, `resources/read`, `prompts/get` (base64 sentinel `=?base64?...?=` allowed) | must match the body, else 400 / `-32020` |
| Unsupported version | 400 / `-32022` with `data.supported` |
| `server/discover` required | answer with supported versions, capabilities, instructions |
| `resultType` on results; `ttlMs`, `cacheScope` on lists | include them |
| Unknown method | 404 / `-32601` (`ping` and `initialize` are not methods here) |
| Cross-call state as explicit handles | see below |

### Status handles

Without a session, "the orders this conversation prepared" has no meaning. ILOP replaces it with a **status handle**: `prepare` returns `status_handle`; the agent passes it to `status` as an ordinary argument.

A handle MUST be:

- **unguessable** — signed (HMAC) or a random token stored server-side;
- **scoped** — to the orders that one `prepare` call created, nothing else;
- **expiring** — the reference implementation uses 90 days;
- **private** — it reveals status only, never an address or the document.

A missing, forged, expired or foreign handle gets `NOT_AUTHORIZED`, with the same answer whether the order exists or not. An order id, tracking number or verification code is never accepted in its place.

Reference format (Piloxa): `ilsh1.<base64url {a: attribution id, e: expiry}>.<base64url HMAC-SHA256>`. Other providers may use any format that meets the four rules.

### Session-bound operations

An in-chat payment must stay tied to the conversation that showed the person the total. A provider MAY withhold such operations from the stateless profile, as Piloxa does. The hosted `approval_url` works for every client.

## Advertising

List in `mcp.protocol_versions` only versions the endpoint actually serves and that passed your tests. Piloxa lists 2026-07-28 only while its owner switch is on.

## Optional

MCP Tasks and multi-round-trip requests are OPTIONAL in ILOP 0.2. Status polling and `approval_url` must remain available without them.
