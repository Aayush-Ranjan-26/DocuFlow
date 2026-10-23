import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createApp } from '../server.js';

// This check intentionally uses the real local model, never an injected generator.
const directory = await mkdtemp(path.join(os.tmpdir(), 'docuflow-live-'));
const port = 4329, base = `http://127.0.0.1:${port}`;
let listener, client;
const evidence = { at: new Date().toISOString(), steps: [] };
try {
  const { app } = await createApp({ directory, port });
  listener = app.listen(port, '127.0.0.1'); await new Promise(resolve => listener.once('listening', resolve));
  const { token } = await (await fetch(base + '/api/session')).json();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const status = await (await fetch(base + '/api/status', { headers })).json();
  assert.equal(status.available, true, 'Start the local Qwen model using Ollama or Start-Local-AI.cmd.');
  evidence.model = status.model;
  client = new Client({ name: 'docuflow-live-check', version: '1.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(base + '/mcp'), { requestInit: { headers } }));
  const call = async (name, args = {}) => {
    const start = Date.now();
    const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 240000 });
    assert.notEqual(result.isError, true, JSON.stringify(result));
    evidence.steps.push({ tool: name, elapsedMs: Date.now() - start });
    return JSON.parse(result.content[0].text);
  };
  const doc = await (await fetch(base + '/api/sample', { method: 'POST', headers, body: '{}' })).json();
  let plan = await call('draft_study_plan', { documentIds: [doc.id], message: 'Build a 3-day plan, 60 minutes per day.' });
  assert.ok(plan.topics.length >= 1);
  for (const topic of plan.topics) assert.ok(plan.sources.find(s => s.id === topic.sourceId)?.text.includes(topic.quote));
  assert.deepEqual(plan.days.map(d => d.tasks.reduce((sum, task) => sum + task.minutes, 0)), [60, 60, 60]);
  plan = await call('revise_study_plan', { planId: plan.id, message: 'I only have 45 minutes tomorrow.' });
  assert.deepEqual(plan.days.map(d => d.budget), [60, 45, 60]);
  assert.equal((await call('list_saved_plans')).length, 0);
  const proof = await (await fetch(base + '/api/confirm', { method: 'POST', headers, body: JSON.stringify({ planId: plan.id, revision: plan.revision, confirmed: true }) })).json();
  plan = await call('save_study_plan', { planId: plan.id, revision: plan.revision, confirmationToken: proof.confirmationToken });
  assert.equal((await call('list_saved_plans'))[0].revision, 2);
  evidence.result = 'PASS'; evidence.plan = plan;
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/live-check.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ result: 'PASS', model: evidence.model, topics: plan.topics.length, budgets: plan.days.map(d => d.budget), steps: evidence.steps }, null, 2));
} finally {
  if (client) await client.close();
  if (listener) await new Promise(resolve => listener.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
