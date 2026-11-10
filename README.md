# ILOP — Intent Logistics Orders Protocol

**An open standard for how AI agents turn a person's intent into a completed real-world order, and prove it was done.**

ILOP sits on top of [MCP](https://modelcontextprotocol.io). MCP defines how an assistant talks to a service. ILOP defines what a trustworthy real-world order looks like once it does: quote, prepare, approve and pay, carry out, track, prove, repeat.

- **Spec:** [SPEC.md](SPEC.md) (draft v0.1)
- **Discovery file schema:** [schema/ilop-manifest.schema.json](schema/ilop-manifest.schema.json)
- **Example:** [examples/ilop.json](examples/ilop.json)
- **Website:** [ilop.ai](https://ilop.ai)
- **Reference implementation:** [Piloxa](https://piloxa.com), USPS Certified Mail for AI assistants

## The promises every ILOP provider makes

1. Nothing is done or charged without the person's explicit yes to the exact total.
2. A changed price, document or destination cancels that yes.
3. Retrying never charges twice.
4. Nobody says "sent" or "done" before the fulfillment partner has accepted the job.
5. Every answer says plainly whether money was taken and whether the work happened.
6. Every completed order comes with proof a third party can check.

## What ILOP is not

ILOP does not define payments. It works with whichever agent-payment method the assistant supports (the Agentic Commerce Protocol, AP2, Stripe shared payment tokens) or with a provider-hosted approval page.

## Licence

Specification text: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Schemas and examples: [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0). See [LICENSE.md](LICENSE.md).
