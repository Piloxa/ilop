#!/usr/bin/env python3
"""Rebuilds conformance/fixtures/traces/*.json from examples/ (run from the repo root).
The examples are envelopes captured from a local Piloxa test server; the invalid traces are
deliberate mutations of them, each breaking exactly one trace rule."""
import json, copy
L = lambda n: json.load(open('examples/' + n))
prep, acc, exe, dlv, ret, unc = (L(n) for n in ['prepare-response.json', 'status-accepted.json', 'status-executed.json', 'status-delivered.json', 'status-returned.json', 'status-unconfirmed.json'])
def w(name, obj): json.dump(obj, open('conformance/fixtures/traces/' + name, 'w'), indent=2); open('conformance/fixtures/traces/' + name, 'a').write('\n')
w('T-01-approved-journey.json', {"id": "T-01", "title": "prepare -> accepted -> executed -> delivered", "expect": "valid", "trace": [prep, acc, exe, dlv]})
w('T-02-returned-journey.json', {"id": "T-02", "title": "prepare -> accepted -> executed -> returned (EXCEPTION)", "expect": "valid", "trace": [prep, acc, exe, ret]})
w('T-03-uncertain-then-reconciled.json', {"id": "T-03", "title": "uncertain outcome, then reconciled as accepted", "expect": "valid", "trace": [prep, unc, acc]})
w('T-04-backwards.json', {"id": "T-04", "title": "state moves backwards", "expect": "invalid", "violates": "forward_only", "trace": [prep, exe, acc]})
w('T-05-after-terminal.json', {"id": "T-05", "title": "state changes after a terminal state", "expect": "invalid", "violates": "terminal_final", "trace": [prep, acc, exe, dlv, ret]})
x = copy.deepcopy(acc); x['charged'] = False
w('T-06-captured-not-charged.json', {"id": "T-06", "title": "CAPTURED but charged false", "expect": "invalid", "violates": "payment_consistency", "trace": [prep, x]})
x = copy.deepcopy(ret); x['ilop_state'] = 'COMPLETED'; x['fulfillment_status'] = 'DELIVERED'
w('T-07-returned-called-delivered.json', {"id": "T-07", "title": "COMPLETED although the carrier reported a return", "expect": "invalid", "violates": "no_delivery_after_return", "trace": [prep, acc, exe, x]})
x = copy.deepcopy(acc); dup = copy.deepcopy(x['events'][0]); dup['source']['source_reference'] = 'job-2'; x['events'].append(dup)
w('T-08-duplicate-partner-job.json', {"id": "T-08", "title": "two partner acceptances for one order", "expect": "invalid", "violates": "single_partner_job", "trace": [prep, x]})
x = copy.deepcopy(exe); x['events'] = [e for e in x['events'] if not e['event_type'].startswith('CARRIER')]
w('T-09-executed-without-carrier-event.json', {"id": "T-09", "title": "EXECUTED with no carrier event (fabricated handoff)", "expect": "invalid", "violates": "execution_evidenced", "trace": [prep, acc, x]})
w('T-10-delivered-receipt-pending-ok.json', {"id": "T-10", "title": "delivered while the signature record is still pending is truthful", "expect": "valid", "trace": [prep, acc, exe, dlv]})
x = copy.deepcopy(acc); x['order_id'] = 'draft_OTHER'
w('T-11-order-id-changes.json', {"id": "T-11", "title": "order_id changes mid-journey", "expect": "invalid", "violates": "stable_order_id", "trace": [prep, acc, x]})
x = copy.deepcopy(exe); x['executed'] = False; x['ilop_state'] = 'ACCEPTED'; x['fulfillment_status'] = 'PARTNER_ACCEPTED'
w('T-12-unexecuted.json', {"id": "T-12", "title": "executed goes from true back to false", "expect": "invalid", "violates": "forward_only", "trace": [prep, exe, x]})
