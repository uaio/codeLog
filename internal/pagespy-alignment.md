# PageSpy Feature Alignment

> **Purpose:** Complete feature-by-feature comparison between codeLog and [PageSpy](https://github.com/HuolalaTech/page-spy-web) — both for gap analysis and UX quality benchmarking. Features shared by both tools are compared for which delivers a better user experience.
>
> **Last updated:** 2026-05-30 · Source: PageSpy SDK / Web / API server source code (verified against actual codeLog source)

---

## 🔍 共有功能横向 UX 对比（源码核实版）

> 以下仅列出**两者都已实现**的功能，逐一对比体验质量。基于对 `packages/sdk/src/` 和 `packages/web/src/` 的实际代码审查得出。

### 🏆 codeLog 更强的功能（2 项）

| 功能 | codeLog 实现 | PageSpy 实现 | 优势说明 |
|---|---|---|---|
| **localStorage 远程写入** | 面板有 Key/Value 输入框，支持远程 setItem/clear，实时同步到手机端 | 只读展示，无法从面板修改 | **codeLog 独有**：调试时可直接在面板注入 token、修改配置，PageSpy 做不到 |
| **sessionStorage 远程写入** | 同上，面板可直接写入 | 只读展示 | **codeLog 独有**：测试登录态、切换 feature flag 无需手动操作手机 |

---

### 🥈 PageSpy 更强的功能（7 项）

#### 1. Cookie 面板 — 属性字段缺失

| 维度 | codeLog | PageSpy |
|---|---|---|
| **数据采集** | `Object.defineProperty` 拦截 `document.cookie` setter，读取原始字符串后 split(`;`) | `cookieStore.addEventListener('change')` 直接拿到结构化对象 |
| **展示字段** | 只有 `Name` / `Value` 两列 | `Name` / `Value` / `Expires` / `Path` / `Domain` / `HttpOnly` / `Secure` |
| **实时性** | 依赖 setter 拦截，JS 无法修改的 HttpOnly Cookie 变化不会触发 | CookieStore change 事件覆盖所有来源 |
| **差距** | 登录调试时看不到 `HttpOnly`、`expires` 等安全属性 | 完整还原 Chrome DevTools Application → Cookies 面板 |
| **修复成本** | 小：Web 侧增加 5 列；SDK 侧改用 CookieStore API + fallback | — |

#### 2. 资源加载失败捕获 — 有 bug 被静默丢弃

| 维度 | codeLog | PageSpy |
|---|---|---|
| **addEventListener** | ✅ 已用 `capture: true` | ✅ 同 |
| **handler 逻辑** | `if (event.error)` → 只处理 JS 错误；资源加载失败时 `event.error === null`，直接跳过 | 额外检查 `event.target instanceof HTMLElement`，提取 `target.src \|\| target.href` |
| **结果** | 404 图片、加载失败的 CDN JS/CSS **在 Console 面板里完全不出现** | 清晰显示 `[Resource Error] https://cdn.example.com/xxx.js` |
| **修复成本** | 极小：在现有 errorHandler 里加 3 行 target 检查即可 | — |

#### 3. Fetch 响应解析 — 二进制响应必乱码

| 维度 | codeLog | PageSpy |
|---|---|---|
| **响应读取策略** | 无论什么 Content-Type，一律 `clonedResponse.text()` | 先读 `Content-Type` header，分支处理：`application/json` → parseJSON；`text/*` → text；其他 → blob → base64 |
| **二进制响应** | 显示乱码 `\uFFFD\uFFFD...` | 显示 base64 + 标注 `[Binary, N bytes]` |
| **JSON 大对象** | 文本字符串，不可折叠 | 解析为 JSON 对象，可在对象树里展开 |
| **修复成本** | 小：Fetch 拦截器加 Content-Type 分支判断 | — |

#### 4. XHR 响应解析 — 缺少 responseType 处理

| 维度 | codeLog | PageSpy |
|---|---|---|
| **responseType 支持** | 只读 `this.responseText`，`responseType=blob/arraybuffer` 时为空 | 按 responseType 分支：text/json → 直接读；blob/arraybuffer → base64（>MAX_SIZE 标注 `EXCEED_SIZE`）|
| **withCredentials** | 未采集 | ✅ 采集并展示 |
| **超大响应处理** | 直接截断，无说明 | 超出阈值时显示 `[EXCEED_SIZE]` 标注，让用户知道数据被截断 |
| **修复成本** | 小：XHR 拦截器增加 responseType 分支 | — |

#### 5. Console REPL — 输入/输出视觉无区分

| 维度 | codeLog | PageSpy |
|---|---|---|
| **执行结果消息类型** | 所有来自 REPL 的消息都是普通 `log` 类型，混在日志流里 | `debug-origin`（用户输入，灰色）和 `debug-eval`（执行结果，绿色/红色）两种类型 |
| **历史记录** | ✅ 有 ArrowUp/Down 历史 | ✅ 同 |
| **问题** | 多次执行后无法区分"哪条是我输入的，哪条是结果" | 输入/输出一目了然 |
| **修复成本** | 极小：SDK 端发送两种消息类型；Web 侧加两种样式 | — |

#### 6. 设备列表 — 展示原始 UA 字符串

| 维度 | codeLog | PageSpy |
|---|---|---|
| **设备名展示** | 原始 UA 字符串：`Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 ...)` | 解析后：🍎 iOS 17 + Safari 17 图标+版本 |
| **可读性** | 需要人工解读 UA | 一眼看出平台/浏览器/版本 |
| **设备分组** | ✅ 按 projectId 分组（已有） | ✅ 按 project/group 分组 |
| **修复成本** | 小：引入 ua-parser-js 解析，替换展示层 | — |

#### 7. 服务端认证 — 仅 API Key 方式

| 维度 | codeLog | PageSpy |
|---|---|---|
| **认证方式** | 环境变量 API Key，所有客户端共用 | 可选密码保护 + JWT，支持 `NotAllowedDeleteLog` 只读模式 |
| **公网部署** | API Key 泄露即全权限 | 密码+JWT 可设置过期时间，更安全 |
| **修复成本** | 中：Server 增加密码登录接口 + JWT 中间件 | — |

---

### 🤝 功能等价（体验相近）（8 项）

| 功能 | 说明 | 细微差异 |
|---|---|---|
| **日志级别拦截** | 均覆盖 5 级 + 未处理 Promise rejection | codeLog 无 `debug-origin`/`debug-eval` 消息类型区分 |
| **未处理 Promise rejection** | 两者均捕获并格式化 | 等价 |
| **localStorage 实时监控（读）** | 均代理 setItem/removeItem/clear，onInit 快照 | codeLog 额外支持写入（见上方 🏆） |
| **sessionStorage 实时监控（读）** | 同上 | 同上 |
| **Storage 初始快照** | 均在连接时推送全量 | 等价 |
| **UserAgent 采集** | 均采集 navigator.userAgent | 等价 |
| **HTML 快照** | 均捕获 outerHTML | PageSpy 额外附带 window.location 结构化对象 |
| **设备列表分组** | codeLog 按 projectId 分组，有在线/离线颜色标注 | PageSpy 额外有 OS/浏览器图标 |

---

### 📊 总结

| 结果 | 数量 | 功能 |
|---|---|---|
| 🏆 codeLog 更强 | 2 | localStorage 写入、sessionStorage 写入 |
| 🥈 PageSpy 更强 | 7 | Cookie 属性、资源错误、Fetch 解析、XHR 类型、REPL 区分、UA 解析、认证 |
| 🤝 基本等价 | 8 | 日志级别、rejection、Storage 快照、UA、HTML 快照等 |

**结论：** codeLog 在"写"能力上有优势（远程修改 Storage），但"读"能力（展示质量、响应解析、Cookie 属性）普遍落后 PageSpy 半步。好消息是**所有 7 处 PageSpy 领先的差距修复成本都极低（大多数 < 1 天工作量）**，属于"低垂果实"。

---

## Status Legend

| Symbol | Meaning |
|---|---|
| ✅ | Fully implemented |
| ⚠️ | Partially implemented |
| ❌ | Not implemented |
| 🔴 P0 | Critical — implement first |
| 🟠 P1 | High priority |
| 🟡 P2 | Medium priority |
| ⚪ P3 | Low / future |
| 🏆 codeLog | codeLog has better UX |
| 🥈 PageSpy | PageSpy has better UX |
| 🤝 Tie | Equivalent experience |

---

## 1. SDK — Console Plugin

| Feature | PageSpy Implementation | codeLog Status | UX Winner | Notes & Action |
|---|---|---|---|---|
| **Log type interception** | `log/info/warn/error/debug` + `debug-origin`/`debug-eval` | ✅ Equivalent | 🤝 Tie | Both intercept all 5 levels |
| **Object serialization (Atom)** | Lazy-load atom tree: circular refs, Symbol, BigInt, Set/Map/Prototype expand | ⚠️ Simple `JSON.stringify` | 🥈 PageSpy | PageSpy tree expands like Chrome DevTools; codeLog shows `[object Object]` → **implement Atom system** |
| **Printf-style formatting** | `%c/%d/%s/%o` format strings | ❌ Missing | 🥈 PageSpy | codeLog shows raw format string → **pre-process in SDK interceptor** |
| **Remote REPL execution** | `new Function()` + distinguishes `debug-origin` vs `debug-eval` | ⚠️ Basic JS exec | 🥈 PageSpy | PageSpy colors input vs output; codeLog mixes them → **add message-type distinction + UI color coding** |
| **Data filter callback** | `dataProcessor.console(data) → false` suppresses message | ❌ Missing | 🥈 PageSpy | Useful for filtering sensitive logs → **add `dataProcessor` config option** |

---

## 2. SDK — Error Plugin

| Feature | PageSpy Implementation | codeLog Status | UX Winner | Notes & Action |
|---|---|---|---|---|
| **JS runtime errors** | `errorDetail` structured object + full stack | ✅ Basic stack | 🥈 PageSpy | PageSpy's `errorDetail` has richer metadata → **add `errorDetail` structured field** |
| **Resource load failures** | Capture-phase `addEventListener` for `<script>/<link>/<img>/<font>` → extracts `src`/`href` | ❌ Missing | 🥈 PageSpy | 404 images/CSS/fonts invisible in codeLog → **add capture-phase error listener in SDK** |
| **Unhandled Promise rejection** | `unhandledrejection` + `formatErrorObj` | ✅ Supported | 🤝 Tie | Equivalent |

---

## 3. SDK — Network Plugin

| Feature | PageSpy Implementation | codeLog Status | UX Winner | Notes & Action |
|---|---|---|---|---|
| **XHR interception** | Full state machine UNSENT→DONE, req/res headers, blob→base64, `EXCEED_SIZE` reason, `withCredentials` | ⚠️ Partial | 🥈 PageSpy | Missing blob/arraybuffer handling and `EXCEED_SIZE` annotation → **complete `responseReason` field** |
| **Fetch interception** | Content-Type auto-detect (JSON/text/blob→base64) | ⚠️ Partial | 🥈 PageSpy | Missing Content-Type smart parsing → **add Content-Type-based response parsing** |
| **WebSocket interception** | Replaces `window.WebSocket`, captures send/recv/open/close/error, excludes SDK's own connections | ❌ Missing | 🥈 PageSpy | WS message streams completely invisible in codeLog → **proxy WebSocket constructor** |
| **EventSource / SSE interception** | Intercepts `EventSource`, captures frames + `lastEventId` | ❌ Missing | 🥈 PageSpy | SSE streams invisible → **proxy EventSource constructor** |
| **Beacon interception** | `navigator.sendBeacon` proxy | ❌ Missing | 🥈 PageSpy | Tracking/analytics beacons invisible → **proxy `sendBeacon`** |
| **Resource timing list** | `PerformanceObserver` — script/css/img/font load timings | ⚠️ Performance monitor exists but no resource list | 🥈 PageSpy | No static resource load timeline → **add PerformanceObserver `resource` type entries** |
| **RequestItem completeness** | `withCredentials`, `readyState`, `responseReason`, `lastEventId` | ⚠️ Partial | 🥈 PageSpy | Missing several fields → **align `RequestItem` schema** |

---

## 4. SDK — Storage Plugin

| Feature | PageSpy Implementation | codeLog Status | UX Winner | Notes & Action |
|---|---|---|---|---|
| **localStorage real-time** | Proxy `setItem`/`removeItem`/`clear`, full snapshot on init | ✅ Supported | 🤝 Tie | Equivalent |
| **sessionStorage real-time** | Same as above | ✅ Supported | 🤝 Tie | Equivalent |
| **Cookie monitoring** | `cookieStore.addEventListener` API + `document.cookie` polling fallback | ❌ Missing | 🥈 PageSpy | Cookies (login state, CSRF tokens) completely invisible → **implement CookieStore API with polling fallback** |
| **Initial storage snapshot** | Full snapshot of all 3 storage types pushed on init | ✅ Supported | 🤝 Tie | Equivalent |

---

## 5. SDK — Database Plugin (IndexedDB)

| Feature | PageSpy Implementation | codeLog Status | UX Winner | Notes & Action |
|---|---|---|---|---|
| **IndexedDB monitoring** | Lists all DBs + store structure (keyPath/autoIncrement/indexes); paginated data (50/page); proxies `put`/`add`/`delete`/`clear`/`deleteDatabase` | ❌ Missing | 🥈 PageSpy | Modern web apps use IDB heavily; completely blind in codeLog → **proxy IDBFactory + IDBObjectStore prototypes; add tree-view panel** |

---

## 6. SDK — Page Plugin

| Feature | PageSpy Implementation | codeLog Status | UX Winner | Notes & Action |
|---|---|---|---|---|
| **HTML snapshot** | `document.documentElement.outerHTML` + `window.location` structured object | ⚠️ outerHTML only | 🥈 PageSpy | Missing location info → **include `window.location` alongside HTML** |

---

## 7. SDK — System Plugin

| Feature | PageSpy Implementation | codeLog Status | UX Winner | Notes & Action |
|---|---|---|---|---|
| **UserAgent** | `navigator.userAgent` | ✅ Supported | 🤝 Tie | Equivalent |
| **Browser feature detection (Modernizr)** | 50+ features: Web APIs / Network / JS ES6-ES9 / CSS / Elements / Storage | ❌ Missing | 🥈 PageSpy | Instantly reveals device compatibility gaps → **integrate Modernizr; add System panel tab** |
| **NetworkInformation API** | `connection.type`/`effectiveType`/`downlink`/`rtt` | ❌ Missing | 🥈 PageSpy | Real network quality measurement → **read `navigator.connection`** |
| **Battery API** | `level`/`charging`/`chargingTime`/`dischargingTime` | ❌ Missing | 🥈 PageSpy | Useful for mobile debugging → **`navigator.getBattery()`** |
| **Hardware info** | `navigator.deviceMemory` + `hardwareConcurrency` | ❌ Missing | 🥈 PageSpy | CPU core count and RAM for performance analysis → **read and push on init** |

---

## 8. SDK — Optional Plugins

| Plugin | PageSpy Implementation | codeLog Status | UX Winner | Notes & Action |
|---|---|---|---|---|
| **DataHarborPlugin** | Offline cache (10MB default), 5-min auto-slice periods; `upload`/`download`/`uploadPeriods`/`pause`/`resume`; auto-filters own upload URLs | ❌ Missing | 🥈 PageSpy | No offline data in codeLog; lost on disconnect → **new `@codelog/plugin-data-harbor` package** |
| **RRWebPlugin** | Full DOM recording via rrweb; canvas (15fps/webp); `takeFullSnapshot` on period boundary | ❌ Missing | 🥈 PageSpy | Can replay user actions to reproduce bugs → **new `@codelog/plugin-rrweb` package (depends on DataHarbor)** |
| **OSpy (offline-only)** | Standalone: bundles DataHarbor+RRWeb, floating button UI, zero server required | ❌ Missing | 🥈 PageSpy | Zero-deployment distribution to testers → **new `@codelog/plugin-ospy` package** |
| **Plugin lifecycle system** | `onInit`/`onMounted`/`onReset`, `enforce` ordering (`pre`/`normal`/`post`), `disabledPlugins` | ⚠️ Hardcoded modules | 🥈 PageSpy | Third-party extensibility → **refactor SDK to plugin architecture** |
| **Gesture activation** | `gesture: ['U','D','L','R']` sequence triggers floating button | ❌ Missing | 🥈 PageSpy | Hide debugger UI, activate with gesture → **gesture recognizer in SDK** |
| **Offline mode** | `offline: true` — local data collection, no WebSocket | ❌ Missing | 🥈 PageSpy | Works behind strict firewalls → **skip WS init when `offline: true`** |
| **Room secret** | `useSecret: true` — 6-digit random secret, cached in sessionStorage | ❌ Missing | 🥈 PageSpy | Prevents others from debugging same device → **generate + validate secret on join** |

---

## 9. Web Dashboard — Console Panel

| Feature | PageSpy Implementation | codeLog Status | UX Winner | Notes & Action |
|---|---|---|---|---|
| **Object tree expansion** | `@huolala-tech/react-json-view` — click to expand nested objects/arrays/Set/Map/Prototype | ❌ Flat text | 🥈 PageSpy | PageSpy matches Chrome DevTools feel; codeLog is unreadable for complex objects → **integrate react-json-view + Atom fetch-on-demand** |
| **REPL input/output color coding** | `debug-origin` (grey prefix), `debug-eval` (green result) | ⚠️ No distinction | 🥈 PageSpy | Input and output are visually separated → **CSS color coding for message types** |
| **Log level filter + search** | Filter buttons per level + text search | ✅ Supported | 🤝 Tie | Equivalent |

---

## 10. Web Dashboard — Network Panel

| Feature | PageSpy Implementation | codeLog Status | UX Winner | Notes & Action |
|---|---|---|---|---|
| **All request types display** | XHR / Fetch / WebSocket / EventSource / Beacon with type badges | ⚠️ XHR+Fetch only | 🥈 PageSpy | WS/SSE/Beacon invisible → **add type badges for all request categories** |
| **Request replay** | One-click re-send button | ❌ Missing | 🥈 PageSpy | Saves time debugging API endpoints → **send `replay` command to SDK; SDK re-fires request** |
| **Request/response detail** | Expandable headers + body for each request | ✅ Supported | 🤝 Tie | Equivalent |
| **Network throttle** | ❌ Not in PageSpy | ✅ codeLog exclusive | 🏆 codeLog | Multi-tier speed throttling (2G/3G/4G/slow) |

---

## 11. Web Dashboard — Storage Panel

| Feature | PageSpy Implementation | codeLog Status | UX Winner | Notes & Action |
|---|---|---|---|---|
| **localStorage panel** | Key-value table, editable, delete, refresh | ✅ Supported | 🤝 Tie | Equivalent |
| **sessionStorage panel** | Same as above | ✅ Supported | 🤝 Tie | Equivalent |
| **Cookie panel** | Independent tab with `expires`/`path`/`domain`/`httpOnly`/`secure` columns | ❌ Missing | 🥈 PageSpy | Login state debugging impossible without cookie visibility → **add Cookie tab to Storage panel** |
| **IndexedDB panel** | Tree: DB → Object Store → Paginated data (50/page), expandable | ❌ Missing | 🥈 PageSpy | Modern app storage fully invisible → **add IDB tree panel** |
| **Mock API** | ❌ Not in PageSpy | ✅ codeLog exclusive | 🏆 codeLog | Mock interface responses from the panel |

---

## 12. Web Dashboard — System Panel

| Feature | PageSpy Implementation | codeLog Status | UX Winner | Notes & Action |
|---|---|---|---|---|
| **Feature detection panel** | Modernizr results grouped by Web/Network/JS/CSS/Elements/Storage; spec links | ❌ Missing | 🥈 PageSpy | Compatibility diagnosis in one glance → **add System tab** |
| **Network info** | `connection.type`, `effectiveType`, `downlink`, `rtt` | ❌ Missing | 🥈 PageSpy | Real network quality display |
| **Battery + Hardware** | Battery level/charging, `deviceMemory`, `hardwareConcurrency` | ❌ Missing | 🥈 PageSpy | Device capability snapshot |
| **Health scoring** | ❌ Not in PageSpy | ✅ codeLog exclusive | 🏆 codeLog | Page quality health score |

---

## 13. Web Dashboard — Offline / Replay

| Feature | PageSpy Implementation | codeLog Status | UX Winner | Notes & Action |
|---|---|---|---|---|
| **Offline log list page** | Date range/deviceId/project/title filters; batch delete; file status/size/remark | ❌ Missing | 🥈 PageSpy | Post-hoc analysis completely missing → **new `/log-list` route** |
| **Offline replay player** | Timeline scrubber + Console/Network/Storage multi-track sync + rrweb DOM playback | ❌ Missing | 🥈 PageSpy | Bug reproduction powerhouse → **new `/replay` route** |

---

## 14. Web Dashboard — Session & UX

| Feature | PageSpy Implementation | codeLog Status | UX Winner | Notes & Action |
|---|---|---|---|---|
| **Device/room list with grouping** | project/group tree, online status, click to debug | ⚠️ Flat list | 🥈 PageSpy | PageSpy's grouped view is clearer for multi-app teams → **add project/group grouping** |
| **Multi-debugger collaboration** | Multiple devtools clients in same room simultaneously | ❌ Single viewer | 🥈 PageSpy | Team debugging → **P3: Room protocol multi-viewer** |
| **Device info sidebar** | OS icon + version, browser icon + version, DeviceID first 4 chars, MP warning banner | ⚠️ Text only | 🥈 PageSpy | Platform icon badges increase visual recognition → **add OS/browser icons** |
| **Unread badge on tabs** | Red dot on inactive tabs when new data arrives | ❌ Missing | 🥈 PageSpy | Don't miss events while on another tab → **Zustand unread counter + badge** |
| **Screenshots** | ❌ Not in PageSpy | ✅ codeLog exclusive | 🏆 codeLog | html2canvas screenshot |
| **Benchmark / Perf-run** | ❌ Not in PageSpy | ✅ codeLog exclusive | 🏆 codeLog | Performance benchmarking panel |

---

## 15. Server

| Feature | PageSpy Implementation | codeLog Status | UX Winner | Notes & Action |
|---|---|---|---|---|
| **Log upload API** | `POST /api/v1/log/upload` multipart; tags (project/title/deviceId/remark) | ❌ Missing | 🥈 PageSpy | DataHarbor upload depends on this → **add log file upload/download/list/delete endpoints** |
| **Log list API** | Paginated + time range + tag filters | ❌ Missing | 🥈 PageSpy | |
| **Log auto-cleanup** | Every 10min: by age (`maxLifeOfHour`) + by total size (`maxSizeOfMB`) | ⚠️ By days only | 🥈 PageSpy | Missing total-size-based cleanup → **add `maxSizeMB` eviction** |
| **Log group management** | Logical grouping of related log files | ❌ Missing | 🥈 PageSpy | Session-level log organization |
| **Optional password auth** | Password login + JWT; `NotAllowedDeleteLog` flag | ⚠️ API Key only | 🥈 PageSpy | JWT more user-friendly for public deployment → **add optional password+JWT mode** |
| **Docker deployment** | Official `ghcr.io` image, `docker-compose.yml`, `-v log -v data` volumes | ❌ Missing | 🥈 PageSpy | One-command deployment → **add Dockerfile + docker-compose.yml** |
| **Prometheus metrics** | `server_read_message`/`send_message`/`tunnel_room` counters/timers | ❌ Missing | 🥈 PageSpy | Production observability → **P3: prom-client integration** |
| **Distributed / multi-node** | RPC cross-node queries, `machineId` in `fileId` | ❌ Missing | 🥈 PageSpy | P3: multi-server scaling |

---

## 16. codeLog Exclusive Strengths

> These features do not exist in PageSpy. Maintain and strengthen them.

| Feature | Value |
|---|---|
| **MCP + 30 AI tools** | Claude/Cursor can directly call debug tools — the core AI workflow differentiator |
| **`@codelog[checkpoint]` verification** | AI coding workflow checkpoints, unique to codeLog |
| **Mock API panel** | Mock interface responses directly from the debug panel |
| **Network throttle simulation** | Multi-tier speed throttling (2G/3G/4G/Slow) |
| **Benchmark / Perf-run** | Performance benchmarking suite |
| **Health scoring** | Page quality composite score |
| **Screenshots** | html2canvas screenshots |

---

## Implementation Roadmap

### 🔴 P0 — Critical (implement first)

| # | Task | Scope | Effort |
|---|---|---|---|
| 1 | Cookie support: SDK `cookieStore` monitoring + Web panel Cookie tab | SDK + Web | Small |
| 2 | IndexedDB support: SDK IDBObjectStore proxy + Web tree panel | SDK + Web | Medium |
| 3 | System panel: Modernizr detection + NetworkInfo + Battery/Hardware | SDK + Web | Medium |
| 4 | Console object tree: Atom serialization system + react-json-view | SDK + Web | Large |
| 5 | Docker deployment: Dockerfile + docker-compose.yml | Root | Small |
| 6 | WebSocket interception: proxy `window.WebSocket` | SDK + Web | Medium |
| 7 | Resource load failure capture: capture-phase error events | SDK | Small |

### 🟠 P1 — High Priority

| # | Task | Scope | Effort |
|---|---|---|---|
| 8 | EventSource/SSE interception | SDK + Web | Small |
| 9 | DataHarborPlugin: offline data caching + upload/download | New SDK package | Medium |
| 10 | Log management API: upload/download/list/delete endpoints | Server | Medium |
| 11 | Offline log list page + replay player | Server + Web | Large |
| 12 | Network request replay (one-click re-send) | Web | Small |
| 13 | REPL input/output color distinction | Web | Small |
| 14 | XHR/Fetch completeness: blob→base64, EXCEED_SIZE, Content-Type detection | SDK | Small |

### 🟡 P2 — Medium Priority

| # | Task | Scope | Effort |
|---|---|---|---|
| 15 | RRWebPlugin: DOM recording + canvas recording | New SDK package | Medium |
| 16 | Beacon interception | SDK | Small |
| 17 | Resource timing list (PerformanceObserver) | SDK + Web | Medium |
| 18 | Gesture activation | SDK | Small |
| 19 | Offline mode (`offline: true`) | SDK | Small |
| 20 | Room secret protection | SDK + Server | Small |
| 21 | Device list grouping by project/group | Web | Small |
| 22 | OS/browser icons in device sidebar | Web | Small |
| 23 | Unread badge on panel tabs | Web | Small |
| 24 | HTML snapshot + location info | SDK | Small |
| 25 | Log auto-cleanup by total size (`maxSizeMB`) | Server | Small |
| 26 | Optional password auth + JWT | Server | Medium |
| 27 | OSpy standalone offline plugin | New SDK package | Medium |
| 28 | `dataProcessor` filter callbacks | SDK | Small |
| 29 | Plugin lifecycle architecture refactor | SDK | Large |

### ⚪ P3 — Future

| # | Task | Scope | Effort |
|---|---|---|---|
| 30 | Mini-program SDKs (WeChat/Alipay/Taro/UniApp) | New packages | Large |
| 31 | Multi-debugger collaboration (Room protocol) | Server | Large |
| 32 | Distributed / multi-node support | Server | Large |
| 33 | Prometheus metrics | Server | Medium |

---

## References

- [PageSpy SDK](https://github.com/HuolalaTech/page-spy) — Plugin source: `packages/page-spy-browser/src/plugins/`
- [PageSpy Web Dashboard](https://github.com/HuolalaTech/page-spy-web) — UI source: `src/pages/Devtools/`
- [PageSpy API Server](https://github.com/HuolalaTech/page-spy-api) — Routes: `serve/route/route.go`
- [PageSpy DataHarbor Plugin](https://github.com/HuolalaTech/page-spy/tree/main/packages/page-spy-plugin-data-harbor)
- [PageSpy RRWeb Plugin](https://github.com/HuolalaTech/page-spy/tree/main/packages/page-spy-plugin-rrweb)
