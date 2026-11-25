import type { IncomingMessage, ServerResponse } from 'http';
import { resolveGeminiApiKey } from './_env.js';

export default function handler(
  _req: IncomingMessage,
  res: ServerResponse,
): void {
  const { apiKey, source, vercelEnv } = resolveGeminiApiKey();
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(
    JSON.stringify({
      ok: true,
      configured: Boolean(apiKey),
      source,
      environment: vercelEnv ?? (process.env.NODE_ENV || 'development'),
    }),
  );
}
