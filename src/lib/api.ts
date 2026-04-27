import type { IpcResult } from '../../shared/types';
import { useStore } from './store';

export const api = window.llsgc;

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
