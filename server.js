import express from 'express';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { Coach, modelStatus } from './lib/coach.js';
import { extractDocument } from './lib/documents.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
export async function createApp({ directory = process.env.DATA_DIR || path.join(ROOT, 'data'), generate, port = Number(process.env.PORT || 4317) } = {}) {
  const coach = new Coach(directory, generate); await coach.init();
  const token = randomBytes(32).toString('hex');
  const app = express(); app.disable('x-powered-by');
  app.use((req, res, next) => {
    const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    if (!allowedHosts.includes(req.headers.host)) return res.status(403).json({ error: 'Untrusted Host.' });
    const origin = req.headers.origin;
    if (origin && !allowedHosts.map(h => `http://${h}`).includes(origin)) return res.status(403).json({ error: 'Untrusted Origin.' });
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
    next();
  });
  app.get('/api/session', (req, res) => res.json({ token }));
  app.use(['/api', '/mcp'], (req, res, next) => req.headers.authorization === `Bearer ${token}` ? next() : res.status(401).json({ error: 'Open the application to initialize a local session.' }));
  app.post('/api/documents', express.raw({ type: 'application/octet-stream', limit: '10mb' }), async (req, res, next) => {
    try { const doc = await extractDocument(req.body, req.query.name || 'document.txt'); await coach.addDocument(doc); res.status(201).json({ id: doc.id, name: doc.name }); } catch (error) { next(error); }
  });
  app.use(express.json({ limit: '64kb' }));
  app.get('/api/status', async (req, res) => res.json({ ...(await modelStatus()), protocol: '2025-11-25', localOnly: true }));
  app.post('/api/sample', async (req, res, next) => { try {
    const name = 'Machine-Learning-Syllabus.txt';
    let doc = [...coach.documents.values()].find(d => d.name === name);
    if (!doc) { doc = await extractDocument(await readFile(path.join(ROOT, 'samples', name)), name); await coach.addDocument(doc); }
    res.json({ id: doc.id, name: doc.name });
  } catch (e) { next(e); } });
  app.post('/api/confirm', (req, res, next) => { try {
    const input = z.object({ planId: z.string().uuid(), revision: z.number().int(), confirmed: z.literal(true) }).parse(req.body);
    res.json({ confirmationToken: coach.confirmation(input.planId, input.revision) });
  } catch (e) { next(e); } });

  function mcpServer() {
    const server = new McpServer({ name: 'docuflow-study-coach', version: '1.0.0' });
    const output = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
    const run = fn => async args => { try { return output(await fn(args)); } catch (e) { return { isError: true, content: [{ type: 'text', text: e.message }] }; } };
    server.registerTool('list_documents', { description: 'List the local document library; does not send documents to a cloud service.', inputSchema: {} }, run(() => coach.listDocuments()));
    server.registerTool('read_document', { description: 'Read one selected document with source section labels.', inputSchema: { documentId: z.string().uuid() } }, run(({ documentId }) => coach.getDocuments([documentId])[0]));
    server.registerTool('draft_study_plan', { description: 'Use a local language model to extract cited study topics, then schedule a draft. Does not save.', inputSchema: { documentIds: z.array(z.string().uuid()).min(1).max(5), message: z.string().min(1).max(1000) } }, run(({ documentIds, message }) => coach.draft(documentIds, message)));
    server.registerTool('revise_study_plan', { description: 'Revise time budgets on a draft or last saved revision. Say 45 minutes tomorrow or 30 minutes on day 3. Does not save.', inputSchema: { planId: z.string().uuid(), message: z.string().min(1).max(1000), revision: z.number().int().min(1).optional() } }, run(({ planId, message, revision }) => coach.revise(planId, message, revision)));
    server.registerTool('save_study_plan', { description: 'Persist a plan ONLY after explicit confirmation in the UI. A fresh one-use token bound to this revision is required.', inputSchema: { planId: z.string().uuid(), revision: z.number().int().min(1), confirmationToken: z.string().uuid() } }, run(({ planId, revision, confirmationToken }) => coach.save(planId, revision, confirmationToken)));
    server.registerTool('list_saved_plans', { description: 'List saved plans after a server restart.', inputSchema: {} }, run(() => [...coach.savedPlans.values()]));
    return server;
  }
  app.post('/mcp', async (req, res) => {
    const server = mcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { transport.close(); server.close(); });
    try { await server.connect(transport); await transport.handleRequest(req, res, req.body); }
    catch { if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', id: req.body?.id ?? null, error: { code: -32603, message: 'MCP request failed.' } }); }
  });
  app.get('/mcp', (req, res) => res.status(405).json({ error: 'This server uses JSON responses; no standalone SSE stream.' }));
  app.delete('/mcp', (req, res) => res.status(405).json({ error: 'Stateless transport has no session to delete.' }));
  app.use(express.static(path.join(ROOT, 'public')));
  app.use((error, req, res, next) => { if (!res.headersSent) res.status(error.type === 'entity.too.large' ? 413 : 400).json({ error: error.type === 'entity.too.large' ? 'File too large (10 MB maximum).' : error.message || 'Request failed.' }); });
  return { app, coach, token };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4317);
  const { app } = await createApp({ port });
  app.listen(port, '127.0.0.1', () => console.log(`DocuFlow Study Coach: http://127.0.0.1:${port}`));
}
