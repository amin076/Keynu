import { extractKapEnvelope } from '../kap/KapExtractor.js';

export type KapParseResult = {
  ok: boolean;
  kap?: ReturnType<typeof extractKapEnvelope>;
  error?: string;
};

export class KapParserService {
  parse(messageText: string): KapParseResult {
    const kap = extractKapEnvelope(messageText);

    if (!kap) {
      return {
        ok: false,
        error: 'No valid KAP envelope was found.',
      };
    }

    return {
      ok: true,
      kap,
    };
  }
}
