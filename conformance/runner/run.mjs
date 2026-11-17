#!/usr/bin/env node
// ILOP v0.2 conformance runner.
//
//   node conformance/runner/run.mjs                 offline: schemas, examples, negative cases,
//                                                   trace rules, the reference adapter
//   node conformance/runner/run.mjs --live <origin> also reads a provider's live discovery file
//                                                   and calls ONLY its read-only MCP operations
//                                                   (tools/list, quote, check). It never calls
//                                                   prepare, authorize or anything that can
//                                                   charge or execute.
//   --json <file>                                   writes the pass/fail manifest by case id
//
// Exit code 0 only when every mandatory case passes.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { checkTrace, RULES } from './trace-rules.mjs';
import * as adapter from '../../reference-adapter/courier-adapter.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const liveOrigin = args.includes('--live') ? args[args.indexOf('--live') + 1] : null;
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;

const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, strictTypes: false, allowUnionTypes: true });
addFormats(ajv);
const schemaDir = path.join(ROOT, 'schema');
for (const file of fs.readdirSync(schemaDir).filter(name => name.endsWith('.json'))) {
  ajv.addSchema(JSON.parse(fs.readFileSync(path.join(schemaDir, file), 'utf8')), file);
}
const validator = name => {
  const found = ajv.getSchema(`https://ilop.ai/schema/${name}`);
  if (!found) throw new Error(`no schema ${name}`);
  return found;
};

const results = [];
function record(id, group, title, ok, detail = '') {
  results.push({ id, group, title, ok, detail });
}
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
function pointerParts(pointer) { return pointer.split('/').slice(1).map(part => part.replace(/~1/g, '/').replace(/~0/g, '~')); }
function getAt(object, pointer) { return pointerParts(pointer).reduce((node, key) => (node == null ? undefined : node[key]), object); }
function setAt(object, pointer, value) {
  const parts = pointerParts(pointer);
  let node = object;
  for (const key of parts.slice(0, -1)) { if (node[key] === undefined) node[key] = {}; node = node[key]; }
  node[parts[parts.length - 1]] = value;
}
function deleteAt(object, pointer) {
  const parts = pointerParts(pointer);
  const parent = parts.slice(0, -1).reduce((node, key) => node[key], object);
  if (Array.isArray(parent)) parent.splice(Number(parts[parts.length - 1]), 1); else delete parent[parts[parts.length - 1]];
}

// 1. Every schema compiles (strict mode), and every example names a schema that accepts it.
for (const file of fs.readdirSync(schemaDir).filter(name => name.endsWith('.json'))) {
  let ok = true; let detail = '';
  try { validator(file); } catch (error) { ok = false; detail = error.message; }
  record(`SCHEMA:${file}`, 'schema', `${file} compiles as JSON Schema 2020-12 (strict)`, ok, detail);
}

// 2. Offline schema cases (positive and negative).
const { cases } = read('conformance/cases/schema-cases.json');
for (const item of cases) {
  let data = clone(read(item.file));
  if (item.pointer) data = clone(getAt(data, item.pointer));
  for (const pointer of item.delete || []) deleteAt(data, pointer);
  for (const [pointer, value] of Object.entries(item.patch || {})) setAt(data, pointer, value);
  const validate = validator(item.schema);
  const valid = validate(data);
  const ok = item.expect === 'valid' ? valid : !valid;
  record(item.id, item.group, item.title, ok, ok ? '' : (valid ? 'accepted but should be refused' : ajv.errorsText(validate.errors)));
}

// 3. Trace rules: one order's observed envelopes, oldest first.
const traceDir = path.join(ROOT, 'conformance/fixtures/traces');
for (const file of fs.readdirSync(traceDir).filter(name => name.endsWith('.json')).sort()) {
  const fixture = JSON.parse(fs.readFileSync(path.join(traceDir, file), 'utf8'));
  const result = validator('ilop-result.schema.json');
  const schemaOk = fixture.trace.every(step => result(step));
  const violations = checkTrace(fixture.trace);
  let ok;
  if (fixture.expect === 'valid') ok = schemaOk && violations.length === 0;
  else ok = violations.some(violation => violation.rule === fixture.violates);
  record(fixture.id, 'trace', fixture.title, ok, ok ? '' : `schema ${schemaOk ? 'ok' : 'failed'}; violations: ${JSON.stringify(violations)}`);
}

