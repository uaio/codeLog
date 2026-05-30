# CLI Reference

## Installation

```bash
npm install -g @codelog/cli
# or use directly
npx @codelog/cli
```

## Commands

### `codelog` (default)

Start the codeLog server with web dashboard.

```bash
codelog [options]
```

### Options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--port` | `-p` | `38291` | Server port |
| `--no-open` | | | Don't auto-open browser |
| `--persist` | | `false` | Enable SQLite persistence |
| `--db-path` | | `~/.codelog/data.db` | Database file location |
| `--retention-days` | | `1` | Data retention period (days) |
| `--api-key` | | — | Require API key authentication |
| `--cors-origin` | | `*` | Allowed CORS origins |

## Examples

```bash
# Start with defaults
codelog

# Custom port, no browser
codelog -p 3000 --no-open

# With persistence
codelog --persist --retention-days 7

# With API key protection
codelog --api-key my-secret-key

# Production-like setup
codelog --persist --api-key $CODELOG_KEY --cors-origin https://myapp.com
```

## Environment Variables

All CLI options can also be set via environment variables:

- `CODELOG_PORT` — Server port
- `CODELOG_PERSIST` — Enable persistence (`true`/`false`)
- `CODELOG_DB_PATH` — Database file path
- `CODELOG_RETENTION` — Retention days
- `CODELOG_API_KEY` — API key
- `CODELOG_CORS` — CORS origins
