// Rules a schema cannot express: they look at one order across time.
// Input: the ILOP envelopes an agent observed for ONE order, oldest first.

const RANK = { QUOTED: 0, PREPARED: 1, AWAITING_APPROVAL: 2, AUTHORIZED: 3, ACCEPTED: 4, EXECUTED: 5, COMPLETED: 6, EXCEPTION: 6, FAILED: 9, CANCELLED: 9 };
const TERMINAL = new Set(['COMPLETED', 'EXCEPTION', 'FAILED', 'CANCELLED']);

export const RULES = ['forward_only', 'terminal_final', 'payment_consistency', 'no_delivery_after_return', 'single_partner_job', 'execution_evidenced', 'stable_order_id'];

export function checkTrace(trace) {
  const violations = [];
  const add = (rule, index, detail) => violations.push({ rule, index, detail });
  let last = null;
  let lastExecuted = null;
  let orderId;
  trace.forEach((step, index) => {
    if (!step || !step.ilop_version || !('ilop_state' in step)) return; // a refusal carries no state
    const state = step.ilop_state;
    // Stable order id from prepare onwards (quotes and checks have none).
    if (step.order_id) {
      if (orderId && step.order_id !== orderId) add('stable_order_id', index, `${orderId} -> ${step.order_id}`);
      orderId = orderId || step.order_id;
    }
    if (state && last) {
      if (TERMINAL.has(last) && state !== last) add('terminal_final', index, `${last} -> ${state}`);
      else if (RANK[state] < RANK[last]) add('forward_only', index, `${last} -> ${state}`);
    }
    if (lastExecuted === true && step.executed === false) add('forward_only', index, 'executed true -> false');
    if (['CAPTURED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(step.payment_status) && step.charged !== true) add('payment_consistency', index, `${step.payment_status} with charged ${step.charged}`);
    if (['NOT_CHARGED', 'AUTHORIZED_NOT_CAPTURED', 'DECLINED'].includes(step.payment_status) && step.charged !== false) add('payment_consistency', index, `${step.payment_status} with charged ${step.charged}`);
    const events = Array.isArray(step.events) ? step.events : [];
    if (state === 'COMPLETED' && events.some(event => event.event_type === 'CARRIER_RETURNED')) add('no_delivery_after_return', index, 'COMPLETED with a CARRIER_RETURNED event');
    const jobs = new Set(events.filter(event => event.event_type === 'PARTNER_ACCEPTED').map(event => event.source?.source_reference ?? 'unnamed'));
    if (events.filter(event => event.event_type === 'PARTNER_ACCEPTED').length > 1 && jobs.size > 1) add('single_partner_job', index, `${jobs.size} partner jobs`);
    if (['EXECUTED', 'COMPLETED', 'EXCEPTION'].includes(state) && step.operation === 'status' && !events.some(event => String(event.event_type).startsWith('CARRIER_'))) add('execution_evidenced', index, `${state} without a carrier event`);
    if (state) last = state;
    if (step.executed !== null && step.executed !== undefined) lastExecuted = step.executed;
  });
  return violations;
}
