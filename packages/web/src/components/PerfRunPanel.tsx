import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/index.js';
import { websocketManager } from '../lib/websocketManager.js';
import type { PerfRunSession, PerfScoreItem } from '../types/index.js';

interface PerfRunPanelProps {
  deviceId?: string;
}

const GRADE_COLOR: Record<string, string> = {
  A: '#4caf50',
  B: '#8bc34a',
  C: '#ff9800',
  D: '#ff5722',
  F: '#f44336',
};

const RATING_COLOR: Record<string, string> = {
  good: '#4caf50',
  'needs-improvement': '#ff9800',
  poor: '#f44336',
  unknown: '#9e9e9e',
};

function gradeColor(grade: string): string {
  return GRADE_COLOR[grade] ?? '#9e9e9e';
}

function ScoreCircle({ score, grade, color: colorProp, size = 96 }: { score: number; grade?: string; color?: string; size?: number }) {
  const color = colorProp ?? (grade ? GRADE_COLOR[grade] ?? '#9e9e9e' : '#9e9e9e');
  const fontSize = size >= 80 ? 32 : 20;
  const gradeSize = size >= 80 ? 18 : 12;
  return (
    <div style={{ textAlign: 'center', padding: size >= 80 ? '16px' : '8px' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          borderRadius: '50%',
          border: `${Math.max(2, size / 24)}px solid ${color}`,
          flexDirection: 'column',
        }}
      >
        <div style={{ fontSize, fontWeight: 'bold', color, lineHeight: 1 }}>{score}</div>
        {grade && <div style={{ fontSize: gradeSize, color, fontWeight: 600 }}>{grade}</div>}
      </div>
    </div>
  );
}

