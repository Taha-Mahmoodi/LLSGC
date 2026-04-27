import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  const precision = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(precision)} ${units[i]}`;
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0%';
  if (value < 1) return `${value.toFixed(1)}%`;
  if (value < 10) return `${value.toFixed(1)}%`;
  return `${Math.round(value)}%`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '–';
  const s = Math.floor(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

export function formatRelativeTime(timestamp: number): string {
  const diff = (Date.now() - timestamp) / 1000;
  if (diff < 5) return 'just now';
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function truncate(text: string | undefined, length: number): string {
  if (!text) return '';
  if (text.length <= length) return text;
  return text.slice(0, length - 1) + '…';
}

export function shortenCommand(cmd: string | undefined, length = 80): string {
  if (!cmd) return '';
  const collapsed = cmd.replace(/\s+/g, ' ').trim();
  return truncate(collapsed, length);
}

export function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const palette = [
    '#7da6ff',
    '#62d4a3',
    '#f1b95a',
    '#ec7d7d',
    '#b388ff',
    '#5fd1ce',
    '#ffa07a',
    '#a3d977',
  ];
  return palette[Math.abs(hash) % palette.length];
}

export function isLikelyHttp(port: number): boolean {
  const httpPorts = new Set([80, 443, 3000, 3001, 4200, 5000, 5173, 5174, 5500, 8000, 8080, 8081, 8443, 9000]);
  if (httpPorts.has(port)) return true;
  if (port >= 3000 && port <= 9999) return true;
  return false;
}
