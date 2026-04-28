import express from 'express';
import { createServer, Server as HttpServer } from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { handlers } from './handlers';

export function startHttpServer(port: number, host: string): HttpServer {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.post('/api/call', async (req, res) => {
    const { channel, args = [] } = req.body ?? {};
    if (!channel || typeof channel !== 'string') {
      res.status(400).json({ ok: false, error: 'Missing channel' });
      return;
    }
    const handler = handlers[channel];
    if (!handler) {
      res.status(404).json({ ok: false, error: `Unknown channel: ${channel}` });
      return;
    }
    try {
      const result = await handler(...(Array.isArray(args) ? args : []));
      res.json(result ?? { ok: true });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message ?? String(err) });
    }
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      version: process.env.LLSGC_VERSION ?? 'dev',
      mode: getServeMode(),
    });
  });

  attachClient(app);

  const server = createServer(app);
  server.listen(port, host);
  return server;
}

type ServeMode = 'sea' | 'filesystem' | 'none';

function getServeMode(): ServeMode {
  if (seaInfo.enabled) return 'sea';
  return resolveClientDir() ? 'filesystem' : 'none';
}

function attachClient(app: express.Express) {
  if (seaInfo.enabled) {
    attachSeaClient(app);
    return;
  }
  const clientDir = resolveClientDir();
  if (clientDir) {
    app.use(express.static(clientDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDir, 'index.html'));
    });
    return;
  }
  app.get('*', (_req, res) => {
    res
      .status(404)
      .send('Client bundle not built. Run `npm run build` or `npm run dev`.');
  });
}

function attachSeaClient(app: express.Express) {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/ws') return next();
    const target = req.path === '/' ? '/index.html' : req.path;
    const buf = readSeaAsset(target);
    if (!buf) return next();
    res.type(path.extname(target) || '.html');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buf);
  });
  app.get('*', (_req, res) => {
    const buf = readSeaAsset('/index.html');
    if (buf) {
      res.type('html');
      res.send(buf);
    } else {
      res.status(404).send('Client bundle missing in SEA build.');
    }
  });
}

function resolveClientDir(): string | null {
  const exeDir = path.dirname(process.execPath);
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'dist'),                  // LLSGC desktop renderer build (dev test)
    path.join(cwd, 'dist/client'),           // LLSGC-server style
    path.join(cwd, 'client'),                // running from inside lite-zip dir
    path.join(exeDir, 'client'),             // packaged sibling folder
    path.join(exeDir, '../client'),
    path.join(exeDir, 'resources/app/dist'), // electron-builder asar layout
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'index.html'))) return c;
  }
  return null;
}

interface SeaInfo {
  enabled: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  api: any | null;
}

const seaInfo: SeaInfo = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('node:sea');
    if (mod && typeof mod.isSea === 'function' && mod.isSea()) {
      return { enabled: true, api: mod };
    }
  } catch {
    /* node < 20 or not bundled with SEA */
  }
  return { enabled: false, api: null };
})();

function readSeaAsset(name: string): Buffer | null {
  if (!seaInfo.enabled || !seaInfo.api) return null;
  try {
    const arr = seaInfo.api.getAsset(name);
    return Buffer.from(arr);
  } catch {
    return null;
  }
}