// 4. Every example envelope obeys the trace rules on its own.
for (const file of fs.readdirSync(path.join(ROOT, 'examples')).filter(name => /^(quote|check|prepare|authorize|status|outcome)/.test(name))) {
  const violations = checkTrace([read(`examples/${file}`)]);
  record(`EX:${file}`, 'examples', `${file} obeys every trace rule`, violations.length === 0, JSON.stringify(violations));
}

// 5. Vendor neutrality: an unrelated provider (a courier) maps to the same schemas unchanged.
{
  const manifest = adapter.manifest('https://courier.example');
  const valid = validator('ilop-manifest.schema.json')(manifest);
  record('R-01', 'reference-adapter', 'courier adapter manifest validates with no Piloxa-specific fields', valid, ajv.errorsText(validator('ilop-manifest.schema.json').errors));
  const journey = adapter.simulateJourney();
  record('R-02', 'reference-adapter', 'courier journey: every envelope validates', journey.every(step => validator('ilop-result.schema.json')(step)), '');
  record('R-03', 'reference-adapter', 'courier journey obeys every trace rule', checkTrace(journey).length === 0, JSON.stringify(checkTrace(journey)));
  const uncertain = adapter.simulateTimeout();
  record('R-04', 'reference-adapter', 'courier timeout is OUTCOME_UNCERTAIN with executed null, and a retry makes no second job', uncertain.envelope.error?.code === 'OUTCOME_UNCERTAIN' && uncertain.envelope.executed === null && uncertain.jobsCreated === 1, JSON.stringify(uncertain));
  const quote = adapter.quote({ km: 5 });
  record('R-05', 'reference-adapter', 'courier quote creates no order', validator('ilop-result.schema.json')(quote) && quote.order_id === null && adapter.ordersCreated() === 0, '');
}

