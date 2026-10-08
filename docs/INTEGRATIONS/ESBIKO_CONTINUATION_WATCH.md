# Esbiko continuation watch: zero-API-cost handoff

## What this actually does
- Runs an hourly tracker check through GitHub Actions in this **public** Keynu repository, or once locally with Node 22+.
- Reads Esbiko's existing tracker issue [#122](https://github.com/amin076/science-web-lab/issues/122).
- Extracts the first TWO browser-WebMCP-pending simulation IDs, and reports browser-ready and remaining counts.
- Creates or updates a single **Keynu** issue, "Esbiko continuation queue", *only when the handoff changes*. No duplicate hourly notifications.
- Fails closed if the issue's pending section is missing/ambiguous. Does not change Esbiko code or mark tests as passed.
- Has **zero OpenAI API calls**, needs **no OPENAI_API_KEY**, and does not use a browser agent.

The handoff issue is **not an instruction delivered to a live ChatGPT conversation**. An external system has no direct supported way to reawaken this particular chat via the standard OpenAI API. Use the issue as a durable work queue; a separate explicitly-authorized worker could pick it up.

The current counts measure **browser WebMCP discovery only**; end-to-end server MCP control from ChatGPT and video/mobile readiness must be separately tested before calling any simulation fully complete.

## Run from a Windows/PowerShell terminal

After checkout (no npm install needed for the monitor):

    node scripts/esbiko-continuation-watch.mjs

Offline tests:

    node --test scripts/tests/esbiko-continuation-watch.test.mjs

To run periodically on a local PC, configure a Windows Task Scheduler hourly task for this Node script, with the repository directory as working directory. It will stop when the PC is switched off; GitHub Actions is better for an always-on *monitor* and requires no Google Cloud deployment.

## GitHub Actions

Workflow: `.github/workflows/esbiko-continuation-watch.yml`.

- Hourly cron (may start late under GitHub scheduling load).
- Manual dispatch is available.
- Runs Node test suite first.
- Reads public Esbiko issue via GitHub REST API.
- Writes one deduplicated issue in Keynu using the workflow's scoped GITHUB_TOKEN.
- No OpenAI API request, no paid coding agent, no Esbiko branch changes, no merge/deployment.
- Standard hosted runners in public repositories are currently free under GitHub's documented policy; artifact storage/other GitHub plan terms still apply.
- GitHub can disable scheduled workflows in inactive public repositories after prolonged inactivity; monitor workflow settings.

## Optional existing Keynu reasoning worker (NOT zero-cost)

The existing `Esbiko Keynu mission` workflow has a manual `prepare` mode requiring no AI calls and a `run` mode requiring the `OPENAI_API_KEY` GitHub Actions secret and an `OPENAI_MODEL` model choice. Its API worker has a persisted **AI-call count budget, not a US-dollar budget**. This update intentionally does not turn on the paid run mode automatically.

The API key on a local Windows machine is not automatically available in a GitHub Actions job; configure the secret independently if you decide to make a paid test. Never commit or share the key. Plus/Codex plan access does not mean OpenAI API credits.

### Pricing and the USD 0.10/day target
The paid API is billed separately. The separate **complimentary-token-for-API-data-sharing** program can provide qualifying organizations with daily free token pools: currently up to **2.5 million tokens/day** for supported smaller models in the **Build** tier (up to **10 million** for Launch/Grow); a separate larger-model pool exists. This is likely the 2.5M figure you remember. It is **not** a rate limit or a default entitlement: the organization must be eligible, explicitly opt into sharing eligible API traffic, maintain a positive balance, and use included models. An entire request that takes usage past the quota is billed, and tool calls/fine-tuned models are excluded. Sharing source code and prompts has privacy and intellectual-property implications; do not enable it without an informed choice. See https://help.openai.com/en/articles/10306912-sharing-feedback-evaluation-and-fine-tuning-data-and-api-inputs-and-outputs-with-openai . OpenAI tier rate limits (tokens per minute/day) are a separate concept and do not imply free tokens.

If you later enable paid model calls:
1. Check the API project's actual credit balance, daily token eligibility, billing preferences and spend controls.
2. Choose a low-cost model and start with **one** bounded, manually triggered test.
3. Record real request/response token usage and compute actual charges.
4. Add a separately enforced conservative per-day **dollar budget** before scheduling AI tasks; a call-count cap alone does not satisfy the USD 0.10 requirement.
5. Never retry automatically after quota errors; never put repository secrets into public logs, issues or AI prompts.

Do not claim the API key is available or a live OpenAI call passed unless a genuine billed provider request is observed.
