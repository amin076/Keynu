# Keynu architecture and runtime audit — 2026-09-17

Base inspected: `5981901` (main at checkout). Implementation branch:
`audit/keynu-supervised-api-runtime`.

## خلاصهٔ فارسی

Keynu از قبل فایل‌ها و ماژول‌های API، حافظه و اجرای اسکریپت داشت؛ مشکل اصلی نبودن
یک مسیر اجرایی یکپارچهٔ بدون مرورگر برای این قابلیت‌ها بود. این تغییر یک مسیر
اجرایی اختیاری با هدف، مراحل، وابستگی‌ها، ثبت شواهد، توابع دارای ورودی معتبر،
اجرای چند پروژه و بازبینی AI اضافه می‌کند. مسیر قبلی مرورگر حذف نشده است.

خروجی ممیزی و پیشنهاد مراحل بعدی روی دیسک باقی می‌ماند. پس از اتمام هر مرحله،
آزمون تعیین‌شده و سپس بازبینی AI اجرا می‌شوند؛ فقط پس از موفقیت هر دو، مرحلهٔ
وابسته آماده می‌شود. مصرف AI محدود و ماندگار است. قطع کار موجب فراموشی یا
تکرار خودکار کارهای تکمیل‌شده نمی‌شود. کار نیمه‌تمام نیاز به بررسی شواهد دارد.

این تغییر به معنای فعال‌شدن خودکار روی رایانهٔ کاربر، اتصال زندهٔ تأییدشده به
OpenAI، تضمین صحت خروجی AI یا کارکرد نامحدود بدون هزینه و توقف نیست.

## Scope and evidence standard

Inspected repository architecture/docs, provider transport/composition, command/script
execution, processed-job persistence, canonical mission continuation, filesystem and
HTTP integration boundaries, browser runtime entry points and dashboard binding.
Ran the baseline build/regression suite and added focused adversarial/integration tests.
This is a repository audit with implemented fixes, not a proof that every source path or
external application is bug-free. Esbiko, ملاکت, Dishmook and ClaimFlow were not modified
or deployed by this audit.

## Confirmed findings and disposition

| Finding | Impact | Change / evidence |
| --- | --- | --- |
| ProviderRuntime aggregates parse errors but ignores failed dispatch item status | Failed work can appear COMPLETED | Aggregate FAILED/PARTIAL/SKIPPED correctly; regression cases |
| Script wrapper drops expectedExitCodes | Valid nonzero exits fail unexpectedly | Forward codes; actual Node exit-7 test |
| PersistentJobStore read/modify/write races and fixed temp filename | Duplicate claims, lost reports/counters, rename failures | Transaction lock + unique atomic snapshot; 20 concurrent instances |
| HTTP connector automatically follows redirects | Validated origin can be escaped | Disable redirects, validate final request URL, bound body/time; two-server regression |
| Generic filesystem path checks are lexical only | Symlink can escape approved root or protected paths | Reject symlink ancestors, including dangling links; escape regression |
| Windows .cmd/.bat execution enables shell with model-controlled arguments | Shell metacharacters may execute unintended commands | Reject dangerous batch arguments; use JSON-file script inputs |
| Child stdout/stderr grows without bounds | Large output can exhaust memory | Bound captures and fail result on overflow |
| API retries happen immediately | Rate-limit loops can worsen overload | Exponential delay/jitter, honor Retry-After; defer delays >60s |
| OpenAI 429 insufficient_quota treated as retryable rate limit | Futile repeated paid-provider requests | Parse provider codes, stop quota/spend-limit retries |
| Abort signal listeners accumulate across requests | Long-running API worker can retain listeners | Native AbortSignal.any; cancellation/timeout classification |
| APIProvider config accepts nonfinite/unbounded retry counts | An invalid config can create runaway retries | Validate integer timeout/retry bounds |
| OpenAI exists only as generation transport in current composition | API does not perform sustained project work | New explicit API execution composition reuses provider |
| Script support is inline source, not a function catalog | Models keep resending scripts and loose arguments | Code-owned named registry, Zod contracts, trusted Node/PS manifests |
| Browser continuation chooses next work via chat with limited durable plans | Unclear ordered project progression outside browser | Persisted execution plans, dependencies, evidence, continuation contract |
| No headless multi-project verification/review worker | No bounded automated development lane | 1–4 workers, same-root exclusion, deterministic checks + reviewer |

## What already existed (do not rebuild blindly)

