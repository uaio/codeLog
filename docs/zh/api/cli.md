# CLI 参考

## 安装

```bash
npm install -g @codelog/cli
# 或直接使用
npx @codelog/cli
```

## 命令

### `codelog`（默认命令）

启动 codeLog 服务器及 Web 仪表盘。

```bash
codelog [options]
```

### 选项

| 标志 | 简写 | 默认值 | 描述 |
|------|-------|---------|-------------|
| `--port` | `-p` | `38291` | 服务器端口 |
| `--no-open` | | | 不自动打开浏览器 |
| `--persist` | | `false` | 启用 SQLite 持久化 |
| `--db-path` | | `~/.codelog/data.db` | 数据库文件路径 |
| `--retention-days` | | `1` | 数据保留天数 |
| `--api-key` | | — | 要求 API 密钥认证 |
| `--cors-origin` | | `*` | 允许的 CORS 来源 |

## 示例

```bash
# 使用默认配置启动
codelog

# 自定义端口，不打开浏览器
codelog -p 3000 --no-open

# 启用持久化
codelog --persist --retention-days 7

# 启用 API 密钥保护
codelog --api-key my-secret-key

# 生产环境配置
codelog --persist --api-key $CODELOG_KEY --cors-origin https://myapp.com
```

## 环境变量

所有 CLI 选项都可以通过环境变量设置：

- `CODELOG_PORT` — 服务器端口
- `CODELOG_PERSIST` — 启用持久化（`true`/`false`）
- `CODELOG_DB_PATH` — 数据库文件路径
- `CODELOG_RETENTION` — 保留天数
- `CODELOG_API_KEY` — API 密钥
- `CODELOG_CORS` — CORS 来源
