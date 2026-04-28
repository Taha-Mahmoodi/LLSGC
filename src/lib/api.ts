import type { IpcResult } from '../../shared/types';
import type { LLSGCApi } from '../types/window';
import { browserApi, isElectron } from './browser-api';
import { useStore } from './store';

/**
 * Single API surface that works in both runtimes:
 *
 *  - Electron desktop : `window.llsgc` is injected by preload.ts via
 *    contextBridge — we use that.
 *  - Browser (lite zip / web mode) : no preload, we fall back to
 *    HTTP `POST /api/call` + WebSocket `/ws` (browserApi).
 *
 * Components import `api` exactly the same way regardless. Same React
 * bundle ships in both the Electron .exe and the lite zip.
 */
export const api: LLSGCApi = isElectron()
  ? (window as unknown as { llsgc: LLSGCApi }).llsgc
  : browserApi;

export const isElectronEnv = isElectron;

export async function call<T>(
  promise: Promise<IpcResult<T>>,
  errorTitle = 'Operation failed',
): Promise<T | null> {
  try {
    const r = await promise;
    if (r.ok) return r.data ?? (undefined as unknown as T);
    useStore.getState().pushToast({
      title: errorTitle,
      description: r.error,
      tone: 'err',
    });
    return null;
  } catch (err: any) {
    useStore.getState().pushToast({
      title: errorTitle,
      description: err?.message ?? String(err),
      tone: 'err',
    });
    return null;
  }
}

export async function callOk<T>(
  promise: Promise<IpcResult<T>>,
  successTitle?: string,
  errorTitle = 'Operation failed',
): Promise<T | null> {
  const result = await call(promise, errorTitle);
  if (result !== null && successTitle) {
    useStore.getState().pushToast({ title: successTitle, tone: 'ok' });
  }
  return result;
}
