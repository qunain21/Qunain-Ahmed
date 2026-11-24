import type { IncomingMessage, ServerResponse } from 'http';

export default function handler(
  _req: IncomingMessage,
  res: ServerResponse,
): void {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(
    JSON.stringify({
      ok: true,
      configured: Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY'),
    }),
  );
}
