# DocuFlow Study Coach

**Turn course documents into a study plan you can check, adjust, and save.**

A significant new extension of [Aayush Ranjan's DocuFlow](https://github.com/Aayush-Ranjan-26/DocuFlow), built for the **Alexa+ track** of Build, Ship, Shape: Amazon Developer Hackathon 2026.

The Alexa+ conversation is **simulated**. This is not an Alexa device integration and does not use Amazon's gated SDK, AWS, Bee or Fire TV. The browser sends real `initialize`, `tools/list`, and `tools/call` requests over Streamable HTTP, negotiating MCP **2025-11-25**.

## Run it

Prerequisites: Node.js **22.13+** (tested with 24.13), [Ollama](https://ollama.com/download), and memory for a small local model. Initial installation and model downloads require internet. Document processing and inference run on your device.

```sh
ollama pull qwen2.5:1.5b
npm ci
npm start
```

Start Ollama first (desktop app, or `ollama serve` in another terminal). Open **http://127.0.0.1:4317**. Windows users can double-click `Start-Study-Coach.cmd` after installing the prerequisites. Keep the terminal running; Ctrl+C stops the server. No account, API key, paid service, n8n installation or cloud deployment is required for the new coach.

### CPU-only Windows alternative (used for the live verification)

If Ollama is unavailable, the same local OpenAI-compatible API works with official llama.cpp:

```powershell
pwsh -File .\Setup-Local-AI.ps1
.\Start-Local-AI.cmd
# In a second terminal:
npm ci
npm start
```

The setup downloads the official 24 MB CPU runtime and 1.1 GB Qwen2.5-1.5B Q4_K_M model into ignored `.runtime/`, checking SHA-256 for both. It needs no administrator access and changes no system PATH. A random private `.runtime/key.txt` authenticates the model API; the app reads it locally without exposing it to the browser. CORS is limited to local app origins. The runtime is bound to 127.0.0.1:11434 with alias `qwen2.5:1.5b`, one generation slot, and an 8,192-token context. Do not run Ollama and llama.cpp on that port simultaneously. This machine's prepared `.runtime/` can be started directly; source downloads need the setup step. For Ollama with larger inputs, configure an 8,192-token context as described in its documentation.

1. Click **Try the machine learning syllabus**, or upload PDF, DOCX, TXT or Markdown. Existing DocuFlow summary Markdown can be imported directly.
2. Send **Build a 3-day plan, 60 minutes per day.**
3. Open a task's source link and check its exact quoted evidence.
4. Send **I only have 45 minutes tomorrow.** Day 2 changes; other budgets remain intact.
5. Click **Review & save**, inspect the summary, then **Yes, save this plan**. Canceling does not save.
6. Reopen from **Saved plans** after a browser/server restart. Inspect real MCP traffic with the connection icon.

To start a fresh plan from selected documents, send **Build a new 3-day plan, 60 minutes per day.** A new draft does not overwrite a saved plan. Revisions replace their saved version only after a new confirmation. `samples/` contains authored fictional course material in TXT, PDF and DOCX with no real student information.

## What changed from DocuFlow

The original n8n workflow watched a Windows folder, extracted PDF/DOCX, normalized text, used local Ollama for summaries/tags, wrote Markdown, and logged results. Its workflow JSON is unchanged and its README is archived in `docs/Original-DocuFlow-README.md`. Baseline commit: `3ae9c3e771b3ee894f43a247b1973ab37dd448d5`.

This version reuses the extraction → text normalization → local inference approach and adapts DocuFlow's normalization logic. It adds the web interface, six MCP tools, verified quotations, deterministic time allocation, conversational budget revisions, explicit confirmation, plan persistence, fixtures and tests. The standalone coach does not trigger the old workflow's folder renames or Google Sheets writes. Existing n8n users can continue producing Markdown and feed it into the coach.

## Architecture

```text
Browser (Alexa+ simulation, actual MCP client)
  ├── upload → PDF / DOCX / text extraction → local document JSON
  └── Streamable HTTP /mcp → official MCP SDK
         ├── list_documents / read_document
         ├── draft_study_plan → local Ollama → exact quote verification → schedule draft
         ├── revise_study_plan → deterministic budget adjustment → draft
         └── save_study_plan → one-use revision-bound confirmation → local JSON
```

Topic extraction uses the real model through a local `/v1/chat/completions` endpoint (Ollama or llama.cpp), with JSON output requested. Budget parsing, duration allocation, revisions and save checks are ordinary code, so a model cannot override budgets or silently save. The client routes supported planning requests to tools; this is a focused planning simulator, not an unrestricted agent.

| MCP tool | Inputs | Result |
|---|---|---|
| list_documents | none | Names, IDs and extraction counts |
| read_document | documentId | Extracted sections with location labels |
| draft_study_plan | documentIds, message | Cited topics and unsaved schedule |
| revise_study_plan | planId, message | Updated unsaved budgets |
| save_study_plan | planId, revision, confirmationToken | Persisted reviewed revision |
| list_saved_plans | none | Last saved versions |

Endpoint: `POST http://127.0.0.1:4317/mcp`. Stateless Streamable HTTP with JSON responses; standalone SSE and session deletion return 405. The browser obtains an ephemeral local bearer token from `/api/session`. After explicit UI confirmation, `/api/confirm` issues a one-use 60-second token bound to the exact revision and content. No MCP tool issues confirmation tokens.

## Verification

```sh
npm test          # extraction, citations, budgets, persistence, security, real SDK integration
npm run test:live # real Ollama inference + real MCP workflow; requires the model running
npm audit
```

Unit/integration tests inject a predictable generator to test failure boundaries. `test:live` never injects one: it uses Ollama, checks all quotes, revises tomorrow, checks that nothing was saved prematurely, confirms and saves. Evidence goes into ignored `test-results/live-check.json`. See `docs/TEST-REPORT.md` for observed results and browser checks.

## Local data and limits

- Listens on loopback only. Host/Origin validation, per-process bearer authentication, no permissive CORS, strict Content Security Policy and safe text rendering reduce exposure to other websites. This is a trusted single-user local application, not a multi-tenant cloud server.
- Extracted text and saved plans are plaintext under ignored `data/`; unsaved drafts live in memory. Only import material you are allowed to use. Model downloads contact the registry, but the app sends document text only to local Ollama.
- Select 1–5 documents. Each upload: at most 10 MB, 60,000 extracted characters and 250 sections. Scanned PDFs need OCR beforehand. DOCX uses paragraph labels; PDF uses page labels.
- **Coverage limit:** only the first 16 passages (1,100 characters each) of selected material are examined, in library order. Long course packs can be incomplete; use focused sections or a shorter DocuFlow summary. This is not full-document retrieval.
- Matching quotes establish that evidence exists, not that every generated topic name is semantically correct. Review sources. Documents are treated as untrusted data; prompt-injection resistance is not guaranteed.
- Requests use numeric 1–14 days and 15–240 minutes daily: `3-day plan, 60 minutes per day`, `45 minutes tomorrow`, `30 minutes on day 3`. Tomorrow means day 2, not a calendar date. No calendar, reminders, OCR, quiz grading, voice control or deadline detection.
- First CPU model loading can take longer. Inference times out at 180 seconds; one generation runs at a time. Failure produces an error, never a pretend plan. Other Ollama models need separate validation.

Environment settings: `PORT` (4317), `DATA_DIR` (project `data/`), `OLLAMA_MODEL` (`qwen2.5:1.5b`), `OLLAMA_URL` (local-only `http://127.0.0.1:11434`), `LOCAL_AI_KEY` (optional override for the local model API key). Set these before starting; no `.env` loader is installed. If changing PORT, update Start-Local-AI.cmd's allowed CORS origins too.

## Submission and licenses

`submission/` contains a Devpost draft, demo script, genuine feedback and checklist. Fill actual public GitHub and video URLs before submission. A local build alone does not complete the entry.

New code and authored samples: MIT (`LICENSE`). Dependencies retain their own licenses (`docs/THIRD-PARTY.md`). Runtime/model weights are downloaded separately, not bundled. Implemented with Codex assistance; describe the original/new-code boundary accurately in the demo.

[Official rules](https://amazonappdev2026.devpost.com/rules) and [FAQ](https://amazonappdev2026.devpost.com/details/faqs), checked 23 October 2026, permit a local runnable repository and a browser acting as a real MCP client. Final eligibility is determined by the organizers.
