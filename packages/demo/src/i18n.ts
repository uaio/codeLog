type Lang = 'zh' | 'en'

const translations = {
  zh: {
    nav: {
      brand: 'codeLog Demo',
      tag: '测试项目',
      basic: '🧪 基础功能测试',
      basicDesc: 'Console / Network / Storage / Error',
      login: '🔐 登录流程',
      loginDesc: '@codelog[checkpoint] 完整示例',
    },
    home: {
      title: 'codeLog 测试项目',
      subtitle: '用于验证 codeLog 完整工作流：SDK 采集 → WS 传输 → PC 面板 → AI 工具',
      tip: '使用前：',
      tipBody: '确保 npx codelog 已启动，并在控制台复制 SDK 接入地址配置到 src/codelog.ts',
    },
    basic: {
      title: '🧪 全链路功能测试',
      subtitle: '测试链路：Demo 页 → SDK → Server (38291) → PC 面板 (3001)',
      sdkReady: '✅ 已初始化，连接至 http://localhost:38291',
      sdkLoading: '⏳ 加载中...',
      sdkStatus: 'SDK 状态：',
      console: '📝 Console 日志',
      object: '对象',
      batch: '批量 ×5',
      network: '🌐 网络请求 (Fetch / XHR)',
      mock: '🎭 Mock API',
      addMock: '添加 Mock 规则',
      fetchMocked: 'fetch /api/demo（被 mock）',
      clearMocks: '清除 Mock 规则',
      websocket: '🔌 WebSocket',
      connectWS: '连接 WS',
      sendMsg: '发送消息',
      closeWS: '断开 WS',
      idb: '🗄️ IndexedDB',
      idbWrite: '写入 3 条记录',
      idbRead: '读取所有记录',
      idbDelete: '删除 item1',
      storage: '💾 Storage',
      storageWrite: '写入 localStorage/cookie',
      storageRead: '读取 localStorage',
      storageClear: '清除 key',
      errorCapture: '💥 错误捕获',
      uncaughtError: '未捕获错误',
      promiseReject: 'Promise rejection',
      screenshot: '📷 截图',
      screenshotBtn: '截图并发至 PC 面板',
      localLogs: '📋 本页操作记录',
      noLogs: '点击上方按钮开始测试…',
      fetchFail: '500 错误',
    },
    login: {
      title: '🔐 登录流程测试',
      subtitle: '演示 @codelog[checkpoint] 完整使用方式',
      username: '用户名',
      password: '密码',
      submit: '模拟登录',
      running: '执行中…',
      reset: '重置',
      flow: '登录流程节点',
      logs: '执行日志',
      noLogs: '暂无日志',
      success: '✅ 登录流程已完成！所有 checkpoint 已记录。',
      fail: '❌ 登录失败：',
      idle: '等待执行…',
    },
  },
  en: {
    nav: {
      brand: 'codeLog Demo',
      tag: 'Test Project',
      basic: '🧪 Basic Tests',
      basicDesc: 'Console / Network / Storage / Error',
      login: '🔐 Login Flow',
      loginDesc: '@codelog[checkpoint] full example',
    },
    home: {
      title: 'codeLog Test Project',
      subtitle: 'Verify codeLog full workflow: SDK → WS → PC Panel → AI Tools',
      tip: 'Before use: ',
      tipBody: 'Make sure npx codelog is running, and copy the SDK URL from console to src/codelog.ts',
    },
    basic: {
      title: '🧪 Full-chain Test',
      subtitle: 'Test chain: Demo → SDK → Server (38291) → PC Panel (3001)',
      sdkReady: '✅ Initialized, connected to http://localhost:38291',
      sdkLoading: '⏳ Loading...',
      sdkStatus: 'SDK Status: ',
      console: '📝 Console Logs',
      object: 'Object',
      batch: 'Batch ×5',
      network: '🌐 Network Requests (Fetch / XHR)',
      mock: '🎭 Mock API',
      addMock: 'Add Mock Rule',
      fetchMocked: 'fetch /api/demo (mocked)',
      clearMocks: 'Clear Mock Rules',
      websocket: '🔌 WebSocket',
      connectWS: 'Connect WS',
      sendMsg: 'Send Message',
      closeWS: 'Disconnect WS',
      idb: '🗄️ IndexedDB',
      idbWrite: 'Write 3 Records',
      idbRead: 'Read All Records',
      idbDelete: 'Delete item1',
      storage: '💾 Storage',
      storageWrite: 'Write localStorage/cookie',
      storageRead: 'Read localStorage',
      storageClear: 'Clear key',
      errorCapture: '💥 Error Capture',
      uncaughtError: 'Uncaught Error',
      promiseReject: 'Promise Rejection',
      screenshot: '📷 Screenshot',
      screenshotBtn: 'Take Screenshot → PC Panel',
      localLogs: '📋 Activity Log',
      noLogs: 'Click buttons above to start testing…',
      fetchFail: '500 Error',
    },
    login: {
      title: '🔐 Login Flow Test',
      subtitle: 'Demo @codelog[checkpoint] full usage',
      username: 'Username',
      password: 'Password',
      submit: 'Simulate Login',
      running: 'Running…',
      reset: 'Reset',
      flow: 'Login Flow Nodes',
      logs: 'Execution Log',
      noLogs: 'No logs yet',
      success: '✅ Login flow completed! All checkpoints recorded.',
      fail: '❌ Login failed: ',
      idle: 'Waiting to run…',
    },
  },
}

type Translations = typeof translations.zh

function getLang(): Lang {
  const stored = localStorage.getItem('codelog-lang')
  return stored === 'en' ? 'en' : 'zh'
}

let currentLang: Lang = getLang()
const listeners: Array<(lang: Lang) => void> = []

export function t<K1 extends keyof Translations>(
  section: K1
): Translations[K1] {
  return translations[currentLang][section] as Translations[K1]
}

export function getCurrentLang(): Lang {
  return currentLang
}

export function onLangChange(cb: (lang: Lang) => void) {
  listeners.push(cb)
  return () => {
    const idx = listeners.indexOf(cb)
    if (idx >= 0) listeners.splice(idx, 1)
  }
}

// Listen for localStorage changes (eruda lang switch happens in same tab via custom event)
window.addEventListener('storage', (e) => {
  if (e.key === 'codelog-lang') {
    currentLang = e.newValue === 'en' ? 'en' : 'zh'
    listeners.forEach((cb) => cb(currentLang))
  }
})

// Listen for same-tab lang change (eruda sets localStorage then fires this event)
window.addEventListener('codelog-lang-change', ((e: CustomEvent) => {
  const lang = e.detail as Lang
  if (lang === 'en' || lang === 'zh') {
    currentLang = lang
    listeners.forEach((cb) => cb(currentLang))
  }
}) as EventListener)
