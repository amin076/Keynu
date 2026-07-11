export type KapEnvelope = {
  protocol: string;
  version: string;
  type: string;
  id: string;
  createdAt?: string;
  payload?: unknown;
};

export function extractKapEnvelope(text: string): KapEnvelope | null {
  const match = text.match(/```kap\s*([\s\S]*?)\s*```/);

  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[1]) as KapEnvelope;
  } catch {
    return null;
  }
}
