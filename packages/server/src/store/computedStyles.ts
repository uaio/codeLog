export interface ComputedStylesSnapshot {
  deviceId: string;
  selector: string;
  styles: Record<string, string>;
  timestamp: number;
}

/** Stores the latest computed-styles response per deviceId */
export class ComputedStylesStore {
  private snapshots: Map<string, ComputedStylesSnapshot> = new Map();

  set(deviceId: string, snapshot: ComputedStylesSnapshot): void {
    this.snapshots.set(deviceId, snapshot);
  }

  get(deviceId: string): ComputedStylesSnapshot | undefined {
    return this.snapshots.get(deviceId);
  }

  clear(deviceId: string): void {
    this.snapshots.delete(deviceId);
  }
}
