const ENV_KEY_CANDIDATES = [
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
] as const;

export type GeminiKeySource = (typeof ENV_KEY_CANDIDATES)[number];

const PLACEHOLDER_KEYS = new Set([
  'MY_GEMINI_API_KEY',
  'YOUR_GEMINI_API_KEY',
  'YOUR_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'API_KEY',
  'PLACEHOLDER',
  'REPLACE_ME',
  'TEST_KEY',
  'UNDEFINED',
  'NULL',
]);

export function sanitizeEnvApiKey(raw: string | undefined): string | null {
  if (typeof raw !== 'string') return null;

  let cleaned = raw.trim();
  if (!cleaned) return null;

  // Strip matching single, double, or backtick quotes if pasted into Vercel Env UI
  while (
    cleaned.length >= 2 &&
    ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'")) ||
      (cleaned.startsWith('`') && cleaned.endsWith('`')))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  if (!cleaned) return null;
  if (PLACEHOLDER_KEYS.has(cleaned.toUpperCase())) {
    return null;
  }

  return cleaned;
}

export interface ResolvedGeminiKey {
  apiKey: string | null;
  source: GeminiKeySource | null;
  vercelEnv: string | null;
}

export function resolveGeminiApiKey(): ResolvedGeminiKey {
  const vercelEnv = process.env.VERCEL_ENV?.trim() || null;

  for (const name of ENV_KEY_CANDIDATES) {
    const cleaned = sanitizeEnvApiKey(process.env[name]);
    if (cleaned) {
      return {
        apiKey: cleaned,
        source: name,
        vercelEnv,
      };
    }
  }

  return {
    apiKey: null,
    source: null,
    vercelEnv,
  };
}

export function redactApiKeys(text: string): string {
  return text
    .replace(/AIza[0-9A-Za-z_-]{8,}/g, '[REDACTED_KEY]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');
}
