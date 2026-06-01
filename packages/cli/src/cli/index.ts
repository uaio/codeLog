import { createWebSocketServer } from '../ws/server.js';
import { createRoutes } from '../api/routes.js';
import { Persistence } from '../store/persistence.js';
import { SavedLogStore } from '../store/savedLogs.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { networkInterfaces, homedir } from 'os';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';

export interface CLIOptions {
  port?: number;
  host?: string;
  webDistPath?: string;
  corsOrigin?: string;
  apiKey?: string;
  persist?: boolean;
  dbPath?: string;
  retentionDays?: number;
  /** Auto-open the PC panel in the default browser after server starts */
  open?: boolean;
}

/** Check if MCP is already configured for any known AI tool in the current project */
function isMcpConfigured(): boolean {
  const cwd = process.cwd();
  const home = homedir();
  const checks = [
    join(cwd, '.claude.json'),
    join(cwd, '.cursor', 'mcp.json'),
    join(home, '.codeium', 'windsurf', 'mcp_config.json'),
    join(cwd, '.vscode', 'settings.json'),
  ];
  return checks.some((f) => {
    if (!existsSync(f)) return false;
    try {
      const content = readFileSync(f, 'utf-8');
      return content.includes('codelog');
    } catch {
      return false;
    }
  });
}

