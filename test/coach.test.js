import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Coach, parseConstraints, schedule } from '../lib/coach.js';
import { extractDocument, normalizeText, passages, verifyTopics } from '../lib/documents.js';

const sample = 'Data preparation\nStudy missing-value handling and train/test splits.\n\nModel evaluation\nCompare precision, recall and the confusion matrix.';
const generator = async (system, prompt) => { const { passages } = JSON.parse(prompt); return { topics: passages.map(p => ({ title: p.text.split('\n')[0], sourceId: p.id, quote: p.text.slice(0, 60) })) }; };
test('DocuFlow normalizer rejects blank extraction and strips nulls', () => { assert.equal(normalizeText(' \u0000Hi\r\nthere '), 'Hi\nthere'); assert.throws(() => normalizeText(' \n')); });
test('document extraction preserves source sections and disallows unsupported/oversized uploads', async () => {
  const doc = await extractDocument(Buffer.from(sample), '../../syllabus.md'); assert.equal(doc.name, 'syllabus.md'); assert.equal(doc.sections.length, 2);
  await assert.rejects(extractDocument(Buffer.from('x'), 'code.exe'), /Supported/);
  await assert.rejects(extractDocument(Buffer.alloc(10485761), 'big.pdf'), /10 MB/);
  await assert.rejects(extractDocument(Buffer.from('not PDF'), 'fake.pdf'), /valid PDF/);
  await assert.rejects(extractDocument(Buffer.from(' '), 'blank.txt'), /readable/);
  await assert.rejects(extractDocument(undefined, 'empty.txt'), /nonempty file/);
});
test('all passage text survives chunking without silent gaps', async () => { const content = 'X'.repeat(3501); const doc = await extractDocument(Buffer.from(content), 'long.txt'); assert.equal(passages([doc]).map(p => p.text).join(''), content); });
test('long upload names keep their real extension when shortened for display', async () => {
  const doc = await extractDocument(Buffer.from(sample), `../${'x'.repeat(137)}.txt`);
  assert.equal(doc.name, `${'x'.repeat(136)}.txt`);
  assert.equal(doc.sections.length, 2);
  await assert.rejects(extractDocument(Buffer.from(sample), `${'x'.repeat(136)}.txt.exe`), /Supported/);
});
test('real PDF and DOCX fixtures extract text and preserve location labels', async () => {
  for (const ext of ['pdf', 'docx']) {
    const doc = await extractDocument(await readFile(new URL(`../samples/Evaluation-Notes.${ext}`, import.meta.url)), `Evaluation-Notes.${ext}`);
    assert.ok(doc.sections.some(s => s.text.includes('Compare precision, recall and the confusion matrix.')));
    assert.match(doc.sections[0].label, ext === 'pdf' ? /^Page 1$/ : /^Paragraph 1$/);
  }
});
test('fabricated source IDs and non-verbatim evidence are rejected', () => {
  const sources = [{ id: 'a', text: 'Learn model evaluation and recall.' }];
  assert.throws(() => verifyTopics({ topics: [{ title: 'Fake', sourceId: 'b', quote: 'model evaluation' }] }, sources), /No model citations/);
  assert.throws(() => verifyTopics({ topics: [{ title: 'Fake', sourceId: 'a', quote: 'nuclear chemistry' }] }, sources), /No model citations/);
  assert.equal(verifyTopics({ topics: [{ title: 'Evaluation', sourceId: 'a', quote: 'model evaluation' }] }, sources).length, 1);
  assert.equal(verifyTopics({ topics: [null, false, { title: 'Evaluation', sourceId: 'a', quote: 'model evaluation' }] }, sources).length, 1);
  assert.throws(() => verifyTopics({ topics: [null] }, sources), /No model citations/);
  assert.equal(verifyTopics({ topics: [
    { title: 'Evaluation', sourceId: 'a', quote: 'model evaluation' },
    { title: ' Evaluation ', sourceId: 'a', quote: 'model evaluation' }
  ] }, sources).length, 1);
});
test('schedules exactly respect all daily time budgets', () => { const topics = [{ title: 'One', sourceId: 'a', quote: 'evidence' }]; for (const budgets of [[60, 45, 60], [17, 31], [240, 15]]) { const days = schedule(topics, budgets); assert.deepEqual(days.map(d => d.tasks.reduce((s, t) => s + t.minutes, 0)), budgets); assert.ok(days.flatMap(d => d.tasks).every(t => t.minutes > 0)); } });
test('natural-language revisions preserve other days and reject impossible constraints', () => {
  assert.deepEqual(parseConstraints('Build a 3-day plan, 60 minutes per day.'), [60, 60, 60]);
  const previous = { days: [{ budget: 60 }, { budget: 60 }, { budget: 60 }] };
  assert.deepEqual(parseConstraints('I only have 45 minutes tomorrow.', previous), [60, 45, 60]);
  assert.deepEqual(parseConstraints('30 minutes on day 3', previous), [60, 60, 30]);
  assert.throws(() => parseConstraints('0-day plan'), /1–14/);
  assert.throws(() => parseConstraints('10 minutes tomorrow', previous), /15–240/);
  assert.throws(() => parseConstraints('45 minutes', previous), /which day/);
  assert.throws(() => parseConstraints('3 days, 45 minutes daily'), /per day/);
  for (const request of ['-3-day plan', '3.5 days', '.5 days', '-30 minutes per day', '30.5 minutes per day']) assert.throws(() => parseConstraints(request), /Choose/);
  for (const request of ['-30 minutes tomorrow', '30.5 minutes tomorrow', '.5 minutes tomorrow']) assert.throws(() => parseConstraints(request, previous), /whole minutes/);
  for (const request of ['30 minutes on day 2.5', '30 minutes on day -2']) assert.throws(() => parseConstraints(request, previous), /which day/);
});
test('full draft → revision → explicit save survives restart; stale/replayed confirmations cannot write', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'docuflow-test-'));
  try {
    const coach = new Coach(dir, generator); await coach.init(); const doc = await extractDocument(Buffer.from(sample), 'syllabus.txt'); await coach.addDocument(doc);
    let plan = await coach.draft([doc.id], '3-day plan, 60 minutes per day'); assert.equal(plan.saved, false);
    await assert.rejects(coach.save(plan.id, plan.revision, 'missing'), /confirmation/);
    const stale = coach.confirmation(plan.id, 1); plan = coach.revise(plan.id, '45 minutes tomorrow'); assert.deepEqual(plan.days.map(d => d.budget), [60, 45, 60]);
    await assert.rejects(coach.save(plan.id, 1, stale), /confirmation/);
    const token = coach.confirmation(plan.id, 2); const saved = await coach.save(plan.id, 2, token); assert.equal(saved.saved, true);
    await assert.rejects(coach.save(plan.id, 2, token), /confirmation/);
    coach.revise(plan.id, '30 minutes tomorrow');
    assert.equal(coach.savedPlans.get(plan.id).revision, 2);
    assert.equal(coach.plans.get(plan.id).revision, 3);
    const resumed = coach.revise(plan.id, '30 minutes today', 2);
    assert.deepEqual(resumed.days.map(d => d.budget), [30, 45, 60]);
    assert.equal(resumed.revision, 4);
    const restarted = new Coach(dir, generator); await restarted.init(); assert.equal(restarted.plans.get(plan.id).saved, true); assert.equal(restarted.documents.get(doc.id).name, 'syllabus.txt');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('bad model output produces an error, never a fabricated successful plan', async () => {
  const coach = new Coach('.', async () => ({ topics: [{ title: 'Space travel', sourceId: 'fake', quote: 'fake evidence' }] })); const doc = await extractDocument(Buffer.from(sample), 'x.txt'); coach.documents.set(doc.id, doc);
  await assert.rejects(coach.draft([doc.id], '3-day plan'), /No model citations/); assert.equal(coach.plans.size, 0); assert.equal(coach.busy, false);
});

test('a pending save preserves a newer draft and an overlapping save keeps its confirmation', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'docuflow-save-race-'));
  const write = Promise.withResolvers();
  try {
    const coach = new Coach(dir, generator); await coach.init();
    const doc = await extractDocument(Buffer.from(sample), 'syllabus.txt'); coach.documents.set(doc.id, doc);
    const original = await coach.draft([doc.id], '3-day plan, 60 minutes per day');
    const atomicWrite = coach.atomicWrite.bind(coach);
    coach.atomicWrite = async (file, value) => { await write.promise; await atomicWrite(file, value); };
    const pendingSave = coach.save(original.id, original.revision, coach.confirmation(original.id, original.revision));
    const revised = coach.revise(original.id, '45 minutes tomorrow');
    const token = coach.confirmation(revised.id, revised.revision);
    await assert.rejects(coach.save(revised.id, revised.revision, token), /already being saved/);
    assert.equal(coach.confirmations.has(token), true);
    assert.equal(coach.savedPlans.size, 0);
    write.resolve();
    assert.equal((await pendingSave).revision, 1);
    assert.equal(coach.plans.get(revised.id), revised);
    assert.equal(coach.plans.get(revised.id).saved, false);
    assert.equal(coach.savedPlans.get(revised.id).revision, 1);
    const saved = await coach.save(revised.id, revised.revision, token);
    assert.equal(saved.revision, 2);
    assert.deepEqual(saved.days.map(day => day.budget), [60, 45, 60]);
    const restarted = new Coach(dir, generator); await restarted.init();
    assert.deepEqual(restarted.savedPlans.get(revised.id), saved);
  } finally { write.resolve(); await rm(dir, { recursive: true, force: true }); }
});

