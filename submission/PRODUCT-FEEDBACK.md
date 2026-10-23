# Product feedback

These observations describe this implementation and testing. They do not imply access to gated Amazon developer tooling.

| Tool | Use / what worked | Limitation / onboarding | Build with it again? |
|---|---|---|---|
| MCP TypeScript SDK | Actual Streamable HTTP server and independent test client; negotiated 2025-11-25 and exercised tools over HTTP. | Transport lifecycle and required Accept headers need care; the stateless JSON-response example was the useful starting point. A complete browser-client example with error states would shorten onboarding. | Yes: official protocol handling and an independent client made interoperability testable. |
| Alexa+ hackathon documentation | Rules and FAQ clarified that a real MCP web client can demonstrate a simulated experience. | Gated Category SDK/Toolkit/CLI cannot be used by general participants. We used the documented simulated path and did not test the gated tools. Keep this distinction prominent on every onboarding page. | Yes, for the open MCP path; device integration would need access first. |
| Node.js / Express | Loopback HTTP server, uploads, static UI and confirmation endpoint. | Correct Host/Origin validation and parser limits are app responsibilities. Node fetch did not exercise a hostile Host override as expected in a test; using node:http made that security check real. | Yes: small runtime and straightforward integration. |
| Zod | Tool input validation and confirmation schema. | Validation does not replace semantic checks such as exact quote matching or revision binding. | Yes: compact trust-boundary checks. |
| pdf-parse / PDF.js | Real text PDF extraction with page labels; fixture passed. | No OCR; image-only PDFs are rejected with a useful message. Parsing does not guarantee reading order in complex layouts. | Yes for text PDFs, with OCR as a separately scoped capability. |
| Mammoth | Extracted real DOCX text and paragraph labels; fixture passed. | Raw text loses formatting and page layout; paragraph references are more honest than invented page numbers. | Yes for text-focused ingestion. |
| Qwen2.5-1.5B | Local JSON topic extraction with document evidence. | Small-model outputs still need quotation validation and human review. Input coverage is capped to keep CPU inference bounded. See test report for the actual runtime/latency. | Yes for a small local prototype, with broader evaluation before educational deployment. |
| llama.cpp | Official portable CPU runtime used for live verification through its local OpenAI-compatible endpoint. | Windows runtime and model downloads must be prepared before demo time. Setup script checks both hashes. | Yes: no cloud account or paid inference needed. |
| Ollama | The original DocuFlow uses Ollama; the coach supports its documented local OpenAI-compatible endpoint. | Ollama was not installed on the test machine. Its Windows ROCm archive is supplemental, not a complete CPU installation. Live testing used llama.cpp instead; no live Ollama result is claimed. | Yes, with an existing installed model; otherwise use the smaller CPU setup. |

## Feature request
**Important:** publish a minimal downloadable Alexa+ hackathon starter with a real browser MCP client, explicit confirmation example, protocol trace and local test harness. It would make the permitted simulation route easier to distinguish from the gated partner tooling.

## Friction log honesty
No failures of a gated Amazon runtime were tested or observed. The packaging and local-test observations above are real development friction, not evidence for an Amazon platform reliability claim. Do not invent severity ratings or claim a friction bonus as already earned.
