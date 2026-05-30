# @codelog/sdk

> Mobile H5 SDK for codeLog — real-time collection of console logs, network requests, storage, DOM, performance, errors, and screenshots.

## Installation

```bash
npm install @codelog/sdk
```

## Quick Start

### CDN (IIFE)

```html
<script src="https://unpkg.com/@codelog/sdk@latest/dist/codelog.iife.js"></script>
<script>
  CodeLog.init({
    projectId: 'my-app',
    server: 'ws://192.168.x.x:38291',
    lang: 'en'
  });
</script>
```

### ES Module

```javascript
import CodeLog from '@codelog/sdk';

new CodeLog({
  projectId: 'my-app',
  server: 'ws://192.168.x.x:38291',
  lang: 'en'
});
```

### Local-only Mode (No Server)

```javascript
CodeLog.init({ projectId: 'my-app', lang: 'en' });
// Opens built-in Eruda debug panel on device
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `projectId` | `string` | (required) | Project identifier |
| `server` | `string` | — | WebSocket server URL (omit for local-only mode) |
| `lang` | `'en' \| 'zh'` | `'zh'` | UI language |
| `enableConsole` | `boolean` | `true` | Collect console logs |
| `enableNetwork` | `boolean` | `true` | Intercept network requests |
| `enableStorage` | `boolean` | `true` | Monitor storage changes |
| `enablePerformance` | `boolean` | `true` | Collect performance data |
| `enableError` | `boolean` | `true` | Capture JS errors |

## Collectors

| Collector | Description |
|-----------|-------------|
| **Console** | log / warn / error / info, preserves rich-text arguments |
| **Network** | XHR + Fetch interception with request/response bodies + timing |
| **Storage** | localStorage / sessionStorage / Cookie monitoring |
| **DOM** | Page structure serialization |
| **Performance** | FPS + Web Vitals (LCP/CLS/FCP/TTFB/INP) + Long Tasks |
| **Error** | Global JS errors + unhandled Promise rejections |
| **Screenshot** | html2canvas page capture |

## API

### Constructor

```typescript
new CodeLog(options: CodeLogOptions)
// or
CodeLog.init(options: CodeLogOptions)
```

### Methods

| Method | Description |
|--------|-------------|
| `enableRemote()` | Enable remote monitoring |
| `disableRemote()` | Disable remote monitoring (persisted to localStorage) |
| `isRemoteEnabled()` | Check if remote monitoring is active |
| `destroy()` | Destroy instance, restore original console, disconnect |

## Architecture

```
CodeLog SDK
├── DataBus (unified event bus)
│   ├── ErudaPlugin → On-device debug panel
│   └── WebSocket Reporter → Server
├── Interceptors (console, network, storage, DOM, perf, error, screenshot)
└── Transport (WebSocket with auto-reconnect + message queue)
```

## Development

```bash
# From monorepo root
pnpm --filter @codelog/sdk dev    # Watch mode
pnpm --filter @codelog/sdk build  # Production build
pnpm --filter @codelog/sdk test   # Run tests
```

## License

MIT © [codeLog](https://github.com/uaio/codeLog)
