import { CSSProperties, useState, useEffect, useRef } from 'react';
import { websocketManager } from '../lib/websocketManager.js';

interface ScreenshotPanelProps {
  deviceId?: string;
}

interface Screenshot {
  id: string;
  dataUrl: string;
  width: number;
  height: number;
  timestamp: number;
}

export function ScreenshotPanel({ deviceId }: ScreenshotPanelProps) {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [selected, setSelected] = useState<Screenshot | null>(null);
  const [taking, setTaking] = useState(false);
  const [error, setError] = useState('');
  const counterRef = useRef(0);

  // Listen for screenshot events from SDK
  useEffect(() => {
    if (!deviceId) return;
    const unsub = websocketManager.subscribe((msg: any) => {
      if (
        msg.type === 'event' &&
        msg.deviceId === deviceId &&
        msg.envelope?.type === 'screenshot' &&
        msg.envelope?.data?.dataUrl
      ) {
        const data = msg.envelope.data;
        const entry: Screenshot = {
          id: `ss-${Date.now()}-${++counterRef.current}`,
          dataUrl: data.dataUrl,
          width: data.width ?? 0,
          height: data.height ?? 0,
          timestamp: msg.envelope.ts ?? Date.now(),
        };
        setScreenshots((prev) => {
          const next = [entry, ...prev];
          return next.length > 20 ? next.slice(0, 20) : next;
        });
        setSelected(entry);
        setTaking(false);
        setError('');
      }
    });
    return unsub;
  }, [deviceId]);

  const handleTakeScreenshot = async () => {
    if (!deviceId) return;
    setTaking(true);
    setError('');
    try {
      const res = await fetch(`/api/devices/${deviceId}/screenshot`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Response arrives via WS, handled by the listener above
      // Fallback: if no WS event after 8s, poll REST
      setTimeout(async () => {
        if (!taking) return;
        try {
          const get = await fetch(`/api/devices/${deviceId}/screenshot`);
          if (get.ok) {
            const data = await get.json();
            if (data.dataUrl) {
              const entry: Screenshot = {
                id: `ss-${Date.now()}-${++counterRef.current}`,
                dataUrl: data.dataUrl,
                width: data.width ?? 0,
                height: data.height ?? 0,
                timestamp: data.timestamp ?? Date.now(),
              };
              setScreenshots((prev) => {
                const next = [entry, ...prev];
                return next.length > 20 ? next.slice(0, 20) : next;
              });
              setSelected(entry);
            }
          }
        } catch {}
        setTaking(false);
      }, 8000);
    } catch (e) {
      setError(`截图失败: ${(e as Error).message}`);
      setTaking(false);
    }
  };

  const handleDownload = (ss: Screenshot) => {
    const a = document.createElement('a');
    a.href = ss.dataUrl;
    a.download = `screenshot-${new Date(ss.timestamp).toISOString().replace(/[:.]/g, '-')}.png`;
    a.click();
  };

  if (!deviceId) {
    return (
      <div style={s.placeholder}>
        <div style={{ fontSize: 48, opacity: 0.3 }}>📷</div>
        <div style={{ fontSize: 14, color: '#999' }}>请先选择设备</div>
      </div>
    );
  }

  return (
    <div style={s.container}>
      {/* Toolbar */}
      <div style={s.toolbar}>
        <button onClick={handleTakeScreenshot} disabled={taking} style={s.captureBtn}>
          {taking ? '截图中...' : '📷 截取截图'}
        </button>
        {screenshots.length > 0 && (
          <span style={{ fontSize: 12, color: '#999' }}>{screenshots.length} 张</span>
        )}
        {error && <span style={{ fontSize: 12, color: '#ff4d4f' }}>{error}</span>}
        {taking && (
          <span style={{ fontSize: 12, color: '#1890ff' }}>等待设备响应...</span>
        )}
      </div>

      <div style={s.body}>
        {/* Thumbnail list */}
        {screenshots.length > 0 && (
          <div style={s.sideList}>
            {screenshots.map((ss) => (
              <div
                key={ss.id}
                onClick={() => setSelected(ss)}
                style={{
                  ...s.thumb,
                  ...(selected?.id === ss.id ? s.thumbSelected : {}),
                }}
              >
                <img
                  src={ss.dataUrl}
                  alt="screenshot"
                  style={{ width: '100%', height: 80, objectFit: 'contain', backgroundColor: '#000' }}
                />
                <div style={s.thumbInfo}>
                  <div style={{ fontSize: 10, color: '#666' }}>
                    {ss.width}×{ss.height}
                  </div>
                  <div style={{ fontSize: 10, color: '#999' }}>
                    {new Date(ss.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <button
                  title="下载"
                  onClick={(e) => { e.stopPropagation(); handleDownload(ss); }}
                  style={s.downloadBtn}
                >
                  ⬇
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Main view */}
        <div style={s.main}>
          {selected ? (
            <div style={s.previewWrapper}>
              <div style={s.previewToolbar}>
                <span style={{ fontSize: 12, color: '#666' }}>
                  {selected.width}×{selected.height} · {new Date(selected.timestamp).toLocaleString()}
                </span>
                <button onClick={() => handleDownload(selected)} style={s.dlBtn}>
                  ⬇ 下载
                </button>
              </div>
              <div style={s.previewArea}>
                <img
                  src={selected.dataUrl}
                  alt="screenshot preview"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </div>
            </div>
          ) : (
            <div style={s.emptyMain}>
              <div style={{ fontSize: 48, opacity: 0.2 }}>📷</div>
              <div style={{ fontSize: 14, color: '#bbb', marginTop: 12 }}>
                点击「截取截图」按钮捕获当前页面
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#fff',
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 12,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 12px',
    borderBottom: '1px solid #e8e8e8',
    backgroundColor: '#fafafa',
    flexShrink: 0,
  },
  captureBtn: {
    padding: '5px 14px',
    backgroundColor: '#1890ff',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 13,
    cursor: 'pointer',
    fontWeight: 500,
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sideList: {
    width: 140,
    flexShrink: 0,
    borderRight: '1px solid #e8e8e8',
    overflowY: 'auto',
    backgroundColor: '#fafafa',
  },
  thumb: {
    padding: 6,
    borderBottom: '1px solid #f0f0f0',
    cursor: 'pointer',
    position: 'relative',
  },
  thumbSelected: {
    backgroundColor: '#e6f7ff',
  },
  thumbInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingRight: 20,
  },
  downloadBtn: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    padding: '1px 4px',
    fontSize: 10,
    backgroundColor: '#fff',
    border: '1px solid #d9d9d9',
    borderRadius: 3,
    cursor: 'pointer',
    color: '#666',
  },
  main: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  previewWrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  previewToolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    borderBottom: '1px solid #f0f0f0',
    flexShrink: 0,
  },
  previewArea: {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  emptyMain: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  dlBtn: {
    padding: '4px 10px',
    fontSize: 12,
    backgroundColor: '#fff',
    border: '1px solid #d9d9d9',
    borderRadius: 4,
    cursor: 'pointer',
    color: '#333',
  },
};
