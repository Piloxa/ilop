// A minimal ILOP v0.2 adapter for an UNRELATED physical-world service: a same-day document
// courier ("courier.example"). It exists to show that ILOP does not depend on Piloxa, mail, or
// USPS: the same schemas and trace rules hold for a provider whose partner is a bike messenger
// and whose execution event is "picked up". No Piloxa code is imported.
//
// It is an in-memory simulation for the conformance runner. A real provider replaces the four
// functions marked PROVIDER with calls to its own systems and keeps the envelope logic.

import crypto from 'node:crypto';

const VERSION = '0.2';
const ACTION = 'courier.documents.same_day';
const now = () => '2026-11-17T16:00:00.000Z'; // fixed, so the runner is deterministic

// Provider state -> ILOP state. Unknown words map to null (OUTCOME_UNCERTAIN), never a guess.
const STATE = { draft: 'PREPARED', ready: 'AWAITING_APPROVAL', held: 'AUTHORIZED', dispatched: 'ACCEPTED', picked_up: 'EXECUTED', delivered: 'COMPLETED', refused: 'EXCEPTION', failed: 'FAILED', cancelled: 'CANCELLED' };
const FULFILLMENT = { PREPARED: 'NOT_SUBMITTED', AWAITING_APPROVAL: 'NOT_SUBMITTED', AUTHORIZED: 'NOT_SUBMITTED', ACCEPTED: 'PARTNER_ACCEPTED', EXECUTED: 'CARRIER_ACCEPTED', COMPLETED: 'DELIVERED', EXCEPTION: 'RETURNED', FAILED: 'NOT_SUBMITTED', CANCELLED: 'NOT_SUBMITTED' };
const MEANING = {
  QUOTED: 'A price only; no order exists.', PREPARED: 'Draft saved; something is missing.', AWAITING_APPROVAL: 'Ready for the person to approve on the courier page.',
  AUTHORIZED: 'Approved; card held, not charged; no rider assigned yet.', ACCEPTED: 'A rider accepted the job; the documents are not picked up yet.',
  EXECUTED: 'The rider picked up the documents; delivery not yet confirmed.', COMPLETED: 'Delivery was reported by the rider app.', EXCEPTION: 'Picked up but the recipient refused it.',
  FAILED: 'Nothing was picked up; any hold was released.', CANCELLED: 'Cancelled before pickup.'
};

let orders = new Map();
let jobs = 0;

export function ordersCreated() { return orders.size; }

export function manifest(base) {
  return {
    ilop_version: VERSION,
    spec_url: 'https://ilop.ai/SPEC.md',
    provider: { name: 'Example Courier', url: base },
    mcp: { url: `${base}/mcp`, auth: 'none', transport: 'streamable-http', protocol_versions: ['2026-07-28'] },
    service_areas: [{ country: 'US', regions: ['US-CA'] }],
    actions: [{ id: ACTION, title: 'Same-day document delivery', destination_countries: ['US'], proof_types: ['document_hash', 'pickup_scan', 'delivery_photo'], approval_mode: 'provider_hosted', human_approval_required: true, autonomous_execution: false, pricing: { mode: 'dynamic', quote_operation: 'quote', binding: 'the total on the approval page' } }],
    tools: { quote: 'courier_quote', prepare: 'courier_prepare', status: 'courier_status' },
    tool_annotations: { courier_quote: { readOnlyHint: true }, courier_prepare: { readOnlyHint: false }, courier_status: { readOnlyHint: true } },
    approval: { hosted_page: true, in_chat: [] },
    access: { full_address_in_status: false },
    features: { hosted_approval: true, in_chat_authorization: { listed: false }, cross_session_status: false, status_handles: true, signed_evidence: false, next_actions: false },
    policy: { autonomous_charge: false, autonomous_mailing: false, charge_timing: 'held at approval, captured when a rider accepts' },
    capability_revision: crypto.createHash('sha256').update(ACTION).digest('hex').slice(0, 16)
  };
}

