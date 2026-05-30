import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';
import type { SavedLogSessionMeta, SavedLogSession } from '../types/index.js';
import { LogReplayPanel } from './LogReplayPanel.js';

export function OfflineLogsPanel() {
  const [sessions, setSessions] = useState<SavedLogSessionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<SavedLogSession | null>(null);
  const [replaySession, setReplaySession] = useState<SavedLogSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listSavedLogs();
      setSessions(list);
    } catch (e) {
      setError((e as Error).message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const handleOpen = async (id: string) => {
    setLoadingSession(true);
    try {
      const session = await api.getSavedLog(id);
      setSelectedSession(session);
    } catch {
      setError('Failed to load session');
    } finally {
      setLoadingSession(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this saved session?')) return;
    await api.deleteSavedLog(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (selectedSession?.id === id) setSelectedSession(null);
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  if (replaySession) {
    return <LogReplayPanel session={replaySession} onClose={() => setReplaySession(null)} />;
  }

  if (selectedSession) {
    return (
      <div style={styles.container}>
        <div style={styles.toolbar}>
          <button style={styles.backBtn} onClick={() => setSelectedSession(null)}>
            ← Back
          </button>
          <span style={styles.sessionTitle}>
            {selectedSession.deviceId.slice(0, 8)}… · {formatDate(selectedSession.startTime)}
          </span>
          <button style={styles.replayBtn} onClick={() => setReplaySession(selectedSession)}>
            ▶ Replay
          </button>
        </div>
        <div style={styles.logList}>
          {selectedSession.logs.map((entry, i) => {
            const level = (entry as any).level ?? 'log';
            return (
              <div key={i} style={{ ...styles.logRow, borderLeftColor: levelColor(level) }}>
                <span style={styles.logTime}>{formatDate((entry as any).timestamp ?? 0)}</span>
                <span style={{ ...styles.logLevel, color: levelColor(level) }}>
                  {level.toUpperCase()}
                </span>
                <span style={styles.logMsg}>{(entry as any).message}</span>
              </div>
            );
          })}
          {selectedSession.logs.length === 0 && (
            <div style={styles.empty}>No log entries in this session</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <span style={styles.toolbarTitle}>Saved Log Sessions</span>
        <button style={styles.refreshBtn} onClick={loadList} disabled={loading}>
          {loading ? '⟳ Loading…' : '⟳ Refresh'}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {loadingSession && <div style={styles.loading}>Loading session…</div>}

      {!loading && sessions.length === 0 && !error && (
        <div style={styles.empty}>
          No saved sessions yet. Use <code>codeLog.uploadLogs()</code> or{' '}
          <code>codeLog.flushOfflineBuffer()</code> to save.
        </div>
      )}

      <div style={styles.sessionList}>
        {sessions.map((s) => (
          <div key={s.id} style={styles.sessionRow}>
            <div style={styles.sessionInfo}>
              <div style={styles.sessionDevice}>{s.deviceId.slice(0, 12)}…</div>
              <div style={styles.sessionMeta}>
                <span style={styles.sessionDate}>{formatDate(s.startTime)}</span>
                <span style={styles.sessionCount}>{s.entryCount} entries</span>
              </div>
              {s.projectId && <div style={styles.sessionProject}>{s.projectId}</div>}
            </div>
            <div style={styles.sessionActions}>
              <button style={styles.openBtn} onClick={() => handleOpen(s.id)}>
                View
              </button>
              <button style={styles.deleteBtn} onClick={() => handleDelete(s.id)}>
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function levelColor(level: string): string {
  switch (level) {
    case 'error': return '#ff4d4f';
    case 'warn': return '#faad14';
    case 'info': return '#597ef7';
    default: return '#52c41a';
  }
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    overflow: 'hidden',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '13px',
    backgroundColor: '#fff',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    borderBottom: '1px solid #f0f0f0',
    flexShrink: 0,
  },
  toolbarTitle: {
    flex: 1,
    fontWeight: 600 as const,
    color: '#333',
  },
  sessionTitle: {
    flex: 1,
    color: '#666',
    fontSize: '12px',
  },
  refreshBtn: {
    padding: '4px 12px',
    borderRadius: '4px',
    border: '1px solid #d9d9d9',
    cursor: 'pointer',
    backgroundColor: '#fff',
    fontSize: '12px',
  },
  backBtn: {
    padding: '4px 12px',
    borderRadius: '4px',
    border: '1px solid #d9d9d9',
    cursor: 'pointer',
    backgroundColor: '#fff',
    fontSize: '12px',
  },
  error: {
    padding: '8px 16px',
    color: '#ff4d4f',
    backgroundColor: '#fff2f0',
    borderBottom: '1px solid #ffccc7',
  },
  loading: {
    padding: '8px 16px',
    color: '#1890ff',
  },
  empty: {
    padding: '32px 16px',
    textAlign: 'center' as const,
    color: '#999',
    lineHeight: 1.8,
  },
  sessionList: {
    flex: 1,
    overflow: 'auto',
  },
  sessionRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #f5f5f5',
    gap: '8px',
  },
  sessionInfo: {
    flex: 1,
    minWidth: 0,
  },
  sessionDevice: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#333',
  },
  sessionMeta: {
    display: 'flex',
    gap: '12px',
    marginTop: '2px',
  },
  sessionDate: {
    color: '#999',
    fontSize: '11px',
  },
  sessionCount: {
    color: '#1890ff',
    fontSize: '11px',
  },
  sessionProject: {
    color: '#722ed1',
    fontSize: '11px',
    marginTop: '2px',
  },
  sessionActions: {
    display: 'flex',
    gap: '6px',
    flexShrink: 0,
  },
  openBtn: {
    padding: '4px 10px',
    borderRadius: '4px',
    border: '1px solid #1890ff',
    color: '#1890ff',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
  },
  deleteBtn: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #ff4d4f',
    color: '#ff4d4f',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
  },
  replayBtn: {
    padding: '4px 12px',
    borderRadius: '4px',
    border: '1px solid #52c41a',
    color: '#52c41a',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
  },
  logList: {
    flex: 1,
    overflow: 'auto',
  },
  logRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '8px 16px',
    borderBottom: '1px solid #f5f5f5',
    borderLeft: '3px solid #52c41a',
    fontSize: '12px',
  },
  logTime: {
    color: '#999',
    flexShrink: 0,
    fontSize: '11px',
    fontFamily: 'monospace',
  },
  logLevel: {
    flexShrink: 0,
    fontWeight: 600 as const,
    fontSize: '11px',
    minWidth: '36px',
  },
  logMsg: {
    flex: 1,
    wordBreak: 'break-word' as const,
    color: '#333',
    fontFamily: 'monospace',
  },
};
