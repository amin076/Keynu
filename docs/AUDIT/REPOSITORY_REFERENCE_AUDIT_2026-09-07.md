# Keynu Repository Reference & Hygiene Audit — 2026-09-07

**Branch:** `chore/repository-reference-audit`  
**Scope:** tracked repository residue, generated source-tree output, backup artifacts, ignore policy, and continuation-document reference drift.

## Result

The audit identified a bounded set of tracked files that are not source-of-truth inputs and can be removed without changing Keynu runtime semantics. A repository-hygiene CI contract now makes the same classes of residue fail deterministically if they are reintroduced.

## Verified findings

### 1. Root smoke-test residue

Six tracked root-level text files match ad-hoc command/pipeline/reconnect/workflow test output rather than product source:

- `keynu-command-test.txt`
- `keynu-pipeline-test.txt`
- `keynu-reconnect-health-check.txt`
- `keynu-success-test.txt`
- `keynu-workflow-continuation-test.txt`
- `new-job-test.txt`

They are removed and matching scratch-file patterns are ignored going forward.

### 2. TypeScript compiler output committed beside source

`tsconfig.json` declares `rootDir: "src"` and `outDir: "dist"`, but generated `.js`, `.js.map`, `.d.ts`, and `.d.ts.map` siblings were tracked beside TypeScript sources under:

- `src/index.*`
- `src/core/{Agent,Config,Driver,DriverManager,Logger,registerBuiltinDrivers}.*`
- `src/drivers/filesystem/FileSystemDriver.*`

The 32 generated siblings are removed. The corresponding `.ts` source files remain authoritative. `.gitignore` now rejects generated compiler siblings under `src/`; normal build output remains under `dist/`.

### 3. Stale source backup

`src/kap/KapExtractor.ts.backup` contains an older regex/JSON-parse implementation and an inline `KapEnvelope` type. The current `src/kap/KapExtractor.ts` instead delegates interpretation and validation to `KapInterpreter` and `KapValidator` and imports the canonical `KapEnvelope` type. The backup is therefore stale, redundant, and removed. Existing backup ignore rules remain in force.

### 4. Continuation documentation reference drift

`docs/AUDIT/KEYNU_RUNTIME_AUDIT_2026-09-06.md` is preserved as a historical point-in-time audit. A supersession note now directs continuation-specific interpretation to accepted `docs/adr/ADR-0012-CONTINUATION-RUNTIME-UNIFICATION.md`.

The current architectural decision is one active continuation authority centered on `BrowserContinuationCoordinator` and persistent mission/job stores. The older `src/workflow` continuation path is a legacy compatibility boundary rather than a second active continuation runtime.

## Enforcement

`src/runtime/tests/RepositoryHygiene.test.ts` scans the repository and fails when it finds:

- known root smoke-marker filename patterns;
- `*.backup` files under `src`;
- generated `.js`, `.js.map`, `.d.ts`, or `.d.ts.map` siblings beside TypeScript source files.

This converts the cleanup rule from documentation into an executable repository contract.

## Deliberately retained

- `processed/*.json` is not deleted in this pass. Those files may represent historical runtime evidence; provenance and reference intent are not sufficiently established for destructive cleanup.
- Historical audit/ADR documents are retained. Documentation is corrected by supersession/reference notes rather than rewriting history.
- Compatibility layers protected by ADR-0011 are untouched.

## Runtime impact

No runtime behavior, KAP contract, mission semantics, driver behavior, or external API is intentionally changed by this cleanup. The source-of-truth TypeScript files remain in place; only verified residue, generated duplicates, and stale backup material are removed.

## Verification

The cleanup is complete only when the branch CI/test entry point passes with `RepositoryHygiene.test.ts` enabled. Dependency vulnerability review is a separate follow-up audit and is intentionally not folded into this repository-hygiene change.
