export type APITokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
  categories?: Record<string, number>;
};

function addOptionalNumber(left?: number, right?: number): number | undefined {
  if (left === undefined && right === undefined) return undefined;
  return (left ?? 0) + (right ?? 0);
}

export function mergeTokenUsage(
  left: APITokenUsage = {},
  right: APITokenUsage = {},
): APITokenUsage {
  const categories = {
    ...(left.categories ?? {}),
  };

  for (const [key, value] of Object.entries(right.categories ?? {})) {
    categories[key] = (categories[key] ?? 0) + value;
  }

  return {
    promptTokens: addOptionalNumber(left.promptTokens, right.promptTokens),
    completionTokens: addOptionalNumber(
      left.completionTokens,
      right.completionTokens,
    ),
    cachedTokens: addOptionalNumber(left.cachedTokens, right.cachedTokens),
    reasoningTokens: addOptionalNumber(
      left.reasoningTokens,
      right.reasoningTokens,
    ),
    totalTokens: addOptionalNumber(left.totalTokens, right.totalTokens),
    categories: Object.keys(categories).length > 0 ? categories : undefined,
  };
}
