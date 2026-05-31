import { useEffect, useRef, useState } from 'react';
import { initCodeLog } from '../codelog';

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
    const sdk = window.__codelog__;
    if (!sdk) { add('error', 'SDK 未初始化'); return; }
    const mock = sdk.getMockAPI?.();
    if (!mock) { add('error', 'getMockAPI() 不可用'); return; }
    mock.addRule({
      name: '拦截 /api/demo',
      pattern: '/api/demo',
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
    const sdk = window.__codelog__;
    if (!sdk) { add('error', 'SDK 未初始化'); return; }
    sdk.getMockAPI?.()?.clearRules();
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
    const sdk = window.__codelog__;
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
        <h2>🧪 全链路功能测试</h2>
        <p>
          测试链路：Demo 页 → SDK → Server (38291) → PC 面板 (3001)<br />
          <small style={{ color: '#888' }}>
            PC 面板：<a href="http://localhost:3001" target="_blank" rel="noreferrer">http://localhost:3001</a>
          </small>
        </p>
      </div>

      <div className="section">
        <h3>
          SDK 状态：
          <span className={`status-badge ${sdkReady ? 'connected' : 'disconnected'}`}>
            {sdkReady ? '✅ 已初始化，连接至 http://localhost:38291' : '⏳ 加载中...'}
          </span>
        </h3>
      </div>

      <div className="section">
        <h3>📝 Console 日志</h3>
        <div className="btn-group">
          <button className="btn-secondary" onClick={testLog}>log</button>
          <button className="btn-secondary" onClick={testInfo}>info</button>
          <button className="btn-warn" onClick={testWarn}>warn</button>
          <button className="btn-danger" onClick={testError}>error</button>
          <button className="btn-secondary" onClick={testObject}>对象</button>
          <button className="btn-secondary" onClick={testBatch}>批量 ×5</button>
        </div>
      </div>

      <div className="section">
        <h3>🌐 网络请求 (Fetch / XHR)</h3>
        <div className="btn-group">
          <button className="btn-primary" onClick={testFetch}>fetch GET</button>
          <button className="btn-primary" onClick={testFetchPost}>fetch POST</button>
          <button className="btn-secondary" onClick={testXHR}>XHR GET</button>
          <button className="btn-danger" onClick={testFetchFail}>500 错误</button>
        </div>
      </div>

      <div className="section">
        <h3>🎭 Mock API</h3>
        <div className="btn-group">
          <button className="btn-success" onClick={testAddMock}>添加 Mock 规则</button>
          <button className="btn-primary" onClick={testMockFetch}>fetch /api/demo（被 mock）</button>
          <button className="btn-warn" onClick={testClearMocks}>清除 Mock 规则</button>
        </div>
      </div>

      <div className="section">
        <h3>🔌 WebSocket</h3>
        <div className="btn-group">
          <button className="btn-success" onClick={testWSOpen}>连接 WS</button>
          <button className="btn-primary" onClick={testWSSend}>发送消息</button>
          <button className="btn-warn" onClick={testWSClose}>断开 WS</button>
        </div>
      </div>

      <div className="section">
        <h3>🗄️ IndexedDB</h3>
        <div className="btn-group">
          <button className="btn-success" onClick={testIDBWrite}>写入 3 条记录</button>
          <button className="btn-secondary" onClick={testIDBRead}>读取所有记录</button>
          <button className="btn-warn" onClick={testIDBDelete}>删除 item1</button>
        </div>
      </div>

      <div className="section">
        <h3>💾 Storage</h3>
        <div className="btn-group">
          <button className="btn-success" onClick={testSetStorage}>写入 localStorage/cookie</button>
          <button className="btn-secondary" onClick={testGetStorage}>读取 localStorage</button>
          <button className="btn-warn" onClick={testClearStorage}>清除 key</button>
        </div>
      </div>

      <div className="section">
        <h3>💥 错误捕获</h3>
        <div className="btn-group">
          <button className="btn-danger" onClick={testUncaughtError}>未捕获错误</button>
          <button className="btn-danger" onClick={testPromiseReject}>Promise rejection</button>
        </div>
      </div>

      <div className="section">
        <h3>📷 截图</h3>
        <div className="btn-group">
          <button className="btn-primary" onClick={testScreenshot}>截图并发至 PC 面板</button>
        </div>
      </div>

      <div className="section">
        <h3>📋 本页操作记录</h3>
        <div className="log-output">
          {logs.length === 0 && <div style={{ color: '#555' }}>点击上方按钮开始测试…</div>}
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


interface LogItem {
  level: 'log' | 'info' | 'warn' | 'error' | 'checkpoint';
  msg: string;
  time: string;
}

function useLocalLogs() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const add = (level: LogItem['level'], msg: string) => {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    setLogs((prev) => [...prev.slice(-49), { level, msg, time }]);
  };
  return { logs, add };
}

export default function BasicTest() {
  const { logs, add } = useLocalLogs();
  const [sdkReady, setSdkReady] = useState(false);
  const reqCount = useRef(0);

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
      add('log', `fetch 完成：${res.status} ${JSON.stringify(data).slice(0, 60)}`);
    } catch (e: any) {
      add('error', `fetch 失败：${e.message}`);
    }
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

  // ── Storage 测试 ──────────────────────────────────────────
  const testSetStorage = () => {
    const val = `value_${Date.now()}`;
    localStorage.setItem('codelog_test_key', val);
    console.log('localStorage.setItem', { key: 'codelog_test_key', value: val });
    add('log', `写入 localStorage: ${val}`);
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

  return (
    <div>
      <div className="page-header">
        <h2>🧪 基础功能测试</h2>
        <p>测试 codeLog SDK 各项数据采集能力，打开 PC 面板实时查看</p>
      </div>

      <div className="section">
        <h3>
          SDK 状态：
          <span className={`status-badge ${sdkReady ? 'connected' : 'disconnected'}`}>
            {sdkReady ? '✅ 已初始化' : '⏳ 加载中...'}
          </span>
        </h3>
        <p style={{ fontSize: 12, color: '#888' }}>
          修改 <code>src/codelog.ts</code> 中的 <code>SERVER_URL</code> 或设置环境变量{' '}
          <code>VITE_CODELOG_SERVER=ws://192.168.x.x:38291</code>
        </p>
      </div>

      <div className="section">
        <h3>📝 Console 日志</h3>
        <div className="btn-group">
          <button className="btn-secondary" onClick={testLog}>
            log
          </button>
          <button className="btn-secondary" onClick={testInfo}>
            info
          </button>
          <button className="btn-warn" onClick={testWarn}>
            warn
          </button>
          <button className="btn-danger" onClick={testError}>
            error
          </button>
          <button className="btn-secondary" onClick={testObject}>
            对象
          </button>
          <button className="btn-secondary" onClick={testBatch}>
            批量 ×5
          </button>
        </div>
      </div>

      <div className="section">
        <h3>🌐 网络请求</h3>
        <div className="btn-group">
          <button className="btn-primary" onClick={testFetch}>
            fetch 请求
          </button>
          <button className="btn-danger" onClick={testFetchFail}>
            500 错误请求
          </button>
        </div>
      </div>

      <div className="section">
        <h3>💾 Storage</h3>
        <div className="btn-group">
          <button className="btn-success" onClick={testSetStorage}>
            写入 localStorage
          </button>
          <button className="btn-secondary" onClick={testGetStorage}>
            读取 localStorage
          </button>
          <button className="btn-warn" onClick={testClearStorage}>
            清除 key
          </button>
        </div>
      </div>

      <div className="section">
        <h3>💥 错误捕获</h3>
        <div className="btn-group">
          <button className="btn-danger" onClick={testUncaughtError}>
            触发未捕获错误
          </button>
          <button className="btn-danger" onClick={testPromiseReject}>
            Promise rejection
          </button>
        </div>
      </div>

      <div className="section">
        <h3>📋 本页操作记录</h3>
        <div className="log-output">
          {logs.length === 0 && <div style={{ color: '#555' }}>点击上方按钮开始测试…</div>}
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
