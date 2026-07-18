export type KapBlockSource = 'fenced' | 'balanced-json' | 'raw';

export type KapBlock = {
  id?: string;
  source: KapBlockSource;
  raw: string;
  parsed?: unknown;
  parseError?: string;
  index: number;
  info?: string;
};

export type KapInterpretation = {
  blocks: KapBlock[];
  errors: string[];
};

function parseFenceId(info: string): string | undefined {
  const match = /\bid\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s]+))/i.exec(info);
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function parseJson(raw: string): { parsed?: unknown; parseError?: string } {
  const normalized = raw
    .trim()
    .replace(/^\s*(?:kap|json)\s*(?=\{)/i, '');

  try {
    return { parsed: JSON.parse(normalized) as unknown };
  } catch (error) {
    return {
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
}

function extractBalancedJson(text: string): string[] {
  const candidates: string[] = [];

  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== '{') continue;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index += 1) {
      const character = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === '\\') {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }

      if (character === '"') {
        inString = true;
        continue;
      }

      if (character === '{') {
        depth += 1;
      } else if (character === '}') {
        depth -= 1;

        if (depth === 0) {
          candidates.push(text.slice(start, index + 1));
          start = index;
          break;
        }
      }
    }
  }

  return candidates;
}

export class KapInterpreter {
  interpret(text: string): KapInterpretation {
    const blocks: KapBlock[] = [];
    const errors: string[] = [];
    const fencedBlockPattern = /```kap(?<info>[^\n`]*)\n(?<body>[\s\S]*?)```/gi;

    for (const match of text.matchAll(fencedBlockPattern)) {
      const info = match.groups?.info?.trim() ?? '';
      const raw = match.groups?.body ?? '';
      const parsed = parseJson(raw);
      const block: KapBlock = {
        id: parseFenceId(info),
        source: 'fenced',
        raw,
        index: blocks.length,
        info,
        ...parsed,
      };
      blocks.push(block);
      if (block.parseError) {
        errors.push(`KAP block ${block.index} could not be parsed: ${block.parseError}`);
      }
    }

    if (blocks.length > 0) {
      return { blocks, errors };
    }

    for (const raw of extractBalancedJson(text)) {
      const parsed = parseJson(raw);
      if (parsed.parsed) {
        blocks.push({
          source: 'balanced-json',
          raw,
          index: blocks.length,
          ...parsed,
        });
      }
    }

    if (blocks.length > 0) {
      return { blocks, errors };
    }

    if (text.trim()) {
      const parsed = parseJson(text);
      if (parsed.parsed || parsed.parseError) {
        const block: KapBlock = {
          source: 'raw',
          raw: text,
          index: 0,
          ...parsed,
        };
        if (block.parsed) {
          blocks.push(block);
        } else if (text.trim().startsWith('{')) {
          blocks.push(block);
          errors.push(`KAP text could not be parsed: ${block.parseError}`);
        }
      }
    }

    return { blocks, errors };
  }
}