export async function start(options: CLIOptions = {}) {
  const port = options.port || 38291;
  const host = options.host; // 用户指定的公网地址（域名或 IP）
  const corsOrigin = options.corsOrigin || process.env.CODELOG_CORS_ORIGIN;
  const apiKey = options.apiKey || process.env.CODELOG_API_KEY;

  const app = express();
  const server = http.createServer(app);

  app.use(cors(corsOrigin ? { origin: corsOrigin.split(',').map((s) => s.trim()) } : undefined));

  // Optional API key authentication middleware (enhanced with rate limiting)
  if (apiKey) {
    app.use(createAuthMiddleware(apiKey));
  }

  // Optional persistence layer
  let persistence: Persistence | undefined;
  if (options.persist) {
    persistence = new Persistence({
      dbPath: options.dbPath,
      retentionDays: options.retentionDays,
    });
  }

  const {
    deviceStore,
    logStore,
    networkStore,
    storageStore,
    domStore,
    performanceStore,
    screenshotStore,
    perfRunStore,
    mockStore,
    systemStore,
    idbStore,
    idbSnapshotStore,
    computedStylesStore,
  } = createWebSocketServer(server, { apiKey, persistence });

  // Start hourly TTL cleanup for log entries older than 24 hours
  logStore.startPeriodicCleanup();

  const savedLogStore = new SavedLogStore();

  app.use(express.json({ limit: '5mb' })); // screenshots can be large, but cap at 5MB
  app.use(
    createRoutes(
      deviceStore,
      logStore,
      networkStore,
      storageStore,
      domStore,
      performanceStore,
      screenshotStore,
      perfRunStore,
      mockStore,
      systemStore,
      idbStore,
      savedLogStore,
      idbSnapshotStore,
      computedStylesStore,
    ),
  );

  // 获取当前文件的目录路径
  const currentFilename = fileURLToPath(import.meta.url);
  const currentDirname = dirname(currentFilename);

  // 提供静态文件：优先使用传入的路径，否则回退到 monorepo 中 web/dist（开发模式）
  const webDistPath = options.webDistPath ?? join(currentDirname, '../../../web/dist');
  app.use(express.static(webDistPath));

  // 全局异常处理
  const handleError = (error: Error, context: string) => {
    console.error(`[${context}]`, error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  };

  process.on('uncaughtException', (error) => {
    handleError(error, 'uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    handleError(reason instanceof Error ? reason : new Error(String(reason)), 'unhandledRejection');
  });

  // 进程信号处理
  const shutdown = async (signal: string) => {
    console.log(`\n收到 ${signal} 信号，正在关闭服务器...`);

    try {
      // Stop log cleanup timer
      logStore.stopPeriodicCleanup();

      // 关闭持久化层
      persistence?.close();

      // 关闭 HTTP 服务器
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      console.log('服务器已关闭');
      process.exit(0);
    } catch (error) {
      console.error('关闭服务器时出错:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // 启动服务器，添加错误处理
  await new Promise<void>((resolve, reject) => {
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        reject(new Error(`端口 ${port} 已被占用，请使用其他端口或关闭占用该端口的程序`));
      } else {
        reject(new Error(`服务器启动失败: ${error.message}`));
      }
    });

    server.listen(port, '0.0.0.0', async () => {
      // 列出所有可用的 IPv4 地址（跳过 loopback）
      const allIpv4 = Object.entries(networkInterfaces()).flatMap(([name, ifaces]) =>
        (ifaces ?? [])
          .filter((i) => i.family === 'IPv4' && !i.internal)
          .map((i) => ({ name, address: i.address })),
      );

      const localUrl = `http://localhost:${port}`;

      // 如果用户指定了 --host，优先使用（云端/公网场景）
      const useHost = host;
      const protocol = useHost?.startsWith('https') ? 'wss' : 'ws';
      const httpProtocol = useHost?.startsWith('https') ? 'https' : 'http';

      // 构建网络地址列表行
      const networkLines =
        allIpv4.length > 0
          ? allIpv4
              .map(({ name, address }) => {
                const url = `http://${address}:${port}`;
                const wsUrl = `ws://${address}:${port}`;
                return `  ${name.padEnd(12)} ${url}\n` + `               SDK server: '${wsUrl}'`;
              })
              .join('\n')
          : '  （未检测到局域网地址）';

      // 确定 SDK snippet 中使用的 server 地址
      let primaryWs: string;
      let panelUrl: string;
      if (useHost) {
        // 云端模式：用户指定了公网地址
        const cleanHost = useHost.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const needsPort = !cleanHost.includes(':');
        primaryWs = `${protocol}://${cleanHost}${needsPort && port !== 80 && port !== 443 ? ':' + port : ''}`;
        panelUrl = `${httpProtocol}://${cleanHost}${needsPort && port !== 80 && port !== 443 ? ':' + port : ''}`;
      } else {
        // 局域网模式：自动检测 IP
        const primaryIp = allIpv4[0]?.address ?? 'localhost';
        primaryWs = `ws://${primaryIp}:${port}`;
        panelUrl = localUrl;
      }

      console.log(`
✅ codeLog 已启动  端口: ${port}
   PC 面板  →  ${localUrl}${useHost ? `\n   公网    →  ${panelUrl}` : ''}
   按 Ctrl+C 停止
`);

      resolve();

      // Auto-open browser panel if requested
      if (options.open) {
        try {
          const { default: openBrowser } = await import('open');
          await openBrowser(localUrl);
        } catch {
          // open is optional — don't fail if unavailable
        }
      }

      // MCP setup wizard — only when running interactively (TTY)
      if (process.stdout.isTTY) {
        await runOnboardingGuide({ port, primaryWs, allIpv4 });
      }
    });
  });

  return server;
}

/** Detect installed AI tools by checking known config paths */
function detectAITools(): string[] {
  const cwd = process.cwd();
  const home = homedir();
  const found: string[] = [];
  if (existsSync(join(cwd, '.claude.json')) || existsSync(join(cwd, '.claude'))) found.push('Claude Code');
  if (existsSync(join(cwd, '.cursor'))) found.push('Cursor');
  if (existsSync(join(home, '.codeium', 'windsurf'))) found.push('Windsurf');
  if (
    existsSync(join(home, '.vscode')) ||
    existsSync(join(cwd, '.vscode'))
  ) found.push('VS Code / Copilot');
  return found;
}

/**
 * Post-start onboarding guide.
 * Step 1: Show SDK snippet (always).
 * Step 2: Offer MCP setup if AI tools detected and not yet configured.
 */
async function runOnboardingGuide(opts: {
  port: number;
  primaryWs: string;
  allIpv4: { name: string; address: string }[];
}): Promise<void> {
  const { port, primaryWs, allIpv4 } = opts;

  // Build network address list for multi-NIC hint
  const nicLines =
    allIpv4.length > 1
      ? '\n   不在同一 WiFi？换成手机可达的网卡地址：\n' +
        allIpv4.map(({ name, address }) => `     ${name.padEnd(10)} ws://${address}:${port}`).join('\n')
      : '';

  // ── Step 1: SDK snippet ──────────────────────────────────────────
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 接入你的 H5 页面（粘贴到 <head> 或 </body> 前）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  <script src="https://unpkg.com/@codelog/sdk@latest/dist/codelog.iife.js"></script>
  <script>CodeLog.init({ projectId: 'my-app', server: '${primaryWs}', lang: 'zh' })</script>
${nicLines}
`);

  // ── Step 2: MCP setup (optional) ────────────────────────────────
  if (isMcpConfigured()) return;

  const tools = detectAITools();
  if (tools.length === 0) {
    console.log(`  💡 使用 Claude / Cursor / Windsurf？运行 npx @codelog/cli init 接入 AI。\n`);
    return;
  }

  try {
    const { createInterface } = await import('readline');
    const rl = createInterface({ input: process.stdin, output: process.stdout });

    const answer = await new Promise<string>((res) => {
      process.stdout.write(`  🤖 检测到 ${tools.join(' / ')}，配置 MCP 让 AI 直接调用调试工具？[Y/n] `);
      rl.once('line', (line) => {
        rl.close();
        res(line.trim().toLowerCase());
      });
    });

    if (answer === '' || answer === 'y' || answer === 'yes') {
      console.log('');
      const { init } = await import('./init.js');
      await init({ port });
    } else {
      console.log(`\n  稍后运行: npx @codelog/cli init\n`);
    }
  } catch {
    console.log(`\n  运行 npx @codelog/cli init 配置 MCP\n`);
  }
}
