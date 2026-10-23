# DocuFlow Study Coach

## Tagline
Turn course documents into a source-backed study plan that adapts to your time, with local AI and a real MCP workflow.

## Inspiration
My existing DocuFlow pipeline made documents easier to summarize. Students still had to turn those summaries into a realistic next step. Study Coach closes that gap: bring a syllabus, choose your available time, check the evidence, and refine the plan when life changes.

## What it does
Upload PDF, DOCX, text or DocuFlow Markdown. A local Qwen model extracts study topics with exact quotations. The app verifies those quotations before building a draft. Each session links back to a named document and page or section. Ask for a 3-day plan at 60 minutes per day, then say “I only have 45 minutes tomorrow.” The schedule changes while preserving the other days' budgets. Saving requires reviewing and explicitly confirming the current revision; saved plans survive a restart.

## How it works
The browser is a real MCP client. It initializes a connection, lists tools and invokes six tools over Streamable HTTP using the official MCP SDK and protocol 2025-11-25. The language model identifies topics; ordinary code validates evidence, allocates minutes and gates writes. Documents and inference stay local. The Alexa+ experience is simulated in a web app; it is not connected to an Alexa device or gated Amazon tooling.

## Significant update during the hackathon
The original DocuFlow was an n8n file-processing workflow for summaries and organization. This contribution adds the entire interactive web product, runtime MCP server/client, source-quote verification, time-budget planning and revision, confirmation-gated persistence, import fixtures and automated tests. The original workflow is preserved. Baseline commit: 3ae9c3e771b3ee894f43a247b1973ab37dd448d5. Implementation used Codex assistance.

## Challenges and lessons
Local models can return plausible but unsupported text, so source IDs and quotations are checked rather than trusted. A model should not decide whether a write was authorized: saving uses a short-lived, single-use token bound to the reviewed revision. Deterministic scheduling also makes daily totals testable. CPU setup needed a smaller portable runtime, so a checksum-verified llama.cpp alternative is included alongside Ollama-compatible setup.

## Limits and next steps
This is focused planning, not general Q&A. Only the first 16 passages are inspected; long course packs should be shortened or split. Scanned PDFs need OCR. Matching quotes do not guarantee perfect topic interpretation. Next steps would be retrieval across larger packs and evaluating learning outcomes with real student consent.

## Built with
JavaScript, Node.js, Express, Model Context Protocol SDK, Streamable HTTP, Zod, pdf-parse, Mammoth, Qwen2.5-1.5B, llama.cpp; local Ollama-compatible API; original n8n DocuFlow workflow.

## Track
Alexa+ — simulated web experience backed by a working self-hosted MCP server.
Do not claim Fire TV, Bee, Ring, AWS services, Kiro usage, or an additional Open Source mini-challenge contribution without separate qualifying evidence.

## Links to complete after publication
- Code: actual public GitHub URL containing this full version, not the unchanged original main branch.
- Demo: actual publicly visible YouTube or Vimeo URL, under 3 minutes.
- Run instructions: README in the code repository. No login or hosted site is required to run locally.
- Product feedback: paste the accompanying PRODUCT-FEEDBACK.md.

Final entry is not submitted by this draft. Review the live form, actual links, video and rules before submitting.
