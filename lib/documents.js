import { randomUUID } from 'node:crypto';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

// Adapted from DocuFlow's Normalize Extracted Text n8n node.
export function normalizeText(value) {
  const text = String(value ?? '').replace(/\u0000/g, '').replace(/\r\n/g, '\n').trim();
  if (!text) throw new Error('No readable text found. Scanned PDFs need OCR before import.');
  return text;
}

export async function extractDocument(buffer, filename) {
  if (!buffer.length || buffer.length > 10 * 1024 * 1024) throw new Error('Upload a nonempty file smaller than 10 MB.');
  const name = String(filename).split(/[\\/]/).pop().replace(/[\x00-\x1f]/g, '').slice(0, 140);
  const ext = name.split('.').pop().toLowerCase();
  let pages;
  if (ext === 'pdf') {
    if (buffer.subarray(0, 5).toString() !== '%PDF-') throw new Error('This is not a valid PDF.');
    const parser = new PDFParse({ data: buffer });
    try { const result = await parser.getText(); pages = result.pages.map(p => ({ label: `Page ${p.num}`, text: p.text })); }
    finally { await parser.destroy(); }
  } else if (ext === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    pages = result.value.split(/\n\s*\n/).map((text, i) => ({ label: `Paragraph ${i + 1}`, text }));
  } else if (['txt', 'md'].includes(ext)) {
    pages = buffer.toString('utf8').split(/\n\s*\n/).map((text, i) => ({ label: `Section ${i + 1}`, text }));
  } else throw new Error('Supported files: PDF, DOCX, TXT, Markdown (including DocuFlow summaries).');
  const id = randomUUID();
  const sections = pages.filter(p => p.text.trim()).map((p, i) => ({ id: `${id}:${i + 1}`, label: p.label, text: normalizeText(p.text) }));
  const text = normalizeText(sections.map(s => s.text).join('\n\n'));
  if (text.length > 60000 || sections.length > 250) throw new Error('Use a shorter document: maximum 60,000 characters and 250 sections.');
  return { id, name, sections, chars: text.length, createdAt: new Date().toISOString() };
}

export function passages(documents) {
  return documents.flatMap(d => d.sections.flatMap(s => {
    // Keep small model inputs bounded while retaining exact source quotes.
    const chunks = [];
    for (let offset = 0; offset < s.text.length; offset += 1100) chunks.push(s.text.slice(offset, offset + 1100));
    return chunks.map((text, i) => ({ id: `${s.id}.${i + 1}`, documentId: d.id, document: d.name, label: s.label, text }));
  })).slice(0, 40);
}

export function verifyTopics(raw, sources) {
  if (!raw || !Array.isArray(raw.topics)) throw new Error('The model did not return a topics array.');
  const byId = new Map(sources.map(s => [s.id, s]));
  const seen = new Set();
  const topics = raw.topics.filter(t => {
    const source = byId.get(t.sourceId);
    if (!source || typeof t.title !== 'string' || typeof t.quote !== 'string') return false;
    const quote = t.quote.trim();
    if (quote.length < 8 || quote.length > 400 || !source.text.includes(quote) || !t.title.trim() || t.title.length > 120) return false;
    if (seen.has(t.title.toLowerCase())) return false;
    seen.add(t.title.toLowerCase()); return true;
  }).slice(0, 12).map(t => ({ title: t.title.trim(), sourceId: t.sourceId, quote: t.quote.trim() }));
  if (!topics.length) throw new Error('No model citations matched the document. Try again or use a clearer syllabus.');
  return topics;
}
