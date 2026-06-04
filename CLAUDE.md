# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

codeLog — 开源移动端 H5 监控调试平台，面向 AI Agent 集成设计。核心能力：移动端 SDK 实时采集数据 → WebSocket 中继服务器 → PC 可视化面板 + MCP AI 工具。

## Build & Dev Commands

```bash
pnpm install            # 安装依赖
pnpm build              # 构建所有包（Turborepo 管理依赖顺序）
pnpm dev                # 所有包开发模式（watch）
pnpm test               # 运行所有测试（需要先 build）
pnpm lint               # ESLint 检查
pnpm format             # Prettier 格式化
pnpm start              # 启动服务器 (node packages/server/bin/codelog)
pnpm demo               # 启动 demo 应用

# 单包操作
pnpm --filter @codelog/sdk test       # 运行 SDK 测试
pnpm --filter @codelog/cli test       # 运行 CLI 测试
pnpm --filter @codelog/types build    # 构建 types 包
```

## Monorepo Architecture

pnpm workspaces + Turborepo。包间构建依赖由 `turbo.json` pipeline 的 `dependsOn: ["^build"]` 自动管理。

```
packages/types   ← 所有包的基础类型（SSOT），无运行时依赖
packages/sdk     ← 移动端浏览器 SDK（数据采集 + Eruda 面板），依赖 types
packages/cli     ← 服务器 + CLI + MCP server，依赖 types，内含 Express + WebSocket hub
packages/web     ← PC 调试面板（React + Vite），依赖 types
packages/eruda   ← Fork 的 Eruda 调试控制台（webpack 构建，独立工具链）
packages/demo    ← 开发测试用 demo 页面，依赖 sdk
```

**构建顺序**：types → sdk / cli / web（可并行）→ eruda / demo

## Core Data Flow

```
移动端 SDK (DataBus 事件总线)
  ├── Console/Network/Storage/DOM/Performance/Error 拦截器 → DataBus.emit()
  └── Reporter (WebSocket) → 发送 Envelope 格式数据

服务器 (Express + ws)
  ├── WebSocket Hub：双向中继（SDK ↔ PC/MCP）
  ├── REST API：/api/devices/*, /api/ingest
  └── 内存 Store（per-device，TTL 自动清理）

PC 面板 / MCP 工具
  └── WebSocket 订阅 → 各 Tab 组件 / AI 工具消费数据
```

## Key Architectural Patterns

### Envelope 统一数据格式（`packages/types/src/envelope.ts`）
所有数据遵循 `CodeLogEnvelope` 格式：`{ v, platform, device, tabId, ts, type, data }`。`type` 字段作为判别联合（discriminated union），14 种事件类型各有强类型 payload。

### DataBus 事件总线（`packages/sdk/src/core/DataBus.ts`）
同步事件发射器，拦截器发布、Reporter/Eruda 等订阅。同步 emit 确保数据采集不丢失。

### 插件系统（`packages/sdk/src/plugins/PluginManager.ts`）
生命周期：install → enable ↔ disable → uninstall。插件获得 dataBus、projectId、serverUrl 上下文。

### 双向通信
PC/MCP 不仅接收数据，还可向 SDK 发送命令（execute_js、take_screenshot、reload、mock 等），服务器作为中继。

### Zen Mode
性能分析时禁用高开销采集器（console、network 等），确保数据纯净。

## Package-Specific Notes

### `packages/types`
- 纯类型包，不产生运行时代码
- `envelope.ts` — Envelope 格式定义
- `events/index.ts` — 所有事件类型与 payload
- `protocol.ts` — WebSocket 消息协议（设备→服务器、服务器→设备、服务器→PC）
- 修改类型后需要重新构建依赖包

### `packages/sdk`
- 主类 `CodeLog`（`index.ts`）是唯一入口
- `interceptors/` — 各数据源拦截器（console、network、storage、dom、performance、indexeddb、screenshot、error）
- `transport/reporter.ts` — WebSocket 传输层，含限流和离线缓冲
- `core/platform/` — 平台适配层（browser 已实现，React Native 规划中）
- 输出格式：IIFE（`dist/codelog.iife.js`），通过 `<script>` 标签引入

### `packages/cli`
- 同时包含 Express 服务器和 CLI 命令
- `ws/server.ts` — WebSocket hub 核心逻辑
- `api/routes.ts` — REST API 路由
- `store/` — per-device 内存数据存储
- MCP server 集成在 CLI 包内（`npx @codelog/cli` 启动时可选加载）
- 支持 SQLite 持久化（`--persist`）和 API Key 认证（`--api-key`）

### `packages/web`
- React 18 单页应用
- `lib/websocketManager.ts` — WebSocket 单例，自动重连 + 消息订阅
- `components/` — 各功能 Tab 面板组件
- 国际化：中/英双语

### `packages/eruda`
- Fork 的第三方库，有自己的 webpack 构建链和 karma 测试
- ESLint 忽略此目录，不参与项目 lint

## Development Conventions

- TypeScript strict mode
- `@typescript-eslint/no-explicit-any` 设为 `warn`（非 error）
- 未使用变量以下划线前缀忽略：`argsIgnorePattern: '^_'`
- SDK 中的 `@codelog[checkpoint]` 日志格式用于 AI 验证流程，验证后必须清理
- 默认端口：38291
