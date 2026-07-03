import type { YouTubeMetadataDraft, YouTubeUploadInput } from "./types.js";

const DEFAULT_CATEGORY_ID = "28"; // Science & Technology

export function cleanTags(tags: string[] = []): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const raw of tags) {
    const tag = raw.replace(/^#+/, "").trim().replace(/\s+/g, " ");
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    cleaned.push(tag);
  }

  return trimTagsToYouTubeLimit(cleaned);
}

export function trimTitle(title: string): string {
  return title.replace(/[<>]/g, "").trim().slice(0, 100);
}

export function trimDescription(description = ""): string {
  const safe = description.replace(/[<>]/g, "").trim();
  return Buffer.byteLength(safe, "utf8") <= 5000 ? safe : safe.slice(0, 4900);
}

export function trimTagsToYouTubeLimit(tags: string[]): string[] {
  const output: string[] = [];
  let length = 0;

  for (const tag of tags) {
    const effectiveLength = tag.includes(" ") ? tag.length + 2 : tag.length;
    const extraComma = output.length > 0 ? 1 : 0;
    if (length + effectiveLength + extraComma > 500) break;
    output.push(tag);
    length += effectiveLength + extraComma;
  }

  return output;
}

export function buildMetadata(input: YouTubeUploadInput, fallbackCategoryId = DEFAULT_CATEGORY_ID): YouTubeMetadataDraft {
  return {
    title: trimTitle(input.title),
    description: trimDescription(input.description),
    tags: cleanTags(input.tags),
    categoryId: input.categoryId || fallbackCategoryId,
    madeForKids: input.madeForKids ?? false,
  };
}
