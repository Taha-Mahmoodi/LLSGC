import { startHttpServer } from './http';
import { startWsServer, stopWs } from './ws';
import { customManager } from '../electron/services/custom-manager';
import { getDataDir, initStore, store } from '../electron/services/store';

initStore(getDataDir());

interface CliArgs {
  port: number;
  host: string;
  noOpen: boolean;
  noAutoStart: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    port: parseIntEnv('LLSGC_PORT', 47291),
    host: process.env.LLSGC_HOST ?? '127.0.0.1',
    noOpen: false,
    noAutoStart: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port' || a === '-p') {
      args.port = parseInt(argv[++i] ?? '', 10) || args.port;
    } else if (a.startsWith('--port=')) {
      args.port = parseInt(a.slice(7), 10) || args.port;
    } else if (a === '--host' || a === '-H') {
      args.host = argv[++i] ?? args.host;
    } else if (a.startsWith('--host=')) {
      args.host = a.slice(7) || args.host;
    } else if (a === '--no-open') {
      args.noOpen = true;
    } else if (a === '--no-auto-start') {
      args.noAutoStart = true;
    } else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else if (a === '--version' || a === '-v') {
      console.log(process.env.LLSGC_VERSION ?? 'dev');
      process.exit(0);
    }
  }
  return args;
}

function parseIntEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function printHelp() {
  console.log(`llsgc-server — Live Local Servers GUI Controller (web)

Usage:
  llsgc-server [options]

Options:
  -p, --port <port>      Port to listen on (default: 47291, env: LLSGC_PORT)
  -H, --host <host>      Host to bind to (default: 127.0.0.1, env: LLSGC_HOST)
      --no-open          Do not open the browser on start
      --no-auto-start    Skip auto-starting saved launchers
  -v, --version          Print version and exit
  -h, --help             Show this help

Data is stored in ~/.config/llsgc/ (or %APPDATA%/LLSGC/ on Windows).
Override with LLSGC_HOME=<dir>.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const httpServer = startHttpServer(args.port, args.host);
  startWsServer(httpServer);

  if (!args.noAutoStart) customManager.autoStartAll();

  const url = `http://${args.host === '0.0.0.0' ? 'localhost' : args.host}:${args.port}`;
  console.log(`\n  ▶ LLSGC server running at ${url}`);
  console.log(`    config: ${getDataDir()}`);
  console.log(`    Ctrl+C to stop.\n`);

  if (!args.noOpen) {
    try {
      const opener = await import('open');
      await opener.default(url);
    } catch {
      /* opener can fail in headless environments — not fatal */
    }
  }

  const shutdown = (signal: string) => {
    console.log(`\n  ${signal} received, shutting down…`);
    stopWs();
    customManager.shutdown();
    store.flush();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch(err => {
  console.error('[llsgc-server] fatal', err);
  process.exit(1);
});
