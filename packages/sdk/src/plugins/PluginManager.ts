import type { DataBus } from '../core/DataBus.js';

/** Context provided to plugins when they are installed */
export interface PluginContext {
  /** The shared event bus — subscribe to data events */
  dataBus: DataBus;
  /** Project identifier for the current CodeLog instance */
  projectId: string;
  /** Base HTTP URL for the codeLog server (without trailing slash) */
  serverUrl: string | undefined;
}

/** Plugin interface that all codeLog plugins must implement */
export interface CodeLogPlugin {
  /** Unique plugin name — used for conflict detection */
  readonly name: string;
  /** Human-readable tab label in the web panel (defaults to name) */
  readonly panelTitle?: string;
  /** Emoji or short icon string for the tab (defaults to '🔌') */
  readonly panelIcon?: string;
  /** Semantic version string (e.g. '1.0.0') */
  readonly version?: string;
  /** Called when the plugin is installed (CodeLog constructor). */
  install(ctx: PluginContext): void | Promise<void>;
  /** Called when the plugin is enabled after being disabled. */
  enable?(): void;
  /** Called when the plugin is temporarily disabled but not uninstalled. */
  disable?(): void;
  /** Called when CodeLog.destroy() is called or the plugin is explicitly removed. */
  uninstall?(): void;
}

type PluginState = 'installed' | 'enabled' | 'disabled' | 'uninstalled';

interface PluginRecord {
  plugin: CodeLogPlugin;
  state: PluginState;
}

/**
 * PluginManager — manages CodeLogPlugin lifecycle.
 *
 * Lifecycle states:
 *   installed → enabled (install + enable)
 *   enabled  ↔ disabled (enable / disable)
 *   any      → uninstalled (uninstall, terminal)
 */
export class PluginManager {
  private plugins = new Map<string, PluginRecord>();
  private ctx: PluginContext | null = null;

  /** Set the context once CodeLog is initialised */
  setContext(ctx: PluginContext): void {
    this.ctx = ctx;
  }

  /** Install and enable a plugin */
  async use(plugin: CodeLogPlugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      console.warn(`[codeLog] Plugin "${plugin.name}" is already installed.`);
      return;
    }
    const record: PluginRecord = { plugin, state: 'installed' };
    this.plugins.set(plugin.name, record);
    if (this.ctx) {
      await plugin.install(this.ctx);
      record.state = 'enabled';
      plugin.enable?.();
    }
  }

  /** Enable a previously disabled plugin */
  enable(name: string): void {
    const record = this.plugins.get(name);
    if (!record) return;
    if (record.state === 'disabled') {
      record.plugin.enable?.();
      record.state = 'enabled';
    }
  }

  /** Temporarily disable a plugin (preserves installed state) */
  disable(name: string): void {
    const record = this.plugins.get(name);
    if (!record || record.state !== 'enabled') return;
    record.plugin.disable?.();
    record.state = 'disabled';
  }

  /** Fully remove and uninstall a plugin */
  remove(name: string): void {
    const record = this.plugins.get(name);
    if (!record) return;
    if (record.state === 'enabled') record.plugin.disable?.();
    record.plugin.uninstall?.();
    record.state = 'uninstalled';
    this.plugins.delete(name);
  }

  /** Uninstall all plugins (called from CodeLog.destroy) */
  destroyAll(): void {
    for (const [name] of this.plugins) {
      this.remove(name);
    }
  }

  /** List installed plugins with their states */
  list(): Array<{ name: string; panelTitle?: string; panelIcon?: string; version?: string; state: PluginState }> {
    return Array.from(this.plugins.entries()).map(([name, r]) => ({
      name,
      panelTitle: r.plugin.panelTitle,
      panelIcon: r.plugin.panelIcon,
      version: r.plugin.version,
      state: r.state,
    }));
  }

  /** Get a plugin by name */
  get<T extends CodeLogPlugin>(name: string): T | undefined {
    return this.plugins.get(name)?.plugin as T | undefined;
  }
}
