const $ = id => document.getElementById(id);
let token, requestId = 0, busy = false, plan = null, selected = new Set(), trace = [], savedPlans = [];
const text = (tag, value, className) => { const el = document.createElement(tag); el.textContent = value; if (className) el.className = className; return el; };

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Request failed.'); return data;
}
async function rpc(method, params, notification = false) {
  const start = performance.now();
  const payload = { jsonrpc: '2.0', method, params }; if (!notification) payload.id = ++requestId;
  const response = await fetch('/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25' }, body: JSON.stringify(payload) });
  let result;
  if (response.status !== 202) { const data = await response.json(); if (!response.ok || data.error) throw new Error(data.error?.message || 'MCP connection failed.'); result = data.result; }
  trace.push({ method: method === 'tools/call' ? `tools/call → ${params.name}` : method, time: Math.round(performance.now() - start), status: response.status }); renderTrace(); return result;
}
async function tool(name, args = {}) {
  const result = await rpc('tools/call', { name, arguments: args });
  if (result.isError) throw new Error(result.content[0].text);
  return JSON.parse(result.content[0].text);
}
function renderTrace() {
  $('protocol-log').replaceChildren(...trace.slice().reverse().map(row => { const el = text('div', row.method, 'protocol-entry'); el.append(text('span', ` · HTTP ${row.status} · ${row.time} ms`)); return el; }));
}
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; setTimeout(() => { $('toast').hidden = true; }, 4500); }
function message(content, role = 'coach', error = false) {
  const article = document.createElement('article'); article.className = `message ${role}${error ? ' error' : ''}`;
  const avatar = text('div', role === 'user' ? 'Y' : '✦', 'avatar'); const body = document.createElement('div'); body.append(text('span', role === 'user' ? 'YOU' : 'DOCUFLOW', 'message-name'), text('p', content)); article.append(avatar, body); $('messages').append(article); $('messages').scrollTop = $('messages').scrollHeight; return article;
}
function setBusy(value) { busy = value; $('send-button').disabled = value; $('message').disabled = value; $('save-button').disabled = value || !plan || plan.saved; $('file-input').disabled = value; document.querySelectorAll('[data-prompt]').forEach(b => { b.disabled = value || (b.id === 'revise-prompt' && !plan); }); $('sample-button').disabled = value; }
async function refreshLibrary() {
  const documents = await tool('list_documents'); $('document-count').textContent = documents.length;
  $('documents').replaceChildren(...documents.map(doc => {
    const label = document.createElement('label'); label.className = 'doc-item'; const box = document.createElement('input'); box.type = 'checkbox'; box.checked = selected.has(doc.id); box.setAttribute('aria-label', `Use ${doc.name}`); box.addEventListener('change', () => { box.checked ? selected.add(doc.id) : selected.delete(doc.id); });
    const info = document.createElement('span'); info.append(text('strong', doc.name), text('small', `${doc.sections} sections · ${(doc.chars / 1000).toFixed(1)}k characters`)); label.append(box, info); return label;
  }));
}
function showSource(task) {
  const source = plan.sources.find(s => s.id === task.sourceId); if (!source) return;
  $('source-title').textContent = `${source.document} · ${source.label}`; $('source-quote').textContent = task.quote; $('source-text').textContent = source.text; $('source-dialog').showModal();
}
function renderPlan() {
  if (!plan) return; $('plan-content').replaceChildren();
  const total = plan.days.reduce((sum, d) => sum + d.budget, 0);
  $('plan-content').append(text('p', `${plan.topics.length} source-checked topics · Revision ${plan.revision} · ${plan.engine}\nScope: first ${plan.sources.length} passages (16 maximum). Review coverage.`, 'plan-intro'));
  for (const day of plan.days) {
    const card = document.createElement('section'); card.className = 'day-card'; const heading = text('div', `Day ${day.day}`, 'day-title'); heading.append(text('span', `${day.budget} minutes`)); card.append(heading);
    for (const task of day.tasks) {
      const row = document.createElement('div'); row.className = 'task'; const body = document.createElement('div'); body.className = 'task-main'; body.append(text('strong', task.title));
      const source = plan.sources.find(s => s.id === task.sourceId); const link = text('button', `↗ ${source?.document || 'Source'} · ${source?.label || ''}`, 'source-link'); link.addEventListener('click', () => showSource(task)); body.append(link); row.append(text('span', '', 'task-check'), body, text('span', `${task.minutes} min`, 'task-time')); card.append(row);
    }
    $('plan-content').append(card);
  }
  $('plan-badge').textContent = plan.saved ? 'SAVED ON DEVICE' : 'DRAFT'; $('plan-badge').className = `badge ${plan.saved ? 'saved' : 'draft'}`;
  $('plan-total').textContent = `${plan.days.length} days · ${total} minutes`;
  $('plan-meta').textContent = plan.saved ? `Revision ${plan.revision} saved locally` : 'Review references before saving'; $('save-button').disabled = busy || plan.saved; $('revise-prompt').disabled = busy;
}
async function refreshSaved() { savedPlans = await tool('list_saved_plans'); $('saved-count').textContent = savedPlans.length; }
async function checkModel() { try { const status = await api('/api/status'); $('model-label').textContent = status.available ? 'Local model ready' : 'Local model needs setup'; $('model-detail').textContent = status.available ? `${status.model} · on this device` : `Start local AI: ${status.model} (see README)`; $('model-light').className = `status-light ${status.available ? 'ready' : ''}`; } catch (e) { $('model-label').textContent = 'Connection unavailable'; $('model-detail').textContent = e.message; } }

