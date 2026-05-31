/**
 * codeLog SDK 初始化
 *
 * 开发模式：自动加载本地构建的 SDK（packages/sdk/dist/codelog.iife.js）
 * 生产模式：从 CDN 加载
 *
 * 服务端地址通过环境变量 VITE_CODELOG_SERVER 指定（默认 http://localhost:38291）
 */

const SERVER_URL = (import.meta.env.VITE_CODELOG_SERVER as string) || 'http://localhost:38291';

// 开发时使用本地 SDK，生产时使用 CDN
const SDK_URL = import.meta.env.DEV
  ? '/codelog.iife.js'
  : 'https://unpkg.com/@codelog/sdk@latest/dist/codelog.iife.js';

declare global {
  interface Window {
    CodeLog: any;
    __codelog__: any;
  }
}

let initialized = false;

export async function initCodeLog() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  return new Promise<void>((resolve) => {
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.onload = () => {
      if (window.CodeLog) {
        window.__codelog__ = new window.CodeLog({
          projectId: 'codelog-demo',
          server: SERVER_URL,
          lang: 'zh',
        });
        console.log('[codeLog] SDK initialized', `→ ${SERVER_URL}`, `(SDK: ${SDK_URL})`);
      } else {
        console.warn('[codeLog] window.CodeLog not found after script load');
      }
      resolve();
    };
    script.onerror = () => {
      console.warn('[codeLog] SDK load failed:', SDK_URL);
      resolve();
    };
    document.head.appendChild(script);
  });
}
