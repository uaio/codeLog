export interface SavedLogEntry {
  timestamp: number;
  level: string;
  message: string;
  stack?: string;
  tabId?: string;
}

export interface SavedLogSession {
  id: string;
  deviceId: string;
  ua: string;
  projectId?: string;
  startTime: number;
  endTime: number;
  uploadedAt: number;
  entryCount: number;
  logs: SavedLogEntry[];
}

export class SavedLogStore {
  private sessions: Map<string, SavedLogSession> = new Map();
  private readonly maxSessions = 200;

  save(session: Omit<SavedLogSession, 'id' | 'uploadedAt'>): SavedLogSession {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const saved: SavedLogSession = { ...session, id, uploadedAt: Date.now() };
    this.sessions.set(id, saved);
    this._evict();
    return saved;
  }

  list(): Omit<SavedLogSession, 'logs'>[] {
    return [...this.sessions.values()]
      .map(({ logs: _logs, ...meta }) => meta)
      .sort((a, b) => b.uploadedAt - a.uploadedAt);
  }

  get(id: string): SavedLogSession | undefined {
    return this.sessions.get(id);
  }

  delete(id: string): boolean {
    return this.sessions.delete(id);
  }

  private _evict(): void {
    if (this.sessions.size > this.maxSessions) {
      const oldest = [...this.sessions.entries()].sort(
        ([, a], [, b]) => a.uploadedAt - b.uploadedAt,
      );
      const toDelete = oldest.slice(0, this.sessions.size - this.maxSessions);
      for (const [id] of toDelete) this.sessions.delete(id);
    }
  }
}