// 6. Live, read-only.
async function live(origin) {
  const base = origin.replace(/\/$/, '');
  const response = await fetch(`${base}/.well-known/ilop.json`);
  record('L-01', 'live', `${base}/.well-known/ilop.json answers 200`, response.status === 200, `HTTP ${response.status}`);
  if (response.status !== 200) return;
  record('L-02', 'live', 'served as application/json', /^application\/json/.test(response.headers.get('content-type') || ''), response.headers.get('content-type'));
  const manifest = await response.json();
  const validManifest = validator('ilop-manifest.schema.json');
  record('L-03', 'live', 'live manifest validates', validManifest(manifest), ajv.errorsText(validManifest.errors));
  record('L-04', 'live', 'manifest names no secrets, ids or email addresses', !/sk_live|sk_test|whsec_|spt_|attr_|draft_[A-Za-z0-9]{6}|@[a-z0-9-]+\./i.test(JSON.stringify(manifest)), '');
  const mcpUrl = manifest.mcp.url;
  record('L-05', 'live', 'MCP endpoint is on the manifest origin', new URL(mcpUrl).hostname.replace(/^www\./, '') === new URL(base).hostname.replace(/^www\./, ''), mcpUrl);
  const post = (body, headers = {}) => fetch(mcpUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers }, body: JSON.stringify(body) });
  const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'ilop-conformance', version: '0.2' } } });
  const session = init.headers.get('mcp-session-id');
  const headers = session ? { 'Mcp-Session-Id': session } : {};
  const listed = (await (await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, headers)).json()).result.tools;
  const byName = new Map(listed.map(tool => [tool.name, tool]));
  const missing = Object.values(manifest.tools).filter(name => !byName.has(name));
  record('L-06', 'live', 'every mapped tool is served by tools/list', missing.length === 0, missing.join(', '));
  const mismatched = Object.entries(manifest.tool_annotations || {}).filter(([name, hints]) => byName.has(name) && Boolean(byName.get(name).annotations?.readOnlyHint) !== hints.readOnlyHint).map(([name]) => name);
  record('L-07', 'live', 'manifest annotations match tools/list', mismatched.length === 0, mismatched.join(', '));
  for (const op of ['quote', 'check', 'status']) {
    if (!manifest.tools[op]) continue;
    record(`L-08:${op}`, 'live', `${op} is annotated readOnlyHint true on the server`, byName.get(manifest.tools[op])?.annotations?.readOnlyHint === true, '');
  }
  if (!manifest.tools.authorize) record('L-09', 'live', 'authorize is not advertised and in-chat payment is empty', (manifest.approval.in_chat || []).length === 0, JSON.stringify(manifest.approval));
  else record('L-09', 'live', 'authorize is advertised with its conditions', manifest.features?.in_chat_authorization?.listed === true && Array.isArray(manifest.features.in_chat_authorization.conditions), '');
  const quote = (await (await post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: manifest.tools.quote, arguments: {} } }, headers)).json()).result;
  const ilopQuote = quote?.structuredContent?.ilop;
  const validResult = validator('ilop-result.schema.json');
  record('L-10', 'live', 'quote returns a valid ILOP envelope', Boolean(ilopQuote) && validResult(ilopQuote), ilopQuote ? ajv.errorsText(validResult.errors) : 'no structuredContent.ilop');
  record('L-11', 'live', 'quote creates no order and charges nothing', ilopQuote?.order_id === null && ilopQuote?.charged === false, '');
  if (manifest.tools.status) {
    const status = (await (await post({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: manifest.tools.status, arguments: { reference: 'act_guessed000000' } } }, {})).json()).result;
    record('L-12', 'live', 'status without a session shows nothing for a guessed reference', !status?.structuredContent || (status.structuredContent.found || 0) === 0, '');
  }
  if ((manifest.mcp.protocol_versions || []).includes('2026-07-28')) {
    const meta = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} };
    const discover = await post({ jsonrpc: '2.0', id: 5, method: 'server/discover', params: { _meta: meta } }, { 'MCP-Protocol-Version': '2026-07-28', 'Mcp-Method': 'server/discover' });
    const body = await discover.json();
    record('L-13', 'live', '2026-07-28 advertised: server/discover answers', discover.status === 200 && body.result?.supportedVersions?.includes('2026-07-28'), `HTTP ${discover.status}`);
    const mismatch = await post({ jsonrpc: '2.0', id: 6, method: 'tools/list', params: { _meta: meta } }, { 'MCP-Protocol-Version': '2026-07-28', 'Mcp-Method': 'resources/list' });
    record('L-14', 'live', '2026-07-28 advertised: header mismatch is refused with -32020', mismatch.status === 400 && (await mismatch.json()).error?.code === -32020, `HTTP ${mismatch.status}`);
  }
}

if (liveOrigin) {
  try { await live(liveOrigin); } catch (error) { record('L-ERR', 'live', `live run against ${liveOrigin}`, false, error.message); }
}

const failed = results.filter(item => !item.ok);
for (const item of results) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.id.padEnd(44)} ${item.title}${item.ok ? '' : `\n      ${item.detail}`}`);
const groups = {};
for (const item of results) { groups[item.group] = groups[item.group] || { pass: 0, fail: 0 }; groups[item.group][item.ok ? 'pass' : 'fail'] += 1; }
console.log('\nby group:', JSON.stringify(groups));
console.log(`\n${results.length} cases, ${results.length - failed.length} passed, ${failed.length} failed. Trace rules: ${RULES.join(', ')}.`);
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ ilop_version: '0.2', live: liveOrigin, ran_at: new Date().toISOString(), results }, null, 2));
process.exit(failed.length ? 1 : 0);
