import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const fixture = { id: 'existing-plan', revision: 2, saved: false, documentIds: ['doc'], topics: [], sources: [], days: [{ day: 1, budget: 45, tasks: [] }] };

async function browserHarness(initialPlan = fixture) {
  const elements = new Map(), calls = [];
  let offline = false;
  const element = () => ({
    listeners: {}, value: '', classList: { add() {} },
    addEventListener(name, callback) { this.listeners[name] = callback; },
    append() {}, replaceChildren() {}, setAttribute() {}, focus() {}, remove() {}
  });
  const get = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  await vm.runInNewContext(`(async () => { ${source}\nplan = initialPlan; selected = new Set(['doc']); })()`, {
    initialPlan,
    document: { getElementById: get, createElement: element, querySelectorAll: () => [] },
    performance: { now: () => 1 }, setTimeout: () => 1, clearTimeout() {},
    fetch: async (url, options) => {
      const response = value => ({ ok: true, status: 200, json: async () => value });
      if (url === '/api/session') return response({ token: 'session' });
      if (url === '/api/status') {
        if (offline) throw new Error('Offline');
        return response({ available: true, model: 'local-model' });
      }
      const request = JSON.parse(options.body);
      if (request.method === 'notifications/initialized') return { status: 202 };
      if (request.method === 'initialize') return response({ result: { protocolVersion: '2025-11-25' } });
      if (request.method === 'tools/list') return response({ result: { tools: [] } });
      calls.push(request.params);
      const value = request.params.name === 'list_documents' ? [{ id: 'doc', name: 'Course.txt', chars: 10, sections: 1 }]
        : request.params.name === 'list_saved_plans' ? [] : fixture;
      return response({ result: { content: [{ text: JSON.stringify(value) }] } });
    }
  });
  calls.length = 0;
  return { get, calls, setOffline() { offline = true; }, async submit(input) { get('message').value = input; await get('chat-form').listeners.submit({ preventDefault() {} }); } };
}

test('existing-plan time and duration edits use revision; explicit new plans use drafting', async () => {
  for (const [input, expected] of [
    ['Make tomorrow 45 minutes.', 'revise_study_plan'],
    ['Make each day 30 minutes.', 'revise_study_plan'],
    ['Make it 4 days.', 'revise_study_plan'],
    ['I need 5 days.', 'revise_study_plan'],
    ['Make a 3-day plan, 60 minutes per day.', 'draft_study_plan'],
    ['Build a 3-day plan, 60 minutes per day.', 'draft_study_plan'],
    ['Create a 4-day plan.', 'draft_study_plan'],
    ['New plan for 5 days.', 'draft_study_plan']
  ]) {
    const browser = await browserHarness(); await browser.submit(input);
    assert.equal(browser.calls.length, 1, input);
    assert.equal(browser.calls[0].name, expected, input);
    if (expected === 'revise_study_plan') {
      assert.equal(browser.calls[0].arguments.planId, fixture.id);
      assert.equal(browser.calls[0].arguments.revision, fixture.revision);
    }
  }
  const browser = await browserHarness(null); await browser.submit('Make it 4 days.');
  assert.equal(browser.calls[0].name, 'draft_study_plan');
});

test('model-status failure removes the stale ready indicator', async () => {
  const browser = await browserHarness();
  assert.equal(browser.get('model-light').className, 'status-light ready');
  browser.setOffline(); await browser.get('refresh-model').listeners.click();
  assert.equal(browser.get('model-light').className, 'status-light');
  assert.equal(browser.get('model-label').textContent, 'Connection unavailable');
  assert.equal(browser.get('model-detail').textContent, 'Offline');
});
