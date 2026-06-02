import { useEffect, useRef, useState } from 'react';
import { initCodeLog, codelog } from '../codelog';
import { t } from '../i18n';
import { useLang } from '../components/useLang';

interface LogItem {
  level: 'log' | 'info' | 'warn' | 'error' | 'checkpoint';
  msg: string;
  time: string;
}

function useLocalLogs() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const add = (level: LogItem['level'], msg: string) => {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    setLogs((prev) => [...prev.slice(-99), { level, msg, time }]);
  };
  return { logs, add };
}

export default function BasicTest() {
  const { logs, add } = useLocalLogs();
  const [sdkReady, setSdkReady] = useState(false);
  const reqCount = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  useLang(); // trigger re-render on language change

  useEffect(() => {
    initCodeLog().then(() => setSdkReady(true));
  }, []);

  // ── Console 测试 ──────────────────────────────────────────
  const testLog = () => {
    console.log('这是一条普通日志', { ts: Date.now() });
    add('log', '发送 console.log');
  };
  const testInfo = () => {
    console.info('这是一条 info 日志');
    add('info', '发送 console.info');
  };
  const testWarn = () => {
    console.warn('这是一条警告', { code: 'W001' });
    add('warn', '发送 console.warn');
  };
  const testError = () => {
    console.error('这是一条错误', new Error('测试错误'));
    add('error', '发送 console.error');
  };
  const testBatch = () => {
    for (let i = 1; i <= 5; i++) console.log(`批量日志 #${i}`, { i, ts: Date.now() });
    add('log', '发送 5 条批量日志');
  };
  const testObject = () => {
    console.log('对象测试', { user: { id: 1, name: '测试用户' }, arr: [1, 2, 3] });
    add('log', '发送复杂对象');
  };

  // ── Network 测试 ──────────────────────────────────────────
  const testFetch = async () => {
    reqCount.current++;
    add('info', `发起 fetch 请求 #${reqCount.current}`);
    try {
      const res = await fetch(`https://jsonplaceholder.typicode.com/todos/${reqCount.current}`);
      const data = await res.json();
      console.log('fetch 响应', data);
      add('log', `fetch 完成：${res.status} id=${data.id}`);
    } catch (e: any) {
      add('error', `fetch 失败：${e.message}`);
    }
  };
  const testFetchPost = async () => {
    add('info', '发起 fetch POST 请求');
    try {
      const res = await fetch('https://jsonplaceholder.typicode.com/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '测试', body: 'codeLog demo', userId: 1 }),
      });
      const data = await res.json();
      console.log('fetch POST 响应', data);
      add('log', `fetch POST 完成：${res.status} id=${data.id}`);
    } catch (e: any) {
      add('error', `fetch POST 失败：${e.message}`);
    }
  };
  const testXHR = () => {
    add('info', 'XHR GET 请求');
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://jsonplaceholder.typicode.com/users/1');
    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText);
      console.log('XHR 响应', data);
      add('log', `XHR 完成：${xhr.status} name=${data.name}`);
    };
    xhr.onerror = () => add('error', 'XHR 失败');
    xhr.send();
  };
  const testFetchFail = async () => {
    add('warn', '发起注定失败的请求');
    try {
      await fetch('https://httpstat.us/500');
    } catch (e: any) {
      console.error('请求失败', e);
      add('error', `请求异常：${e.message}`);
    }
  };

  // ── Mock API 测试 ──────────────────────────────────────────
  const testAddMock = () => {
    codelog.addMock('/api/demo', {
      method: 'GET',
      status: 200,
      body: JSON.stringify({ mocked: true, msg: 'codeLog mock 生效！' }),
      enabled: true,
      headers: { 'X-Mocked-By': 'codeLog', 'Content-Type': 'application/json' },
    });
    add('log', '已添加 Mock 规则：/api/demo → 200 {"mocked":true}');
  };
  const testMockFetch = async () => {
    add('info', '请求被 mock 的接口 /api/demo');
    try {
      const res = await fetch('/api/demo');
      const data = await res.json();
      add('log', `mock fetch → ${res.status} x-mocked=${res.headers.get('X-Mocked-By')} body=${JSON.stringify(data)}`);
      console.log('mock 响应', { status: res.status, data });
    } catch (e: any) {
      add('error', `mock fetch 失败：${e.message}`);
    }
  };
  const testClearMocks = () => {
    codelog.clearMocks();
    add('warn', '已清除所有 Mock 规则');
  };

  // ── WebSocket 测试 ──────────────────────────────────────────
  const testWSOpen = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      add('warn', 'WS 已连接，先关闭再重连'); return;
    }
    try {
      wsRef.current = new WebSocket('wss://echo.websocket.org');
      wsRef.current.onopen = () => add('log', '✅ WebSocket 已连接 (echo.websocket.org)');
      wsRef.current.onmessage = (e) => {
        console.log('WS 收到消息', e.data);
        add('log', `WS 收到：${e.data}`);
      };
      wsRef.current.onerror = () => add('error', 'WS 连接错误');
      wsRef.current.onclose = (e) => { add('warn', `WS 已关闭 (${e.code})`); wsRef.current = null; };
      add('info', 'WS 正在连接…');
    } catch (e: any) {
      add('error', `WS 错误：${e.message}`);
    }
  };
  const testWSSend = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      add('warn', '请先打开 WS 连接'); return;
    }
    const msg = `Hello from codeLog demo @ ${Date.now()}`;
    wsRef.current.send(msg);
    add('info', `WS 发送：${msg}`);
  };
  const testWSClose = () => {
    wsRef.current?.close(1000, '手动关闭');
    add('warn', 'WS 关闭中…');
  };

  // ── IndexedDB 测试 ──────────────────────────────────────────
  const IDB_DB = 'codelog-demo-db';
  const IDB_STORE = 'items';

  function openIDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  const testIDBWrite = async () => {
    try {
      const db = await openIDB();
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const s = tx.objectStore(IDB_STORE);
      const ts = Date.now();
      s.put({ id: 'item1', name: '测试数据 1', ts });
      s.put({ id: 'item2', name: '测试数据 2', ts });
      s.put({ id: 'item3', name: '测试数据 3', ts });
      await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
      db.close();
      console.log('[IDB] 写入 3 条记录');
      add('log', 'IDB 写入 3 条记录（item1/item2/item3）');
    } catch (e: any) { add('error', `IDB 写入失败：${e.message}`); }
  };
  const testIDBRead = async () => {
    try {
      const db = await openIDB();
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).getAll();
      await new Promise<void>((res) => { req.onsuccess = () => res(); });
      db.close();
      console.log('[IDB] 读取记录', req.result);
      add('log', `IDB 读取 ${req.result.length} 条记录`);
    } catch (e: any) { add('error', `IDB 读取失败：${e.message}`); }
  };
  const testIDBDelete = async () => {
    try {
      const db = await openIDB();
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete('item1');
      await new Promise<void>((res) => { tx.oncomplete = () => res(); });
      db.close();
      console.log('[IDB] 删除 item1');
      add('warn', 'IDB 删除 item1');
    } catch (e: any) { add('error', `IDB 删除失败：${e.message}`); }
  };

  // ── Storage 测试 ──────────────────────────────────────────
  const testSetStorage = () => {
    const val = `value_${Date.now()}`;
    localStorage.setItem('codelog_test_key', val);
    sessionStorage.setItem('codelog_session_key', `sess_${Date.now()}`);
    document.cookie = `codelog_cookie=cookie_${Date.now()}; path=/`;
    console.log('Storage 写入', { localStorage: val });
    add('log', `写入 localStorage/sessionStorage/cookie`);
  };
  const testGetStorage = () => {
    const val = localStorage.getItem('codelog_test_key');
    console.log('localStorage.getItem', { key: 'codelog_test_key', value: val });
    add('log', `读取 localStorage: ${val ?? '(未设置)'}`);
  };
  const testClearStorage = () => {
    localStorage.removeItem('codelog_test_key');
    console.log('localStorage.removeItem', 'codelog_test_key');
    add('warn', '清除 localStorage key');
  };

  // ── Error 测试 ──────────────────────────────────────────
  const testUncaughtError = () => {
    add('error', '即将触发未捕获错误');
    setTimeout(() => {
      throw new Error('测试未捕获错误 — codeLog 应该能捕获此错误');
    }, 100);
  };
  const testPromiseReject = () => {
    add('error', '即将触发未处理 Promise rejection');
    Promise.reject(new Error('测试未处理 Promise rejection'));
  };

  // ── 截图 ──────────────────────────────────────────
  const testScreenshot = async () => {
    const sdk = codelog;
    if (!sdk) { add('error', 'SDK 未初始化'); return; }
    add('info', '请求截图…');
    try {
      await sdk.takeScreenshot?.();
      add('log', '截图已发送至 PC 面板');
    } catch (e: any) {
      add('error', `截图失败：${e.message}`);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>{t('basic').title}</h2>
        <p>
          {t('basic').subtitle}<br />
          <small style={{ color: '#888' }}>
            PC 面板：<a href="http://localhost:3001" target="_blank" rel="noreferrer">http://localhost:3001</a>
          </small>
        </p>
      </div>

      <div className="section">
        <h3>
          {t('basic').sdkStatus}
          <span className={`status-badge ${sdkReady ? 'connected' : 'disconnected'}`}>
            {sdkReady ? t('basic').sdkReady : t('basic').sdkLoading}
          </span>
        </h3>
      </div>

      <div className="section">
        <h3>{t('basic').console}</h3>
        <div className="btn-group">
          <button className="btn-secondary" onClick={testLog}>log</button>
          <button className="btn-secondary" onClick={testInfo}>info</button>
          <button className="btn-warn" onClick={testWarn}>warn</button>
          <button className="btn-danger" onClick={testError}>error</button>
          <button className="btn-secondary" onClick={testObject}>{t('basic').object}</button>
          <button className="btn-secondary" onClick={testBatch}>{t('basic').batch}</button>
        </div>
      </div>

      <div className="section">
        <h3>{t('basic').network}</h3>
        <div className="btn-group">
          <button className="btn-primary" onClick={testFetch}>fetch GET</button>
          <button className="btn-primary" onClick={testFetchPost}>fetch POST</button>
          <button className="btn-secondary" onClick={testXHR}>XHR GET</button>
          <button className="btn-danger" onClick={testFetchFail}>{t('basic').fetchFail}</button>
        </div>
      </div>

      <div className="section">
        <h3>{t('basic').mock}</h3>
        <div className="btn-group">
          <button className="btn-success" onClick={testAddMock}>{t('basic').addMock}</button>
          <button className="btn-primary" onClick={testMockFetch}>{t('basic').fetchMocked}</button>
          <button className="btn-warn" onClick={testClearMocks}>{t('basic').clearMocks}</button>
        </div>
      </div>

      <div className="section">
        <h3>{t('basic').websocket}</h3>
        <div className="btn-group">
          <button className="btn-success" onClick={testWSOpen}>{t('basic').connectWS}</button>
          <button className="btn-primary" onClick={testWSSend}>{t('basic').sendMsg}</button>
          <button className="btn-warn" onClick={testWSClose}>{t('basic').closeWS}</button>
        </div>
      </div>

      <div className="section">
        <h3>{t('basic').idb}</h3>
        <div className="btn-group">
          <button className="btn-success" onClick={testIDBWrite}>{t('basic').idbWrite}</button>
          <button className="btn-secondary" onClick={testIDBRead}>{t('basic').idbRead}</button>
          <button className="btn-warn" onClick={testIDBDelete}>{t('basic').idbDelete}</button>
        </div>
      </div>

      <div className="section">
        <h3>{t('basic').storage}</h3>
        <div className="btn-group">
          <button className="btn-success" onClick={testSetStorage}>{t('basic').storageWrite}</button>
          <button className="btn-secondary" onClick={testGetStorage}>{t('basic').storageRead}</button>
          <button className="btn-warn" onClick={testClearStorage}>{t('basic').storageClear}</button>
        </div>
      </div>

      <div className="section">
        <h3>{t('basic').errorCapture}</h3>
        <div className="btn-group">
          <button className="btn-danger" onClick={testUncaughtError}>{t('basic').uncaughtError}</button>
          <button className="btn-danger" onClick={testPromiseReject}>{t('basic').promiseReject}</button>
        </div>
      </div>

      <div className="section">
        <h3>{t('basic').screenshot}</h3>
        <div className="btn-group">
          <button className="btn-primary" onClick={testScreenshot}>{t('basic').screenshotBtn}</button>
        </div>
      </div>

      <div className="section">
        <h3>{t('basic').localLogs}</h3>
        <div className="log-output">
          {logs.length === 0 && <div style={{ color: '#555' }}>{t('basic').noLogs}</div>}
          {[...logs].reverse().map((l, i) => (
            <div key={i} className={`log-item ${l.level}`}>
              <span className="log-time">{l.time}</span>
              {l.msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

