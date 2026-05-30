/**
 * codeLog SDK 初始化
 *
 * 修改 SERVER_URL 为你的局域网地址（运行 `npx codelog` 后终端会打印）
 * 如果不需要远程监控，将 SERVER_URL 设为 undefined
 */

const SERVER_URL = (import.meta.env.VITE_CODELOG_SERVER as string) || undefined;

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

  // 动态加载 SDK（CDN）
  return new Promise<void>((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@codelog/sdk@latest/dist/codelog.iife.js';
    script.onload = () => {
      if (window.CodeLog) {
        window.__codelog__ = new window.CodeLog({
          projectId: 'codelog-demo',
          server: SERVER_URL,
          lang: 'zh',
        });
        console.log('[codeLog] SDK initialized', SERVER_URL ? `→ ${SERVER_URL}` : '(local only)');
      }
      resolve();
    };
    script.onerror = () => {
      console.warn('[codeLog] CDN load failed, running without SDK');
      resolve();
    };
    document.head.appendChild(script);
  });
}
