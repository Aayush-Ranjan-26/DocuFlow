import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createApp } from '../server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

test('real SDK client negotiates 2025-11-25 and executes the entire workflow over HTTP', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'docuflow-mcp-'));
  let listener, client;
  try {
    const generate = async (system, prompt) => ({ topics: JSON.parse(prompt).passages.map(p => ({ title: 'Verified topic', sourceId: p.id, quote: p.text.slice(0, 50) })) });
    const { app } = await createApp({ directory: dir, generate, port: 4328 });
    listener = app.listen(4328, '127.0.0.1'); await new Promise(resolve => listener.once('listening', resolve));
    const base = 'http://127.0.0.1:4328'; const { token } = await (await fetch(base + '/api/session')).json(); const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    assert.equal((await fetch(base + '/api/status')).status, 401);
    assert.equal((await fetch(base + '/api/session', { headers: { Origin: 'https://evil.invalid' } })).status, 403);
    const hostileHostStatus = await new Promise((resolve, reject) => { const request = http.get(base + '/api/session', { headers: { Host: 'evil.invalid' } }, response => { response.resume(); resolve(response.statusCode); }); request.on('error', reject); });
    assert.equal(hostileHostStatus, 403);
    const negotiation = await (await fetch(base + '/mcp', { method: 'POST', headers: { ...headers, Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'protocol-test', version: '1' } } }) })).json();
    assert.equal(negotiation.result.protocolVersion, '2025-11-25');
    const doc = await (await fetch(base + '/api/documents?name=syllabus.txt', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/octet-stream' }, body: 'Evaluation\nLearn precision, recall and F1 for imbalanced classes.' })).json();
    client = new Client({ name: 'integration-test', version: '1.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(base + '/mcp'), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
    assert.equal(client.getServerVersion().name, 'docuflow-study-coach');
    const tools = await client.listTools(); assert.equal(tools.tools.length, 6);
    const call = async (name, args) => { const r = await client.callTool({ name, arguments: args }); assert.notEqual(r.isError, true, JSON.stringify(r)); return JSON.parse(r.content[0].text); };
    assert.equal((await call('list_documents', {})).length, 1);
    assert.equal((await call('read_document', { documentId: doc.id })).name, 'syllabus.txt');
    for (const ext of ['pdf', 'docx']) {
      const response = await fetch(base + `/api/documents?name=Evaluation-Notes.${ext}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/octet-stream' }, body: await readFile(new URL(`../samples/Evaluation-Notes.${ext}`, import.meta.url)) });
      assert.equal(response.status, 201);
      const imported = await response.json();
      assert.ok((await call('read_document', { documentId: imported.id })).sections.some(s => s.text.includes('precision')));
    }
    assert.equal((await call('list_documents', {})).length, 3);
    let plan = await call('draft_study_plan', { documentIds: [doc.id], message: '3-day plan, 60 minutes per day' });
    plan = await call('revise_study_plan', { planId: plan.id, message: '45 minutes tomorrow' }); assert.equal(plan.days[1].budget, 45);
    const denied = await client.callTool({ name: 'save_study_plan', arguments: { planId: plan.id, revision: plan.revision, confirmationToken: '00000000-0000-4000-8000-000000000000' } }); assert.equal(denied.isError, true);
    const proof = await (await fetch(base + '/api/confirm', { method: 'POST', headers, body: JSON.stringify({ planId: plan.id, revision: plan.revision, confirmed: true }) })).json();
    assert.equal((await call('save_study_plan', { planId: plan.id, revision: plan.revision, confirmationToken: proof.confirmationToken })).saved, true);
    assert.equal((await call('list_saved_plans', {})).length, 1);
    assert.equal((await fetch(base + '/mcp', { headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' } })).status, 405);
  } finally { if (client) await client.close(); if (listener) await new Promise(resolve => listener.close(resolve)); await rm(dir, { recursive: true, force: true }); }
});
