import type { DeviceInfo } from '../types/index.js';
import type { PlatformAdapter } from '../platform/types.js';
import { hashString, fnv1a } from './utils/hash.js';
import { generateTabId } from './utils/id.js';
import { getOrCreateFingerprint } from './fingerprint.js';

export { generateTabId };

/**
 * Generate a stable device ID.
 *
 * Strategy (in order of preference):
 * 1. Browser fingerprint stored in localStorage — same browser/device always gives the same ID.
 * 2. If we are NOT in a browser environment (mini-program, Node), fall back to hashing UA+projectId.
 *
 * The ID is prefixed with the projectId so two different projects on the same device
 * are still distinguishable by the server.
 */
export function generateDeviceId(projectId: string, platform: PlatformAdapter): string {
  try {
    // Browser environment: use stable multi-signal fingerprint + page path
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const fp = getOrCreateFingerprint();
      // Include page path (origin+pathname) so each page URL becomes a distinct device entry.
      // query params / hash fragments are excluded to keep the ID stable within the same route.
      const rawUrl = platform.device.getUrl();
      const pageHash = fnv1a(rawUrl); // getUrl() already returns origin+pathname
      return `${hashString(projectId)}-${fp}-${pageHash}`;
    }
  } catch {
    // fall through to legacy path
  }
  // Non-browser or fingerprint blocked: hash UA + projectId + url
  const ua = platform.device.getUserAgent();
  const url = platform.device.getUrl();
  return hashString(ua + projectId + url);
}

/** 获取设备信息 */
export function getDeviceInfo(projectId: string, platform: PlatformAdapter): DeviceInfo {
  const deviceId = generateDeviceId(projectId, platform);

  const CONNECT_KEY = `_codelog_connect_${projectId}`;
  const existingConnect = platform.storage.getItem(CONNECT_KEY);

  if (!existingConnect) {
    platform.storage.setItem(CONNECT_KEY, Date.now().toString());
  }

  return {
    deviceId,
    projectId,
    ua: platform.device.getUserAgent(),
    screen: platform.device.getScreen(),
    pixelRatio: platform.device.getPixelRatio(),
    language: platform.device.getLanguage(),
    url: platform.device.getUrl(),
    connectTime: existingConnect ? parseInt(existingConnect) : Date.now(),
    lastActiveTime: Date.now(),
  };
}

/** 更新设备活跃时间 */
export function updateDeviceActiveTime(projectId: string, platform: PlatformAdapter): void {
  platform.storage.setItem(`codelog_last_active_${projectId}`, Date.now().toString());
}
