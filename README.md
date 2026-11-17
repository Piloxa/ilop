# ILOP — Intent Logistics Orders Protocol

**An open standard for how AI agents turn a person's intent into a completed real-world order, and prove it was done.**

ILOP sits on top of [MCP](https://modelcontextprotocol.io). MCP defines how an assistant talks to a service. ILOP defines what a trustworthy real-world order looks like once it does: quote, prepare, approve, carry out, track, prove.

- **Spec:** [SPEC.md](SPEC.md) (draft v0.2) · [CHANGELOG.md](CHANGELOG.md) · [MIGRATION-v0.1-to-v0.2.md](MIGRATION-v0.1-to-v0.2.md)
- **Schemas:** [schema/](schema/) (JSON Schema 2020-12)
- **Examples:** [examples/](examples/), captured from the reference implementation and redacted
- **Conformance harness:** [conformance/](conformance/) (`npm ci && npm test`, 117 offline cases)
- **Vendor-neutral adapter:** [reference-adapter/courier-adapter.mjs](reference-adapter/courier-adapter.mjs)
- **Docs:** [provider quickstart](docs/provider-quickstart.md) · [MCP compatibility](docs/mcp-compatibility.md) · [privacy and proof](docs/privacy-and-proof.md) · [threat model](docs/security-threat-model.md) · [conformance matrix](docs/conformance-matrix.md) · [decisions](docs/architecture-decisions/)
- **Reference implementation:** [Piloxa](https://piloxa.com), USPS Certified Mail · [what is live there](docs/piloxa-reference-mapping.md)
- **Website:** [ilop.ai](https://ilop.ai)

## The promises every ILOP provider makes

1. Nothing is done or charged without the person's own approval of the exact document, destination, service and total, on a page or credential the agent cannot fake.
2. A changed price, document or destination cancels that approval.
3. Retrying never charges twice or creates a second job. If the outcome is unknown, the provider says so and reconciles instead of retrying.
4. Nobody says "sent" before the partner accepted the job, or "mailed" before the carrier has it.
5. Every answer says separately whether money was taken and whether the work happened.
6. Every proof says who vouches for it. Missing evidence is reported as missing.
7. Status is never unlocked by an order number alone.

## What ILOP is not

ILOP does not define payments, identity or a registry. It works with a provider-hosted approval page (the baseline) or, optionally, a host-issued agent-payment credential.

## Licence

Specification text: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Schemas, examples and code: [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0). See [LICENSE.md](LICENSE.md).
