import { Server as HttpServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { IPC } from '../shared/channels';
import { customManager } from '../electron/services/custom-manager';
import { buildTickPayload } from './handlers';
import { store } from '../electron/services/store';

let wss: WebSocketServer | null = null;
let tickHandle: NodeJS.Timeout | null = null;

export function startWsServer(http: HttpServer) {
  wss = new WebSocketServer({ server: http, path: '/ws' });
  wss.on('connection', socket => {
    socket.on('error', () => undefined);
  });

  customManager.on('status', () => {
    broadcast(IPC.customStatusTick, customManager.list());
  });

  customManager.on('log', (line: any) => {
    broadcast(IPC.customLogTick, line);
  });

  scheduleTick();
}

function scheduleTick() {
  const settings = store.getSettings();
  const interval = Math.max(800, settings.refreshIntervalMs);
  tickHandle = setTimeout(async () => {
    try {
      if (wss && wss.clients.size > 0) {
        const { stats, servers } = await buildTickPayload();
        broadcast(IPC.systemTick, stats);
        broadcast(IPC.serversTick, servers);
      }
    } catch (err) {
      console.error('[ws tick]', err);
    } finally {
      scheduleTick();
    }
  }, interval);
}

export function stopWs() {
  if (tickHandle) clearTimeout(tickHandle);
  tickHandle = null;
  wss?.close();
  wss = null;
}

function broadcast(event: string, data: unknown) {
  if (!wss) return;
  const payload = JSON.stringify({ event, data });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch {
        /* ignore broken socket */
      }
    }
  }
}
