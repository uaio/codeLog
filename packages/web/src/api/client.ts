import type {
  Device,
  ConsoleLog,
  StorageSnapshot,
  DOMSnapshot,
  PerformanceReport,
  SystemInfo,
  IDBOperationEntry,
  SavedLogSessionMeta,
  SavedLogSession,
} from '../types/index.js';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:38291/api';

interface ApiError {
  message: string;
  status?: number;
  url?: string;
}

class ApiClientError extends Error implements ApiError {
  status?: number;
  url?: string;

  constructor(message: string, status?: number, url?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.url = url;
  }
}

async function handleResponse(res: Response, url: string): Promise<any> {
  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const contentType = res.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const errorData = await res.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      }
    } catch {
      // 如果无法解析错误响应，使用默认消息
    }
    throw new ApiClientError(errorMessage, res.status, url);
  }

  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

export const api = {
  async listDevices(projectId?: string): Promise<Device[]> {
    const url = projectId ? `${API_BASE}/devices?projectId=${projectId}` : `${API_BASE}/devices`;
    const res = await fetch(url);
    return handleResponse(res, url);
  },

  async getLogs(deviceId: string, limit?: number, level?: string): Promise<ConsoleLog[]> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (level) params.append('level', level);

    const url = `${API_BASE}/devices/${deviceId}/logs?${params}`;
    const res = await fetch(url);
    return handleResponse(res, url);
  },

  async getDevice(deviceId: string): Promise<Device> {
    const url = `${API_BASE}/devices/${deviceId}`;
    const res = await fetch(url);
    return handleResponse(res, url);
  },

  async deleteLogs(deviceId: string): Promise<{ success: boolean; count: number }> {
    const url = `${API_BASE}/devices/${deviceId}/logs`;
    const res = await fetch(url, {
      method: 'DELETE',
    });
    return handleResponse(res, url);
  },

  async getStorage(deviceId: string): Promise<StorageSnapshot | null> {
    const url = `${API_BASE}/devices/${deviceId}/storage`;
    const res = await fetch(url);
    if (res.status === 404) return null;
    return handleResponse(res, url);
  },

  async getNetworkRequests(deviceId: string, limit?: number): Promise<any[]> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    const url = `${API_BASE}/devices/${deviceId}/network?${params}`;
    const res = await fetch(url);
    return handleResponse(res, url);
  },

  async getDOM(deviceId: string): Promise<DOMSnapshot | null> {
    const url = `${API_BASE}/devices/${deviceId}/dom`;
    const res = await fetch(url);
    if (res.status === 404) return null;
    return handleResponse(res, url);
  },

  async getPerformance(deviceId: string): Promise<PerformanceReport | null> {
    const url = `${API_BASE}/devices/${deviceId}/performance`;
    const res = await fetch(url);
    if (res.status === 404) return null;
    return handleResponse(res, url);
  },

  async getSystemInfo(deviceId: string): Promise<SystemInfo | null> {
    const url = `${API_BASE}/devices/${deviceId}/system`;
    const res = await fetch(url);
    if (res.status === 404) return null;
    return handleResponse(res, url);
  },

  async getIndexedDB(deviceId: string): Promise<IDBOperationEntry[]> {
    const url = `${API_BASE}/devices/${deviceId}/indexeddb`;
    const res = await fetch(url);
    return handleResponse(res, url);
  },

  async getIDBSnapshot(deviceId: string): Promise<any> {
    const url = `${API_BASE}/devices/${deviceId}/idb-snapshot`;
    const res = await fetch(url);
    if (res.status === 404) return null;
    return handleResponse(res, url);
  },

  async getIDBStoreData(deviceId: string, reqId: string): Promise<any> {
    const url = `${API_BASE}/devices/${deviceId}/idb-store-data/${encodeURIComponent(reqId)}`;
    const res = await fetch(url);
    if (res.status === 404) return null;
    return handleResponse(res, url);
  },

  async requestComputedStyles(deviceId: string, selector: string): Promise<void> {
    const url = `${API_BASE}/devices/${deviceId}/computed-styles`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selector }),
    });
  },

  async getComputedStyles(deviceId: string): Promise<{ selector: string; styles: Record<string, string>; timestamp: number } | null> {
    const url = `${API_BASE}/devices/${deviceId}/computed-styles`;
    const res = await fetch(url);
    if (res.status === 404) return null;
    return handleResponse(res, url);
  },

  async setElementAttr(deviceId: string, selector: string, attr: string, value: string): Promise<void> {
    await fetch(`${API_BASE}/devices/${deviceId}/element-attr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selector, attr, value }),
    });
  },

  async listSavedLogs(): Promise<SavedLogSessionMeta[]> {
    const url = `${API_BASE}/saved-logs`;
    const res = await fetch(url);
    return handleResponse(res, url);
  },

  async getSavedLog(sessionId: string): Promise<SavedLogSession> {
    const url = `${API_BASE}/saved-logs/${sessionId}`;
    const res = await fetch(url);
    return handleResponse(res, url);
  },

  async deleteSavedLog(sessionId: string): Promise<void> {
    const url = `${API_BASE}/saved-logs/${sessionId}`;
    await fetch(url, { method: 'DELETE' });
  },

  async get(path: string): Promise<any> {
    const url = path.startsWith('http') ? path : `${API_BASE.replace('/api', '')}${path}`;
    const res = await fetch(url);
    return handleResponse(res, url);
  },

  async post(path: string, body?: any): Promise<any> {
    const url = path.startsWith('http') ? path : `${API_BASE.replace('/api', '')}${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse(res, url);
  },

  async delete(path: string): Promise<any> {
    const url = path.startsWith('http') ? path : `${API_BASE.replace('/api', '')}${path}`;
    const res = await fetch(url, { method: 'DELETE' });
    return handleResponse(res, url);
  },
};

export { ApiClientError };
