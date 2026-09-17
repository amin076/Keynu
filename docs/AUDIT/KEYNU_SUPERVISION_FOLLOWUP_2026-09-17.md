# Keynu audit follow-up: execution supervision

Baseline: merged PR #27, main commit `401655f039ea0ac7a87593b1bbb742a57d7ba400`.

## What this closes

- Browser command/filesystem/PowerShell KAP execution and the API worker now share
  cooperative project ownership. Git subdirectories use the same checkout root.
- PowerShell's command runners no longer maintain different Windows shell behavior;
  they delegate to CommandExecutor for shell argument policy and bounded output.
- Mission Control now displays API execution goals, stage status, phase/action,
  dependencies, call budgets, follow-up proposals and scheduling information.
- A heartbeat is separate from a progress timestamp. Stale worker activity does not
  masquerade as productive work, and a healthy heartbeat does not claim useful progress.
- Intermediate AI progress reviews can stop drift before final completion. Counters and
  evidence persist; all reviews consume the same approved request budget.
- Approved plans can start later and repeat a bounded number of times. Recurrences do not
  overwrite the original audit/development evidence or reset the current occurrence's budget.
- Local API stop persists a pause; restarting the server does not silently unpause work.
- Cancellation received while waiting for an AI response is checked before applying its action.

## Verification

Local build and non-browser regressions passed. The three browser tests require Chromium,
which remains unavailable locally; GitHub CI installs it. Exact CI outcomes are recorded
in the follow-up PR, rather than inferred from local availability.

New regression coverage exercises actual browser-route/API ownership contention, Git
subdirectory coordination, a real child Node process inheriting scoped ownership, stale
token rejection, finite recurrence/restart idempotency, progress-review rejection,
cancellation before side effects, heartbeat/progress distinction and persisted API stop.
The dashboard test opens the real built UI, verifies goals/dependencies, changes persisted
state and checks that polling updates the rendered status. Windows CI includes the new
runtime regressions alongside the existing actual PowerShell argument round-trip test.

## Remaining boundaries

- No paid live OpenAI call or installation on the user's Windows PC was performed.
- Shared locks coordinate cooperating adapters, not every possible driver or external editor.
- Browser/API mission definitions are still distinct. One goal owner per checkout remains important.
- Hard-killed owners can leave locks; automatic lease stealing and full descendant-process
  termination are not implemented. Operator reconciliation remains necessary for ambiguous work.
- Recurrence runs the approved workflow again. It does not authorize unbounded model-generated
  project expansion, automatic merges or deployment. Saved proposals remain reviewable inputs.
- Continuous service installation, alternative provider adapters and long-term evidence
  indexing/retention remain separate deployment/development tasks.

## فارسی

این مرحله بخش‌های باقی‌ماندهٔ ممیزی قبلی را جلو می‌برد: جلوگیری از تداخل مسیر
مرورگر و API در اجرای عملیات مشترک، نمایش وضعیت در داشبورد، بازبینی پیشرفت
توسط AI و زمان‌بندی تکرار محدود برنامه‌ها. هدف و شواهد هر نوبت حفظ می‌شوند.
این قابلیت‌ها نیازمند اجرای Keynu روی دستگاه روشن و تنظیم ارائه‌دهندهٔ AI هستند؛
پاس‌شدن تست‌ها به معنی اجرای زنده روی پروژه‌های کاربر یا تضمین قضاوت مدل نیست.
