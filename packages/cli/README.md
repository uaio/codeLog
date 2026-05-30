# @codelog/cli

> CLI for codeLog — start the server, configure AI tools, one-command setup.

## Installation

```bash
# Use directly with npx (zero install)
npx @codelog/cli

# Or install globally
npm install -g @codelog/cli
```

## Commands

### Start Server

```bash
codelog              # Start with default port (38291)
codelog -p 8080     # Custom port
codelog --host myapp.example.com  # Public/cloud deployment
```

On startup, the CLI prints:
- All available LAN IP addresses
- SDK snippet ready to copy
- PC panel URL

### Configure AI Tools

```bash
codelog init                # Auto-detect installed AI tools
codelog init --for=claude   # Configure for Claude Code
codelog init --for=cursor   # Configure for Cursor
codelog init --for=windsurf # Configure for Windsurf
```

The `init` command:
1. Detects installed AI tools
2. Writes MCP server configuration
3. For Claude Code: installs slash commands (`/codelog:start`, `/codelog:stop`, etc.)

### MCP Mode (Internal)

```bash
codelog --mcp   # Start in MCP server mode (used by AI tools)
```

## Claude Code Slash Commands

After running `codelog init`, these commands are available in Claude Code:

| Command | Description |
|---------|-------------|
| `/codelog:setup` | One-click zero-to-ready setup |
| `/codelog:start` | Start monitoring + WS connection |
| `/codelog:stop` | Stop monitoring |
| `/codelog:status` | Check device connection status |
| `/codelog:logs` | View logs + checkpoint trace |
| `/codelog:screenshot` | Capture current page |
| `/codelog:clean` | Remove all `@codelog` debug logs |

## Development

```bash
pnpm --filter @codelog/cli dev    # Watch mode
pnpm --filter @codelog/cli build  # Build
pnpm --filter @codelog/cli test   # Run tests
```

## License

MIT © [codeLog](https://github.com/uaio/codeLog)
