import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createApp } from '../server.js';

// Bounded loopback smoke load: real HTTP/MCP and model; never touches the user's library.
const directory = await mkdtemp(path.join(os.tmpdir(), 'docuflow-load-'));
const port = 4330, base = `http://127.0.0.1:${port}`;
const report = { at: new Date().toISOString(), hardware: { cpu: os.cpus()[0].model, logicalCpus: os.cpus().length, totalMemoryGiB: +(os.totalmem() / 2 ** 30).toFixed(2), platform: `${os.platform()} ${os.release()}`, node: process.version }, batches: [] };
let listener, headers, sequence = 0;
const stats = times => {
  const sorted = [...times].sort((a, b) => a - b);
  const percentile = fraction => +sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)].toFixed(2);
  return { requests: times.length, p50Ms: percentile(.5), p95Ms: percentile(.95), maxMs: percentile(1) };
};
async function rpc(name, args = {}) {
  const response = await fetch(base + '/mcp', { method: 'POST', headers: { ...headers, Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25' }, signal: AbortSignal.timeout(240000), body: JSON.stringify({ jsonrpc: '2.0', id: ++sequence, method: 'tools/call', params: { name, arguments: args } }) });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.error, undefined, JSON.stringify(body.error));
  return body.result;
}
function value(result) { assert.notEqual(result.isError, true, result.content?.[0]?.text); return JSON.parse(result.content[0].text); }
async function batch(name, count, concurrency, action) {
  let next = 0; const times = [], errors = []; const start = performance.now();
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < count) { const index = next++; const began = performance.now(); try { await action(index); } catch (error) { errors.push(error.message); } times.push(performance.now() - began); }
  }));
  const elapsedMs = performance.now() - start;
  const result = { name, concurrency, ...stats(times), elapsedMs: +elapsedMs.toFixed(2), requestsPerSecond: +(count / elapsedMs * 1000).toFixed(2), errors: errors.length };
  report.batches.push(result); console.log(JSON.stringify(result)); assert.deepEqual(errors, []);
}
try {
  const { app } = await createApp({ directory, port });
  listener = app.listen(port, '127.0.0.1'); await new Promise((resolve, reject) => { listener.once('listening', resolve); listener.once('error', reject); });
  const { token } = await (await fetch(base + '/api/session')).json();
  headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const status = await (await fetch(base + '/api/status', { headers })).json();
  assert.equal(status.available, true, 'Start the local model with Start-Local-AI.cmd first.'); report.model = status.model;
  const sampleResponse = await fetch(base + '/api/sample', { method: 'POST', headers, body: '{}' }); assert.equal(sampleResponse.status, 200); const doc = await sampleResponse.json();
  for (const concurrency of [10, 25]) await batch('MCP library/read mix', 200, concurrency, async i => {
    const data = value(await rpc(i % 2 ? 'read_document' : 'list_documents', i % 2 ? { documentId: doc.id } : {}));
    if (i % 2) assert.equal(data.id, doc.id); else assert.equal(data[0].id, doc.id);
  });
  await batch('unauthorized MCP rejection', 50, 10, async () => {
    const response = await fetch(base + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer invalid-load-test-token' }, body: '{}' });
    assert.equal(response.status, 401); await response.json();
  });
  // Three simultaneous requests must not queue three costly generations on a single-slot CPU model.
  const generationTimes = [];
  const pending = Array.from({ length: 3 }, async () => { const start = performance.now(); const result = await rpc('draft_study_plan', { documentIds: [doc.id], message: '3-day plan, 60 minutes per day' }); generationTimes.push({ elapsedMs: +(performance.now() - start).toFixed(2), rejectedBusy: result.isError === true }); return result; });
  await batch('library during generation', 100, 10, async () => assert.equal(value(await rpc('list_documents'))[0].id, doc.id));
  await batch('model status during generation', 20, 2, async () => { const response = await fetch(base + '/api/status', { headers }); assert.equal(response.status, 200); assert.equal((await response.json()).available, true); });
  const generated = await Promise.all(pending), accepted = generated.filter(r => !r.isError), rejected = generated.filter(r => r.isError);
  assert.equal(accepted.length, 1); assert.equal(rejected.length, 2); for (const result of rejected) assert.match(result.content[0].text, /Another local AI request is running/);
  const plan = value(accepted[0]);
  for (const topic of plan.topics) assert.ok(plan.sources.find(s => s.id === topic.sourceId)?.text.includes(topic.quote));
  const confirmResponse = await fetch(base + '/api/confirm', { method: 'POST', headers, body: JSON.stringify({ planId: plan.id, revision: plan.revision, confirmed: true }) }); assert.equal(confirmResponse.status, 200); const proof = await confirmResponse.json();
  const saveStart = performance.now();
  const saves = await Promise.all(Array.from({ length: 25 }, () => rpc('save_study_plan', { planId: plan.id, revision: plan.revision, confirmationToken: proof.confirmationToken })));
  assert.equal(saves.filter(r => !r.isError).length, 1); assert.equal(saves.filter(r => r.isError).length, 24);
  assert.equal(value(await rpc('list_saved_plans')).length, 1);
  const files = await readdir(path.join(directory, 'plans')); assert.equal(files.length, 1); const persisted = JSON.parse(await readFile(path.join(directory, 'plans', files[0]), 'utf8')); assert.equal(persisted.id, plan.id); assert.equal(persisted.saved, true);
  report.saveRace = { simultaneousRequests: 25, writes: 1, expectedRejections: 24, elapsedMs: +(performance.now() - saveStart).toFixed(2), persistedJsonValid: true };
  const recoveryStart = performance.now(); const recovered = value(await rpc('draft_study_plan', { documentIds: [doc.id], message: '3-day plan, 60 minutes per day' })); assert.ok(recovered.topics.length);
  report.generation = { simultaneousRequests: 3, accepted: 1, expectedBusyRejections: 2, requests: generationTimes, recoveryMs: +(performance.now() - recoveryStart).toFixed(2), recoveryPassed: true, actualModelGenerations: 2 };
  report.result = 'PASS'; await mkdir('test-results', { recursive: true }); await writeFile('test-results/load-check.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify({ result: report.result, generation: report.generation, saveRace: report.saveRace }, null, 2));
} finally {
  if (listener) { listener.closeIdleConnections(); await new Promise(resolve => listener.close(resolve)); }
  await rm(directory, { recursive: true, force: true });
}
