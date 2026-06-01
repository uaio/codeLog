/**
 * codeLog SDK 初始化
 *
 * 直接引用 @codelog/sdk（monorepo workspace 包），Vite 负责打包。
 * 服务端地址通过环境变量 VITE_CODELOG_SERVER 指定（默认 http://localhost:38291）
 */
import { init } from '@codelog/sdk';

const SERVER_URL = (import.meta.env.VITE_CODELOG_SERVER as string) || 'http://localhost:38291';

// SDK 在模块加载时同步初始化（eruda 面板在后台异步加载）
export const codelog = init({
  projectId: 'codelog-demo',
  server: SERVER_URL,
  lang: 'zh',
});

/** 兼容旧组件的调用方式，SDK 已在模块顶层初始化，直接返回 */
export function initCodeLog(): Promise<typeof codelog> {
  return Promise.resolve(codelog);
}