function MetricCard({ item }: { item: PerfScoreItem }) {
  const color = RATING_COLOR[item.rating] ?? '#9e9e9e';
  return (
    <div
      style={{
        padding: '10px 12px',
        border: `1px solid ${color}33`,
        borderTop: `3px solid ${color}`,
        borderRadius: 4,
        backgroundColor: '#fff',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{item.name}</div>
      <div style={{ fontSize: 22, fontWeight: 'bold', color, lineHeight: 1 }}>{item.score}</div>
      <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
        {item.value !== null ? `${item.value}${item.unit}` : 'N/A'}
      </div>
    </div>
  );
}

export function PerfRunPanel({ deviceId }: PerfRunPanelProps) {
  const [computing, setComputing] = useState(false);
  const [sessions, setSessions] = useState<PerfRunSession[]>([]);
  const [selected, setSelected] = useState<PerfRunSession | null>(null);
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('performance');
  const { t } = useI18n();

  // 动态类别标签（跟随中英文切换）
  const categoryLabel = (id: string): string => {
    const map: Record<string, string> = {
      'performance': t.perfRunPanel.categoryPerformance,
      'accessibility': t.perfRunPanel.categoryAccessibility,
      'best-practices': t.perfRunPanel.categoryBestPractices,
      'seo': t.perfRunPanel.categorySEO,
    };
    return map[id] || id;
  };

  const hasCategories = !!selected?.score?.categories && Object.keys(selected.score.categories).length > 0;

  const loadSessions = useCallback(async () => {
    if (!deviceId) return;
    try {
      const data = await api.get(`/api/devices/${deviceId}/perf-run`);
      if (Array.isArray(data)) {
        setSessions(data.reverse());
        if (data.length > 0 && !selected) setSelected(data[data.length - 1]);
      }
    } catch {
      /* ignore */
    }
  }, [deviceId, selected]);

  useEffect(() => {
    setSessions([]);
    setSelected(null);
    setComputing(false);
  }, [deviceId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // WS: listen for perf_run results pushed from server after device submits raw data
  useEffect(() => {
    const unsub = websocketManager.subscribe((msg: any) => {
      // Server broadcasts perf_run result as: { type: 'event', deviceId, envelope: { type: 'perf_run', data: session } }
      if (
        msg.type === 'event' &&
        msg.deviceId === deviceId &&
        msg.envelope?.type === 'perf_run'
      ) {
        const session: PerfRunSession = msg.envelope.data;
        setSessions((prev) => [session, ...prev]);
        setSelected(session);
        setComputing(false);
      }
    });
    return unsub;
  }, [deviceId]);

  const handleExport = useCallback(() => {
    if (!selected) return;
    const blob = new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `perf-run-${selected.sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selected]);

  if (!deviceId)
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#999',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 48 }}>🏁</div>
        <div>{t.common.selectDevice}</div>
      </div>
    );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 16px',
          borderBottom: '1px solid #e0e0e0',
          backgroundColor: '#fafafa',
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 'bold', fontSize: 14 }}>🏁 {t.perfRunPanel.title}</span>
        {computing && (
          <span style={{ fontSize: 12, color: '#888' }}>⏳ {t.perfRunPanel.running}</span>
        )}
        <div style={{ flex: 1 }} />
        {selected && (
          <button
            onClick={handleExport}
            style={{
              padding: '5px 12px',
              fontSize: 12,
              border: '1px solid #1890ff',
              borderRadius: 4,
              backgroundColor: '#fff',
              color: '#1890ff',
              cursor: 'pointer',
            }}
          >
            📤 {t.common.export}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* History sidebar */}
        <div
          style={{ width: 180, borderRight: '1px solid #e0e0e0', overflowY: 'auto', flexShrink: 0 }}
        >
          <div
            style={{
              padding: '8px 12px',
              fontSize: 11,
              color: '#888',
              borderBottom: '1px solid #f0f0f0',
            }}
          >
            {t.perfRunPanel.history}
          </div>
          {sessions.length === 0 && (
            <div style={{ padding: 12, fontSize: 12, color: '#bbb', textAlign: 'center' }}>
              {t.common.noData}
            </div>
          )}
          {sessions.map((s) => (
            <div
              key={s.sessionId}
              onClick={() => setSelected(s)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: 12,
                borderBottom: '1px solid #f5f5f5',
                backgroundColor: selected?.sessionId === s.sessionId ? '#e6f4ff' : '#fff',
                borderLeft:
                  selected?.sessionId === s.sessionId
                    ? '3px solid #1890ff'
                    : '3px solid transparent',
              }}
            >
              <div style={{ fontWeight: 'bold', color: GRADE_COLOR[s.score.grade] }}>
                {s.score.grade} · {s.score.total}pts
              </div>
              <div style={{ color: '#999', fontSize: 11, marginTop: 2 }}>
                {new Date(s.startTime).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {!selected ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#999',
              }}
            >
              {computing ? (
                <>
                  <div style={{ fontSize: 48 }}>⏳</div>
                  <div>{t.perfRunPanel.running}</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 48 }}>🏁</div>
                  <div>{t.perfRunPanel.waiting}</div>
                </>
              )}
            </div>
          ) : (
            <div style={{ maxWidth: 700 }}>
              {/* Score card */}
              <div
                style={{
                  backgroundColor: '#fff',
                  border: '1px solid #e0e0e0',
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 24,
                }}
              >
                <ScoreCircle score={selected.score.total} grade={selected.score.grade} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 }}>
                    {selected.score.summary}
                  </div>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    {(selected.duration / 1000).toFixed(1)}s ·{' '}
                    {new Date(selected.startTime).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Category gauges */}
              {hasCategories && (
                <div style={{ display: 'flex', gap: 16, marginBottom: 20, justifyContent: 'center' }}>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <ScoreCircle score={selected.score.total} color={gradeColor(selected.score.grade)} size={80} />
                    <div style={{ fontSize: 12, marginTop: 4, color: '#666' }}>Performance</div>
                  </div>
                  {Object.entries(selected.score.categories!).map(([id, cat]) => (
                    <div key={id} style={{ textAlign: 'center', flex: 1 }}>
                      <ScoreCircle score={cat.score} color={gradeColor(cat.grade)} size={80} />
                      <div style={{ fontSize: 12, marginTop: 4, color: '#666' }}>{categoryLabel(id)}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Metrics grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                {selected.score.items.map((item) => (
                  <MetricCard key={item.name} item={item} />
                ))}
              </div>

              {/* Issues */}
              {selected.score.issues.length > 0 && (
                <div
                  style={{
                    backgroundColor: '#fff',
                    border: '1px solid #e0e0e0',
                    borderRadius: 8,
                    padding: 16,
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 10 }}>
                    ⚠️ Issues
                  </div>
                  {selected.score.issues.map((issue, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '6px 0',
                        borderBottom: '1px solid #f5f5f5',
                        fontSize: 13,
                        color: '#595959',
                      }}
                    >
                      • {issue}
                    </div>
                  ))}
                </div>
              )}

              {/* Category audit details */}
              {hasCategories && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, borderBottom: '1px solid #e0e0e0', paddingBottom: 8 }}>
                    <button
                      onClick={() => setActiveCategoryTab('performance')}
                      style={{
                        padding: '6px 16px', border: 'none', borderRadius: 4, cursor: 'pointer',
                        background: activeCategoryTab === 'performance' ? '#1a73e8' : 'transparent',
                        color: activeCategoryTab === 'performance' ? '#fff' : '#333',
                        fontWeight: activeCategoryTab === 'performance' ? 600 : 400,
                      }}
                    >
                      {categoryLabel('performance')}
                    </button>
                    {Object.keys(selected.score.categories!).map(id => (
                      <button
                        key={id}
                        onClick={() => setActiveCategoryTab(id)}
                        style={{
                          padding: '6px 16px', border: 'none', borderRadius: 4, cursor: 'pointer',
                          background: activeCategoryTab === id ? '#1a73e8' : 'transparent',
                          color: activeCategoryTab === id ? '#fff' : '#333',
                          fontWeight: activeCategoryTab === id ? 600 : 400,
                        }}
                      >
                        {categoryLabel(id)}
                      </button>
                    ))}
                  </div>
                  {activeCategoryTab === 'performance' ? (
                    <div>
                      {/* Performance tab: 显示已有的指标卡片 */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                        {selected.score.items.map((item) => (
                          <div key={item.name} style={{
                            padding: 12,
                            borderRadius: 8,
                            background: '#fafafa',
                            border: '1px solid #f0f0f0',
                          }}>
                            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                              {item.name}
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 600, color: RATING_COLOR[item.rating] || '#333' }}>
                              {item.score}
                            </div>
                            {item.value !== null && (
                              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                                {item.value}{item.unit ? ` ${item.unit}` : ''}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {/* Performance issues */}
                      {selected.score.issues.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}>
                            ⚠️ Issues
                          </div>
                          {selected.score.issues.map((issue, i) => (
                            <div key={i} style={{
                              padding: '6px 0',
                              borderBottom: '1px solid #f5f5f5',
                              fontSize: 13,
                              color: '#595959',
                            }}>
                              • {issue}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : selected.score.categories![activeCategoryTab] && (
                    <div style={{ fontSize: 13 }}>
                      {selected.score.categories![activeCategoryTab].audits.map(audit => (
                        <div key={audit.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 12px', borderBottom: '1px solid #f0f0f0',
                        }}>
                          <span style={{ fontSize: 16 }}>
                            {audit.score === null ? '⚠️' : audit.score === 1 ? '✅' : '❌'}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500 }}>{audit.title}</div>
                            {audit.description && <div style={{ color: '#666', fontSize: 12 }}>{audit.description}</div>}
                          </div>
                          {audit.value && <div style={{ color: '#888', fontSize: 12 }}>{audit.value}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
