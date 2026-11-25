import type { IncomingMessage, ServerResponse } from 'http';
import { handleGenerateImageRequest } from './_imageGen.js';

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
): Promise<void> {
  await handleGenerateImageRequest(req, res);
}