- OpenAI REST transport and generic APIProvider under `src/providers`.
- Canonical browser continuation and persistent mission/delivery state under `src/mission`.
- MemoryLoader with repository documents and mission bootstrap context.
- EngineeringRuntime and Node/PowerShell command adapters.
- IntegrationHub and an HTTP connector; it was inaccurate to say there were no APIs at all.
- Dashboard binds to `127.0.0.1`; this audit did not expose it publicly.
- Legacy RuntimeScheduler is intentionally in-memory and not active browser authority.

## New operational path

`npm run mission -- <command> config.json` supports add/status/run/watch/resume/serve.
The model selects one allowed function with typed arguments. Each intent/result persists.
A finish proposal triggers host-configured checks and a new reviewer request. A failure
blocks dependent work. Accepted stages and follow-up proposals persist across restarts.
The authenticated inbound API has an explicit project/function allowlist.

API-call limits include the reviewer. Transport retries are disabled for this worker,
so they cannot silently exceed the plan's call budget. Model output is capped at 4096
tokens per request; context uses marked excerpts. This is a call budget, not a dollar
budget. It does not estimate variable provider billing or promise free API use.

## Validation

Baseline: 114 compiled test files, 112 passed; two browser tests failed because Chromium
was not installed in the execution environment. The build passed.

Implementation regression run: 119 compiled test files, 117 passed, with the same two
browser infrastructure failures. Added tests cover concurrent job claims, script exit
codes, status aggregation, redirect escape, symlink escape, Windows batch metacharacters,
three concurrent projects, dependency order, restart replay suppression, persistent budgets,
review/verification rejection, overlap rejection, JSON argument handling, API contracts
and inbound API authentication/scope. See `KEYNU_AUDIT_EVIDENCE_2026-09-17.json` for run data.

OpenAI traffic was tested through real loopback HTTP and injected transports, without a
paid live request. The AI test decisions are fixtures, not evidence of real model quality.
Windows PowerShell round-trip is conditional on Windows and a dedicated Windows workflow
was added. Local testing ran on Linux; its passing static shell tests do not establish
actual Windows process behavior. Browser download was attempted and failed due connection
timeouts. GitHub CI outcomes, if available, are recorded separately rather than guessed.

`npm audit --json`: 0 reported vulnerabilities across all severities at execution time.
A clean package audit does not establish absence of runtime or design vulnerabilities.

## Remaining risks and next development (persisted, prioritized)

1. **Real Windows acceptance:** run named Node/PowerShell functions and actual project
   build/test commands; inspect process-tree cleanup after timeout. Current command
   termination is not a complete cross-platform descendant-process supervisor.
2. **Live API acceptance:** with a locally configured account/model, run the example audit
   against a disposable checkout. Verify bills, quotas, review quality and evidence.
3. **Unify browser/API plan ownership:** ADR-0014 adds explicit API ownership. Existing
   browser workers do not honor new API project locks. Do not run both on the same checkout.
4. **Crash lifecycle:** filesystem locks can remain after a hard kill; they require
   stopped-owner confirmation before removal. No distributed lease or exactly-once
   side-effect guarantee. Long-lived service installation and automatic reboot recovery
   remain deployment work.
5. **Monitoring/dashboard:** local GET /plans and /health expose state; existing React
   Mission Control has not yet been wired to these plans. Review happens at step completion,
   not continuous semantic observation of every subprocess.
6. **Evidence scaling:** recent evidence and previous plan summaries are bounded context.
   Add indexed retrieval, archive retention and disk quotas before thousands of daily jobs.
7. **Trust isolation:** registered scripts run as the OS user. Source edits and tests can
   execute project code. File checks are not a hostile-process sandbox; approved project
   workers should use separate worktrees/OS isolation. No automatic merge/deploy/publish.
8. **Project integrations:** create real acceptance contracts for each application. For
   scientific apps, passing software tests cannot replace scientific reproducibility checks.
9. **Provider expansion:** the execution-agent interface accepts other providers, but this
   CLI currently configures OpenAI Responses only. Gemini/Ollama adapters are future work.
10. **Continuous planning:** approved steps run automatically. AI future proposals are saved,
    not silently installed as an unlimited self-expanding work queue. Daily recurrence and
    policy-governed automatic proposal promotion remain explicit future capabilities.

## Primary references used for external behavior

- [Node.js child process API](https://nodejs.org/api/child_process.html): shell execution and process lifecycle.
- [OpenAI rate limits](https://developers.openai.com/api/docs/guides/rate-limits): backoff and Retry-After.
- [OpenAI error codes](https://developers.openai.com/api/docs/guides/error-codes): quota versus temporary rate limits.

The repository code and executable regressions, not these external references, establish
the findings about Keynu.
