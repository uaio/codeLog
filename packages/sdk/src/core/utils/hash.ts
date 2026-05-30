/** 简单的字符串 hash 函数 (djb2) */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/**
 * FNV-1a 32-bit hash — better distribution for fingerprinting.
 * Returns an 8-char hex string.
 */
export function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Combine multiple FNV-1a hashes into a single 16-char ID.
 * Used for browser fingerprinting.
 */
export function combineHashes(...parts: string[]): string {
  const a = fnv1a(parts.slice(0, Math.ceil(parts.length / 2)).join('|'));
  const b = fnv1a(parts.slice(Math.ceil(parts.length / 2)).join('|'));
  return a + b;
}
