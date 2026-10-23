# Verification report — 23 October 2026

Environment: Windows, Node.js 24.13.0, official MCP SDK 1.32.1, llama.cpp build 11809, Qwen2.5-1.5B-Instruct Q4_K_M, CPU with six inference threads and 8,192-token context.

## Passed

- `npm test`: **10/10** tests, including real PDF and DOCX extraction fixtures and uploads through the actual HTTP endpoint.
- Real SDK client integration: negotiated **2025-11-25**, discovered six tools, uploaded/read documents, drafted/revised/saved/listed a plan over Streamable HTTP.
- Host and Origin rejection, unauthenticated API rejection, unsupported-file/size/blank-text rejection, invented quote/ID rejection, exact daily totals.
- Confirmation required for the exact revision; stale and replayed tokens cannot save. Persistence survives a fresh Coach instance. A later draft does not erase the last saved version; revising a reopened saved revision uses its own budget.
- `npm run test:live`: **PASS** using the actual local Qwen model, no injected generator. Five verified topics; daily budgets 60/60/60 → 60/45/60; no saved plan before confirmation; confirmed revision 2 persisted. Final observed generation **6,484 ms** (warm model; not a performance guarantee).
- Browser with real model and actual MCP calls: generated five topics in **8,808 ms**, inspected exact source quote, revised to 165 total minutes, canceled save (count stayed zero), confirmed save (count became one), reloaded and reopened saved revision 2.
- Browser protocol dialog showed initialize (HTTP 200), notifications/initialized (202), tools/list (200), and draft/revise/save/list calls (200).
- Portable model setup executed with already downloaded runtime/model, verified checksums, generated a private local key, and started successfully. The model endpoint returned **401** without that key; the app worked with it. CORS is restricted to the local app origins.
- `npm audit --omit=dev`: **0 vulnerabilities reported** at verification time.
- Original n8n workflow kept unchanged. Screenshots under `docs/screenshots/` come from the real browser session and contain only fictional sample content.

## Failure found and corrected

The first live extraction returned no acceptable citations. The app rejected it and did not create a false successful plan. The model prompt was simplified to short source IDs and text, removing unrelated UUID/name metadata that confused the small model. The subsequent live run and browser run passed. This does not prove every document will produce valid topics; invalid output still fails clearly.

## Limits / not verified

No actual Alexa device, gated Amazon SDK, AWS, Bee, Ring or Fire TV integration is claimed. The supported route is the simulated web experience with a real MCP server/client. Ollama was not installed here; actual inference was verified with the documented llama.cpp alternative, not live Ollama.

The original n8n workflow and Google Sheets logging were preserved, not executed. OCR, complex PDF reading order, arbitrary natural-language scheduling, mobile-device browsers, load testing, hostile-document fuzzing and educational effectiveness were not comprehensively tested. The coach only inspects its first 16 passages; citations are exact-text checks, not semantic correctness guarantees.

Public GitHub/video URLs and the final Devpost entry must be verified separately. Passing local tests does not mean a hackathon submission has been made or accepted.
