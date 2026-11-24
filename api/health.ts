import type { IncomingMessage, ServerResponse } from 'http';
import { sendJson } from './_gemini.js';

export default function handler(
  _req: IncomingMessage,
  res: ServerResponse,
): void {
  sendJson(res, 200, {
    ok: true,
    configured: Boolean(
      process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY.trim() !== '' &&
        process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY',
    ),
  });
}
