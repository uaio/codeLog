import { Router } from 'express';
import {
  DeviceStore,
  LogStore,
  NetworkStore,
  StorageStore,
  DOMStore,
  PerformanceStore,
  ScreenshotStore,
  PerfRunStore,
  MockStore,
  SystemStore,
  IndexedDBStore,
  IDBSnapshotStore,
  ComputedStylesStore,
  SavedLogStore,
} from '../store/index.js';
import { createDeviceRoutes } from './devices.js';
import { createIngestRoute } from './ingest.js';

export function createRoutes(
  deviceStore: DeviceStore,
  logStore: LogStore,
  networkStore: NetworkStore,
  storageStore: StorageStore,
  domStore: DOMStore,
  performanceStore: PerformanceStore,
  screenshotStore: ScreenshotStore,
  perfRunStore: PerfRunStore,
  mockStore: MockStore,
  systemStore: SystemStore,
  idbStore: IndexedDBStore,
  savedLogStore: SavedLogStore,
  idbSnapshotStore?: IDBSnapshotStore,
  computedStylesStore?: ComputedStylesStore,
): Router {
  const router = Router();
  const deviceRoutes = createDeviceRoutes(
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
  );

  // ── 外部数据接入（统一 Envelope 标准）──────────────────────────────
  router.post(
    '/api/ingest',
    createIngestRoute({
      deviceStore,
      logStore,
      networkStore,
      storageStore,
      performanceStore,
      screenshotStore,
    }),
  );

  // ── Server health (used by Docker healthcheck) ────────────────────────
  router.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // ── Prometheus metrics ─────────────────────────────────────────────────
  router.get('/metrics', (_req, res) => {
    const uptimeSecs = process.uptime();
    const mem = process.memoryUsage();
    const devices = deviceStore.list();
    const now = Date.now();
    const fiveMin = 5 * 60 * 1000;
    const activeDevices = devices.filter((d) => now - d.lastActiveTime < fiveMin).length;
    const savedLogCount = savedLogStore.list().length;

    const lines = [
      '# HELP codelog_uptime_seconds Server uptime in seconds',
      '# TYPE codelog_uptime_seconds gauge',
      `codelog_uptime_seconds ${uptimeSecs.toFixed(3)}`,
      '',
      '# HELP codelog_devices_total Total number of registered devices',
      '# TYPE codelog_devices_total gauge',
      `codelog_devices_total ${devices.length}`,
      '',
      '# HELP codelog_active_devices Devices active in the last 5 minutes',
      '# TYPE codelog_active_devices gauge',
      `codelog_active_devices ${activeDevices}`,
      '',
      '# HELP codelog_saved_log_sessions_total Total saved log sessions',
      '# TYPE codelog_saved_log_sessions_total gauge',
      `codelog_saved_log_sessions_total ${savedLogCount}`,
      '',
      '# HELP process_resident_memory_bytes Resident set size in bytes',
      '# TYPE process_resident_memory_bytes gauge',
      `process_resident_memory_bytes ${mem.rss}`,
      '',
      '# HELP process_heap_bytes Heap memory in bytes',
      '# TYPE process_heap_bytes gauge',
      `process_heap_bytes ${mem.heapUsed}`,
      '',
    ];

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(lines.join('\n'));
  });

  router.get('/api/devices', deviceRoutes.listDevices);
  router.get('/api/devices/:deviceId', deviceRoutes.getDevice);
  router.delete('/api/devices/:deviceId/logs', deviceRoutes.deleteLogs);
  router.get('/api/devices/:deviceId/logs', deviceRoutes.getLogs);
  router.get('/api/devices/:deviceId/network', deviceRoutes.getNetworkRequests);
  router.get('/api/devices/:deviceId/storage', deviceRoutes.getStorage);
  router.get('/api/devices/:deviceId/dom', deviceRoutes.getDOM);
  router.get('/api/devices/:deviceId/performance', deviceRoutes.getPerformance);
  router.post('/api/devices/:deviceId/execute', deviceRoutes.executeJs);
  router.post('/api/devices/:deviceId/screenshot', deviceRoutes.takeScreenshot);
  router.get('/api/devices/:deviceId/screenshot', deviceRoutes.getScreenshot);
  router.post('/api/devices/:deviceId/reload', deviceRoutes.reloadPage);
  router.post('/api/devices/:deviceId/storage/set', deviceRoutes.setStorage);
  router.post('/api/devices/:deviceId/storage/clear', deviceRoutes.clearStorage);
  router.post('/api/devices/:deviceId/storage/delete', deviceRoutes.deleteStorage);
  router.post('/api/devices/:deviceId/highlight', deviceRoutes.highlightElement);
  router.post('/api/devices/:deviceId/zen', deviceRoutes.setZenMode);
  router.post('/api/devices/:deviceId/perf-run/start', deviceRoutes.startPerfRun);
  router.post('/api/devices/:deviceId/perf-run/stop', deviceRoutes.stopPerfRun);
  router.get('/api/devices/:deviceId/perf-run', deviceRoutes.listPerfRunSessions);
  router.get('/api/devices/:deviceId/perf-run/:sessionId', deviceRoutes.getPerfRunSession);
  router.post('/api/devices/:deviceId/network-throttle', deviceRoutes.setNetworkThrottle);
  router.get('/api/devices/:deviceId/mocks', deviceRoutes.listMocks);
  router.post('/api/devices/:deviceId/mocks', deviceRoutes.addMock);
  router.delete('/api/devices/:deviceId/mocks/:mockId', deviceRoutes.removeMock);
  router.delete('/api/devices/:deviceId/mocks', deviceRoutes.clearMocks);
  router.patch('/api/devices/:deviceId/mocks/:mockId', deviceRoutes.toggleMock);
  router.get('/api/devices/:deviceId/health', deviceRoutes.getHealthCheck);
  router.get('/api/devices/:deviceId/system', deviceRoutes.getSystemInfo);
  router.get('/api/devices/:deviceId/indexeddb', deviceRoutes.getIndexedDB);
  router.get('/api/devices/:deviceId/idb-snapshot', deviceRoutes.getIDBSnapshot);
  router.get('/api/devices/:deviceId/idb-store-data/:reqId', deviceRoutes.getIDBStoreData);
  router.post('/api/devices/:deviceId/computed-styles', deviceRoutes.requestComputedStyles);
  router.get('/api/devices/:deviceId/computed-styles', deviceRoutes.getComputedStyles);
  router.post('/api/devices/:deviceId/element-attr', deviceRoutes.setElementAttr);

  // ── Saved log sessions (offline upload/replay) ────────────────────────
  router.post('/api/saved-logs', (req, res) => {
    const { deviceId, ua, projectId, startTime, endTime, logs } = req.body ?? {};
    if (!deviceId || !Array.isArray(logs)) {
      return res.status(400).json({ error: 'deviceId and logs[] are required' });
    }
    const session = savedLogStore.save({
      deviceId: String(deviceId),
      ua: String(ua ?? ''),
      projectId: projectId ? String(projectId) : undefined,
      startTime: Number(startTime) || Date.now(),
      endTime: Number(endTime) || Date.now(),
      entryCount: logs.length,
      logs,
    });
    res.status(201).json({ id: session.id, entryCount: session.entryCount });
  });

  router.get('/api/saved-logs', (_req, res) => {
    res.json(savedLogStore.list());
  });

  router.get('/api/saved-logs/:sessionId', (req, res) => {
    const session = savedLogStore.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  });

  router.delete('/api/saved-logs/:sessionId', (req, res) => {
    const deleted = savedLogStore.delete(req.params.sessionId);
    if (!deleted) return res.status(404).json({ error: 'Session not found' });
    res.status(204).end();
  });

  return router;
}
