import { useState, useEffect, useRef, useCallback } from 'react';
import type { SavedLogSession } from '../types/index.js';

interface LogReplayProps {
  session: SavedLogSession;
  onClose: () => void;
}

interface ReplayEntry {
  index: number;
  timestamp: number;
  level: string;
  message: string;
  stack?: string;
}

export function LogReplayPanel({ session, onClose }: LogReplayProps) {
  const entries: ReplayEntry[] = (session.logs as any[]).map((l, i) => ({
    index: i,
    timestamp: l.timestamp ?? 0,
    level: l.level ?? 'log',
    message: l.message ?? '',
    stack: l.stack,
  }));

  const duration = entries.length > 1
    ? entries[entries.length - 1].timestamp - entries[0].timestamp
    : 0;
  const startTs = entries[0]?.timestamp ?? 0;

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0); // ms from start
  const [visibleUntil, setVisibleUntil] = useState(-1); // show entries up to this index
  const rafRef = useRef<number | null>(null);
  const lastRealTimeRef = useRef<number>(0);
  const simTimeRef = useRef<number>(0);

  const visibleEntries = entries.slice(0, visibleUntil + 1);

  const tick = useCallback(() => {
    const now = performance.now();
    const elapsed = (now - lastRealTimeRef.current) * speed;
    lastRealTimeRef.current = now;
    simTimeRef.current += elapsed;

    const t = simTimeRef.current;
    setCurrentTime(t);

    const newVisible = entries.filter((e) => e.timestamp - startTs <= t).length - 1;
    setVisibleUntil(newVisible);

    if (t >= duration) {
      setPlaying(false);
      simTimeRef.current = duration;
      setCurrentTime(duration);
      setVisibleUntil(entries.length - 1);
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [entries, startTs, duration, speed]);

  useEffect(() => {
    if (playing) {
      lastRealTimeRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, tick]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value);
    simTimeRef.current = t;
    setCurrentTime(t);
    const newVisible = entries.filter((en) => en.timestamp - startTs <= t).length - 1;
    setVisibleUntil(newVisible);
  };

  const handlePlay = () => {
    if (currentTime >= duration) {
      simTimeRef.current = 0;
      setCurrentTime(0);
      setVisibleUntil(-1);
    }
    setPlaying(true);
  };

  const formatMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.${String(Math.floor((ms % 1000) / 100))}`;
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <button style={styles.backBtn} onClick={onClose}>← Back</button>
        <span style={styles.title}>
          Replay · {entries.length} entries · {formatMs(duration)}
        </span>
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        {playing ? (
          <button style={styles.ctrlBtn} onClick={() => setPlaying(false)}>⏸ Pause</button>
        ) : (
          <button style={styles.ctrlBtn} onClick={handlePlay}>▶ Play</button>
        )}
        <button
          style={styles.ctrlBtn}
          onClick={() => {
            setPlaying(false);
            simTimeRef.current = 0;
            setCurrentTime(0);
            setVisibleUntil(-1);
          }}
        >
          ⏮ Reset
        </button>
        <div style={styles.speedGroup}>
          {[0.5, 1, 2, 5, 10].map((s) => (
            <button
              key={s}
              style={{ ...styles.speedBtn, fontWeight: speed === s ? 'bold' : 'normal', borderColor: speed === s ? '#1890ff' : '#d9d9d9', color: speed === s ? '#1890ff' : '#666' }}
              onClick={() => setSpeed(s)}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Seek bar */}
      <div style={styles.seekBar}>
        <span style={styles.seekTime}>{formatMs(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 1}
          value={currentTime}
          step={100}
          onChange={handleSeek}
          style={styles.seekSlider}
        />
        <span style={styles.seekTime}>{formatMs(duration)}</span>
      </div>

      {/* Log stream */}
      <div style={styles.logList}>
        {visibleEntries.map((entry) => (
          <div
            key={entry.index}
            style={{ ...styles.logRow, borderLeftColor: levelColor(entry.level) }}
          >
            <span style={styles.logTime}>{formatTime(entry.timestamp)}</span>
            <span style={{ ...styles.logLevel, color: levelColor(entry.level) }}>
              {entry.level.toUpperCase()}
            </span>
            <span style={styles.logMsg}>{entry.message}</span>
          </div>
        ))}
        {visibleEntries.length === 0 && (
          <div style={styles.empty}>Press ▶ Play to start replay</div>
        )}
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
  title: {
    flex: 1,
    color: '#666',
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
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderBottom: '1px solid #f0f0f0',
    flexShrink: 0,
    flexWrap: 'wrap' as const,
  },
  ctrlBtn: {
    padding: '5px 14px',
    borderRadius: '4px',
    border: '1px solid #d9d9d9',
    cursor: 'pointer',
    backgroundColor: '#fff',
    fontSize: '13px',
  },
  speedGroup: {
    display: 'flex',
    gap: '4px',
    marginLeft: 'auto',
  },
  speedBtn: {
    padding: '3px 8px',
    borderRadius: '4px',
    border: '1px solid #d9d9d9',
    cursor: 'pointer',
    backgroundColor: '#fff',
    fontSize: '12px',
  },
  seekBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 16px',
    borderBottom: '1px solid #f0f0f0',
    flexShrink: 0,
  },
  seekTime: {
    color: '#999',
    fontSize: '11px',
    fontFamily: 'monospace',
    minWidth: '48px',
  },
  seekSlider: {
    flex: 1,
    accentColor: '#1890ff',
  },
  logList: {
    flex: 1,
    overflow: 'auto',
  },
  logRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '7px 16px',
    borderBottom: '1px solid #f5f5f5',
    borderLeft: '3px solid #52c41a',
    fontSize: '12px',
    animation: 'fadeIn 0.15s ease-out',
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
  empty: {
    padding: '32px 16px',
    textAlign: 'center' as const,
    color: '#999',
  },
};
