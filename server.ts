import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleChatRequest } from './api/_gemini';
import { handleWeatherRequest } from './api/_weather';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always listen on port 3000 for AI Studio / Cloud Run proxy (even if container sets PORT=8080)
const PORT = Number(process.env.APP_PORT) || 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      configured: Boolean(
        process.env.GEMINI_API_KEY &&
          process.env.GEMINI_API_KEY.trim() !== '' &&
          process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY',
      ),
    });
  });

  app.post('/api/chat', async (req: Request, res: Response) => {
    await handleChatRequest(req, res);
  });

  app.all('/api/weather', async (req: Request, res: Response) => {
    await handleWeatherRequest(req, res);
  });

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({
      error: 'API endpoint not found.',
      code: 'ENDPOINT_NOT_FOUND',
      retryable: false,
    });
  });

  const distDir = path.resolve(__dirname, 'dist');
  const isCompiledProdBundle =
    path.basename(__filename) === 'server.js' &&
    fs.existsSync(path.join(distDir, 'index.html'));

  if (process.env.NODE_ENV !== 'production' && !isCompiledProdBundle) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SwiftChat server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
