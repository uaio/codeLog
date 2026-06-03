/**
 * 运行时审计 Hook
 * 在 SDK 初始化时安装，监控 document.write、废弃 API 等
 * ⚠️ 不覆盖 console.error — SDK 已有 console 拦截器在运行
 */

export interface RuntimeAuditState {
  documentWriteCount: number;
  consoleErrorCount: number;
  deprecatedApiCalls: string[];
  notificationRequestedWithoutGesture: boolean;
  geolocationRequestedWithoutGesture: boolean;
}

let state: RuntimeAuditState;
let installed = false;

export function getRuntimeAuditState(): RuntimeAuditState {
  return state;
}

/** 重置状态（每次跑分后调用） */
export function resetRuntimeAuditState(): void {
  state = {
    documentWriteCount: 0,
    consoleErrorCount: 0,
    deprecatedApiCalls: [],
    notificationRequestedWithoutGesture: false,
    geolocationRequestedWithoutGesture: false,
  };
}

/** 安装所有运行时 Hook */
export function installRuntimeAuditHooks(): void {
  if (installed) return;
  resetRuntimeAuditState();

  // Hook document.write / document.writeln
  try {
    const origWrite = document.write.bind(document);
    const origWriteln = document.writeln.bind(document);
    document.write = function (...args: string[]): Document {
      state.documentWriteCount++;
      return origWrite(...args);
    };
    document.writeln = function (...args: string[]): Document {
      state.documentWriteCount++;
      return origWriteln(...args);
    };
  } catch {
    // 有些环境不允许覆盖 document.write
  }

  // ⚠️ 不覆盖 console.error — SDK 已有 console 拦截器在运行。
  // 改为监听 window.onerror / unhandledrejection 事件统计错误数量。
  window.addEventListener('error', () => { state.consoleErrorCount++; });
  window.addEventListener('unhandledrejection', () => { state.consoleErrorCount++; });

  // Hook 废弃 API: document.execCommand
  try {
    const origExecCommand = document.execCommand.bind(document);
    (document as any).execCommand = function (command: string, ...args: any[]): boolean {
      state.deprecatedApiCalls.push(`document.execCommand("${command}")`);
      return origExecCommand(command, ...args);
    };
  } catch {
    // 有些环境不允许覆盖
  }

  // Hook Notification.requestPermission
  try {
    if (typeof Notification !== 'undefined' && Notification.requestPermission) {
      const origRequestPermission = Notification.requestPermission.bind(Notification);
      let userGestureActive = false;
      const markGesture = () => { userGestureActive = true; };
      document.addEventListener('click', markGesture, true);
      document.addEventListener('keydown', markGesture, true);
      document.addEventListener('pointerdown', markGesture, true);

      (Notification as any).requestPermission = function (...args: any[]): Promise<string> | void {
        if (!userGestureActive) {
          state.notificationRequestedWithoutGesture = true;
        }
        userGestureActive = false;
        return origRequestPermission(...args);
      };
    }
  } catch {
    // Notification API 可能不可用
  }

  // Hook navigator.geolocation.getCurrentPosition
  try {
    if (navigator.geolocation?.getCurrentPosition) {
      const origGetGeo = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      let geoUserGesture = false;
      const markGesture = () => { geoUserGesture = true; };
      document.addEventListener('click', markGesture, true);
      document.addEventListener('keydown', markGesture, true);

      (navigator.geolocation as any).getCurrentPosition = function (...args: any[]): void {
        if (!geoUserGesture) {
          state.geolocationRequestedWithoutGesture = true;
        }
        geoUserGesture = false;
        return origGetGeo(...args);
      };
    }
  } catch {
    // geolocation API 可能不可用
  }

  installed = true;
}
