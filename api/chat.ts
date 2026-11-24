import type { IncomingMessage, ServerResponse } from 'http';
import { handleChatRequest } from './_gemini.js';

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
): Promise<void> {
  await handleChatRequest(req, res);
}
