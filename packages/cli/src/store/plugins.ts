export interface PluginInfo {
  name: string;
  panelTitle?: string;
  panelIcon?: string;
  version?: string;
  state: 'enabled' | 'disabled';
}

export class PluginStore {
  private plugins = new Map<string, PluginInfo[]>();

  set(deviceId: string, plugins: PluginInfo[]): void {
    this.plugins.set(deviceId, plugins);
  }

  get(deviceId: string): PluginInfo[] {
    return this.plugins.get(deviceId) ?? [];
  }

  remove(deviceId: string): void {
    this.plugins.delete(deviceId);
  }
}

export const pluginStore = new PluginStore();
