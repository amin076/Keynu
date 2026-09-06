# Keynu npm Dependency Security Audit — 2026-09-07

**Repository:** `amin076/Keynu`  
**Audit branch:** `audit/npm-dependency-security-2026-09-07`  
**Baseline main commit:** `fe2b25ade90f6bf9c052737da793cbba638e3e8d`

## Scope

This audit reviews the dependency graph represented by `package.json` and `package-lock.json` using the npm registry advisory database. It distinguishes production dependencies from development-only/transitive dependencies, records the exact vulnerable path, applies the smallest lockfile-only remediation allowed by the existing declared ranges, and adds a recurring CI security gate.

## Initial result

The first evidence run was GitHub Actions run `34054774944`.

| Scope | Info | Low | Moderate | High | Critical | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| All dependencies | 0 | 0 | 1 | 1 | 0 | 2 |
| Production only | 0 | 0 | 0 | 0 | 0 | 0 |

The two findings were therefore development-only transitive dependencies; the production dependency graph had zero reported vulnerabilities.

### `nanoid` — high

- installed version before remediation: `3.3.16`
- advisory: `GHSA-2v37-7h3g-55p8`
- advisory title: `nanoid: custom generators can loop indefinitely when size is zero`
- affected range reported by npm audit: `<3.3.18`
- direct dependency: no
- fix available: yes

### `postcss` — moderate

- installed version before remediation: `8.5.19`
- advisory: `GHSA-fxqj-rqcc-2cmp`
- advisory title: `PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when from is unset`
- affected range reported by npm audit: `<=8.5.22`
- direct dependency: no
- fix available: yes

## Dependency path

Captured dependency evidence showed:

```text
vite -> postcss 8.5.19 -> nanoid 3.3.16
```

The existing lockfile also showed compatible declared transitive ranges:

```text
vite -> postcss ^8.5.17
postcss -> nanoid ^3.3.12
```

This allowed remediation without changing any top-level dependency range in `package.json`.

## Remediation

The remediation trial used:

```text
npm update postcss nanoid --package-lock-only --ignore-scripts
```

The resulting verified versions are:

```text
postcss 8.5.28
nanoid 3.3.18
```

The remediated dependency path is:

```text
vite -> postcss 8.5.28 -> nanoid 3.3.18
```

The clean remediation evidence was produced by GitHub Actions run `34054924616`. Its final audit reported:

| Scope | Info | Low | Moderate | High | Critical | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| All dependencies | 0 | 0 | 0 | 0 | 0 | 0 |
| Production only | 0 | 0 | 0 | 0 | 0 | 0 |

The verified lockfile update was then persisted to the branch by commit `a036306c59c34f0e11831a9a78df543e2733fec0` (`fix: remediate npm transitive vulnerabilities`).

## Permanent security gate

`.github/workflows/npm-security-audit.yml` is converted from the one-off remediation workflow into a read-only audit gate. It:

- validates the lockfile with `npm ci --ignore-scripts`;
- audits the complete dependency graph;
- separately audits production dependencies with `npm audit --omit=dev`;
- publishes the counts in the GitHub Actions job summary;
- uploads the raw JSON audit evidence for 14 days;
- fails when any **high** or **critical** npm vulnerability is present;
- keeps lower-severity findings visible rather than silently discarding them;
- runs on relevant dependency/workflow changes, on `main`, on audit branches, on pull requests, weekly, and by manual dispatch.

The permanent gate does not update dependencies or write repository contents.

## Security interpretation

The original findings did not establish a production-runtime exposure because `npm audit --omit=dev` reported zero vulnerabilities. They still mattered for Keynu's engineering supply chain because the affected packages were installed in the development/build dependency graph. Updating the lockfile removes the reported advisories while preserving the declared top-level dependency contract.

## Acceptance criteria

This remediation is acceptable for merge only when:

1. the permanent npm security workflow passes on the final branch state;
2. the normal `Keynu validation` workflow passes with the remediated lockfile;
3. the Melakat restart/resume proof remains green if triggered;
4. the final PR changes only the intended lockfile, security workflow, and audit documentation.
