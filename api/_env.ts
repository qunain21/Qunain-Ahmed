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
    .replace(/hf_[0-9A-Za-z]{8,}/g, '[REDACTED_HF_TOKEN]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');
}

export type ImageGenProviderId =
  | 'huggingface'
  | 'cloudflare'
  | 'pollinations_key'
  | 'pollinations_free';

export interface ImageGenConfig {
  providerId: ImageGenProviderId;
  providerLabel: string;
  hasKey: boolean;
  source: string | null;
  freeTierNote: string;
  hfToken?: string;
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  pollinationsApiKey?: string;
}

export function resolveImageGenConfig(): ImageGenConfig {
  const hfToken =
    sanitizeEnvApiKey(process.env.HF_TOKEN) ??
    sanitizeEnvApiKey(process.env.HUGGINGFACE_API_KEY);
  const hfSource = sanitizeEnvApiKey(process.env.HF_TOKEN)
    ? 'HF_TOKEN'
    : sanitizeEnvApiKey(process.env.HUGGINGFACE_API_KEY)
      ? 'HUGGINGFACE_API_KEY'
      : null;

  const cfToken = sanitizeEnvApiKey(process.env.CLOUDFLARE_API_TOKEN);
  const cfAccount = sanitizeEnvApiKey(process.env.CLOUDFLARE_ACCOUNT_ID);
  const pollinationsKey = sanitizeEnvApiKey(process.env.POLLINATIONS_API_KEY);

  const preferred = process.env.IMAGE_GEN_PROVIDER?.trim().toLowerCase();

  if (preferred === 'cloudflare' && cfToken && cfAccount) {
    return {
      providerId: 'cloudflare',
      providerLabel: 'Cloudflare Workers AI (FLUX.1 Schnell)',
      hasKey: true,
      source: 'CLOUDFLARE_API_TOKEN',
      freeTierNote: 'Free tier: 10,000 Neurons/day via Cloudflare Workers AI',
      cloudflareAccountId: cfAccount,
      cloudflareApiToken: cfToken,
    };
  }

  if (preferred === 'pollinations' && pollinationsKey) {
    return {
      providerId: 'pollinations_key',
      providerLabel: 'Pollinations AI (Flux)',
      hasKey: true,
      source: 'POLLINATIONS_API_KEY',
      freeTierNote: 'Pollinations API key active',
      pollinationsApiKey: pollinationsKey,
    };
  }

  if (hfToken) {
    return {
      providerId: 'huggingface',
      providerLabel: 'Hugging Face (FLUX.1 Schnell)',
      hasKey: true,
      source: hfSource,
      freeTierNote: 'Free tier: monthly Hugging Face inference credits',
      hfToken,
    };
  }

  if (cfToken && cfAccount) {
    return {
      providerId: 'cloudflare',
      providerLabel: 'Cloudflare Workers AI (FLUX.1 Schnell)',
      hasKey: true,
      source: 'CLOUDFLARE_API_TOKEN',
      freeTierNote: 'Free tier: 10,000 Neurons/day via Cloudflare Workers AI',
      cloudflareAccountId: cfAccount,
      cloudflareApiToken: cfToken,
    };
  }

  if (pollinationsKey) {
    return {
      providerId: 'pollinations_key',
      providerLabel: 'Pollinations AI (Flux)',
      hasKey: true,
      source: 'POLLINATIONS_API_KEY',
      freeTierNote: 'Pollinations API key active',
      pollinationsApiKey: pollinationsKey,
    };
  }

  return {
    providerId: 'pollinations_free',
    providerLabel: 'Pollinations Free Tier (Flux)',
    hasKey: false,
    source: null,
    freeTierNote:
      'Free public tier: up to 1 image every 45 seconds per IP. Add HF_TOKEN or CLOUDFLARE_API_TOKEN for higher limits.',
  };
}
