import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/index.js';

interface MockPanelProps {
  deviceId?: string;
}

interface MockRule {
  id: string;
  pattern: string;
  method?: string;
  status: number;
  body?: string;
  delay?: number;
  headers?: Record<string, string>;
  createdAt: number;
  enabled: boolean;
  matchCount: number;
}

interface MockRuleForm {
  pattern: string;
  method: string;
  status: number;
  body: string;
  delay: number;
  headersText: string;
}

const defaultForm: MockRuleForm = {
  pattern: '',
  method: 'GET',
  status: 200,
  body: '{"ok":true}',
  delay: 0,
  headersText: '',
};

export function MockPanel({ deviceId }: MockPanelProps) {
  const [form, setForm] = useState<MockRuleForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [rules, setRules] = useState<MockRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();

  // 加载已有规则
  const loadRules = useCallback(async () => {
    if (!deviceId) return;
    setLoadingRules(true);
    try {
      const data = await api.get(`/api/devices/${deviceId}/mocks`);
      setRules(Array.isArray(data) ? data : []);
    } catch {
      // 设备不存在或网络错误
      setRules([]);
    } finally {
      setLoadingRules(false);
    }
  }, [deviceId]);

  useEffect(() => {
    setRules([]);
    loadRules();
  }, [loadRules]);

  const handleSubmit = useCallback(async () => {
    if (!deviceId || !form.pattern.trim()) return;
    setSaving(true);
    try {
      // Parse headersText: "Key: Value\nKey2: Value2"
      const headers: Record<string, string> = {};
      for (const line of form.headersText.split('\n')) {
        const idx = line.indexOf(':');
        if (idx > 0) {
          headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
      }
      await api.post(`/api/devices/${deviceId}/mocks`, {
        pattern: form.pattern,
        method: form.method || undefined,
        status: Number(form.status),
        headers,
        body: form.body,
        delay: form.delay > 0 ? form.delay : undefined,
      });
      setMsg('✅ Mock 规则已添加到设备');
      setForm(defaultForm);
      loadRules();
    } catch (e: any) {
      setMsg('❌ 失败: ' + e.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 3000);
    }
  }, [deviceId, form, loadRules]);

  const handleRemoveRule = useCallback(
    async (mockId: string) => {
      if (!deviceId) return;
      try {
        await api.delete(`/api/devices/${deviceId}/mocks/${mockId}`);
        setRules((prev) => prev.filter((r) => r.id !== mockId));
      } catch (e: any) {
        setMsg('❌ 删除失败: ' + e.message);
        setTimeout(() => setMsg(''), 3000);
      }
    },
    [deviceId],
  );

  const handleToggleRule = useCallback(
    async (mockId: string) => {
      if (!deviceId) return;
      try {
        const result = await api.patch(`/api/devices/${deviceId}/mocks/${mockId}`, {});
        if (result?.rule) {
          setRules((prev) => prev.map((r) => r.id === mockId ? { ...r, enabled: result.rule.enabled } : r));
        }
      } catch (e: any) {
        setMsg('❌ 切换失败: ' + e.message);
        setTimeout(() => setMsg(''), 3000);
      }
    },
    [deviceId],
  );

  const handleClearAll = useCallback(async () => {
    if (!deviceId) return;
    if (!confirm(t.mockPanel.clearAllConfirm)) return;
    try {
      await api.delete(`/api/devices/${deviceId}/mocks`);
      setRules([]);
      setMsg('✅ 已清空所有 Mock 规则');
    } catch (e: any) {
      setMsg('❌ 失败: ' + e.message);
    } finally {
      setTimeout(() => setMsg(''), 3000);
    }
  }, [deviceId]);

  const handleExport = useCallback(() => {
    if (rules.length === 0) return;
    const exportable = rules.map(({ pattern, method, status, body, delay, headers }) => ({
      pattern,
      method: method || 'GET',
      status,
      body: body ?? '',
      ...(delay ? { delay } : {}),
      ...(headers && Object.keys(headers).length ? { headers } : {}),
    }));
    const blob = new Blob([JSON.stringify(exportable, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mock-rules-${deviceId ?? 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rules, deviceId]);

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !deviceId) return;
      try {
        const text = await file.text();
        const imported = JSON.parse(text);
        if (!Array.isArray(imported)) throw new Error('文件格式不正确，需要 JSON 数组');
        let successCount = 0;
        for (const rule of imported) {
          if (!rule.pattern) continue;
          await api.post(`/api/devices/${deviceId}/mocks`, {
            pattern: rule.pattern,
            method: rule.method ?? 'GET',
            status: Number(rule.status ?? 200),
            headers: rule.headers ?? {},
            body: rule.body ?? '',
            delay: rule.delay ?? undefined,
          });
          successCount++;
        }
        setMsg(`✅ 已导入 ${successCount} 条规则`);
        loadRules();
      } catch (err: any) {
        setMsg('❌ 导入失败: ' + err.message);
      } finally {
        if (importInputRef.current) importInputRef.current.value = '';
        setTimeout(() => setMsg(''), 4000);
      }
    },
    [deviceId, loadRules],
  );

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
        <div style={{ fontSize: 48 }}>🎭</div>
        <div>请选择设备后使用 Mock</div>
      </div>
    );

  return (
    <div style={{ padding: 20, maxWidth: 600, overflow: 'auto', height: '100%' }}>
      <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 16 }}>🎭 API Mock</div>
      {msg && (
        <div
          style={{
            padding: '8px 12px',
            marginBottom: 12,
            backgroundColor: '#f6ffed',
            border: '1px solid #b7eb8f',
            borderRadius: 4,
            fontSize: 13,
          }}
        >
          {msg}
        </div>
      )}

      {/* 已有规则列表 */}
      {rules.length > 0 && (
        <div
          style={{
            backgroundColor: '#fff',
            border: '1px solid #e0e0e0',
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: 12, fontSize: 13 }}>
            已有规则 ({rules.length})
          </div>
          {rules.map((rule) => (
            <div
              key={rule.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                marginBottom: 6,
                backgroundColor: rule.enabled ? '#f9f9f9' : '#fafafa',
                borderRadius: 4,
                border: `1px solid ${rule.enabled ? '#f0f0f0' : '#e0e0e0'}`,
                opacity: rule.enabled ? 1 : 0.55,
              }}
            >
              {/* Enable/disable toggle */}
              <button
                onClick={() => handleToggleRule(rule.id)}
                title={rule.enabled ? '点击禁用' : '点击启用'}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  padding: '0 2px',
                  flexShrink: 0,
                  color: rule.enabled ? '#52c41a' : '#bbb',
                }}
              >
                {rule.enabled ? '●' : '○'}
              </button>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 'bold',
                  color: '#1890ff',
                  backgroundColor: '#e6f7ff',
                  padding: '2px 6px',
                  borderRadius: 3,
                  flexShrink: 0,
                }}
              >
                {rule.method || 'ANY'}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 12,
                  fontFamily: 'monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={rule.pattern}
              >
                {rule.pattern}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: rule.status >= 400 ? '#ff4d4f' : '#52c41a',
                  flexShrink: 0,
                }}
              >
                {rule.status}
              </span>
              {/* Match count badge */}
              {rule.matchCount > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    backgroundColor: '#722ed1',
                    color: '#fff',
                    padding: '1px 5px',
                    borderRadius: 10,
                    flexShrink: 0,
                  }}
                  title={`已命中 ${rule.matchCount} 次`}
                >
                  ×{rule.matchCount}
                </span>
              )}
              {/* Delay badge */}
              {rule.delay && rule.delay > 0 ? (
                <span
                  style={{
                    fontSize: 10,
                    backgroundColor: '#fa8c16',
                    color: '#fff',
                    padding: '1px 5px',
                    borderRadius: 10,
                    flexShrink: 0,
                  }}
                  title={`延迟 ${rule.delay}ms`}
                >
                  ⏱{rule.delay}ms
                </span>
              ) : null}
              <button
                onClick={() => handleRemoveRule(rule.id)}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  color: '#ff4d4f',
                  padding: '0 4px',
                  flexShrink: 0,
                }}
                title="删除此规则"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {loadingRules && rules.length === 0 && (
        <div style={{ textAlign: 'center', color: '#999', padding: 12, fontSize: 13 }}>
          加载规则中...
        </div>
      )}

      {/* 添加规则表单 */}
      <div
        style={{
          backgroundColor: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: 12, fontSize: 13 }}>添加 Mock 规则</div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 4 }}>
            URL 匹配规则（支持正则）
          </label>
          <input
            value={form.pattern}
            onChange={(e) => setForm((f) => ({ ...f, pattern: e.target.value }))}
            placeholder="/api/user"
            style={{
              width: '100%',
              padding: '6px 10px',
              border: '1px solid #d9d9d9',
              borderRadius: 4,
              fontSize: 13,
              boxSizing: 'border-box' as const,
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 4 }}>
              Method
            </label>
            <select
              value={form.method}
              onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
              style={{
                width: '100%',
                padding: '6px 10px',
                border: '1px solid #d9d9d9',
                borderRadius: 4,
                fontSize: 13,
              }}
            >
              <option>GET</option>
              <option>POST</option>
              <option>PUT</option>
              <option>DELETE</option>
              <option>PATCH</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 4 }}>
              Status Code
            </label>
            <input
              type="number"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: Number(e.target.value) }))}
              style={{
                width: '100%',
                padding: '6px 10px',
                border: '1px solid #d9d9d9',
                borderRadius: 4,
                fontSize: 13,
                boxSizing: 'border-box' as const,
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 4 }}>
            Response Body (JSON)
          </label>
          <textarea
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            rows={4}
            style={{
              width: '100%',
              padding: '6px 10px',
              border: '1px solid #d9d9d9',
              borderRadius: 4,
              fontSize: 12,
              fontFamily: 'monospace',
              resize: 'vertical',
              boxSizing: 'border-box' as const,
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 4 }}>
              延迟 (ms)
            </label>
            <input
              type="number"
              value={form.delay}
              min={0}
              onChange={(e) => setForm((f) => ({ ...f, delay: Number(e.target.value) }))}
              placeholder="0"
              style={{
                width: '100%',
                padding: '6px 10px',
                border: '1px solid #d9d9d9',
                borderRadius: 4,
                fontSize: 13,
                boxSizing: 'border-box' as const,
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 4 }}>
            响应 Headers（每行 Key: Value，可选）
          </label>
          <textarea
            value={form.headersText}
            onChange={(e) => setForm((f) => ({ ...f, headersText: e.target.value }))}
            rows={2}
            placeholder={'X-Custom-Header: value\nAnother-Header: value2'}
            style={{
              width: '100%',
              padding: '6px 10px',
              border: '1px solid #d9d9d9',
              borderRadius: 4,
              fontSize: 12,
              fontFamily: 'monospace',
              resize: 'vertical',
              boxSizing: 'border-box' as const,
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.pattern.trim()}
            style={{
              padding: '6px 16px',
              fontSize: 13,
              border: '1px solid #1890ff',
              borderRadius: 4,
              backgroundColor: '#1890ff',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            ➕ 添加 Mock
          </button>
          <button
            onClick={handleClearAll}
            disabled={rules.length === 0}
            style={{
              padding: '6px 16px',
              fontSize: 13,
              border: '1px solid #ff4d4f',
              borderRadius: 4,
              backgroundColor: '#fff',
              color: rules.length === 0 ? '#ccc' : '#ff4d4f',
              cursor: rules.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            🗑 清空全部
          </button>
          <button
            onClick={handleExport}
            disabled={rules.length === 0}
            style={{
              padding: '6px 16px',
              fontSize: 13,
              border: '1px solid #52c41a',
              borderRadius: 4,
              backgroundColor: '#fff',
              color: rules.length === 0 ? '#ccc' : '#52c41a',
              cursor: rules.length === 0 ? 'not-allowed' : 'pointer',
            }}
            title="导出规则为 JSON 文件"
          >
            ⬇ 导出
          </button>
          <label
            style={{
              padding: '6px 16px',
              fontSize: 13,
              border: '1px solid #722ed1',
              borderRadius: 4,
              backgroundColor: '#fff',
              color: '#722ed1',
              cursor: 'pointer',
              display: 'inline-block',
            }}
            title="从 JSON 文件导入规则"
          >
            ⬆ 导入
            <input
              ref={importInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#888', lineHeight: 1.8 }}>
        <div>• Mock 规则会直接推送到设备端，由 SDK 拦截 fetch 请求</div>
        <div>
          • URL 匹配支持正则表达式，如 <code>/api/.*</code>
        </div>
        <div>• 关闭 App 后规则自动清除</div>
      </div>
    </div>
  );
}