function envelope(operation, order, extra = {}) {
  const state = order ? STATE[order.state] ?? null : 'QUOTED';
  const payment = order?.payment || 'NOT_CHARGED';
  const fulfillment = state ? FULFILLMENT[state] ?? 'NOT_SUBMITTED' : 'UNKNOWN';
  return {
    ilop_version: VERSION, operation, action: ACTION, order_id: order ? order.id : null, ilop_state: state, provider_state: order ? order.state : null,
    state_meaning: state ? MEANING[state] : 'Unknown provider state.', charged: payment === 'UNKNOWN' ? null : payment === 'CAPTURED',
    executed: fulfillment === 'UNKNOWN' ? null : ['EXECUTED', 'COMPLETED', 'EXCEPTION'].includes(state),
    payment_status: payment, fulfillment_status: fulfillment, requires_human_approval: true, approval_mode: 'provider_hosted',
    events: order ? order.events : [], evidence: order ? order.evidence : [], observed_at: now(), ...extra
  };
}

const partner = { system: 'rider_dispatch', third_party_authenticated: false };

// PROVIDER: price from the provider's own rate engine.
export function quote({ km }) { return envelope('quote', null, { quote: { currency: 'USD', total_cents: 900 + Math.round(km * 150), valid_until: null, binding: 'standard price; the approval page total is binding' } }); }

// PROVIDER: create a draft order. Never dispatches.
export function prepare({ documentBytes }) {
  const id = `ord_${orders.size + 1}`;
  const sha = crypto.createHash('sha256').update(documentBytes).digest('hex');
  const order = { id, state: 'ready', payment: 'NOT_CHARGED', events: [], evidence: [{ type: 'document_hash', claim: 'approved_document_digest', issuer: 'Example Courier', status: 'RECORDED', value: sha, source: { system: 'provider', third_party_authenticated: false } }] };
  orders.set(id, order);
  return envelope('prepare', order, { approval_url: `https://courier.example/approve/${id}` });
}

// PROVIDER: the person approved on the hosted page; the card is held; dispatch is attempted.
// `dispatch` returns 'accepted' or throws { timeout: true }.
function approveAndDispatch(id, dispatch) {
  const order = orders.get(id);
  if (order.state !== 'ready') return envelope('status', order, { replayed: true });
  order.state = 'held'; order.payment = 'AUTHORIZED_NOT_CAPTURED';
  try {
    jobs += 1;
    dispatch();
    order.state = 'dispatched'; order.payment = 'CAPTURED';
    order.events.push({ event_type: 'PARTNER_ACCEPTED', source: { ...partner, reported_by: 'partner', source_reference: 'job-1' }, occurred_at: now() });
  } catch (error) {
    if (error.timeout) { order.uncertain = true; }
  }
  return status(id);
}

// PROVIDER: status from the provider's records.
export function status(id) {
  const order = orders.get(id);
  const body = envelope('status', order);
  if (order.uncertain && order.state === 'held') {
    body.fulfillment_status = 'UNKNOWN'; body.executed = null;
    body.state_meaning = 'The dispatch service may have taken the job but did not confirm. Do not retry.';
    body.error = { code: 'OUTCOME_UNCERTAIN', human_message: body.state_meaning, retryable: false, safe_next_action: 'Check status later.', side_effect_status: 'payment_held_fulfillment_unknown', correlation_id: 'corr_courier_1', observed_at: now() };
  }
  return body;
}

export function simulateJourney() {
  orders = new Map(); jobs = 0;
  const steps = [prepare({ documentBytes: 'Contract page 1' })];
  const id = steps[0].order_id;
  steps.push(approveAndDispatch(id, () => 'accepted'));
  const order = orders.get(id);
  order.state = 'picked_up'; order.events.push({ event_type: 'CARRIER_ACCEPTED', source: { ...partner, reported_by: 'partner' }, occurred_at: now() });
  steps.push(status(id));
  order.state = 'delivered'; order.events.push({ event_type: 'CARRIER_DELIVERED', source: { ...partner, reported_by: 'partner' }, occurred_at: null });
  steps.push(status(id));
  orders = new Map();
  return steps;
}

export function simulateTimeout() {
  orders = new Map(); jobs = 0;
  const { order_id: id } = prepare({ documentBytes: 'Notice' });
  const envelopeAfter = approveAndDispatch(id, () => { throw { timeout: true }; });
  // The agent retries: the order is no longer 'ready', so nothing is dispatched again.
  approveAndDispatch(id, () => 'accepted');
  const result = { envelope: envelopeAfter, jobsCreated: jobs };
  orders = new Map();
  return result;
}