test('a failed save leaves the saved revision intact and allows a confirmed retry', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'docuflow-save-failure-'));
  try {
    const coach = new Coach(dir, generator); await coach.init();
    const doc = await extractDocument(Buffer.from(sample), 'syllabus.txt'); coach.documents.set(doc.id, doc);
    const original = await coach.draft([doc.id], '3-day plan, 60 minutes per day');
    const saved = await coach.save(original.id, original.revision, coach.confirmation(original.id, original.revision));
    const revised = coach.revise(original.id, '45 minutes tomorrow');
    const atomicWrite = coach.atomicWrite.bind(coach);
    const write = Promise.withResolvers();
    coach.atomicWrite = () => write.promise;
    const pendingSave = coach.save(revised.id, revised.revision, coach.confirmation(revised.id, revised.revision));
    const failedSave = assert.rejects(pendingSave, /disk full/);
    write.reject(new Error('disk full'));
    await failedSave;
    assert.equal(coach.plans.get(revised.id), revised);
    assert.equal(coach.savedPlans.get(revised.id), saved);
    assert.deepEqual(JSON.parse(await readFile(path.join(dir, 'plans', `${saved.id}.json`), 'utf8')), saved);
    coach.atomicWrite = atomicWrite;
    const retried = await coach.save(revised.id, revised.revision, coach.confirmation(revised.id, revised.revision));
    assert.equal(retried.revision, 2);
    assert.equal(retried.saved, true);
    assert.equal(coach.savedPlans.get(revised.id), retried);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