$('sample-button').addEventListener('click', async () => { try { const doc = await api('/api/sample', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); selected.add(doc.id); await refreshLibrary(); message('The sample syllabus is in your library. Try: “Build a 3-day plan, 60 minutes per day.”'); $('message').value = 'Build a 3-day plan, 60 minutes per day.'; $('message').focus(); } catch (e) { toast(e.message); } });
$('file-input').addEventListener('change', async event => { const file = event.target.files[0]; if (!file) return; try { if (file.size > 10485760) throw new Error('Choose a document under 10 MB.'); const doc = await api(`/api/documents?name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file }); selected.add(doc.id); await refreshLibrary(); message(`“${doc.name}” is ready. Select your documents and ask for a study plan.`); } catch (e) { toast(e.message); } finally { event.target.value = ''; } });
document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => { $('message').value = button.dataset.prompt; $('message').focus(); }));
$('chat-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return; const input = $('message').value.trim(); if (!input) return;
  if (!plan && !selected.size) { toast('Add or select a document first.'); return; }
  message(input, 'user'); $('message').value = ''; setBusy(true); const loading = message(plan ? 'Adjusting your schedule…' : 'Reading your course material with the local model. The first run may take a minute…'); loading.classList.add('loading');
  try {
    if (/\b(?:save|confirm)\b/i.test(input)) { message('Use “Review & save” to confirm the exact plan. A chat message alone cannot save it.'); return; }
    const isRevision = plan && !/\b(?:new|build|create|make)\b/i.test(input) && /\b(?:tomorrow|today|day\s*\d|adjust|revise|change|only|per day|each day|a day)\b/i.test(input);
    plan = isRevision ? await tool('revise_study_plan', { planId: plan.id, revision: plan.revision, message: input }) : await tool('draft_study_plan', { documentIds: [...selected], message: input });
    renderPlan(); const total = plan.days.reduce((s, d) => s + d.budget, 0);
    message(isRevision ? `Updated to ${total} minutes across ${plan.days.length} days. I kept the document-backed topics and rebalanced the sessions. This revision is a draft until you save it.` : `Here’s a ${plan.days.length}-day draft with ${total} minutes of study. Each task links to an exact passage from your material. Review the sources, then tell me if your available time changes.`);
  } catch (e) { message(e.message, 'coach', true); } finally { loading.remove(); setBusy(false); }
});
$('message').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('chat-form').requestSubmit(); } });
$('save-button').addEventListener('click', () => { $('save-summary').textContent = `Revision ${plan.revision}: ${plan.days.length} days, ${plan.days.reduce((s, d) => s + d.budget, 0)} minutes. Only this reviewed version will be saved.`; $('save-dialog').showModal(); });
$('confirm-save').addEventListener('click', async () => { $('confirm-save').disabled = true; try { const proof = await api('/api/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: plan.id, revision: plan.revision, confirmed: true }) }); plan = await tool('save_study_plan', { planId: plan.id, revision: plan.revision, confirmationToken: proof.confirmationToken }); renderPlan(); await refreshSaved(); $('save-dialog').close(); message(`Revision ${plan.revision} is saved on this device. You can find it in Saved plans or keep refining it.`); toast('Study plan saved locally.'); } catch (e) { toast(e.message); } finally { $('confirm-save').disabled = false; } });
$('protocol-button').addEventListener('click', () => $('protocol-dialog').showModal());
$('saved-nav').addEventListener('click', async () => { try { await refreshSaved(); $('saved-list').replaceChildren(...(savedPlans.length ? savedPlans.map(p => { const button = text('button', `${p.days.length}-day study plan`, 'saved-item'); button.append(text('small', `Revision ${p.revision} · ${new Date(p.savedAt).toLocaleDateString()}`)); button.addEventListener('click', () => { plan = p; selected = new Set(p.documentIds); renderPlan(); refreshLibrary(); $('saved-dialog').close(); }); return button; }) : [text('p', 'No saved plans yet. Review a draft and save it to keep it here.', 'muted')])); $('saved-dialog').showModal(); } catch (e) { toast(e.message); } });
$('workspace-nav').addEventListener('click', () => $('message').focus());
document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$('refresh-model').addEventListener('click', checkModel);
try { ({ token } = await (await fetch('/api/session')).json()); const initialized = await rpc('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'docuflow-browser-client', version: '1.0.0' } }); $('protocol-version').textContent = initialized.protocolVersion; await rpc('notifications/initialized', {}, true); await rpc('tools/list', {}); await refreshLibrary(); await refreshSaved(); await checkModel(); } catch (e) { message(`Could not connect to the local coach: ${e.message}`, 'coach', true); }
