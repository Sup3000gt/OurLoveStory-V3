export const DEFAULT_MEMORY_PAGE_SIZE = 12;
export const MAX_MEMORY_PAGE_SIZE = 24;

export interface MemoryCursor {
  takenAt: string;
  createdAt: string;
  id: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeMemoryCursor(cursor: MemoryCursor): string {
  const bytes = encoder.encode(JSON.stringify(cursor));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function decodeMemoryCursor(value: string | null): MemoryCursor | null {
  if (!value) return null;

  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed = JSON.parse(decoder.decode(bytes)) as Partial<MemoryCursor>;
    if (
      typeof parsed.takenAt !== 'string'
      || typeof parsed.createdAt !== 'string'
      || typeof parsed.id !== 'string'
      || !parsed.takenAt
      || !parsed.createdAt
      || !parsed.id
    ) {
      return null;
    }
    return {
      takenAt: parsed.takenAt,
      createdAt: parsed.createdAt,
      id: parsed.id,
    };
  } catch {
    return null;
  }
}

export function normalizeMemoryPageSize(value: string | null): number {
  if (value === null) return DEFAULT_MEMORY_PAGE_SIZE;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return DEFAULT_MEMORY_PAGE_SIZE;
  return Math.min(MAX_MEMORY_PAGE_SIZE, Math.max(1, parsed));
}
