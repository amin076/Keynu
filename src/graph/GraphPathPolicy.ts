const INTERNAL_PATH_PREFIXES = [
  ".keynu/",
  ".git/",
  "dist/",
  "node_modules/",
  "runtime-data/",
  "chrome-profile/",
  "coverage/",
];

const INTERNAL_EXACT_PATHS = [
  ".keynu",
  ".git",
  "dist",
  "node_modules",
  "runtime-data",
  "chrome-profile",
  "coverage",
];

export type GraphPathClassification =
  | "repository"
  | "excluded-internal"
  | "invalid";

export function normalizeGraphPath(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const normalized = value
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");

  if (!normalized || normalized.includes("\0")) return null;
  if (/^[A-Za-z]:\//.test(normalized)) return null;
  if (normalized === ".." || normalized.startsWith("../")) return null;

  return normalized;
}

export function classifyGraphPath(value: unknown): GraphPathClassification {
  const normalized = normalizeGraphPath(value);
  if (!normalized) return "invalid";

  if (
    INTERNAL_EXACT_PATHS.includes(normalized) ||
    INTERNAL_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  ) {
    return "excluded-internal";
  }

  return "repository";
}
