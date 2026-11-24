import type { IncomingMessage, ServerResponse } from 'http';
import { handleWeatherRequest } from './_weather.js';

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
): Promise<void> {
  await handleWeatherRequest(req, res);
}
