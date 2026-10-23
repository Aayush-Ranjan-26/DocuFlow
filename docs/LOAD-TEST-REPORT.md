# Bounded local load test

**Result: PASS**, run 2026-10-23 at 06:19:59 UTC (11:49:59 IST), using `npm run test:load`.

The script starts a separate real Express/MCP server on loopback port 4330 with a new temporary data directory. It exercises HTTP authentication and MCP `tools/call`, uses the actual local model for generation, checks exact source quotes, and deletes the temporary library/plans and closes the server on exit. No user documents, plans, or credentials are logged or modified. Machine-readable evidence is written to ignored `test-results/load-check.json`.

## Hardware and configuration

- Windows 10.0.26300, Node v24.13.0.
- Intel Core i5-13420H (8 cores, 12 logical CPUs), 15.65 GiB physical RAM.
- Local Qwen2.5 1.5B Instruct Q4_K_M via llama.cpp on port 11434; alias `qwen2.5:1.5b`, 6 CPU threads, 8192-token context, one inference slot.
- One fictional sample syllabus in the isolated library. Browser/UI work was active on the same laptop; the parent browser was coordinated to avoid a separate generation during this run.
- Model requests have a 240-second MCP client timeout; the application retains its 180-second inference timeout.

## Request latency

These are short, bounded bursts over local loopback. Throughput includes HTTP/JSON/MCP processing and local client scheduling; it is **not** a sustained production capacity estimate.

| Workload | Requests | Concurrency | p50 ms | p95 ms | Max ms | Requests/sec | Unexpected errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| MCP library/read mix | 200 | 10 | 11.94 | 20.57 | 40.31 | 709.32 | 0 |
| MCP library/read mix | 200 | 25 | 24.17 | 32.69 | 43.81 | 977.85 | 0 |
| Invalid bearer token | 50 | 10 | 3.28 | 5.88 | 6.30 | 2655.03 | 0 |
| MCP library during inference | 100 | 10 | 20.37 | 35.93 | 36.72 | 436.73 | 0 |
| Model status during inference | 20 | 2 | 2.82 | 6.73 | 6.81 | 599.66 | 0 |

All 50 invalid-token requests returned the expected HTTP 401. All authorized reads returned the expected sample document, including while the CPU model was generating. Status responses remained HTTP 200 with the configured model available.

## Inference overload and recovery

Three simultaneous draft requests resulted in **one successful generation (7489.96 ms)** and **two expected busy rejections (15.83 and 16.12 ms)**. The rejected calls returned the explicit “Another local AI request is running” message; they were not silently queued or reported as successful drafts. The accepted draft's cited quotes were checked against its actual source passages.

A subsequent generation succeeded in **7802.13 ms**, proving the busy flag was released and the service recovered. Only **two actual model generations** ran in this test.

The application intentionally supports **one active generation per server process**, appropriate for its one-slot local CPU runtime. Twenty-five concurrent library requests do not mean twenty-five concurrent AI users are supported.

## Confirmed-save race

Twenty-five simultaneous MCP save calls reused the same fresh, explicit, one-use confirmation token for the same plan revision. Exactly **one save succeeded** and **24 were rejected as expected**. The full batch and persistence assertions took **87.58 ms**. The saved-plan library contained exactly one plan, and the temporary plans directory contained exactly one valid JSON file with the expected plan ID and `saved: true`. No replayed confirmation produced a duplicate successful save.

## Limits

No unexpected failures were found in these bounded cases. This is a local functional stress check, not an endurance, Internet exposure, multi-process, large-library, memory-leak, or production benchmark. It does not test physical mobile/Alexa devices; those require accessible target hardware and are recorded separately. Load measurements vary with laptop power mode, CPU contention, thermal state, model size, document length, and hardware.
