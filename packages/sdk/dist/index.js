function K(s) {
  let e = 0;
  for (let t = 0; t < s.length; t++) {
    const n = s.charCodeAt(t);
    e = (e << 5) - e + n, e = e & e;
  }
  return Math.abs(e).toString(16);
}
function H(s) {
  let e = 2166136261;
  for (let t = 0; t < s.length; t++)
    e ^= s.charCodeAt(t), e = e * 16777619 >>> 0;
  return e.toString(16).padStart(8, "0");
}
function ve(...s) {
  const e = H(s.slice(0, Math.ceil(s.length / 2)).join("|")), t = H(s.slice(Math.ceil(s.length / 2)).join("|"));
  return e + t;
}
function Se() {
  return "tab-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}
const Q = "_codelog_fp";
function ke() {
  try {
    const e = localStorage.getItem(Q);
    if (e && /^[0-9a-f]{16,}$/.test(e))
      return e;
  } catch {
  }
  const s = Ce();
  try {
    localStorage.setItem(Q, s);
  } catch {
  }
  return s;
}
function Ce() {
  const s = [
    // User agent (browser name + version + OS)
    navigator.userAgent,
    // Screen
    `${screen.width}x${screen.height}x${screen.colorDepth}x${window.devicePixelRatio}`,
    // Locale
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
    // Hardware
    String(navigator.hardwareConcurrency ?? 0),
    String(navigator.deviceMemory ?? 0),
    // Touch
    String(navigator.maxTouchPoints),
    // Canvas fingerprint
    Re(),
    // WebGL renderer
    Ie(),
    // Audio context fingerprint
    Ae()
  ];
  return ve(...s);
}
function Re() {
  try {
    const s = document.createElement("canvas");
    s.width = 240, s.height = 60;
    const e = s.getContext("2d");
    return e ? (e.fillStyle = "#f0f0f0", e.fillRect(0, 0, 240, 60), e.fillStyle = "#1a1a2e", e.font = '14px "Arial", sans-serif', e.fillText("codeLog 🔍 BrowserFP", 10, 22), e.font = 'bold 11px "Courier New", monospace', e.fillStyle = "#16213e", e.fillText("abcdef ABCDEF 012345", 10, 42), e.strokeStyle = "#0f3460", e.lineWidth = 1.5, e.beginPath(), e.arc(200, 30, 18, 0, Math.PI * 2), e.stroke(), H(s.toDataURL().slice(22, 100))) : "no-canvas";
  } catch {
    return "canvas-blocked";
  }
}
function Ie() {
  try {
    const s = document.createElement("canvas"), e = s.getContext("webgl") ?? s.getContext("experimental-webgl");
    if (!e) return "no-webgl";
    const t = e.getExtension("WEBGL_debug_renderer_info");
    return t ? e.getParameter(t.UNMASKED_RENDERER_WEBGL) : "no-ext";
  } catch {
    return "webgl-blocked";
  }
}
function Ae() {
  try {
    const s = window.AudioContext ?? window.webkitAudioContext;
    if (!s) return "no-audio";
    const e = new s(), t = e.createOscillator(), n = e.createAnalyser(), i = e.createGain();
    i.gain.value = 0, t.connect(n), n.connect(i), i.connect(e.destination), t.start(0);
    const o = new Float32Array(n.frequencyBinCount);
    n.getFloatFrequencyData(o), t.stop(), e.close();
    const a = o.slice(0, 32).join(",");
    return H(a);
  } catch {
    return "audio-blocked";
  }
}
function Ee(s, e) {
  try {
    if (typeof window < "u" && typeof localStorage < "u") {
      const i = ke(), o = e.device.getUrl(), a = H(o);
      return `${K(s)}-${i}-${a}`;
    }
  } catch {
  }
  const t = e.device.getUserAgent(), n = e.device.getUrl();
  return K(t + s + n);
}
function xe(s, e) {
  const t = Ee(s, e), n = `_codelog_connect_${s}`, i = e.storage.getItem(n);
  return i || e.storage.setItem(n, Date.now().toString()), {
    deviceId: t,
    projectId: s,
    ua: e.device.getUserAgent(),
    screen: e.device.getScreen(),
    pixelRatio: e.device.getPixelRatio(),
    language: e.device.getLanguage(),
    url: e.device.getUrl(),
    connectTime: i ? parseInt(i) : Date.now(),
    lastActiveTime: Date.now()
  };
}
function Te(s, e) {
  e.storage.setItem(`codelog_last_active_${s}`, Date.now().toString());
}
class Le {
  constructor() {
    this.listeners = /* @__PURE__ */ new Map();
  }
  emit(e, t) {
    const n = this.listeners.get(e);
    if (!(!n || n.size === 0))
      for (const i of n)
        try {
          i(t);
        } catch {
        }
  }
  /** 订阅事件，返回取消订阅函数 */
  on(e, t) {
    return this.listeners.has(e) || this.listeners.set(e, /* @__PURE__ */ new Set()), this.listeners.get(e).add(t), () => this.off(e, t);
  }
  off(e, t) {
    var n;
    (n = this.listeners.get(e)) == null || n.delete(t);
  }
  /** 清除所有监听器（用于 destroy） */
  clear() {
    this.listeners.clear();
  }
}
class De {
  constructor(e = 100) {
    this.maxSize = e, this.queue = [];
  }
  /** 添加消息到队列 */
  enqueue(e) {
    this.queue.length < this.maxSize && this.queue.push(e);
  }
  /** 取出所有待发送消息并清空队列 */
  dequeueAll() {
    const e = this.queue;
    return this.queue = [], e;
  }
  /** 队列长度 */
  get length() {
    return this.queue.length;
  }
}
class $e {
  constructor(e, t, n) {
    this.conn = null, this.state = "disconnected", this.reconnectAttempts = 0, this.maxReconnectAttempts = 10, this.reconnectDelay = 3e3, this.shouldReconnect = !0, this.reconnectTimer = null;
    let i = e.server || "";
    if (e.secret && i) {
      const o = i.includes("?") ? "&" : "?";
      i = `${i}${o}apiKey=${encodeURIComponent(e.secret)}`;
    }
    this.serverUrl = i, this.events = t, this.messageQueue = new De(100), this.platform = n;
  }
  connect() {
    var e, t;
    if (!(!this.shouldReconnect || !this.serverUrl) && !(this.state === "connecting" || this.state === "connected")) {
      this.state = "connecting", this.reconnectAttempts++;
      try {
        this.conn = this.platform.createWebSocket(this.serverUrl, {
          onOpen: () => {
            var i, o, a;
            this.state = "connected", this.reconnectAttempts = 0, (o = (i = this.events).onConnect) == null || o.call(i);
            const n = this.messageQueue.dequeueAll();
            for (const r of n)
              (a = this.conn) == null || a.send(r);
          },
          onMessage: (n) => {
            var i, o;
            (o = (i = this.events).onMessage) == null || o.call(i, n);
          },
          onClose: () => {
            var n, i;
            this.state = "disconnected", (i = (n = this.events).onDisconnect) == null || i.call(n), this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts && (this.reconnectTimer = this.platform.timer.setTimeout(() => {
              this.reconnectTimer = null, this.connect();
            }, this.reconnectDelay));
          },
          onError: (n) => {
            var i, o;
            this.state = "error", (o = (i = this.events).onError) == null || o.call(i, n);
          }
        });
      } catch (n) {
        this.state = "error", (t = (e = this.events).onError) == null || t.call(e, n);
      }
    }
  }
  send(e) {
    var t, n;
    if (this.state === "connected" && this.conn)
      try {
        this.conn.send(e);
      } catch (i) {
        this.state = "error", (n = (t = this.events).onError) == null || n.call(t, i);
      }
    else
      this.messageQueue.enqueue(e);
  }
  disconnect() {
    this.shouldReconnect = !1, this.reconnectTimer !== null && (this.platform.timer.clearTimeout(this.reconnectTimer), this.reconnectTimer = null), this.conn && (this.conn.close(), this.conn = null), this.state = "disconnected";
  }
  getState() {
    return this.state;
  }
  getServerUrl() {
    return this.serverUrl;
  }
}
class Pe {
  constructor(e = 100) {
    this.maxPerSecond = e, this.count = 0, this.resetTime = 0;
  }
  /** 检查是否超过速率限制，返回 true 表示允许 */
  check() {
    const e = Date.now();
    return e > this.resetTime + 1e3 && (this.count = 0, this.resetTime = e), this.count >= this.maxPerSecond ? !1 : (this.count++, !0);
  }
}
function P(s) {
  return s.length === 0 ? "" : typeof s[0] == "string" && /%[sdifoOc]/.test(s[0]) ? Be(s[0], s.slice(1)) : s.map((e) => {
    if (e === void 0)
      return "undefined";
    if (e === null)
      return "null";
    if (typeof e == "object")
      try {
        return JSON.stringify(e);
      } catch {
        return String(e);
      }
    return String(e);
  }).join(" ");
}
function Be(s, e) {
  let t = 0;
  const n = s.replace(/%([sdifoOc])/g, (o, a) => {
    if (t >= e.length) return `%${a}`;
    const r = e[t++];
    switch (a) {
      case "s":
        return r === void 0 ? "undefined" : r === null ? "null" : String(r);
      case "d":
      case "i":
        return String(parseInt(String(r), 10));
      case "f":
        return String(parseFloat(String(r)));
      case "o":
      case "O":
        try {
          return JSON.stringify(r);
        } catch {
          return String(r);
        }
      case "c":
        return "";
      default:
        return `%${a}`;
    }
  }), i = e.slice(t).map((o) => {
    if (o === void 0) return "undefined";
    if (o === null) return "null";
    if (typeof o == "object")
      try {
        return JSON.stringify(o);
      } catch {
        return String(o);
      }
    return String(o);
  }).join(" ");
  return i ? `${n} ${i}` : n;
}
function Me(s) {
  const e = [];
  if (typeof s[0] != "string") return e;
  let t = 1;
  const n = s[0], i = /%([sdifoOc])/g;
  let o;
  for (; (o = i.exec(n)) !== null && !(t >= s.length); )
    o[1] === "c" && e.push(String(s[t])), t++;
  return e;
}
function ze(s) {
  if (typeof s[0] != "string") return null;
  const e = s[0];
  if (!/%c/.test(e)) return null;
  const t = [];
  let n = 1, i = 0, o;
  const a = /%([sdifoOc])/g;
  let r;
  for (; (r = a.exec(e)) !== null; )
    if (r[1] === "c") {
      const d = e.slice(i, r.index);
      d && t.push({ text: d, style: o }), o = n < s.length ? String(s[n]) : void 0, n++, i = r.index + r[0].length;
    } else
      n < s.length && n++;
  const l = e.slice(i);
  return l && t.push({ text: l, style: o }), t.length === 0 ? null : t;
}
function U(s) {
  return s ? s.split(`
`).filter(
    (n) => !n.includes("interceptConsole") && !n.includes("serializeArgs") && !n.includes("cleanStackTrace")
  ).join(`
`) : void 0;
}
class qe {
  constructor(e, t, n) {
    this.transport = null, this.remoteEnabled = !0, this.onRefreshStorageCallback = null, this.onRefreshDOMCallback = null, this.onTakeScreenshotCallback = null, this.onZenModeCallback = null, this.onStartPerfRunCallback = null, this.onStopPerfRunCallback = null, this.onPerfRunDoneCallback = null, this.onSetNetworkThrottleCallback = null, this.onAddMockCallback = null, this.onRemoveMockCallback = null, this.onClearMocksCallback = null, this.onUpdateMockRuleCallback = null, this.onRequestIDBSnapshotCallback = null, this.onRequestIDBStoreDataCallback = null, this.onGetComputedStylesCallback = null, this.onSetElementAttrCallback = null, this.onStartElementPickerCallback = null, this.executeJsBus = null, this.rateLimiter = new Pe(100), this.dataBusUnsubscribers = [], this.deviceInfo = e, this.tabId = t, this.platform = n;
  }
  connect(e) {
    this.remoteEnabled && (this.serverUrl = e ?? this.serverUrl, this.transport = new $e(
      { projectId: this.deviceInfo.projectId, server: this.serverUrl },
      {
        onConnect: () => {
          this.sendRegisterMessage();
        },
        onMessage: (t) => {
          var n, i, o, a, r, l, c, d, p, h, g, S, k, C, m, b, y;
          if (t.type === "refresh_storage" && ((n = this.onRefreshStorageCallback) == null || n.call(this)), t.type === "refresh_dom" && ((i = this.onRefreshDOMCallback) == null || i.call(this)), t.type === "take_screenshot" && ((o = this.onTakeScreenshotCallback) == null || o.call(this)), t.type === "execute_js" && t.code && this.executeJsBus && this.runCode(t.code, this.executeJsBus), t.type === "reload_page")
            try {
              window.location.reload();
            } catch {
            }
          if (t.type === "set_storage")
            try {
              t.storageType === "cookie" ? (async () => {
                var L;
                const R = t.key, I = t.value ?? "";
                if (typeof ((L = window.cookieStore) == null ? void 0 : L.set) == "function") {
                  const A = { name: R, value: I };
                  t.path && (A.path = t.path), t.domain && (A.domain = t.domain), t.expires && (A.expires = t.expires), t.secure !== void 0 && (A.secure = t.secure), t.sameSite && (A.sameSite = t.sameSite), await window.cookieStore.set(A);
                } else {
                  let A = `${encodeURIComponent(R)}=${encodeURIComponent(I)}`;
                  A += `; path=${t.path ?? "/"}`, t.domain && (A += `; domain=${t.domain}`), t.expires && (A += `; expires=${new Date(t.expires).toUTCString()}`), t.secure && (A += "; Secure"), t.sameSite && (A += `; SameSite=${t.sameSite}`), document.cookie = A;
                }
              })() : (t.storageType === "session" ? sessionStorage : localStorage).setItem(t.key, t.value ?? "");
            } catch {
            }
          if (t.type === "clear_storage")
            try {
              t.storageType === "session" ? sessionStorage.clear() : t.storageType === "local" ? localStorage.clear() : (localStorage.clear(), sessionStorage.clear());
            } catch {
            }
          if (t.type === "delete_storage")
            try {
              if (t.storageType === "cookie") {
                const v = ["/", "/"], R = encodeURIComponent(t.key);
                for (const I of v)
                  document.cookie = `${R}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${I}`;
              } else
                (t.storageType === "session" ? sessionStorage : localStorage).removeItem(t.key);
            } catch {
            }
          if (t.type === "highlight_element" && t.selector && this.highlightElement(t.selector, t.duration ?? 3e3), t.type === "zen_mode" && ((a = this.onZenModeCallback) == null || a.call(this, !!t.enabled)), t.type === "start_perf_run" && ((r = this.onStartPerfRunCallback) == null || r.call(this)), t.type === "stop_perf_run" && ((l = this.onStopPerfRunCallback) == null || l.call(this)), t.type === "perf_run_done" && t.score && ((c = this.onPerfRunDoneCallback) == null || c.call(this, t.score)), t.type === "set_network_throttle" && t.preset && ((d = this.onSetNetworkThrottleCallback) == null || d.call(this, t.preset)), t.type === "add_mock" && t.rule && ((p = this.onAddMockCallback) == null || p.call(this, t.rule)), t.type === "remove_mock" && t.id && ((h = this.onRemoveMockCallback) == null || h.call(this, t.id)), t.type === "clear_mocks" && ((g = this.onClearMocksCallback) == null || g.call(this)), t.type === "update_mock_rule" && t.id && ((S = this.onUpdateMockRuleCallback) == null || S.call(this, t.id, t.enabled ?? !0)), t.type === "request_idb_snapshot" && ((k = this.onRequestIDBSnapshotCallback) == null || k.call(this)), t.type === "request_idb_store_data" && ((C = this.onRequestIDBStoreDataCallback) == null || C.call(
            this,
            t.dbName,
            t.storeName,
            t.page ?? 0,
            t.pageSize ?? 50,
            t.reqId ?? ""
          )), t.type === "idb_clear_store" && t.dbName && t.storeName)
            try {
              const v = indexedDB.open(t.dbName);
              v.onsuccess = () => {
                const R = v.result;
                try {
                  const I = R.transaction(t.storeName, "readwrite");
                  I.objectStore(t.storeName).clear(), I.oncomplete = () => {
                    R.close();
                  }, I.onerror = () => {
                    R.close();
                  };
                } catch {
                  R.close();
                }
              };
            } catch {
            }
          if (t.type === "idb_put_record" && t.dbName && t.storeName && t.value !== void 0)
            try {
              const v = indexedDB.open(t.dbName);
              v.onsuccess = () => {
                const R = v.result;
                try {
                  const I = R.transaction(t.storeName, "readwrite"), L = I.objectStore(t.storeName), A = L.keyPath !== null ? L.put(t.value) : L.put(t.value, t.key);
                  A.onsuccess = () => {
                  }, I.oncomplete = () => {
                    R.close();
                  }, I.onerror = () => {
                    R.close();
                  };
                } catch {
                  R.close();
                }
              };
            } catch {
            }
          t.type === "get_computed_styles" && t.selector && ((m = this.onGetComputedStylesCallback) == null || m.call(this, t.selector)), t.type === "set_element_attr" && t.selector && t.attr !== void 0 && ((b = this.onSetElementAttrCallback) == null || b.call(this, t.selector, t.attr, t.value ?? "")), t.type === "start_element_picker" && ((y = this.onStartElementPickerCallback) == null || y.call(this));
        }
      },
      this.platform
    ), this.transport.connect());
  }
  onRefreshStorage(e) {
    this.onRefreshStorageCallback = e;
  }
  onRefreshDOM(e) {
    this.onRefreshDOMCallback = e;
  }
  onTakeScreenshot(e) {
    this.onTakeScreenshotCallback = e;
  }
  onZenMode(e) {
    this.onZenModeCallback = e;
  }
  onStartPerfRun(e) {
    this.onStartPerfRunCallback = e;
  }
  onStopPerfRun(e) {
    this.onStopPerfRunCallback = e;
  }
  onPerfRunDone(e) {
    this.onPerfRunDoneCallback = e;
  }
  onSetNetworkThrottle(e) {
    this.onSetNetworkThrottleCallback = e;
  }
  onAddMock(e) {
    this.onAddMockCallback = e;
  }
  onRemoveMock(e) {
    this.onRemoveMockCallback = e;
  }
  onClearMocks(e) {
    this.onClearMocksCallback = e;
  }
  onUpdateMockRule(e) {
    this.onUpdateMockRuleCallback = e;
  }
  reportMockMatch(e, t) {
    !this.remoteEnabled || !this.transport || this.transport.send(JSON.stringify({ type: "mock_matched", ruleId: e, url: t }));
  }
  onRequestIDBSnapshot(e) {
    this.onRequestIDBSnapshotCallback = e;
  }
  onRequestIDBStoreData(e) {
    this.onRequestIDBStoreDataCallback = e;
  }
  onGetComputedStyles(e) {
    this.onGetComputedStylesCallback = e;
  }
  onSetElementAttr(e) {
    this.onSetElementAttrCallback = e;
  }
  onStartElementPicker(e) {
    this.onStartElementPickerCallback = e;
  }
  reportComputedStyles(e, t) {
    !this.remoteEnabled || !this.transport || this.sendEnvelope("computed_styles", { selector: e, styles: t });
  }
  reportPickedElement(e, t) {
    !this.remoteEnabled || !this.transport || this.sendEnvelope("element_picked", { selector: e, tagName: t });
  }
  reportPerfRunRaw(e) {
    !this.remoteEnabled || !this.transport || this.sendEnvelope("perf_run_raw", e);
  }
  reportIDBSnapshot(e) {
    !this.remoteEnabled || !this.transport || this.sendEnvelope("idb_snapshot", e);
  }
  reportIDBStoreData(e) {
    !this.remoteEnabled || !this.transport || this.sendEnvelope("idb_store_data", e);
  }
  disconnect() {
    var e;
    (e = this.transport) == null || e.disconnect();
  }
  /**
   * 将 Reporter 绑定到 DataBus，订阅所有事件并通过 WebSocket 转发到远端 PC
   * 调用多次会先解绑旧的再重新绑定
   */
  attachDataBus(e) {
    this.detachDataBus(), this.executeJsBus = e, this.dataBusUnsubscribers = [
      e.on("console", (t) => this.reportConsole(t)),
      e.on("network", (t) => this.reportNetwork(t)),
      e.on("storage", (t) => this.reportStorage(t)),
      e.on("dom", (t) => this.reportDOM(t)),
      e.on("performance", (t) => this.reportPerformance(t)),
      e.on("screenshot", (t) => this.reportScreenshot(t)),
      e.on("perf_run_raw", (t) => this.reportPerfRunRaw(t)),
      e.on("system", (t) => this.sendEnvelope("system", t))
    ];
  }
  detachDataBus() {
    for (const e of this.dataBusUnsubscribers)
      e();
    this.dataBusUnsubscribers = [], this.executeJsBus = null;
  }
  /** PC 下发的 JS 代码在手机端执行，结果经 DataBus console 通道回传 */
  runCode(e, t) {
    t.emit("console", {
      timestamp: Date.now(),
      level: "repl-input",
      message: e,
      args: [e]
    });
    try {
      const n = (0, eval)(e);
      n !== void 0 && t.emit("console", {
        timestamp: Date.now(),
        level: "repl-output",
        message: P([n]),
        args: [n]
      });
    } catch (n) {
      const i = n instanceof Error ? n.message : String(n);
      t.emit("console", {
        timestamp: Date.now(),
        level: "error",
        message: i,
        args: [i]
      });
    }
  }
  highlightElement(e, t) {
    if (!(typeof document > "u"))
      try {
        const n = document.querySelector(e);
        if (!n) return;
        const i = n.style.outline, o = n.style.backgroundColor;
        n.style.outline = "3px solid #ff4d4f", n.style.backgroundColor = "rgba(255,77,79,0.15)", n.scrollIntoView({ behavior: "smooth", block: "center" }), setTimeout(() => {
          n.style.outline = i, n.style.backgroundColor = o;
        }, t);
      } catch {
      }
  }
  enableRemote() {
    this.remoteEnabled = !0, this.platform.storage.setItem(`codelog_remote_${this.deviceInfo.projectId}`, "true"), (!this.transport || this.transport.getState() === "disconnected") && this.connect();
  }
  disableRemote() {
    var e;
    this.remoteEnabled = !1, this.platform.storage.setItem(`codelog_remote_${this.deviceInfo.projectId}`, "false"), (e = this.transport) == null || e.disconnect();
  }
  isRemoteEnabled() {
    return this.remoteEnabled;
  }
  reportConsole(e) {
    !this.remoteEnabled || !this.transport || this.rateLimiter.check() && this.sendEnvelope("console", {
      level: e.level,
      args: e.args ?? [e.message],
      message: e.message,
      stack: e.stack
    });
  }
  reportNetwork(e) {
    !this.remoteEnabled || !this.transport || this.rateLimiter.check() && this.sendEnvelope("network", e);
  }
  reportStorage(e) {
    !this.remoteEnabled || !this.transport || this.sendEnvelope("storage", e);
  }
  reportDOM(e) {
    !this.remoteEnabled || !this.transport || this.sendEnvelope("dom", e);
  }
  reportPerformance(e) {
    !this.remoteEnabled || !this.transport || this.sendEnvelope("performance", e);
  }
  reportScreenshot(e) {
    !this.remoteEnabled || !this.transport || this.sendEnvelope("screenshot", e);
  }
  updateDeviceInfo() {
    this.deviceInfo.lastActiveTime = Date.now(), this.send({
      type: "heartbeat",
      deviceId: this.deviceInfo.deviceId,
      timestamp: Date.now()
    });
  }
  sendRegisterMessage() {
    this.send({
      type: "register",
      projectId: this.deviceInfo.projectId,
      deviceId: this.deviceInfo.deviceId,
      deviceInfo: {
        ua: this.deviceInfo.ua,
        screen: this.deviceInfo.screen,
        pixelRatio: this.deviceInfo.pixelRatio,
        language: this.deviceInfo.language,
        url: this.deviceInfo.url
      }
    });
  }
  announcePlugins(e) {
    !this.remoteEnabled || !this.transport || this.transport.send(JSON.stringify({
      type: "plugin_announce",
      deviceId: this.deviceInfo.deviceId,
      plugins: e.map((t) => ({
        name: t.name,
        panelTitle: t.panelTitle,
        panelIcon: t.panelIcon,
        version: t.version,
        state: t.state === "enabled" ? "enabled" : "disabled"
      }))
    }));
  }
  sendEnvelope(e, t) {
    this.send({
      v: "1",
      platform: "web",
      device: {
        deviceId: this.deviceInfo.deviceId,
        projectId: this.deviceInfo.projectId,
        ua: this.deviceInfo.ua,
        screen: this.deviceInfo.screen,
        pixelRatio: this.deviceInfo.pixelRatio,
        language: this.deviceInfo.language,
        url: this.deviceInfo.url
      },
      tabId: this.tabId,
      ts: Date.now(),
      type: e,
      data: t
    });
  }
  send(e) {
    var t;
    (t = this.transport) == null || t.send(JSON.stringify(e));
  }
}
function Y() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
function $(s, e) {
  return !s || new TextEncoder().encode(s).length <= e ? s : s.slice(0, Math.floor(e / 2)) + "...[truncated]";
}
function ee(s, e) {
  for (const t of e)
    try {
      if (new RegExp(t).test(s))
        return !0;
    } catch {
    }
  return !1;
}
function W(s) {
  const e = {};
  return s.forEach((t, n) => {
    e[n] = t;
  }), e;
}
function te(s, e) {
  try {
    const n = performance.getEntriesByType("resource").find(
      (d) => d.name === s || d.name.endsWith(s) && Math.abs(d.startTime - (e - performance.timeOrigin)) < 500
    );
    if (!n || n.startTime === 0) return;
    const i = n.domainLookupEnd - n.domainLookupStart, o = n.connectEnd - n.connectStart, a = n.secureConnectionStart > 0 ? n.connectEnd - n.secureConnectionStart : 0, r = n.responseStart - n.requestStart, l = n.responseEnd - n.responseStart, c = n.responseEnd - n.startTime;
    return {
      dns: Math.max(0, i),
      tcp: Math.max(0, o),
      ssl: Math.max(0, a),
      request: Math.max(0, r),
      response: Math.max(0, l),
      total: Math.max(0, c)
    };
  } catch {
    return;
  }
}
function ne(s, e) {
  if (s) {
    const t = s["content-length"];
    if (t) {
      const n = parseInt(t, 10);
      if (!isNaN(n)) return n;
    }
  }
  if (e)
    return new TextEncoder().encode(e).length;
}
class Oe {
  constructor(e, t) {
    this.originalFetch = null, this.originalXhrOpen = null, this.originalXhrSend = null, this.originalXhrSetRequestHeader = null, this.onReport = e, this.config = {
      enabled: (t == null ? void 0 : t.enabled) ?? !0,
      maxRequestBodySize: (t == null ? void 0 : t.maxRequestBodySize) ?? 10240,
      maxResponseBodySize: (t == null ? void 0 : t.maxResponseBodySize) ?? 10240,
      ignoreUrls: (t == null ? void 0 : t.ignoreUrls) ?? []
    };
  }
  /** 启动拦截 */
  start() {
    this.config.enabled && (this.interceptFetch(), this.interceptXHR());
  }
  /** 停止拦截 */
  stop() {
    this.originalFetch && (window.fetch = this.originalFetch, this.originalFetch = null), this.originalXhrOpen && this.originalXhrSend && this.originalXhrSetRequestHeader && (XMLHttpRequest.prototype.open = this.originalXhrOpen, XMLHttpRequest.prototype.send = this.originalXhrSend, XMLHttpRequest.prototype.setRequestHeader = this.originalXhrSetRequestHeader, this.originalXhrOpen = null, this.originalXhrSend = null, this.originalXhrSetRequestHeader = null);
  }
  /** 拦截 Fetch API */
  interceptFetch() {
    this.originalFetch = window.fetch;
    const e = this;
    window.fetch = function(t, n) {
      var p, h;
      const i = Y(), o = Date.now();
      let a, r = ((p = n == null ? void 0 : n.method) == null ? void 0 : p.toUpperCase()) || "GET", l, c, d;
      try {
        d = (h = new Error().stack) == null ? void 0 : h.split(`
`).slice(3, 8).join(`
`);
      } catch {
      }
      if (typeof t == "string" ? a = t : t instanceof URL ? a = t.toString() : t instanceof Request ? (a = t.url, r = t.method.toUpperCase(), l = W(t.headers)) : a = String(t), ee(a, e.config.ignoreUrls))
        return e.originalFetch.call(window, t, n);
      if (n && (n.headers && (n.headers instanceof Headers ? l = W(n.headers) : typeof n.headers == "object" && (l = n.headers)), n.body))
        if (typeof n.body == "string")
          c = $(n.body, e.config.maxRequestBodySize);
        else if (n.body instanceof FormData)
          c = "[FormData]";
        else
          try {
            c = $(
              JSON.stringify(n.body),
              e.config.maxRequestBodySize
            );
          } catch {
            c = "[Body]";
          }
      return e.originalFetch.call(window, t, n).then(async (g) => {
        const S = Date.now() - o;
        let k;
        try {
          k = W(g.headers);
        } catch {
        }
        let C;
        try {
          const m = g.clone(), b = (k == null ? void 0 : k["content-type"]) ?? "";
          if (b.includes("application/json")) {
            const y = await m.text();
            C = $(y, e.config.maxResponseBodySize);
          } else if (b.includes("text/")) {
            const y = await m.text();
            C = $(y, e.config.maxResponseBodySize);
          } else if (b) {
            const y = await m.blob();
            if (y.size <= e.config.maxResponseBodySize) {
              const v = await y.arrayBuffer(), R = new Uint8Array(v);
              let I = "";
              R.forEach((L) => {
                I += String.fromCharCode(L);
              }), C = `[binary: ${y.type}, ${y.size}B] ` + btoa(I).slice(0, 200);
            } else
              C = `[binary: ${y.type}, ${y.size}B, EXCEED_SIZE]`;
          } else {
            const y = await m.text();
            C = $(y, e.config.maxResponseBodySize);
          }
        } catch {
        }
        return e.onReport({
          id: i,
          timestamp: o,
          method: r,
          url: a,
          status: g.status,
          statusText: g.statusText,
          requestHeaders: l,
          requestBody: c,
          responseHeaders: k,
          responseBody: C,
          duration: S,
          type: "fetch",
          responseSize: ne(k, C),
          timingPhases: te(a, o),
          initiator: d
        }), g;
      }).catch((g) => {
        const S = Date.now() - o;
        throw e.onReport({
          id: i,
          timestamp: o,
          method: r,
          url: a,
          requestHeaders: l,
          requestBody: c,
          duration: S,
          type: "fetch",
          error: g.message,
          initiator: d
        }), g;
      });
    };
  }
  /** 拦截 XMLHttpRequest */
  interceptXHR() {
    const e = this;
    this.originalXhrOpen = XMLHttpRequest.prototype.open, this.originalXhrSend = XMLHttpRequest.prototype.send, this.originalXhrSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    const t = /* @__PURE__ */ new WeakMap();
    XMLHttpRequest.prototype.open = function(n, i, o = !0, a, r) {
      var d;
      let l;
      try {
        l = (d = new Error().stack) == null ? void 0 : d.split(`
`).slice(3, 8).join(`
`);
      } catch {
      }
      const c = {
        requestId: Y(),
        startTime: 0,
        method: n.toUpperCase(),
        url: typeof i == "string" ? i : i.toString(),
        requestHeaders: {},
        initiator: l
      };
      return t.set(this, c), e.originalXhrOpen.call(this, n, i, o, a, r);
    }, XMLHttpRequest.prototype.setRequestHeader = function(n, i) {
      const o = t.get(this);
      return o && (o.requestHeaders[n] = i), e.originalXhrSetRequestHeader.call(this, n, i);
    }, XMLHttpRequest.prototype.send = function(n) {
      const i = t.get(this);
      if (!i)
        return e.originalXhrSend.call(this, n);
      if (ee(i.url, e.config.ignoreUrls))
        return e.originalXhrSend.call(this, n);
      if (i.startTime = Date.now(), n)
        if (typeof n == "string")
          i.requestBody = $(n, e.config.maxRequestBodySize);
        else if (n instanceof FormData)
          i.requestBody = "[FormData]";
        else
          try {
            i.requestBody = $(
              JSON.stringify(n),
              e.config.maxRequestBodySize
            );
          } catch {
            i.requestBody = "[Body]";
          }
      const o = () => {
        const r = Date.now() - i.startTime;
        let l;
        try {
          const d = this.getAllResponseHeaders();
          if (d) {
            const p = {};
            d.split(`\r
`).forEach((h) => {
              const [g, S] = h.split(": ");
              g && S && (p[g] = S);
            }), Object.keys(p).length > 0 && (l = p);
          }
        } catch {
        }
        let c;
        try {
          const d = this.responseType;
          if (!d || d === "text" || d === "json") {
            const p = d === "json" ? JSON.stringify(this.response) : this.responseText;
            p && (c = $(p, e.config.maxResponseBodySize));
          } else if (d === "arraybuffer" && this.response instanceof ArrayBuffer) {
            const p = new Uint8Array(this.response);
            if (p.byteLength <= e.config.maxResponseBodySize) {
              let h = "";
              p.forEach((g) => {
                h += String.fromCharCode(g);
              }), c = `[arraybuffer: ${p.byteLength}B] ` + btoa(h).slice(0, 200);
            } else
              c = `[arraybuffer: ${p.byteLength}B, EXCEED_SIZE]`;
          } else d === "blob" && this.response instanceof Blob ? c = `[blob: ${this.response.type}, ${this.response.size}B${this.response.size > e.config.maxResponseBodySize ? ", EXCEED_SIZE" : ""}]` : d === "document" && (c = "[document]");
        } catch {
        }
        e.onReport({
          id: i.requestId,
          timestamp: i.startTime,
          method: i.method,
          url: i.url,
          status: this.status,
          statusText: this.statusText,
          requestHeaders: i.requestHeaders,
          requestBody: i.requestBody,
          responseHeaders: l,
          responseBody: c,
          duration: r,
          type: "xhr",
          withCredentials: this.withCredentials,
          responseSize: ne(l, c),
          timingPhases: te(i.url, i.startTime),
          initiator: i.initiator
        });
      }, a = () => {
        const r = Date.now() - i.startTime;
        e.onReport({
          id: i.requestId,
          timestamp: i.startTime,
          method: i.method,
          url: i.url,
          requestHeaders: i.requestHeaders,
          requestBody: i.requestBody,
          duration: r,
          type: "xhr",
          error: "Network error"
        });
      };
      return this.addEventListener("load", o), this.addEventListener("error", a), e.originalXhrSend.call(this, n);
    };
  }
}
class He {
  constructor(e) {
    this.originalWebSocket = null, this.connections = /* @__PURE__ */ new Map(), this.onReport = e;
  }
  start() {
    if (typeof WebSocket > "u") return;
    this.originalWebSocket = WebSocket;
    const e = this, t = WebSocket;
    window.WebSocket = function(n, i) {
      const o = i !== void 0 ? new t(n, i) : new t(n), a = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, r = String(n), l = {
        id: a,
        url: r,
        openTime: Date.now(),
        messageCount: 0
      };
      e.connections.set(o, l), o.addEventListener("open", () => {
        l.openTime = Date.now(), e.onReport({
          id: a,
          method: "WS",
          url: r,
          type: "ws",
          wsEventType: "open",
          wsConnectionId: a,
          status: 101,
          statusText: "Switching Protocols",
          timestamp: Date.now()
        });
      }), o.addEventListener("message", (d) => {
        l.messageCount++;
        const p = typeof d.data == "string" ? d.data : d.data instanceof ArrayBuffer ? `[Binary ArrayBuffer: ${d.data.byteLength} bytes]` : d.data instanceof Blob ? `[Blob: ${d.data.size} bytes]` : String(d.data);
        e.onReport({
          id: `${a}-recv-${l.messageCount}`,
          method: "WS",
          url: r,
          type: "ws",
          wsEventType: "message",
          wsDirection: "receive",
          wsConnectionId: a,
          responseBody: p,
          timestamp: Date.now()
        });
      }), o.addEventListener("error", () => {
        e.onReport({
          id: `${a}-err`,
          method: "WS",
          url: r,
          type: "ws",
          wsEventType: "error",
          wsConnectionId: a,
          error: "WebSocket error",
          timestamp: Date.now()
        }), e.connections.delete(o);
      }), o.addEventListener("close", (d) => {
        const p = Date.now() - l.openTime;
        e.onReport({
          id: `${a}-close`,
          method: "WS",
          url: r,
          type: "ws",
          wsEventType: "close",
          wsConnectionId: a,
          status: d.code,
          statusText: d.reason || "Connection closed",
          duration: p,
          messageCount: l.messageCount,
          timestamp: Date.now()
        }), e.connections.delete(o);
      });
      const c = o.send.bind(o);
      return o.send = (d) => {
        l.messageCount++;
        const p = typeof d == "string" ? d : d instanceof ArrayBuffer ? `[Binary ArrayBuffer: ${d.byteLength} bytes]` : d instanceof Blob ? `[Blob: ${d.size} bytes]` : `[Binary: ${d.byteLength} bytes]`;
        e.onReport({
          id: `${a}-send-${l.messageCount}`,
          method: "WS",
          url: r,
          type: "ws",
          wsEventType: "message",
          wsDirection: "send",
          wsConnectionId: a,
          requestBody: p,
          timestamp: Date.now()
        }), c(d);
      }, o;
    }, Object.assign(window.WebSocket, {
      CONNECTING: t.CONNECTING,
      OPEN: t.OPEN,
      CLOSING: t.CLOSING,
      CLOSED: t.CLOSED
    }), window.WebSocket.prototype = t.prototype;
  }
  stop() {
    this.originalWebSocket && (window.WebSocket = this.originalWebSocket, this.originalWebSocket = null), this.connections.clear();
  }
}
class _e {
  constructor(e) {
    this.originalEventSource = null, this.onReport = e;
  }
  start() {
    if (typeof EventSource > "u") return;
    this.originalEventSource = EventSource;
    const e = this, t = EventSource;
    window.EventSource = function(n, i) {
      const o = new t(n, i), a = `sse-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, r = String(n);
      let l = Date.now(), c = 0;
      return o.addEventListener("open", () => {
        l = Date.now(), e.onReport({
          id: a,
          method: "SSE",
          url: r,
          type: "sse",
          wsEventType: "open",
          status: 200,
          statusText: "OK",
          timestamp: Date.now()
        });
      }), o.addEventListener("message", (d) => {
        c++, e.onReport({
          id: `${a}-msg-${c}`,
          method: "SSE",
          url: r,
          type: "sse",
          wsEventType: "message",
          wsDirection: "receive",
          responseBody: d.data,
          timestamp: Date.now()
        });
      }), o.addEventListener("error", () => {
        const d = Date.now() - l;
        e.onReport({
          id: `${a}-err`,
          method: "SSE",
          url: r,
          type: "sse",
          wsEventType: "error",
          error: o.readyState === EventSource.CLOSED ? "Connection closed" : "SSE error",
          duration: d,
          messageCount: c,
          timestamp: Date.now()
        });
      }), o;
    }, window.EventSource.prototype = t.prototype, Object.assign(window.EventSource, {
      CONNECTING: t.CONNECTING,
      OPEN: t.OPEN,
      CLOSED: t.CLOSED
    });
  }
  stop() {
    this.originalEventSource && (window.EventSource = this.originalEventSource, this.originalEventSource = null);
  }
}
class Ne {
  constructor(e) {
    this.originalSendBeacon = null, this.onReport = e;
  }
  start() {
    if (typeof (navigator == null ? void 0 : navigator.sendBeacon) != "function") return;
    this.originalSendBeacon = navigator.sendBeacon.bind(navigator);
    const e = this;
    navigator.sendBeacon = function(t, n) {
      const i = `beacon-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, o = String(t);
      let a;
      if (n != null)
        if (typeof n == "string")
          a = n;
        else if (n instanceof Blob)
          a = `[Blob: ${n.size} bytes, type: ${n.type || "unknown"}]`;
        else if (n instanceof FormData) {
          const l = [];
          n.forEach((c, d) => {
            l.push(`${d}=${typeof c == "string" ? c : "[File]"}`);
          }), a = l.join("&");
        } else n instanceof URLSearchParams ? a = n.toString() : (n instanceof ArrayBuffer || ArrayBuffer.isView(n)) && (a = `[Binary: ${n instanceof ArrayBuffer, n.byteLength} bytes]`);
      const r = e.originalSendBeacon(t, n);
      return e.onReport({
        id: i,
        method: "BEACON",
        url: o,
        type: "beacon",
        requestBody: a,
        status: r ? 200 : 0,
        statusText: r ? "Queued" : "Failed",
        timestamp: Date.now()
      }), r;
    };
  }
  stop() {
    this.originalSendBeacon && (navigator.sendBeacon = this.originalSendBeacon, this.originalSendBeacon = null);
  }
}
class je {
  constructor(e) {
    this.debounceTimer = null, this.origLocalSetItem = null, this.origLocalRemoveItem = null, this.origLocalClear = null, this.origSessionSetItem = null, this.origSessionRemoveItem = null, this.origSessionClear = null, this.cookieDescriptor = null, this.watching = !1, this.onReport = e;
  }
  /** 读取并上报存储快照（可手动触发） */
  async readAndReport() {
    try {
      const e = await this.readStorage();
      this.onReport(e);
    } catch (e) {
      console.error("[codeLog] Failed to read storage:", e);
    }
  }
  /** 开始监听所有存储写操作，任何写入都会自动触发防抖上报 */
  watch() {
    this.watching || typeof window > "u" || (this.watching = !0, this.patchStorageObject(localStorage, "local"), this.patchStorageObject(sessionStorage, "session"), this.patchCookie());
  }
  /** 停止监听，恢复原始 API */
  unwatch() {
    this.watching && (this.watching = !1, this.restoreStorageObject(localStorage, "local"), this.restoreStorageObject(sessionStorage, "session"), this.restoreCookie(), this.debounceTimer && (clearTimeout(this.debounceTimer), this.debounceTimer = null));
  }
  /** 读取存储数据 */
  async readStorage() {
    const e = {}, t = {};
    let n = 0, i = 0;
    try {
      for (let r = 0; r < localStorage.length; r++) {
        const l = localStorage.key(r);
        if (l) {
          const c = localStorage.getItem(l) || "";
          e[l] = c, n += l.length + c.length;
        }
      }
    } catch {
    }
    try {
      for (let r = 0; r < sessionStorage.length; r++) {
        const l = sessionStorage.key(r);
        if (l) {
          const c = sessionStorage.getItem(l) || "";
          t[l] = c, i += l.length + c.length;
        }
      }
    } catch {
    }
    let o = "", a;
    try {
      o = document.cookie, typeof window < "u" && "cookieStore" in window && (a = (await window.cookieStore.getAll()).map((l) => ({
        name: l.name,
        value: l.value,
        path: l.path,
        domain: l.domain,
        expires: l.expires != null ? new Date(l.expires).toISOString() : void 0,
        secure: l.secure,
        sameSite: l.sameSite
      })));
    } catch {
    }
    return {
      timestamp: Date.now(),
      localStorage: e,
      sessionStorage: t,
      cookies: o,
      cookieEntries: a,
      localStorageSize: n,
      sessionStorageSize: i
    };
  }
  // ─── Private helpers ───────────────────────────────────────────────────────
  debouncedReport() {
    this.debounceTimer && clearTimeout(this.debounceTimer), this.debounceTimer = setTimeout(() => {
      this.readAndReport();
    }, 200);
  }
  patchStorageObject(e, t) {
    const n = this;
    try {
      const i = e.setItem.bind(e);
      t === "local" ? this.origLocalSetItem = i : this.origSessionSetItem = i, e.setItem = function(r, l) {
        i(r, l), n.debouncedReport();
      };
      const o = e.removeItem.bind(e);
      t === "local" ? this.origLocalRemoveItem = o : this.origSessionRemoveItem = o, e.removeItem = function(r) {
        o(r), n.debouncedReport();
      };
      const a = e.clear.bind(e);
      t === "local" ? this.origLocalClear = a : this.origSessionClear = a, e.clear = function() {
        a(), n.debouncedReport();
      };
    } catch {
    }
  }
  restoreStorageObject(e, t) {
    try {
      t === "local" ? (this.origLocalSetItem && (e.setItem = this.origLocalSetItem), this.origLocalRemoveItem && (e.removeItem = this.origLocalRemoveItem), this.origLocalClear && (e.clear = this.origLocalClear)) : (this.origSessionSetItem && (e.setItem = this.origSessionSetItem), this.origSessionRemoveItem && (e.removeItem = this.origSessionRemoveItem), this.origSessionClear && (e.clear = this.origSessionClear));
    } catch {
    }
  }
  patchCookie() {
    try {
      const e = this, t = Document.prototype, n = Object.getOwnPropertyDescriptor(t, "cookie") ?? Object.getOwnPropertyDescriptor(document, "cookie");
      if (!n || !n.configurable || !n.set) return;
      this.cookieDescriptor = n, Object.defineProperty(document, "cookie", {
        configurable: !0,
        enumerable: !0,
        get() {
          return n.get.call(document);
        },
        set(i) {
          n.set.call(document, i), e.debouncedReport();
        }
      });
    } catch {
    }
  }
  restoreCookie() {
    try {
      this.cookieDescriptor && (Object.defineProperty(document, "cookie", this.cookieDescriptor), this.cookieDescriptor = null);
    } catch {
    }
  }
}
class Fe {
  constructor(e, t) {
    this.errorHandler = null, this.rejectionHandler = null, this.started = !1, this.reporting = !1, this.platform = e, this.bus = t;
  }
  start() {
    this.started || typeof window > "u" || (this.started = !0, this.errorHandler = (e) => {
      if (this.reporting) return;
      if (e.target instanceof HTMLElement) {
        const r = e.target, l = r.src || r.href || "", c = r.tagName.toLowerCase(), d = `[Resource Error] Failed to load <${c}>${l ? `: ${l}` : ""}`;
        this.safeReport({ timestamp: Date.now(), level: "error", message: d }), this.bus.emit("error", { source: "resource", message: d, url: l, tag: c });
        return;
      }
      const t = e, n = t.error, i = n != null && n.stack ? U(n.stack) : t.filename ? `    at ${t.filename}:${t.lineno}:${t.colno}` : void 0, o = (n == null ? void 0 : n.name) ?? "Error", a = {
        timestamp: Date.now(),
        level: "error",
        message: `[Uncaught ${o}] ${t.message}`,
        stack: i
      };
      this.safeReport(a), this.bus.emit("error", {
        source: "uncaught",
        message: t.message,
        stack: i,
        filename: t.filename,
        lineno: t.lineno,
        colno: t.colno
      });
    }, this.rejectionHandler = (e) => {
      if (this.reporting) return;
      const t = e.reason;
      let n, i;
      t instanceof Error ? (n = `[Unhandled Promise Rejection] ${t.message}`, i = U(t.stack)) : n = `[Unhandled Promise Rejection] ${String(t)}`, this.safeReport({ timestamp: Date.now(), level: "error", message: n, stack: i }), this.bus.emit("error", {
        source: "unhandledrejection",
        message: n,
        stack: i,
        reason: String(t)
      });
    }, window.addEventListener("error", this.errorHandler, !0), window.addEventListener("unhandledrejection", this.rejectionHandler));
  }
  stop() {
    this.started && (this.started = !1, this.errorHandler && (window.removeEventListener("error", this.errorHandler, !0), this.errorHandler = null), this.rejectionHandler && (window.removeEventListener("unhandledrejection", this.rejectionHandler), this.rejectionHandler = null));
  }
  safeReport(e) {
    this.reporting = !0;
    try {
      this.bus.emit("console", { ...e, args: [e.message] });
    } catch {
    } finally {
      this.reporting = !1;
    }
  }
}
const Ue = /* @__PURE__ */ new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "CANVAS"]), Xe = /* @__PURE__ */ new Set([
  "onclick",
  "onload",
  "onerror",
  "onchange",
  "onsubmit",
  "onfocus",
  "onblur",
  "onkeydown",
  "onkeyup",
  "onkeypress",
  "onmousedown",
  "onmouseup",
  "onmouseover",
  "onmouseout",
  "onmousemove"
]), ie = 8, se = 30, We = 150, Ze = 8;
function ge(s, e) {
  var a;
  const t = s.tagName;
  if (Ue.has(t)) return null;
  const n = { tag: t.toLowerCase() };
  s.id && (n.id = s.id), s.className && typeof s.className == "string" && s.className.trim() && (n.className = s.className.trim());
  const i = {};
  let o = 0;
  for (const r of Array.from(s.attributes))
    if (!(r.name === "id" || r.name === "class") && !Xe.has(r.name.toLowerCase()) && !r.name.startsWith("on")) {
      if (o >= Ze) break;
      i[r.name] = r.value.slice(0, 200), o++;
    }
  if (o > 0 && (n.attrs = i), e >= ie - 2 || s.children.length === 0) {
    const r = (a = s.textContent) == null ? void 0 : a.trim().slice(0, We);
    r && (n.text = r);
  }
  if (e < ie) {
    const r = [], l = Array.from(s.children), c = l.length;
    for (const d of l.slice(0, se)) {
      const p = ge(d, e + 1);
      p && r.push(p);
    }
    r.length > 0 && (n.children = r), c > se && (n.childCount = c);
  } else
    n.childCount = s.children.length;
  return n;
}
class Ve {
  constructor(e, t) {
    this.refreshHandler = null, this.platform = e, this.callback = t;
  }
  /** 采集并上报一次 DOM 快照 */
  collect() {
    if (!(typeof document > "u"))
      try {
        const e = document.documentElement, t = ge(e, 0);
        if (!t) return;
        let n;
        try {
          const i = document.documentElement.outerHTML;
          n = i.length > 512e3 ? i.slice(0, 512e3) + `
<!-- [truncated] -->` : i;
        } catch {
        }
        this.callback({
          timestamp: Date.now(),
          url: window.location.href,
          title: document.title,
          dom: t,
          htmlSnapshot: n
        });
      } catch (e) {
        console.warn("[codeLog] DOM 快照采集失败", e);
      }
  }
  /** 注册外部触发刷新的回调 */
  onRefresh(e) {
    this.refreshHandler = e;
  }
  triggerRefresh() {
    var e;
    (e = this.refreshHandler) == null || e.call(this);
  }
  destroy() {
    this.refreshHandler = null;
  }
}
const Ge = 3e3, Je = 120, Ke = 100, oe = 200, Qe = 100, Z = 200;
class re {
  constructor(e) {
    this.samples = [], this.vitals = [], this.longTasks = [], this.resources = [], this.interactions = [], this.marks = [], this.rafHandle = 0, this.intervalHandle = null, this.observers = [], this.destroyed = !1, this.fpsFrames = 0, this.fpsLastTick = performance.now(), this.bus = e;
  }
  async start() {
    await this.collectVitals(), this.startFPSLoop(), this.startSamplingInterval(), this.observeLongTasks(), this.observeResources(), this.observeInteractions(), this.observeUserMarks();
  }
  async collectVitals() {
    try {
      const { onLCP: e, onCLS: t, onFCP: n, onTTFB: i, onINP: o, onFID: a } = await import("./web-vitals-Bpb2w_6o.js"), r = (l, c, d) => {
        const p = this.vitals.findIndex((g) => g.name === l), h = { name: l, value: Math.round(c * 100) / 100, rating: d };
        p >= 0 ? this.vitals[p] = h : this.vitals.push(h), this.flush();
      };
      e((l) => r("LCP", l.value, l.rating)), t((l) => r("CLS", l.value, l.rating)), n((l) => r("FCP", l.value, l.rating)), i((l) => r("TTFB", l.value, l.rating));
      try {
        o((l) => r("INP", l.value, l.rating));
      } catch {
      }
      try {
        a((l) => r("FID", l.value, l.rating));
      } catch {
      }
    } catch (e) {
      console.warn("[codeLog] web-vitals unavailable", e);
    }
  }
  observeLongTasks() {
    try {
      const e = new PerformanceObserver((t) => {
        for (const n of t.getEntries())
          this.longTasks.push({
            startTime: Math.round(n.startTime),
            duration: Math.round(n.duration),
            name: n.name
          }), this.longTasks.length > Ke && this.longTasks.shift();
        this.flush();
      });
      e.observe({ entryTypes: ["longtask"] }), this.observers.push(e);
    } catch {
    }
  }
  observeResources() {
    try {
      const e = performance.getEntriesByType("resource");
      for (const n of e.slice(-oe))
        this.resources.push(this.mapResource(n));
      const t = new PerformanceObserver((n) => {
        for (const i of n.getEntries())
          this.resources.push(this.mapResource(i)), this.resources.length > oe && this.resources.shift();
        this.flush();
      });
      t.observe({ entryTypes: ["resource"] }), this.observers.push(t);
    } catch {
    }
  }
  mapResource(e) {
    return {
      name: e.name,
      initiatorType: e.initiatorType,
      duration: Math.round(e.duration),
      transferSize: e.transferSize ?? 0,
      startTime: Math.round(e.startTime)
    };
  }
  observeInteractions() {
    try {
      const e = new PerformanceObserver((t) => {
        for (const n of t.getEntries()) {
          const i = n;
          this.interactions.push({
            type: i.name,
            duration: Math.round(i.duration),
            startTime: Math.round(i.startTime),
            target: (() => {
              const o = i.target;
              if (o instanceof Element)
                return `${o.tagName.toLowerCase()}${o.id ? "#" + o.id : ""}`;
            })()
          }), this.interactions.length > Qe && this.interactions.shift();
        }
        this.flush();
      });
      e.observe({
        type: "event",
        buffered: !0,
        durationThreshold: 16
      }), this.observers.push(e);
    } catch {
    }
  }
  observeUserMarks() {
    try {
      const e = performance.getEntriesByType("mark");
      for (const i of e)
        this.marks.push({ name: i.name, startTime: Math.round(i.startTime), type: "mark" }), this.marks.length > Z && this.marks.shift();
      const t = performance.getEntriesByType("measure");
      for (const i of t)
        this.marks.push({ name: i.name, startTime: Math.round(i.startTime), duration: Math.round(i.duration), type: "measure" }), this.marks.length > Z && this.marks.shift();
      const n = new PerformanceObserver((i) => {
        for (const o of i.getEntries()) {
          const a = o.entryType;
          this.marks.push({
            name: o.name,
            startTime: Math.round(o.startTime),
            ...o.duration ? { duration: Math.round(o.duration) } : {},
            type: a
          }), this.marks.length > Z && this.marks.shift();
        }
        this.flush();
      });
      n.observe({ entryTypes: ["mark", "measure"] }), this.observers.push(n);
    } catch {
    }
  }
  startFPSLoop() {
    const e = () => {
      this.destroyed || (this.fpsFrames++, this.rafHandle = requestAnimationFrame(e));
    };
    this.rafHandle = requestAnimationFrame(e);
  }
  startSamplingInterval() {
    this.intervalHandle = setInterval(() => {
      if (this.destroyed) return;
      const e = performance.now(), t = (e - this.fpsLastTick) / 1e3, n = t > 0 ? Math.round(this.fpsFrames / t) : 0;
      this.fpsFrames = 0, this.fpsLastTick = e;
      const i = {
        ts: Date.now(),
        fps: Math.min(n, 120)
      };
      performance.memory && (i.heapUsed = parseFloat((performance.memory.usedJSHeapSize / 1048576).toFixed(2)), i.heapTotal = parseFloat((performance.memory.totalJSHeapSize / 1048576).toFixed(2))), this.samples.push(i), this.samples.length > Je && this.samples.shift(), this.flush();
    }, Ge);
  }
  flush() {
    const e = {
      vitals: [...this.vitals],
      samples: [...this.samples],
      longTasks: [...this.longTasks],
      resources: [...this.resources],
      interactions: [...this.interactions],
      marks: [...this.marks]
    };
    this.bus.emit("performance", e);
  }
  getSnapshot() {
    return {
      vitals: [...this.vitals],
      samples: [...this.samples],
      longTasks: [...this.longTasks],
      resources: [...this.resources],
      interactions: [...this.interactions],
      marks: [...this.marks]
    };
  }
  reset() {
    this.samples = [], this.vitals = [], this.longTasks = [], this.resources = [], this.interactions = [], this.marks = [], this.fpsFrames = 0, this.fpsLastTick = performance.now();
  }
  destroy() {
    this.destroyed = !0, cancelAnimationFrame(this.rafHandle), this.intervalHandle && clearInterval(this.intervalHandle);
    for (const e of this.observers)
      try {
        e.disconnect();
      } catch {
      }
    this.observers = [];
  }
}
class Ye {
  constructor(e) {
    this.bus = e;
  }
  async capture() {
    if (!(typeof window > "u" || typeof document > "u"))
      try {
        const { default: e } = await import("./html2canvas.esm-d2sM-0Wm.js"), t = await e(document.body, {
          useCORS: !0,
          allowTaint: !1,
          scale: Math.min(window.devicePixelRatio || 1, 2),
          // 最高 2x，避免过大
          logging: !1,
          imageTimeout: 5e3
        }), n = t.toDataURL("image/png");
        this.bus.emit("screenshot", {
          timestamp: Date.now(),
          dataUrl: n,
          width: t.width,
          height: t.height,
          url: window.location.href,
          title: document.title
        });
      } catch (e) {
        console.warn("[codeLog] Screenshot failed:", e);
      }
  }
}
class et {
  constructor(e) {
    this.connectionChangeHandler = null, this.batteryChangeHandler = null, this.batteryObj = null, this.onReport = e;
  }
  /** 采集一次全量系统信息并上报 */
  async collect() {
    const e = await this.buildPayload();
    this.onReport(e);
  }
  /** 开始监听网络/电池变化，并在变化时重新上报 */
  async startWatching() {
    await this.collect();
    const e = navigator.connection;
    if (e && (this.connectionChangeHandler = () => void this.collect(), e.addEventListener("change", this.connectionChangeHandler)), "getBattery" in navigator)
      try {
        const t = await navigator.getBattery();
        this.batteryObj = t, this.batteryChangeHandler = () => void this.collect(), t.addEventListener("chargingchange", this.batteryChangeHandler), t.addEventListener("levelchange", this.batteryChangeHandler);
      } catch {
      }
  }
  stopWatching() {
    var t;
    const e = navigator.connection;
    e && this.connectionChangeHandler && (e.removeEventListener("change", this.connectionChangeHandler), this.connectionChangeHandler = null), (t = this.batteryObj) != null && t.removeEventListener && this.batteryChangeHandler && (this.batteryObj.removeEventListener("chargingchange", this.batteryChangeHandler), this.batteryObj.removeEventListener("levelchange", this.batteryChangeHandler), this.batteryChangeHandler = null, this.batteryObj = null);
  }
  async buildPayload() {
    var l;
    const e = navigator;
    let t;
    if (e.connection) {
      const c = e.connection;
      t = {
        type: c.type,
        effectiveType: c.effectiveType,
        downlink: c.downlink,
        rtt: c.rtt,
        saveData: c.saveData
      };
    }
    let n;
    if (e.getBattery)
      try {
        const c = await e.getBattery();
        n = {
          charging: c.charging,
          level: Math.round(c.level * 100),
          chargingTime: isFinite(c.chargingTime) ? c.chargingTime : void 0,
          dischargingTime: isFinite(c.dischargingTime) ? c.dischargingTime : void 0
        };
      } catch {
      }
    const i = ((l = screen.orientation) == null ? void 0 : l.type) ?? void 0, o = (() => {
      try {
        const c = document.createElement("canvas");
        return c.width = 1, c.height = 1, c.toDataURL("image/webp").startsWith("data:image/webp");
      } catch {
        return !1;
      }
    })(), a = (() => {
      try {
        const c = document.createElement("canvas");
        return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
      } catch {
        return !1;
      }
    })(), r = (() => {
      try {
        return !!document.createElement("canvas").getContext("webgl2");
      } catch {
        return !1;
      }
    })();
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      languages: Array.from(navigator.languages || [navigator.language]),
      vendor: navigator.vendor,
      cookieEnabled: navigator.cookieEnabled,
      screen: {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        colorDepth: screen.colorDepth,
        pixelRatio: window.devicePixelRatio,
        orientation: i
      },
      hardware: {
        cpuCores: navigator.hardwareConcurrency,
        memory: e.deviceMemory,
        maxTouchPoints: navigator.maxTouchPoints
      },
      connection: t,
      battery: n,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: (/* @__PURE__ */ new Date()).getTimezoneOffset(),
      features: {
        // Core APIs
        webGL: a,
        webGL2: r,
        webP: o,
        serviceWorker: "serviceWorker" in navigator,
        webWorker: typeof Worker < "u",
        indexedDB: "indexedDB" in window,
        webSocket: "WebSocket" in window,
        webRTC: "RTCPeerConnection" in window,
        geolocation: "geolocation" in navigator,
        notifications: "Notification" in window,
        vibration: "vibrate" in navigator,
        bluetooth: "bluetooth" in navigator,
        usb: "usb" in navigator,
        paymentRequest: "PaymentRequest" in window,
        clipboard: "clipboard" in navigator,
        share: "share" in navigator,
        pdfViewer: navigator.pdfViewerEnabled ?? !1,
        // Network
        fetch: "fetch" in window,
        beacon: "sendBeacon" in navigator,
        eventSource: "EventSource" in window,
        // JS ES6+ (syntax/runtime detection)
        es6Class: (() => {
          try {
            return !!Function("return class {}")();
          } catch {
            return !1;
          }
        })(),
        es6Arrow: (() => {
          try {
            return !!Function("return (() => true)()")();
          } catch {
            return !1;
          }
        })(),
        es6Template: (() => {
          try {
            return !!Function("return `ok`")();
          } catch {
            return !1;
          }
        })(),
        es6Destructuring: (() => {
          try {
            return Function("const {a}={}"), !0;
          } catch {
            return !1;
          }
        })(),
        es6Symbol: typeof Symbol == "function",
        es6Promise: typeof Promise == "function",
        es6Proxy: typeof Proxy == "function",
        es7Async: (() => {
          try {
            return Function("async function f(){}"), !0;
          } catch {
            return !1;
          }
        })(),
        es8AsyncAwait: (() => {
          try {
            return Function("async function f(){ await Promise.resolve(); }"), !0;
          } catch {
            return !1;
          }
        })(),
        // CSS features
        cssGrid: (() => {
          try {
            return CSS.supports("display", "grid");
          } catch {
            return !1;
          }
        })(),
        cssFlexbox: (() => {
          try {
            return CSS.supports("display", "flex");
          } catch {
            return !1;
          }
        })(),
        cssVariables: (() => {
          try {
            return CSS.supports("--x", "0");
          } catch {
            return !1;
          }
        })(),
        cssAnimation: (() => {
          try {
            return CSS.supports("animation", "none 1s");
          } catch {
            return !1;
          }
        })(),
        cssCssHas: (() => {
          try {
            return CSS.supports("selector(:has(*))");
          } catch {
            return !1;
          }
        })(),
        // Element / Observer APIs
        intersectionObserver: "IntersectionObserver" in window,
        resizeObserver: "ResizeObserver" in window,
        mutationObserver: "MutationObserver" in window,
        performanceObserver: "PerformanceObserver" in window,
        broadcastChannel: "BroadcastChannel" in window,
        // Storage
        cacheStorage: "caches" in window,
        localStorage: (() => {
          try {
            return !!window.localStorage;
          } catch {
            return !1;
          }
        })(),
        sessionStorage: (() => {
          try {
            return !!window.sessionStorage;
          } catch {
            return !1;
          }
        })(),
        cookieStore: "cookieStore" in window,
        webSQL: "openDatabase" in window
      }
    };
  }
}
class tt {
  constructor(e) {
    this.originalOpen = null, this.enabled = !1, this.onReport = e;
  }
  start() {
    if (typeof indexedDB > "u") return;
    this.enabled = !0, this.originalOpen = indexedDB.open.bind(indexedDB);
    const e = this;
    [
      "get",
      "getAll",
      "put",
      "add",
      "delete",
      "clear",
      "count",
      "openCursor"
    ].forEach((n) => {
      const i = IDBObjectStore.prototype[n];
      typeof i == "function" && (IDBObjectStore.prototype[n] = function(...o) {
        const a = Date.now(), r = this.transaction.db.name, l = this.name, c = `idb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, d = i.apply(this, o);
        return d.addEventListener("success", () => {
          if (!e.enabled) return;
          const p = d.result;
          let h;
          try {
            Array.isArray(p) ? h = `[Array(${p.length})]` : p && typeof p == "object" && p instanceof IDBCursor ? h = "[IDBCursor]" : h = p;
          } catch {
            h = "[unserializable]";
          }
          e.onReport({
            id: c,
            dbName: r,
            storeName: l,
            operation: n,
            key: o[0],
            value: n === "put" || n === "add" ? o[0] : void 0,
            result: h,
            duration: Date.now() - a,
            timestamp: a
          });
        }), d.addEventListener("error", () => {
          var p;
          e.enabled && e.onReport({
            id: c,
            dbName: r,
            storeName: l,
            operation: n,
            key: o[0],
            error: ((p = d.error) == null ? void 0 : p.message) ?? "Unknown IDB error",
            duration: Date.now() - a,
            timestamp: a
          });
        }), d;
      });
    });
  }
  stop() {
    this.enabled = !1;
  }
  /** Take a full snapshot of all IndexedDB databases (structure only, no record data). */
  async takeSnapshot() {
    var n;
    if (typeof indexedDB > "u") return { ts: Date.now(), databases: [] };
    let e = [];
    try {
      e = await ((n = indexedDB.databases) == null ? void 0 : n.call(indexedDB)) ?? [];
    } catch {
      return { ts: Date.now(), databases: [] };
    }
    const t = [];
    for (const { name: i, version: o } of e)
      if (i)
        try {
          const a = await this._inspectDatabase(i, o);
          t.push(a);
        } catch {
        }
    return { ts: Date.now(), databases: t };
  }
  /** Fetch paginated records from a specific store. */
  async getStoreData(e, t, n = 0, i = 50) {
    return new Promise((o, a) => {
      const r = indexedDB.open(e);
      r.onsuccess = () => {
        const l = r.result;
        if (!l.objectStoreNames.contains(t))
          return l.close(), o({ dbName: e, storeName: t, records: [], keys: [], total: 0, page: n, pageSize: i });
        const d = l.transaction(t, "readonly").objectStore(t), p = d.keyPath, h = d.count();
        h.onsuccess = () => {
          const g = h.result, S = n * i, k = [], C = [];
          let m = 0;
          const b = d.openCursor();
          b.onsuccess = () => {
            const y = b.result;
            if (!y)
              return l.close(), o({ dbName: e, storeName: t, records: k, keys: C, keyPath: p, total: g, page: n, pageSize: i });
            if (m < S) {
              m++, y.continue();
              return;
            }
            if (k.length < i) {
              try {
                k.push(JSON.parse(JSON.stringify(y.value)));
              } catch {
                k.push(String(y.value));
              }
              C.push(y.key), y.continue();
            } else
              l.close(), o({ dbName: e, storeName: t, records: k, keys: C, keyPath: p, total: g, page: n, pageSize: i });
          }, b.onerror = () => {
            l.close(), o({ dbName: e, storeName: t, records: k, keys: C, keyPath: p, total: g, page: n, pageSize: i });
          };
        }, h.onerror = () => {
          l.close(), a(new Error("Count failed"));
        };
      }, r.onerror = () => a(new Error(`Cannot open ${e}`));
    });
  }
  _inspectDatabase(e, t) {
    return new Promise((n, i) => {
      const o = indexedDB.open(e, t);
      o.onsuccess = () => {
        const a = o.result, r = [], l = Array.from(a.objectStoreNames);
        if (l.length === 0)
          return a.close(), n({ name: e, version: a.version, stores: r });
        let c = l.length;
        const d = a.transaction(l, "readonly");
        l.forEach((p) => {
          const h = d.objectStore(p), g = Array.from(h.indexNames).map((C) => {
            const m = h.index(C);
            return {
              name: C,
              keyPath: m.keyPath,
              unique: m.unique,
              multiEntry: m.multiEntry
            };
          }), S = h.count(), k = {
            name: p,
            keyPath: h.keyPath,
            autoIncrement: h.autoIncrement,
            indexes: g,
            count: 0
          };
          S.onsuccess = () => {
            k.count = S.result, r.push(k), c--, c === 0 && (a.close(), n({ name: e, version: a.version, stores: r }));
          }, S.onerror = () => {
            r.push(k), c--, c === 0 && (a.close(), n({ name: e, version: a.version, stores: r }));
          };
        });
      }, o.onerror = () => i(new Error(`Cannot open ${e}`)), o.onblocked = () => i(new Error(`${e} is blocked`));
    });
  }
}
const j = {
  zh: {
    pageId: "页面 ID",
    copied: "✓ 已复制",
    clickCopy: "点击复制"
  },
  en: {
    pageId: "Page ID",
    copied: "✓ Copied",
    clickCopy: "Click to copy"
  }
};
class nt {
  constructor() {
    this.eruda = null, this.unsubscribers = [], this.lang = "zh", this.pageId = null, this.onDevToolsShow = null, this.settingsItemsAdded = !1, this.settingsItemCount = 0, this.reinitCallback = null;
  }
  /** 将 Eruda 实例与 DataBus 绑定（可在 Eruda 异步加载完成后调用） */
  attach(e, t, n) {
    if (this.eruda = e, this.pageId = n ?? null, this.settingsItemsAdded = !1, this.settingsItemCount = 0, this.detach(), this.lang = this.detectInitialLang(), this.syncErudaLang(this.lang), this.unsubscribers.push(
      t.on("console", (i) => {
        this.forwardToEruda(i);
      })
    ), typeof document < "u") {
      const i = e.get();
      i != null && i.on && (this.onDevToolsShow = () => {
        setTimeout(() => {
          this.renderInfoPanel(), this.bindInfoPanelHandlers();
        }, 150);
      }, i.on("show", this.onDevToolsShow)), setTimeout(() => this.renderInfoPanel(), 1200), setTimeout(() => this.addSettingsItems(), 1200), setTimeout(() => this.customizeEntryButton(), 1200);
    }
  }
  /** 解绑（清理订阅，不影响 DataBus 本身） */
  detach() {
    var e;
    if (this.onDevToolsShow && this.eruda) {
      const t = this.eruda.get();
      (e = t == null ? void 0 : t.off) == null || e.call(t, "show", this.onDevToolsShow), this.onDevToolsShow = null;
    }
    for (const t of this.unsubscribers)
      t();
    this.unsubscribers = [];
  }
  forwardToEruda(e) {
    if (!this.eruda) return;
    const t = this.eruda.get("console");
    if (!t) return;
    const n = e.level, i = t[n];
    typeof i == "function" && (e.args && e.args.length > 0 ? i.call(t, ...e.args) : i.call(t, e.message));
  }
  getErudaShadowRoot() {
    var e;
    return ((e = document.getElementById("eruda")) == null ? void 0 : e.shadowRoot) ?? null;
  }
  /** Detect initial language from web panel preference stored in localStorage */
  detectInitialLang() {
    try {
      if (typeof localStorage < "u") {
        const e = localStorage.getItem("codelog-lang");
        if (e === "zh" || e === "en") return e;
      }
    } catch {
    }
    return "zh";
  }
  /** Sync eruda's built-in UI language via the fork's i18n module */
  syncErudaLang(e) {
    var n, i;
    const t = e === "zh" ? "zh-CN" : "en";
    (i = (n = this.eruda) == null ? void 0 : n.i18n) == null || i.setLang(t);
  }
  /** Set the callback that will re-initialize Eruda (provided by CodeLog main class) */
  setReinitCallback(e) {
    this.reinitCallback = e;
  }
  /** Force Eruda to re-render with new language */
  refreshErudaUI() {
    this.reinitCallback && this.reinitCallback();
  }
  /** Render (or re-render) all CodeLog-injected Info panel items with current language */
  renderInfoPanel() {
    var n;
    const e = (n = this.eruda) == null ? void 0 : n.get("info");
    if (!e || typeof e.add != "function") return;
    const t = j[this.lang];
    for (const i of [j.zh.pageId, j.en.pageId])
      try {
        e.remove(i);
      } catch {
      }
    if (this.pageId) {
      const i = this.pageId.length > 20 ? `${this.pageId.slice(0, 10)}…${this.pageId.slice(-6)}` : this.pageId;
      e.add(
        t.pageId,
        `<span id="codelog-pageid-info" title="${t.clickCopy}" style="cursor:pointer;font-family:monospace;font-size:11px;color:#3b5bdb;word-break:break-all;">${i}</span>`
      );
    }
    setTimeout(() => this.bindInfoPanelHandlers(), 300);
  }
  /** Add language + theme selects to top of Settings panel (called once after attach) */
  addSettingsItems() {
    var o, a;
    if (this.settingsItemsAdded) return;
    const e = (o = this.eruda) == null ? void 0 : o.get("settings");
    if (!e || typeof e.select != "function") return;
    let t = 0;
    const n = {
      get: (r) => this.lang === "zh" ? "中文" : "English",
      set: (r, l) => {
        const c = l === "中文" ? "zh" : "en";
        try {
          localStorage.setItem("codelog-lang", c);
        } catch {
        }
        this.lang = c, this.syncErudaLang(c), this.refreshErudaUI(), this.renderInfoPanel();
      }
    };
    e.select(n, "lang", "语言 / Language", ["中文", "English"]), t++;
    const i = (a = this.eruda) == null ? void 0 : a.get();
    if (i != null && i.config) {
      const r = [
        "Dark",
        "Material Oceanic",
        "Material Darker",
        "Material Palenight",
        "Material Deep Ocean",
        "Monokai Pro",
        "Dracula",
        "Arc Dark",
        "Atom One Dark",
        "Solarized Dark",
        "Night Owl",
        "AMOLED"
      ], l = {
        get: (c) => r.includes(i.config.get("theme")) ? "Dark" : "Light",
        set: (c, d) => {
          i.config.set("theme", d);
        }
      };
      e.select(l, "theme", "主题 / Theme", ["Light", "Dark"]), t++;
    }
    e.separator(), t++, this.settingsItemCount = t, this.settingsItemsAdded = !0, setTimeout(() => this.moveSettingsItemsToTop(), 300);
  }
  /** Move our injected settings items (last N children) to the top of the Settings panel */
  moveSettingsItemsToTop() {
    const e = this.getErudaShadowRoot();
    if (!e) return;
    const t = e.querySelector(".luna-setting");
    if (!t) return;
    const n = Array.from(t.children), i = this.settingsItemCount;
    if (n.length < i) return;
    const o = n.slice(-i);
    for (let a = o.length - 1; a >= 0; a--)
      t.insertBefore(o[a], t.firstChild);
  }
  bindInfoPanelHandlers() {
    const e = this.getErudaShadowRoot();
    if (!e) {
      setTimeout(() => this.bindInfoPanelHandlers(), 300);
      return;
    }
    const t = e.getElementById("codelog-pageid-info");
    if (t && this.pageId) {
      const n = this.pageId.length > 20 ? `${this.pageId.slice(0, 10)}…${this.pageId.slice(-6)}` : this.pageId;
      t.onclick = () => this.copyToClipboard(this.pageId, t, n);
    }
  }
  /** Attach open/close CSS class to entry button for styling hooks */
  customizeEntryButton() {
    var n;
    const e = this.getErudaShadowRoot();
    if (!e) {
      setTimeout(() => this.customizeEntryButton(), 500);
      return;
    }
    const t = (n = this.eruda) == null ? void 0 : n.get();
    t != null && t.on && (t.on("show", () => {
      var i;
      (i = e.querySelector(".eruda-entry-btn")) == null || i.classList.add("codelog-open");
    }), t.on("hide", () => {
      var i;
      (i = e.querySelector(".eruda-entry-btn")) == null || i.classList.remove("codelog-open");
    }));
  }
  copyToClipboard(e, t, n) {
    const i = j[this.lang], o = () => {
      setTimeout(() => {
        t.textContent = n;
      }, 1500);
    };
    if (navigator.clipboard)
      navigator.clipboard.writeText(e).then(() => {
        t.textContent = i.copied, o();
      });
    else {
      const a = document.createElement("input");
      a.value = e, document.body.appendChild(a), a.select(), document.execCommand("copy"), document.body.removeChild(a), t.textContent = i.copied, o();
    }
  }
}
class it {
  constructor(e, t) {
    this.ws = new WebSocket(e), this.ws.onopen = () => t.onOpen(), this.ws.onmessage = (n) => {
      try {
        t.onMessage(JSON.parse(n.data));
      } catch {
      }
    }, this.ws.onclose = () => t.onClose(), this.ws.onerror = () => t.onError(new Error("WebSocket connection failed"));
  }
  send(e) {
    this.ws.send(e);
  }
  close() {
    this.ws.close();
  }
}
class st {
  constructor() {
    this.storage = {
      getItem(e) {
        return localStorage.getItem(e);
      },
      setItem(e, t) {
        localStorage.setItem(e, t);
      }
    }, this.device = {
      getUserAgent() {
        return navigator.userAgent;
      },
      getScreen() {
        return `${window.screen.width}x${window.screen.height}`;
      },
      getPixelRatio() {
        return window.devicePixelRatio;
      },
      getLanguage() {
        return navigator.language;
      },
      getUrl() {
        return window.location.origin + window.location.pathname;
      }
    }, this.timer = {
      setTimeout(e, t) {
        return window.setTimeout(e, t);
      },
      clearTimeout(e) {
        window.clearTimeout(e);
      },
      setInterval(e, t) {
        return window.setInterval(e, t);
      },
      clearInterval(e) {
        window.clearInterval(e);
      }
    };
  }
  createWebSocket(e, t) {
    return new it(e, t);
  }
}
const ot = /* @__PURE__ */ new Set([
  "alert",
  "alertdialog",
  "application",
  "article",
  "banner",
  "blockquote",
  "button",
  "caption",
  "cell",
  "checkbox",
  "code",
  "columnheader",
  "combobox",
  "comment",
  "complementary",
  "contentinfo",
  "definition",
  "deleted",
  "dialog",
  "directory",
  "document",
  "emphasis",
  "feed",
  "figure",
  "form",
  "generic",
  "grid",
  "gridcell",
  "group",
  "heading",
  "img",
  "inserted",
  "link",
  "list",
  "listitem",
  "log",
  "main",
  "mark",
  "marquee",
  "math",
  "menu",
  "menubar",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "meter",
  "navigation",
  "none",
  "note",
  "option",
  "paragraph",
  "presentation",
  "progressbar",
  "radio",
  "radiogroup",
  "region",
  "row",
  "rowgroup",
  "rowheader",
  "scrollbar",
  "search",
  "searchbox",
  "separator",
  "slider",
  "spinbutton",
  "status",
  "strong",
  "subscript",
  "superscript",
  "switch",
  "tab",
  "table",
  "tablist",
  "tabpanel",
  "term",
  "textbox",
  "time",
  "timer",
  "toolbar",
  "tooltip",
  "tree",
  "treegrid",
  "treeitem"
]), rt = /* @__PURE__ */ new Set([
  "command",
  "composite",
  "input",
  "landmark",
  "range",
  "roletype",
  "section",
  "sectionhead",
  "select",
  "structure",
  "widget",
  "window"
]), at = {
  checkbox: ["aria-checked"],
  combobox: ["aria-expanded"],
  heading: ["aria-level"],
  menuitemcheckbox: ["aria-checked"],
  menuitemradio: ["aria-checked"],
  option: ["aria-selected"],
  radio: ["aria-checked"],
  slider: ["aria-valuemax", "aria-valuemin", "aria-valuenow"],
  spinbutton: ["aria-valuemax", "aria-valuemin", "aria-valuenow"],
  switch: ["aria-checked"],
  scrollbar: ["aria-controls", "aria-orientation", "aria-valuemax", "aria-valuemin", "aria-valuenow"],
  tablist: ["aria-orientation"],
  treegrid: ["aria-readonly"]
}, lt = {
  listbox: ["option"],
  menu: ["menuitem", "menuitemcheckbox", "menuitemradio"],
  menubar: ["menuitem", "menuitemcheckbox", "menuitemradio"],
  tablist: ["tab"],
  tree: ["treeitem"],
  treegrid: ["treeitem", "row"],
  radiogroup: ["radio"],
  grid: ["row", "rowgroup"],
  table: ["row", "rowgroup"]
}, ct = {
  listitem: ["list"],
  menuitem: ["menu", "menubar"],
  menuitemcheckbox: ["menu", "menubar"],
  menuitemradio: ["menu", "menubar"],
  option: ["listbox"],
  row: ["grid", "table", "treegrid", "rowgroup"],
  rowgroup: ["grid", "table", "treegrid"],
  tab: ["tablist"],
  tabpanel: ["tablist"],
  treeitem: ["tree", "treegrid"],
  gridcell: ["row"],
  cell: ["row"],
  columnheader: ["row"],
  rowheader: ["row"]
}, ut = /* @__PURE__ */ new Set([
  "aria-activedescendant",
  "aria-atomic",
  "aria-autocomplete",
  "aria-brailleroledescription",
  "aria-busy",
  "aria-checked",
  "aria-colcount",
  "aria-colindex",
  "aria-colindextext",
  "aria-colspan",
  "aria-controls",
  "aria-current",
  "aria-describedby",
  "aria-description",
  "aria-details",
  "aria-disabled",
  "aria-dropeffect",
  "aria-errormessage",
  "aria-expanded",
  "aria-flowto",
  "aria-grabbed",
  "aria-haspopup",
  "aria-hidden",
  "aria-invalid",
  "aria-keyshortcuts",
  "aria-label",
  "aria-labelledby",
  "aria-level",
  "aria-live",
  "aria-modal",
  "aria-multiline",
  "aria-multiselectable",
  "aria-orientation",
  "aria-owns",
  "aria-placeholder",
  "aria-posinset",
  "aria-pressed",
  "aria-readonly",
  "aria-relevant",
  "aria-required",
  "aria-roledescription",
  "aria-rowcount",
  "aria-rowindex",
  "aria-rowindextext",
  "aria-rowspan",
  "aria-selected",
  "aria-setsize",
  "aria-sort",
  "aria-valuemax",
  "aria-valuemin",
  "aria-valuenow",
  "aria-valuetext"
]);
function ae(s) {
  const e = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  return e ? [parseInt(e[1]), parseInt(e[2]), parseInt(e[3])] : null;
}
function le(s, e, t) {
  const [n, i, o] = [s, e, t].map((a) => {
    const r = a / 255;
    return r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * n + 0.7152 * i + 0.0722 * o;
}
function dt(s, e) {
  const t = Math.max(s, e), n = Math.min(s, e);
  return (t + 0.05) / (n + 0.05);
}
function ht(s, e, t = !1) {
  const n = ae(s), i = ae(e);
  if (!n || !i) return null;
  const o = le(...n), a = le(...i), r = dt(o, a);
  return t ? r >= 3 : r >= 4.5;
}
function X(s) {
  var o, a;
  const e = s.getAttribute("aria-labelledby");
  if (e) {
    const r = document.getElementById(e);
    if (r) return ((o = r.textContent) == null ? void 0 : o.trim()) ?? "";
  }
  const t = s.getAttribute("aria-label");
  if (t) return t.trim();
  const n = (a = s.textContent) == null ? void 0 : a.trim();
  if (n) return n;
  const i = s.getAttribute("title");
  if (i) return i.trim();
  if (s instanceof HTMLInputElement || s instanceof HTMLTextAreaElement) {
    const r = s.getAttribute("placeholder");
    if (r) return r.trim();
  }
  return "";
}
function be(s) {
  var t, n;
  const e = s.id;
  return !!(e && document.querySelector(`label[for="${CSS.escape(e)}"]`) || s.closest("label") || s.getAttribute("aria-labelledby") || (t = s.getAttribute("aria-label")) != null && t.trim() || (n = s.getAttribute("title")) != null && n.trim());
}
function ye(s) {
  return /^[a-zA-Z]{2,3}(-[a-zA-Z]{2,8})*$/.test(s);
}
const pt = /* @__PURE__ */ new Set([
  "click here",
  "click",
  "here",
  "more",
  "read more",
  "learn more",
  "link",
  "this",
  "go",
  "download",
  "open",
  "close",
  "点击这里",
  "点击",
  "这里",
  "更多",
  "查看更多",
  "了解更多",
  "链接",
  "下载",
  "打开",
  "关闭"
]), ft = [
  { pattern: /jquery[/.-](\d+\.\d+\.\d+)/i, name: "jQuery", minSafe: "3.5.0" },
  { pattern: /angular(?:\.min)?\.js[/?](\d+\.\d+\.\d+)/i, name: "AngularJS", minSafe: "1.8.3" },
  { pattern: /lodash[/.-](\d+\.\d+\.\d+)/i, name: "Lodash", minSafe: "4.17.21" },
  { pattern: /moment(?:\.min)?\.js[/?](\d+\.\d+\.\d+)/i, name: "Moment.js", minSafe: "2.29.4" },
  { pattern: /bootstrap[/.-](\d+\.\d+\.\d+)/i, name: "Bootstrap", minSafe: "4.6.2" },
  { pattern: /react(?:\.production\.min)?\.js[/?](\d+\.\d+\.\d+)/i, name: "React", minSafe: "16.14.0" },
  { pattern: /axios[/.-](\d+\.\d+\.\d+)/i, name: "Axios", minSafe: "0.21.2" }
];
function mt(s, e) {
  const t = s.split(".").map(Number), n = e.split(".").map(Number);
  for (let i = 0; i < Math.max(t.length, n.length); i++) {
    const o = t[i] ?? 0, a = n[i] ?? 0;
    if (o < a) return !0;
    if (o > a) return !1;
  }
  return !1;
}
function w() {
  try {
    const s = typeof localStorage < "u" && localStorage.getItem("codelog-lang");
    return s === "en" ? !1 : s === "zh" ? !0 : navigator.language.toLowerCase().startsWith("zh");
  } catch {
    return navigator.language.toLowerCase().startsWith("zh");
  }
}
function u(s) {
  return w() ? s.zh : s.en;
}
const f = {
  // Weight 10 (Critical)
  "aria-allowed-attr": { title: { zh: "ARIA 属性匹配角色", en: "ARIA Attributes Match Role" }, description: { zh: "ARIA 属性应与元素角色匹配", en: "ARIA attributes should match element roles" } },
  "aria-hidden-body": { title: { zh: "body 无 aria-hidden", en: "No aria-hidden on body" }, description: { zh: "body 元素不应设置 aria-hidden", en: "Body element should not have aria-hidden" } },
  "aria-required-attr": { title: { zh: "ARIA 必需属性", en: "Required ARIA Attributes" }, description: { zh: "元素角色应具有必需的 ARIA 属性", en: "Element roles must have required ARIA attributes" } },
  "aria-required-children": { title: { zh: "ARIA 必需子角色", en: "Required ARIA Children" }, description: { zh: "复合控件应包含必需的子角色", en: "Composite widgets must contain required child roles" } },
  "aria-required-parent": { title: { zh: "ARIA 必需父角色", en: "Required ARIA Parent" }, description: { zh: "角色应在合法的父元素内", en: "Roles must be inside valid parent elements" } },
  "aria-roles": { title: { zh: "ARIA 角色有效", en: "Valid ARIA Roles" }, description: { zh: "使用的 ARIA 角色应为合法值", en: "ARIA roles used should be valid values" } },
  "aria-valid-attr-value": { title: { zh: "ARIA 属性值有效", en: "Valid ARIA Attribute Values" }, description: { zh: "ARIA 属性值应为合法值", en: "ARIA attribute values should be valid" } },
  "aria-valid-attr": { title: { zh: "ARIA 属性名有效", en: "Valid ARIA Attribute Names" }, description: { zh: "ARIA 属性名不应有拼写错误", en: "ARIA attribute names should not be misspelled" } },
  "button-name": { title: { zh: "按钮有可辨识名称", en: "Button Has Discernible Name" }, description: { zh: "所有按钮应有可辨识的文本", en: "All buttons must have discernible text" } },
  "image-alt": { title: { zh: "图片有 alt 属性", en: "Image Elements Have alt" }, description: { zh: "所有 img 元素应具有 alt 属性", en: "All img elements must have alt attributes" } },
  "input-image-alt": { title: { zh: "图片按钮有 alt", en: "Image Input Has alt" }, description: { zh: "input[type=image] 应有 alt 属性", en: "input[type=image] must have alt attribute" } },
  label: { title: { zh: "表单元素有关联标签", en: "Form Elements Have Labels" }, description: { zh: "表单控件应有关联的 label", en: "Form controls must have associated labels" } },
  "meta-viewport": { title: { zh: "viewport 未禁用缩放", en: "Viewport Does Not Disable Zoom" }, description: { zh: "不应设置 user-scalable=no 或 maximum-scale<5", en: "Should not set user-scalable=no or maximum-scale<5" } },
  "duplicate-id-aria": { title: { zh: "ARIA 引用 ID 唯一", en: "ARIA Reference IDs Are Unique" }, description: { zh: "aria-describedby 等引用的 ID 应唯一", en: "IDs referenced by aria-describedby etc. must be unique" } },
  "select-name": { title: { zh: "选择框有关联标签", en: "Select Has Associated Label" }, description: { zh: "select 元素应有关联的 label", en: "select elements must have associated labels" } },
  "video-caption": { title: { zh: "视频有字幕", en: "Video Has Captions" }, description: { zh: "video 元素应包含字幕轨道", en: "video elements must contain caption tracks" } },
  // Weight 7 (Serious)
  accesskeys: { title: { zh: "accesskey 值唯一", en: "accesskey Values Are Unique" }, description: { zh: "每个 accesskey 值应唯一", en: "Each accesskey value should be unique" } },
  "aria-hidden-focus": { title: { zh: "aria-hidden 不含焦点元素", en: "aria-hidden Does Not Contain Focusable" }, description: { zh: "aria-hidden 元素不应包含可聚焦后代", en: "aria-hidden elements must not contain focusable descendants" } },
  "aria-input-field-name": { title: { zh: "ARIA 输入字段有名称", en: "ARIA Input Fields Have Names" }, description: { zh: "ARIA 输入角色应有可访问名称", en: "ARIA input roles must have accessible names" } },
  "aria-toggle-field-name": { title: { zh: "ARIA 开关字段有名称", en: "ARIA Toggle Fields Have Names" }, description: { zh: "ARIA 开关角色应有可访问名称", en: "ARIA toggle roles must have accessible names" } },
  bypass: { title: { zh: "页面有跳过导航", en: "Page Has Bypass Navigation" }, description: { zh: "页面应有跳过导航链接或 landmark", en: "Page should have skip links or landmarks" } },
  "color-contrast": { title: { zh: "文本对比度足够", en: "Sufficient Color Contrast" }, description: { zh: "文本与背景对比度应满足 WCAG AA 标准", en: "Text-background contrast should meet WCAG AA" } },
  "document-title": { title: { zh: "页面有标题", en: "Document Has Title" }, description: { zh: "页面应有非空的 title 元素", en: "Page must have a non-empty title element" } },
  "frame-title": { title: { zh: "iframe 有标题", en: "iframe Has Title" }, description: { zh: "所有 iframe 应有 title 属性", en: "All iframes must have title attributes" } },
  "heading-order": { title: { zh: "标题层级有序", en: "Heading Levels Do Not Skip" }, description: { zh: "标题层级不应跳级", en: "Heading levels should not skip" } },
  "html-has-lang": { title: { zh: "html 有 lang 属性", en: "html Has lang Attribute" }, description: { zh: "html 元素应有 lang 属性", en: "html element must have a lang attribute" } },
  "html-lang-valid": { title: { zh: "lang 属性值有效", en: "Valid lang Attribute" }, description: { zh: "lang 属性值应为合法 BCP 47", en: "lang attribute should be valid BCP 47" } },
  "link-name": { title: { zh: "链接有可辨识名称", en: "Link Has Discernible Name" }, description: { zh: "所有链接应有可辨识的文本", en: "All links must have discernible text" } },
  list: { title: { zh: "列表结构正确", en: "Proper List Structure" }, description: { zh: "ul/ol 内应只包含 li 等允许的子元素", en: "ul/ol should only contain allowed children" } },
  listitem: { title: { zh: "列表项在列表内", en: "List Items In Lists" }, description: { zh: "li 应在 ul/ol/menu 内", en: "li elements must be inside ul/ol/menu" } },
  "definition-list": { title: { zh: "定义列表结构正确", en: "Proper Definition List" }, description: { zh: "dl 内应只包含 dt/dd 等允许的子元素", en: "dl should only contain allowed children" } },
  dlitem: { title: { zh: "定义项在 dl 内", en: "Definition Items In dl" }, description: { zh: "dt/dd 应在 dl 内", en: "dt/dd must be inside dl" } },
  tabindex: { title: { zh: "无 tabindex>0", en: "No tabindex>0" }, description: { zh: "不应使用 tabindex 大于 0 的值", en: "Should not use tabindex values greater than 0" } },
  "object-alt": { title: { zh: "object 有替代文本", en: "Object Has Alternate Text" }, description: { zh: "object 元素应有替代文本", en: "object elements should have alternate text" } },
  // Weight 3 (Minor)
  "form-field-multiple-labels": { title: { zh: "表单字段无多个标签", en: "No Multiple Labels" }, description: { zh: "表单字段不应被多个 label 关联", en: "Form fields should not have multiple labels" } },
  "valid-lang": { title: { zh: "lang 属性值有效", en: "Valid lang Attributes" }, description: { zh: "所有 lang 属性值应为合法 BCP 47", en: "All lang attributes should be valid BCP 47" } },
  "skip-link-focusable": { title: { zh: "跳过链接可聚焦", en: "Skip Link Is Focusable" }, description: { zh: "跳过导航链接应可通过键盘聚焦", en: "Skip navigation link should be keyboard focusable" } },
  "document-has-main-landmark": { title: { zh: "页面有 main 地标", en: "Page Has Main Landmark" }, description: { zh: '页面应有 main 元素或 role="main"', en: 'Page should have a main element or role="main"' } },
  "th-has-data-cells": { title: { zh: "表头有数据单元格", en: "Header Cells Have Data Cells" }, description: { zh: "表头 th 应有关联的 td 单元格", en: "th elements should have associated td cells" } }
};
function gt() {
  const s = document.querySelectorAll("[role]"), e = /* @__PURE__ */ new Set([
    "aria-atomic",
    "aria-busy",
    "aria-controls",
    "aria-current",
    "aria-describedby",
    "aria-description",
    "aria-details",
    "aria-disabled",
    "aria-dropeffect",
    "aria-flowto",
    "aria-grabbed",
    "aria-haspopup",
    "aria-hidden",
    "aria-invalid",
    "aria-keyshortcuts",
    "aria-label",
    "aria-labelledby",
    "aria-live",
    "aria-owns",
    "aria-placeholder",
    "aria-readonly",
    "aria-relevant",
    "aria-required",
    "aria-roledescription",
    "aria-errormessage"
  ]), t = {
    checkbox: ["aria-checked"],
    combobox: ["aria-expanded", "aria-autocomplete"],
    heading: ["aria-level"],
    slider: ["aria-valuemax", "aria-valuemin", "aria-valuenow", "aria-valuetext"],
    spinbutton: ["aria-valuemax", "aria-valuemin", "aria-valuenow", "aria-valuetext"],
    textbox: ["aria-autocomplete", "aria-multiline"],
    scrollbar: ["aria-controls", "aria-orientation", "aria-valuemax", "aria-valuemin", "aria-valuenow"],
    radio: ["aria-checked"],
    switch: ["aria-checked"],
    menuitemcheckbox: ["aria-checked"],
    menuitemradio: ["aria-checked"],
    option: ["aria-selected"],
    tablist: ["aria-orientation"],
    grid: ["aria-readonly", "aria-multiselectable"],
    treegrid: ["aria-readonly"],
    separator: ["aria-orientation", "aria-valuenow"]
  };
  let n = 0;
  s.forEach((o) => {
    const a = o.getAttribute("role"), r = t[a];
    if (r)
      for (const l of o.getAttributeNames())
        l.startsWith("aria-") && (e.has(l) || r.includes(l) || n++);
  });
  const i = w();
  return {
    id: "aria-allowed-attr",
    title: u(f["aria-allowed-attr"].title),
    description: u(f["aria-allowed-attr"].description),
    score: n === 0 ? 1 : 0,
    weight: 10,
    value: n > 0 ? `${n} ${i ? "处违规" : "violation(s)"}` : void 0
  };
}
function bt() {
  const s = document.body.getAttribute("aria-hidden");
  return {
    id: "aria-hidden-body",
    title: u(f["aria-hidden-body"].title),
    description: u(f["aria-hidden-body"].description),
    score: s !== "true" ? 1 : 0,
    weight: 10
  };
}
function yt() {
  let s = 0;
  for (const [t, n] of Object.entries(at))
    document.querySelectorAll(`[role="${t}"]`).forEach((i) => {
      for (const o of n)
        i.hasAttribute(o) || s++;
    });
  const e = w();
  return {
    id: "aria-required-attr",
    title: u(f["aria-required-attr"].title),
    description: u(f["aria-required-attr"].description),
    score: s === 0 ? 1 : 0,
    weight: 10,
    value: s > 0 ? `${s} ${e ? "个缺失属性" : "missing attribute(s)"}` : void 0
  };
}
function wt() {
  let s = 0;
  for (const [t, n] of Object.entries(lt))
    document.querySelectorAll(`[role="${t}"]`).forEach((i) => {
      Array.from(i.children).some((a) => {
        const r = a.getAttribute("role");
        return r && n.includes(r);
      }) || s++;
    });
  const e = w();
  return {
    id: "aria-required-children",
    title: u(f["aria-required-children"].title),
    description: u(f["aria-required-children"].description),
    score: s === 0 ? 1 : 0,
    weight: 10,
    value: s > 0 ? `${s} ${e ? "处违规" : "violation(s)"}` : void 0
  };
}
function vt() {
  let s = 0;
  for (const [t, n] of Object.entries(ct))
    document.querySelectorAll(`[role="${t}"]`).forEach((i) => {
      var a;
      const o = (a = i.parentElement) == null ? void 0 : a.getAttribute("role");
      (!o || !n.includes(o)) && s++;
    });
  const e = w();
  return {
    id: "aria-required-parent",
    title: u(f["aria-required-parent"].title),
    description: u(f["aria-required-parent"].description),
    score: s === 0 ? 1 : 0,
    weight: 10,
    value: s > 0 ? `${s} ${e ? "处违规" : "violation(s)"}` : void 0
  };
}
function St() {
  let s = 0;
  document.querySelectorAll("[role]").forEach((t) => {
    const n = t.getAttribute("role");
    (!ot.has(n) || rt.has(n)) && s++;
  });
  const e = w();
  return {
    id: "aria-roles",
    title: u(f["aria-roles"].title),
    description: u(f["aria-roles"].description),
    score: s === 0 ? 1 : 0,
    weight: 10,
    value: s > 0 ? `${s} ${e ? "个无效角色" : "invalid role(s)"}` : void 0
  };
}
function kt() {
  let s = 0;
  document.querySelectorAll("*").forEach((t) => {
    for (const n of t.getAttributeNames()) {
      if (!n.startsWith("aria-")) continue;
      const i = t.getAttribute(n);
      if (!i.trim()) {
        s++;
        continue;
      }
      if ((n === "aria-labelledby" || n === "aria-describedby" || n === "aria-owns" || n === "aria-controls" || n === "aria-flowto" || n === "aria-activedescendant") && i)
        for (const o of i.split(/\s+/))
          document.getElementById(o) || s++;
    }
  });
  const e = w();
  return {
    id: "aria-valid-attr-value",
    title: u(f["aria-valid-attr-value"].title),
    description: u(f["aria-valid-attr-value"].description),
    score: s === 0 ? 1 : 0,
    weight: 10,
    value: s > 0 ? `${s} ${e ? "个无效值" : "invalid value(s)"}` : void 0
  };
}
function Ct() {
  let s = 0;
  document.querySelectorAll("*").forEach((t) => {
    for (const n of t.getAttributeNames())
      n.startsWith("aria-") && !ut.has(n) && s++;
  });
  const e = w();
  return {
    id: "aria-valid-attr",
    title: u(f["aria-valid-attr"].title),
    description: u(f["aria-valid-attr"].description),
    score: s === 0 ? 1 : 0,
    weight: 10,
    value: s > 0 ? `${s} ${e ? "个无效属性" : "invalid attr(s)"}` : void 0
  };
}
function Rt() {
  const s = document.querySelectorAll("button");
  if (s.length === 0) return null;
  let e = 0;
  s.forEach((n) => {
    X(n) || e++;
  });
  const t = w();
  return {
    id: "button-name",
    title: u(f["button-name"].title),
    description: u(f["button-name"].description),
    score: e === 0 ? 1 : 0,
    weight: 10,
    value: e > 0 ? `${e} ${t ? "个按钮无名称" : "button(s) without name"}` : void 0
  };
}
function It() {
  const s = document.querySelectorAll("img");
  if (s.length === 0) return null;
  let e = 0;
  s.forEach((n) => {
    n.hasAttribute("alt") || e++;
  });
  const t = w();
  return {
    id: "image-alt",
    title: u(f["image-alt"].title),
    description: u(f["image-alt"].description),
    score: e === 0 ? 1 : 0,
    weight: 10,
    value: e > 0 ? `${e} ${t ? "张图片缺少 alt" : "image(s) missing alt"}` : void 0
  };
}
function At() {
  const s = document.querySelectorAll('input[type="image"]');
  if (s.length === 0) return null;
  let e = 0;
  s.forEach((n) => {
    n.hasAttribute("alt") || e++;
  });
  const t = w();
  return {
    id: "input-image-alt",
    title: u(f["input-image-alt"].title),
    description: u(f["input-image-alt"].description),
    score: e === 0 ? 1 : 0,
    weight: 10,
    value: e > 0 ? `${e} ${t ? "个输入缺少 alt" : "input(s) missing alt"}` : void 0
  };
}
function Et() {
  const s = document.querySelectorAll('input:not([type="hidden"]):not([type="image"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea');
  if (s.length === 0) return null;
  let e = 0;
  s.forEach((n) => {
    be(n) || e++;
  });
  const t = w();
  return {
    id: "label",
    title: u(f.label.title),
    description: u(f.label.description),
    score: e === 0 ? 1 : 0,
    weight: 10,
    value: e > 0 ? `${e} ${t ? "个元素无标签" : "element(s) without label"}` : void 0
  };
}
function xt() {
  const s = document.querySelector('meta[name="viewport"]');
  if (!s) return null;
  const e = s.getAttribute("content") ?? "", t = e.match(/maximum-scale\s*=\s*([\d.]+)/), n = e.match(/user-scalable\s*=\s*(\w+)/), i = t && parseFloat(t[1]) < 5 || n && n[1].toLowerCase() === "no";
  return {
    id: "meta-viewport",
    title: u(f["meta-viewport"].title),
    description: u(f["meta-viewport"].description),
    score: i ? 0 : 1,
    weight: 10
  };
}
function Tt() {
  let s = 0;
  const e = /* @__PURE__ */ new Set();
  document.querySelectorAll("[aria-describedby], [aria-labelledby]").forEach((n) => {
    ["aria-describedby", "aria-labelledby"].forEach((o) => {
      const a = n.getAttribute(o);
      a && a.split(/\s+/).forEach((r) => e.add(r));
    });
  });
  for (const n of e)
    document.querySelectorAll(`[id="${CSS.escape(n)}"]`).length > 1 && s++;
  const t = w();
  return {
    id: "duplicate-id-aria",
    title: u(f["duplicate-id-aria"].title),
    description: u(f["duplicate-id-aria"].description),
    score: s === 0 ? 1 : 0,
    weight: 10,
    value: s > 0 ? `${s} ${t ? "个重复 ID" : "duplicate ID(s)"}` : void 0
  };
}
function Lt() {
  const s = document.querySelectorAll("select");
  if (s.length === 0) return null;
  let e = 0;
  s.forEach((n) => {
    be(n) || e++;
  });
  const t = w();
  return {
    id: "select-name",
    title: u(f["select-name"].title),
    description: u(f["select-name"].description),
    score: e === 0 ? 1 : 0,
    weight: 10,
    value: e > 0 ? `${e} ${t ? "个选择框无标签" : "select(s) without label"}` : void 0
  };
}
function Dt() {
  const s = document.querySelectorAll("video");
  if (s.length === 0) return null;
  let e = 0;
  s.forEach((n) => {
    n.querySelector('track[kind="captions"]') || e++;
  });
  const t = w();
  return {
    id: "video-caption",
    title: u(f["video-caption"].title),
    description: u(f["video-caption"].description),
    score: e === 0 ? 1 : 0,
    weight: 10,
    value: e > 0 ? `${e} ${t ? "个视频无字幕" : "video(s) without captions"}` : void 0
  };
}
function $t() {
  const s = document.querySelectorAll("[accesskey]");
  if (s.length === 0) return null;
  const e = /* @__PURE__ */ new Set();
  let t = 0;
  s.forEach((i) => {
    const o = i.getAttribute("accesskey");
    o && (e.has(o) && t++, e.add(o));
  });
  const n = w();
  return {
    id: "accesskeys",
    title: u(f.accesskeys.title),
    description: u(f.accesskeys.description),
    score: t === 0 ? 1 : 0,
    weight: 7,
    value: t > 0 ? `${t} ${n ? "个重复 accesskey" : "duplicate accesskey(s)"}` : void 0
  };
}
function Pt() {
  let s = 0;
  document.querySelectorAll('[aria-hidden="true"]').forEach((t) => {
    t.querySelectorAll("a[href], button, input, select, textarea, [tabindex]").length > 0 && s++;
  });
  const e = w();
  return {
    id: "aria-hidden-focus",
    title: u(f["aria-hidden-focus"].title),
    description: u(f["aria-hidden-focus"].description),
    score: s === 0 ? 1 : 0,
    weight: 7,
    value: s > 0 ? `${s} ${e ? "处违规" : "violation(s)"}` : void 0
  };
}
function Bt() {
  const s = ["textbox", "combobox", "searchbox", "spinbutton", "slider"];
  let e = 0;
  s.forEach((n) => {
    document.querySelectorAll(`[role="${n}"]`).forEach((i) => {
      X(i) || e++;
    });
  });
  const t = w();
  return {
    id: "aria-input-field-name",
    title: u(f["aria-input-field-name"].title),
    description: u(f["aria-input-field-name"].description),
    score: e === 0 ? 1 : 0,
    weight: 7,
    value: e > 0 ? `${e} ${t ? "个字段无名称" : "field(s) without name"}` : void 0
  };
}
function Mt() {
  const s = ["checkbox", "radio", "switch"];
  let e = 0;
  s.forEach((n) => {
    document.querySelectorAll(`[role="${n}"]`).forEach((i) => {
      X(i) || e++;
    });
  });
  const t = w();
  return {
    id: "aria-toggle-field-name",
    title: u(f["aria-toggle-field-name"].title),
    description: u(f["aria-toggle-field-name"].description),
    score: e === 0 ? 1 : 0,
    weight: 7,
    value: e > 0 ? `${e} ${t ? "个字段无名称" : "field(s) without name"}` : void 0
  };
}
function zt() {
  const s = document.querySelector('main, [role="main"], header, [role="banner"], footer, [role="contentinfo"], nav, [role="navigation"], aside, [role="complementary"]'), e = document.querySelector('a[href^="#"]'), t = !!s || !!e;
  return {
    id: "bypass",
    title: u(f.bypass.title),
    description: u(f.bypass.description),
    score: t ? 1 : 0,
    weight: 7
  };
}
function qt() {
  let s = 0;
  document.querySelectorAll("p, span, a, li, td, th, label, h1, h2, h3, h4, h5, h6, div, button").forEach((n) => {
    var c;
    if (!(n instanceof HTMLElement) || !((c = n.textContent) == null ? void 0 : c.trim())) return;
    const o = getComputedStyle(n), a = o.color, r = o.backgroundColor;
    if (!a || !r || a.includes("transparent") || r.includes("transparent") || a.includes("rgba(0, 0, 0, 0)") || r.includes("rgba(0, 0, 0, 0)")) return;
    ht(a, r) === !1 && s++;
  });
  const t = w();
  return {
    id: "color-contrast",
    title: u(f["color-contrast"].title),
    description: u(f["color-contrast"].description),
    score: s === 0 ? 1 : 0,
    weight: 7,
    value: s > 0 ? `${s} ${t ? "个元素对比度不足" : "element(s) with low contrast"}` : void 0
  };
}
function Ot() {
  var e;
  const s = (e = document.title) == null ? void 0 : e.trim();
  return {
    id: "document-title",
    title: u(f["document-title"].title),
    description: u(f["document-title"].description),
    score: s ? 1 : 0,
    weight: 7
  };
}
function Ht() {
  const s = document.querySelectorAll("iframe");
  if (s.length === 0) return null;
  let e = 0;
  s.forEach((n) => {
    var o;
    ((o = n.getAttribute("title")) == null ? void 0 : o.trim()) || e++;
  });
  const t = w();
  return {
    id: "frame-title",
    title: u(f["frame-title"].title),
    description: u(f["frame-title"].description),
    score: e === 0 ? 1 : 0,
    weight: 7,
    value: e > 0 ? `${e} ${t ? "个框架无标题" : "frame(s) without title"}` : void 0
  };
}
function _t() {
  const s = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
  if (s.length === 0) return null;
  let e = 0, t = 0;
  s.forEach((i) => {
    const o = parseInt(i.tagName[1]);
    t > 0 && o > t + 1 && e++, t = o;
  });
  const n = w();
  return {
    id: "heading-order",
    title: u(f["heading-order"].title),
    description: u(f["heading-order"].description),
    score: e === 0 ? 1 : 0,
    weight: 7,
    value: e > 0 ? `${e} ${n ? "处跳级" : "skipped level(s)"}` : void 0
  };
}
function Nt() {
  var t;
  const e = (t = document.documentElement.getAttribute("lang")) == null ? void 0 : t.trim();
  return {
    id: "html-has-lang",
    title: u(f["html-has-lang"].title),
    description: u(f["html-has-lang"].description),
    score: e ? 1 : 0,
    weight: 7
  };
}
function jt() {
  var e;
  const s = (e = document.documentElement.getAttribute("lang")) == null ? void 0 : e.trim();
  return s ? {
    id: "html-lang-valid",
    title: u(f["html-lang-valid"].title),
    description: u(f["html-lang-valid"].description),
    score: ye(s) ? 1 : 0,
    weight: 7,
    value: `lang="${s}"`
  } : null;
}
function Ft() {
  const s = document.querySelectorAll("a[href]");
  if (s.length === 0) return null;
  let e = 0;
  s.forEach((n) => {
    X(n) || e++;
  });
  const t = w();
  return {
    id: "link-name",
    title: u(f["link-name"].title),
    description: u(f["link-name"].description),
    score: e === 0 ? 1 : 0,
    weight: 7,
    value: e > 0 ? `${e} ${t ? "个链接无名称" : "link(s) without name"}` : void 0
  };
}
function Ut() {
  const s = document.querySelectorAll("ul, ol");
  if (s.length === 0) return null;
  let e = 0;
  s.forEach((n) => {
    Array.from(n.children).forEach((i) => {
      const o = i.tagName.toLowerCase();
      o !== "li" && o !== "script" && o !== "template" && e++;
    });
  });
  const t = w();
  return {
    id: "list",
    title: u(f.list.title),
    description: u(f.list.description),
    score: e === 0 ? 1 : 0,
    weight: 7,
    value: e > 0 ? `${e} ${t ? "个非法子元素" : "invalid child(ren)"}` : void 0
  };
}
function Xt() {
  const s = document.querySelectorAll("li");
  if (s.length === 0) return null;
  let e = 0;
  s.forEach((n) => {
    var o;
    const i = (o = n.parentElement) == null ? void 0 : o.tagName.toLowerCase();
    i !== "ul" && i !== "ol" && i !== "menu" && e++;
  });
  const t = w();
  return {
    id: "listitem",
    title: u(f.listitem.title),
    description: u(f.listitem.description),
    score: e === 0 ? 1 : 0,
    weight: 7,
    value: e > 0 ? `${e} ${t ? "个孤立 <li>" : "orphan <li>(s)"}` : void 0
  };
}
function Wt() {
  const s = document.querySelectorAll("dl");
  if (s.length === 0) return null;
  let e = 0;
  s.forEach((n) => {
    Array.from(n.children).forEach((i) => {
      const o = i.tagName.toLowerCase();
      o !== "dt" && o !== "dd" && o !== "script" && o !== "template" && o !== "div" && e++;
    });
  });
  const t = w();
  return {
    id: "definition-list",
    title: u(f["definition-list"].title),
    description: u(f["definition-list"].description),
    score: e === 0 ? 1 : 0,
    weight: 7,
    value: e > 0 ? `${e} ${t ? "个非法子元素" : "invalid child(ren)"}` : void 0
  };
}
function Zt() {
  const s = document.querySelectorAll("dt, dd");
  if (s.length === 0) return null;
  let e = 0;
  s.forEach((n) => {
    var i;
    ((i = n.parentElement) == null ? void 0 : i.tagName.toLowerCase()) !== "dl" && e++;
  });
  const t = w();
  return {
    id: "dlitem",
    title: u(f.dlitem.title),
    description: u(f.dlitem.description),
    score: e === 0 ? 1 : 0,
    weight: 7,
    value: e > 0 ? `${e} ${t ? "个孤立项" : "orphan item(s)"}` : void 0
  };
}
function Vt() {
  const s = document.querySelectorAll("[tabindex]");
  let e = 0;
  s.forEach((n) => {
    parseInt(n.getAttribute("tabindex")) > 0 && e++;
  });
  const t = w();
  return {
    id: "tabindex",
    title: u(f.tabindex.title),
    description: u(f.tabindex.description),
    score: e === 0 ? 1 : 0,
    weight: 7,
    value: e > 0 ? `${e} ${t ? "个元素 tabindex > 0" : "element(s) with tabindex > 0"}` : void 0
  };
}
function Gt() {
  const s = document.querySelectorAll("object");
  if (s.length === 0) return null;
  let e = 0;
  s.forEach((n) => {
    var a, r;
    const i = (a = n.getAttribute("title")) == null ? void 0 : a.trim(), o = (r = n.getAttribute("aria-label")) == null ? void 0 : r.trim();
    !i && !o && e++;
  });
  const t = w();
  return {
    id: "object-alt",
    title: u(f["object-alt"].title),
    description: u(f["object-alt"].description),
    score: e === 0 ? 1 : 0,
    weight: 7,
    value: e > 0 ? `${e} ${t ? "个 object 无替代文本" : "object(s) without alt text"}` : void 0
  };
}
function Jt() {
  const s = document.querySelectorAll("input, select, textarea");
  if (s.length === 0) return null;
  let e = 0;
  s.forEach((n) => {
    const i = n.id;
    if (!i) return;
    document.querySelectorAll(`label[for="${CSS.escape(i)}"]`).length > 1 && e++;
  });
  const t = w();
  return {
    id: "form-field-multiple-labels",
    title: u(f["form-field-multiple-labels"].title),
    description: u(f["form-field-multiple-labels"].description),
    score: e === 0 ? 1 : 0,
    weight: 3,
    value: e > 0 ? `${e} ${t ? "个字段有多标签" : "field(s) with multiple labels"}` : void 0
  };
}
function Kt() {
  let s = 0;
  document.querySelectorAll("[lang]").forEach((t) => {
    const n = t.getAttribute("lang");
    ye(n) || s++;
  });
  const e = w();
  return {
    id: "valid-lang",
    title: u(f["valid-lang"].title),
    description: u(f["valid-lang"].description),
    score: s === 0 ? 1 : 0,
    weight: 3,
    value: s > 0 ? `${s} ${e ? "个无效 lang" : "invalid lang(s)"}` : void 0
  };
}
function Qt() {
  const s = document.querySelector('a[href^="#"]');
  if (!s) return null;
  const e = s.getAttribute("href").slice(1);
  if (!e) return null;
  const t = w(), n = document.getElementById(e);
  if (!n)
    return {
      id: "skip-link-focusable",
      title: u(f["skip-link-focusable"].title),
      description: u(f["skip-link-focusable"].description),
      score: 0,
      weight: 3,
      value: t ? `目标 #${e} 未找到` : `target #${e} not found`
    };
  const o = n.getAttribute("tabindex") !== "-1";
  return {
    id: "skip-link-focusable",
    title: u(f["skip-link-focusable"].title),
    description: u(f["skip-link-focusable"].description),
    score: o ? 1 : 0,
    weight: 3
  };
}
function Yt() {
  const s = document.querySelector('main, [role="main"]');
  return {
    id: "document-has-main-landmark",
    title: u(f["document-has-main-landmark"].title),
    description: u(f["document-has-main-landmark"].description),
    score: s ? 1 : 0,
    weight: 3
  };
}
function en() {
  const s = document.querySelectorAll("th");
  if (s.length === 0) return null;
  let e = 0;
  s.forEach((n) => {
    const i = n.closest("table");
    if (!i) return;
    i.querySelectorAll("td").length === 0 && e++;
  });
  const t = w();
  return {
    id: "th-has-data-cells",
    title: u(f["th-has-data-cells"].title),
    description: u(f["th-has-data-cells"].description),
    score: e === 0 ? 1 : 0,
    weight: 3,
    value: e > 0 ? `${e} ${t ? "个表格无数据单元格" : "table(s) without data cells"}` : void 0
  };
}
function tn() {
  const s = [
    // Weight 10 — Critical (16)
    gt,
    bt,
    yt,
    wt,
    vt,
    St,
    kt,
    Ct,
    Rt,
    It,
    At,
    Et,
    xt,
    Tt,
    Lt,
    Dt,
    // Weight 7 — Serious (18)
    $t,
    Pt,
    Bt,
    Mt,
    zt,
    qt,
    Ot,
    Ht,
    _t,
    Nt,
    jt,
    Ft,
    Ut,
    Xt,
    Wt,
    Zt,
    Vt,
    Gt,
    // Weight 3 — Minor (5)
    Jt,
    Kt,
    Qt,
    Yt,
    en
  ], e = [];
  for (const a of s) {
    const r = a();
    r && e.push(r);
  }
  const t = e.filter((a) => a.score !== null), n = t.reduce((a, r) => a + r.weight, 0), i = t.filter((a) => a.score === 1).reduce((a, r) => a + r.weight, 0);
  return { id: "accessibility", title: "Accessibility", score: n > 0 ? Math.round(i / n * 100) : 0, audits: e };
}
const E = {
  "bp-is-on-https": {
    title: { zh: "使用 HTTPS", en: "Uses HTTPS" },
    description: { zh: "HTTPS 提供安全的数据传输", en: "HTTPS provides secure data transfer" }
  },
  "bp-console-errors": {
    title: { zh: "无控制台错误", en: "No Console Errors" },
    description: { zh: "控制台错误可能影响页面功能", en: "Console errors may affect page functionality" }
  },
  "bp-no-document-write": {
    title: { zh: "无 document.write", en: "No document.write" },
    description: { zh: "document.write 会阻塞页面解析", en: "document.write blocks page parsing" }
  },
  "bp-no-vulnerable-libraries": {
    title: { zh: "无已知漏洞 JS 库", en: "No Vulnerable JS Libraries" },
    description: { zh: "检测已知安全漏洞的 JavaScript 库", en: "Detects JavaScript libraries with known vulnerabilities" }
  },
  "bp-no-deprecated-apis": {
    title: { zh: "无废弃 API", en: "No Deprecated APIs" },
    description: { zh: "废弃 API 可能被移除", en: "Deprecated APIs may be removed" }
  },
  "bp-password-inputs-paste": {
    title: { zh: "密码输入允许粘贴", en: "Password Fields Allow Paste" },
    description: { zh: "阻止粘贴降低安全性", en: "Preventing paste undermines security" }
  },
  "bp-notification-permission": {
    title: { zh: "通知权限未滥用", en: "Notification Permission Not Abused" },
    description: { zh: "非用户手势触发的通知请求会打扰用户", en: "Non-gesture permission requests disturb users" }
  },
  "bp-geolocation-permission": {
    title: { zh: "地理位置权限未滥用", en: "Geolocation Permission Not Abused" },
    description: { zh: "非用户手势触发的定位请求会打扰用户", en: "Non-gesture geolocation requests disturb users" }
  }
};
function nn(s) {
  const e = [
    // 1. bp-is-on-https
    {
      id: "bp-is-on-https",
      title: u(E["bp-is-on-https"].title),
      description: u(E["bp-is-on-https"].description),
      score: typeof location < "u" && (location.protocol === "https:" || location.hostname === "localhost") ? 1 : 0,
      weight: 1,
      value: typeof location < "u" && (location.protocol === "https:" || location.hostname === "localhost") ? "HTTPS" : location.protocol
    },
    // 2. bp-console-errors
    {
      id: "bp-console-errors",
      title: u(E["bp-console-errors"].title),
      description: u(E["bp-console-errors"].description),
      score: s.consoleErrorCount === 0 ? 1 : 0,
      weight: 1,
      value: s.consoleErrorCount > 0 ? `${s.consoleErrorCount} ${w() ? "个错误" : "error(s)"}` : void 0
    },
    // 3. bp-no-document-write
    {
      id: "bp-no-document-write",
      title: u(E["bp-no-document-write"].title),
      description: u(E["bp-no-document-write"].description),
      score: s.documentWriteCount === 0 ? 1 : 0,
      weight: 1,
      value: s.documentWriteCount === 0 ? w() ? "未使用" : "Not used" : `${w() ? "调用了" : "Called"} ${s.documentWriteCount} ${w() ? "次" : "time(s)"}`
    },
    // 4. bp-no-vulnerable-libraries
    sn(),
    // 5. bp-no-deprecated-apis
    {
      id: "bp-no-deprecated-apis",
      title: u(E["bp-no-deprecated-apis"].title),
      description: u(E["bp-no-deprecated-apis"].description),
      score: s.deprecatedApiCalls.length === 0 ? 1 : 0,
      weight: 1,
      value: s.deprecatedApiCalls.length === 0 ? w() ? "未使用" : "Not used" : `${w() ? "调用了" : "Called"} ${s.deprecatedApiCalls.join(", ")}`,
      details: s.deprecatedApiCalls.length > 0 ? { calls: s.deprecatedApiCalls } : void 0
    },
    // 6. bp-password-inputs-paste
    on(),
    // 7. bp-notification-permission
    {
      id: "bp-notification-permission",
      title: u(E["bp-notification-permission"].title),
      description: u(E["bp-notification-permission"].description),
      score: s.notificationRequestedWithoutGesture ? 0 : 1,
      weight: 1,
      value: s.notificationRequestedWithoutGesture ? w() ? "检测到非用户手势请求" : "Non-gesture request detected" : w() ? "正常" : "Normal"
    },
    // 8. bp-geolocation-permission
    {
      id: "bp-geolocation-permission",
      title: u(E["bp-geolocation-permission"].title),
      description: u(E["bp-geolocation-permission"].description),
      score: s.geolocationRequestedWithoutGesture ? 0 : 1,
      weight: 1,
      value: s.geolocationRequestedWithoutGesture ? w() ? "检测到非用户手势请求" : "Non-gesture request detected" : w() ? "正常" : "Normal"
    }
  ], t = e.filter((o) => o.score !== null), n = t.filter((o) => o.score === 1).length;
  return {
    id: "best-practices",
    title: "Best Practices",
    score: t.length > 0 ? Math.round(n / t.length * 100) : 0,
    audits: e
  };
}
function sn() {
  const s = w(), e = [], t = Array.from(document.querySelectorAll("script[src]"));
  for (const n of t) {
    const i = n.getAttribute("src") ?? "";
    for (const o of ft) {
      const a = i.match(o.pattern);
      if (a) {
        const r = a[1];
        mt(r, o.minSafe) && e.push({
          library: o.name,
          version: r,
          minSafe: o.minSafe
        });
      }
    }
  }
  return {
    id: "bp-no-vulnerable-libraries",
    title: u(E["bp-no-vulnerable-libraries"].title),
    description: u(E["bp-no-vulnerable-libraries"].description),
    score: e.length === 0 ? 1 : 0,
    weight: 1,
    value: e.length === 0 ? s ? "未检测到漏洞库" : "No vulnerable libraries detected" : `${e.length} ${s ? "个漏洞库" : "vulnerable librarie(s)"}`,
    details: e.length > 0 ? { vulnerabilities: e } : void 0
  };
}
function on() {
  const s = w(), e = document.querySelectorAll(
    'input[type="password"]'
  );
  if (e.length === 0)
    return {
      id: "bp-password-inputs-paste",
      title: u(E["bp-password-inputs-paste"].title),
      description: u(E["bp-password-inputs-paste"].description),
      score: null,
      // notApplicable
      weight: 1
    };
  const t = [];
  for (const n of Array.from(e)) {
    const i = n.getAttribute("onpaste");
    if (i !== null && /return\s+false/i.test(i)) {
      t.push(n);
      continue;
    }
    const o = n.getAttribute("style") ?? "";
    o && /user-select\s*:\s*none/i.test(o) && t.push(n);
  }
  return {
    id: "bp-password-inputs-paste",
    title: u(E["bp-password-inputs-paste"].title),
    description: u(E["bp-password-inputs-paste"].description),
    score: t.length === 0 ? 1 : 0,
    weight: 1,
    value: t.length === 0 ? s ? "允许粘贴" : "Paste allowed" : `${t.length} ${s ? "个密码框阻止粘贴" : "password field(s) block paste"}`,
    details: t.length > 0 ? {
      note: "Only inline styles and onpaste attributes are checked; external CSS rules are not detected.",
      blockedCount: t.length
    } : void 0
  };
}
const x = {
  "seo-document-title": {
    title: { zh: "页面标题", en: "Document Title" },
    description: { zh: "标题应存在且长度 10-60 字符", en: "Title should exist and be 10-60 characters" }
  },
  "seo-meta-description": {
    title: { zh: "Meta 描述", en: "Meta Description" },
    description: { zh: "描述应存在且长度 50-160 字符", en: "Description should exist and be 50-160 characters" }
  },
  "seo-http-status-code": {
    title: { zh: "HTTP 状态码", en: "HTTP Status Code" },
    description: { zh: "页面应返回成功状态码", en: "Page should return a successful status code" }
  },
  "seo-link-text": {
    title: { zh: "链接文本", en: "Link Text" },
    description: { zh: "链接文本应清晰描述目标", en: "Link text should clearly describe the target" }
  },
  "seo-meta-viewport": {
    title: { zh: "Viewport 配置", en: "Meta Viewport" },
    description: { zh: "应设置 width=device-width", en: "Should include width=device-width" }
  },
  "seo-crawlable-anchors": {
    title: { zh: "可爬取链接", en: "Crawlable Anchors" },
    description: { zh: "链接应有有效的 href 属性", en: "Links should have valid href attributes" }
  },
  "seo-hreflang": {
    title: { zh: "Hreflang 标签", en: "Hreflang Tags" },
    description: { zh: "hreflang 值应为合法 BCP 47", en: "hreflang values should be valid BCP 47" }
  },
  "seo-canonical": {
    title: { zh: "Canonical URL", en: "Canonical URL" },
    description: { zh: "canonical URL 应为合法 URL", en: "canonical URL should be a valid URL" }
  },
  "seo-robots-meta": {
    title: { zh: "Robots Meta", en: "Robots Meta" },
    description: { zh: "页面应允许搜索引擎索引", en: "Page should allow search engine indexing" }
  },
  "seo-structured-data": {
    title: { zh: "结构化数据", en: "Structured Data" },
    description: { zh: "结构化数据帮助搜索引擎理解页面", en: "Structured data helps search engines understand the page" }
  }
};
function T(s, e, t, n, i) {
  return { id: s, title: e, description: t, score: n, weight: 1, ...i ? { details: i } : {} };
}
function rn() {
  var o, a;
  const s = [], e = w();
  {
    const r = document.title ?? "", l = r.trim().length, c = l >= 10 && l <= 60;
    s.push(
      T(
        "seo-document-title",
        u(x["seo-document-title"].title),
        e ? `标题应为 10-60 字符，当前 ${l} 字符` : `Title should be 10-60 characters. Current: ${l} characters.`,
        c ? 1 : 0,
        { value: r, length: l }
      )
    );
  }
  {
    const r = document.querySelector('meta[name="description"]'), l = (r == null ? void 0 : r.getAttribute("content")) ?? "", c = l.trim().length, d = c >= 50 && c <= 160;
    s.push(
      T(
        "seo-meta-description",
        u(x["seo-meta-description"].title),
        e ? `描述应为 50-160 字符，当前 ${c} 字符` : `Meta description should be 50-160 characters. Current: ${c} characters.`,
        d ? 1 : 0,
        { value: l, length: c }
      )
    );
  }
  {
    let r = !0;
    try {
      const c = (o = performance.getEntriesByType("navigation")[0]) == null ? void 0 : o.responseStatus;
      c !== void 0 ? (r = c >= 200 && c <= 399, s.push(
        T(
          "seo-http-status-code",
          u(x["seo-http-status-code"].title),
          e ? `HTTP 状态码 ${c}，期望 200-399` : `HTTP status ${c}. Expected 200-399.`,
          r ? 1 : 0,
          { statusCode: c }
        )
      )) : s.push(
        T(
          "seo-http-status-code",
          u(x["seo-http-status-code"].title),
          e ? "Navigation API 不可用，因页面 JS 正在执行，假定状态码 200" : "Navigation API unavailable; assumed 200 because JS is executing.",
          1
        )
      );
    } catch {
      s.push(
        T(
          "seo-http-status-code",
          u(x["seo-http-status-code"].title),
          e ? "Navigation API 不可用，因页面 JS 正在执行，假定状态码 200" : "Navigation API unavailable; assumed 200 because JS is executing.",
          1
        )
      );
    }
  }
  {
    const r = Array.from(document.querySelectorAll("a[href]")), l = [];
    let c = !0;
    for (const d of r) {
      const p = ((a = d.textContent) == null ? void 0 : a.trim().toLowerCase()) ?? "";
      p && pt.has(p) && (c = !1, l.push(p));
    }
    s.push(
      T(
        "seo-link-text",
        u(x["seo-link-text"].title),
        l.length > 0 ? e ? `发现 ${l.length} 个模糊链接文本：${l.slice(0, 5).join(", ")}` : `Found ${l.length} link(s) with vague text: ${l.slice(0, 5).join(", ")}` : e ? "所有链接文本均清晰描述" : "All links have descriptive text.",
        c ? 1 : 0,
        { vagueCount: l.length, examples: l.slice(0, 5) }
      )
    );
  }
  {
    const r = document.querySelector('meta[name="viewport"]'), l = (r == null ? void 0 : r.getAttribute("content")) ?? "", c = /width\s*=\s*device-width/i.test(l);
    s.push(
      T(
        "seo-meta-viewport",
        u(x["seo-meta-viewport"].title),
        c ? e ? "Viewport 标签已包含 width=device-width" : "Viewport meta tag includes width=device-width." : e ? "Viewport 标签缺失或未包含 width=device-width" : "Viewport meta tag is missing or does not include width=device-width.",
        c ? 1 : 0,
        { content: l }
      )
    );
  }
  {
    const r = Array.from(document.querySelectorAll("a")), l = [];
    let c = !0;
    for (const d of r) {
      const p = d.getAttribute("href");
      (!p || p.trim() === "" || p.startsWith("javascript:")) && (c = !1, l.push(p ?? "(empty)"));
    }
    s.push(
      T(
        "seo-crawlable-anchors",
        u(x["seo-crawlable-anchors"].title),
        l.length > 0 ? e ? `发现 ${l.length} 个不可爬取的链接` : `Found ${l.length} non-crawlable anchor(s).` : e ? "所有链接均可爬取" : "All anchors are crawlable.",
        c ? 1 : 0,
        { nonCrawlableCount: l.length, examples: l.slice(0, 5) }
      )
    );
  }
  {
    const r = Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]'));
    if (r.length === 0)
      s.push(
        T(
          "seo-hreflang",
          u(x["seo-hreflang"].title),
          e ? "未发现 hreflang 标签" : "No hreflang tags found.",
          null
          // notApplicable
        )
      );
    else {
      let l = !0;
      const c = [];
      for (const d of r) {
        const p = d.getAttribute("hreflang") ?? "";
        p !== "x-default" && (/^[a-zA-Z]{2,3}(-[a-zA-Z]{2,8})*$/.test(p) || (l = !1, c.push(p)));
      }
      s.push(
        T(
          "seo-hreflang",
          u(x["seo-hreflang"].title),
          c.length > 0 ? e ? `无效的 hreflang 值：${c.join(", ")}` : `Invalid hreflang value(s): ${c.join(", ")}` : e ? "所有 hreflang 值均为合法 BCP 47" : "All hreflang values are valid BCP 47.",
          l ? 1 : 0,
          { total: r.length, invalidValues: c }
        )
      );
    }
  }
  {
    const r = document.querySelector('link[rel="canonical"]');
    if (!r)
      s.push(
        T(
          "seo-canonical",
          u(x["seo-canonical"].title),
          e ? "未发现 canonical 链接" : "No canonical link found.",
          null
          // notApplicable
        )
      );
    else {
      const l = r.getAttribute("href") ?? "";
      let c = !1;
      try {
        new URL(l, document.baseURI), c = !0;
      } catch {
        c = !1;
      }
      s.push(
        T(
          "seo-canonical",
          u(x["seo-canonical"].title),
          c ? e ? "Canonical URL 合法" : "Canonical URL is valid." : e ? `Canonical URL 无效：${l}` : `Canonical URL is invalid: ${l}`,
          c ? 1 : 0,
          { href: l }
        )
      );
    }
  }
  {
    const r = document.querySelector('meta[name="robots"]');
    if (!r)
      s.push(
        T(
          "seo-robots-meta",
          u(x["seo-robots-meta"].title),
          e ? "未发现 robots meta 标签，页面默认可被索引" : "No robots meta tag found; page is indexable by default.",
          1
        )
      );
    else {
      const l = r.getAttribute("content") ?? "", c = !l.toLowerCase().includes("noindex");
      s.push(
        T(
          "seo-robots-meta",
          u(x["seo-robots-meta"].title),
          c ? e ? "Robots meta 标签不包含 noindex" : "Robots meta tag does not contain noindex." : e ? "Robots meta 标签包含 noindex，页面可能不被索引" : "Robots meta tag contains noindex, page may not be indexed.",
          c ? 1 : 0,
          { content: l }
        )
      );
    }
  }
  {
    const r = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    if (r.length === 0)
      s.push(
        T(
          "seo-structured-data",
          u(x["seo-structured-data"].title),
          e ? "未发现结构化数据（JSON-LD）" : "No structured data (JSON-LD) found.",
          null
          // notApplicable
        )
      );
    else {
      let l = !0, c = 0;
      for (const d of r)
        try {
          JSON.parse(d.textContent ?? "");
        } catch {
          l = !1, c++;
        }
      s.push(
        T(
          "seo-structured-data",
          u(x["seo-structured-data"].title),
          l ? e ? `全部 ${r.length} 个 JSON-LD 脚本解析成功` : `All ${r.length} JSON-LD script(s) parsed successfully.` : e ? `${c}/${r.length} 个 JSON-LD 脚本解析失败` : `${c} of ${r.length} JSON-LD script(s) failed to parse.`,
          l ? 1 : 0,
          { total: r.length, parseErrors: c }
        )
      );
    }
  }
  const t = s.filter((r) => r.score !== null), n = t.filter((r) => r.score === 1).length;
  return {
    id: "seo",
    title: "SEO",
    score: t.length > 0 ? Math.round(n / t.length * 100) : 0,
    audits: s
  };
}
let D, ce = !1;
function an() {
  return D;
}
function we() {
  D = {
    documentWriteCount: 0,
    consoleErrorCount: 0,
    deprecatedApiCalls: [],
    notificationRequestedWithoutGesture: !1,
    geolocationRequestedWithoutGesture: !1
  };
}
function ln() {
  var s;
  if (!ce) {
    we();
    try {
      const e = document.write.bind(document), t = document.writeln.bind(document);
      document.write = function(...n) {
        return D.documentWriteCount++, e(...n);
      }, document.writeln = function(...n) {
        return D.documentWriteCount++, t(...n);
      };
    } catch {
    }
    window.addEventListener("error", () => {
      D.consoleErrorCount++;
    }), window.addEventListener("unhandledrejection", () => {
      D.consoleErrorCount++;
    });
    try {
      const e = document.execCommand.bind(document);
      document.execCommand = function(t, ...n) {
        return D.deprecatedApiCalls.push(`document.execCommand("${t}")`), e(t, ...n);
      };
    } catch {
    }
    try {
      if (typeof Notification < "u" && Notification.requestPermission) {
        const e = Notification.requestPermission.bind(Notification);
        let t = !1;
        const n = () => {
          t = !0;
        };
        document.addEventListener("click", n, !0), document.addEventListener("keydown", n, !0), document.addEventListener("pointerdown", n, !0), Notification.requestPermission = function(...i) {
          return t || (D.notificationRequestedWithoutGesture = !0), t = !1, e(...i);
        };
      }
    } catch {
    }
    try {
      if ((s = navigator.geolocation) != null && s.getCurrentPosition) {
        const e = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
        let t = !1;
        const n = () => {
          t = !0;
        };
        document.addEventListener("click", n, !0), document.addEventListener("keydown", n, !0), navigator.geolocation.getCurrentPosition = function(i, o, a) {
          return t || (D.geolocationRequestedWithoutGesture = !0), t = !1, e(i, o, a);
        };
      }
    } catch {
    }
    ce = !0;
  }
}
function q(s) {
  return s >= 75 ? "good" : s >= 50 ? "needs-improvement" : "poor";
}
function cn() {
  const s = document.querySelectorAll("*"), e = s.length;
  let t = 0;
  function n(a, r) {
    if (r > t && (t = r), !(r > 50))
      for (let l = 0; l < a.children.length && l < 100; l++)
        n(a.children[l], r + 1);
  }
  n(document.documentElement, 0);
  let i = 0;
  s.forEach((a) => {
    a.children.length > i && (i = a.children.length);
  });
  let o;
  return e <= 800 ? o = 100 : e <= 1500 ? o = 75 : e <= 3e3 ? o = 50 : o = Math.max(0, 100 - Math.floor(e / 100)), {
    id: "dom-size",
    title: "DOM 规模",
    score: o,
    rating: q(o),
    value: `${e} 个元素, 深度 ${t}, 最大宽度 ${i}`,
    details: { totalElements: e, maxDepth: t, maxWidth: i }
  };
}
function un() {
  const s = [];
  document.querySelectorAll("script[src]").forEach((n) => {
    const i = n;
    !i.async && !i.defer && i.type !== "module" && s.push({ tag: "script", url: i.src });
  }), document.querySelectorAll('link[rel="stylesheet"]').forEach((n) => {
    const i = n;
    i.media !== "print" && !i.disabled && s.push({ tag: "link/css", url: i.href });
  });
  const e = s.length;
  let t;
  return e === 0 ? t = 100 : e <= 2 ? t = 75 : e <= 5 ? t = 50 : t = Math.max(10, 100 - e * 10), {
    id: "render-blocking",
    title: "渲染阻塞资源",
    score: t,
    rating: q(t),
    value: e === 0 ? "无阻塞资源" : `${e} 个渲染阻塞资源`,
    details: { count: e, resources: s.slice(0, 10) }
  };
}
function dn() {
  const s = [];
  document.querySelectorAll("img").forEach((n) => {
    const i = n;
    if (!i.src || i.src.startsWith("data:")) return;
    if (i.naturalWidth > 0 && i.width > 0 && i.naturalWidth * i.naturalHeight / (i.width * i.height) > 4 && s.push({
      src: i.src.slice(0, 100),
      problem: "oversized",
      naturalSize: `${i.naturalWidth}x${i.naturalHeight}`,
      displaySize: `${i.width}x${i.height}`
    }), i.getBoundingClientRect().top > window.innerHeight * 1.5 && i.loading !== "lazy" && s.push({
      src: i.src.slice(0, 100),
      problem: "missing-lazy-load"
    }), !i.hasAttribute("width") && !i.hasAttribute("height") && !i.style.width && !i.style.height) {
      const a = getComputedStyle(i);
      (a.width === "auto" || a.height === "auto") && s.push({
        src: i.src.slice(0, 100),
        problem: "missing-dimensions"
      });
    }
  });
  const e = s.length;
  let t;
  return e === 0 ? t = 100 : e <= 2 ? t = 75 : e <= 5 ? t = 50 : t = Math.max(10, 100 - e * 8), {
    id: "image-optimization",
    title: "图片优化",
    score: t,
    rating: q(t),
    value: e === 0 ? "图片优化良好" : `${e} 张图片存在优化空间`,
    details: { count: e, issues: s.slice(0, 10) }
  };
}
function hn() {
  const s = performance.getEntriesByType("resource");
  let e = 0;
  const t = [];
  for (const a of s) {
    const r = Math.round(a.transferSize / 1024);
    e += r, a.transferSize > 100 * 1024 && t.push({
      url: a.name.slice(0, 100),
      sizeKB: r,
      type: a.initiatorType
    });
  }
  const n = {};
  for (const a of s) {
    const r = a.initiatorType || "other";
    n[r] = (n[r] || 0) + Math.round(a.transferSize / 1024);
  }
  const i = t.length;
  let o;
  return e <= 500 ? o = 100 : e <= 1500 ? o = 75 : e <= 3e3 ? o = 50 : o = Math.max(10, 100 - Math.floor(e / 100)), {
    id: "resource-size",
    title: "资源体积",
    score: o,
    rating: q(o),
    value: `总传输 ${e}KB, ${i} 个大资源(>100KB)`,
    details: { totalTransferKB: e, largeCount: i, byType: n, largeResources: t.slice(0, 10) }
  };
}
function pn() {
  const s = performance.getEntriesByType("resource"), e = [];
  for (const i of s)
    i.transferSize > 1024 && i.decodedBodySize > 0 && i.transferSize / i.decodedBodySize > 0.9 && i.decodedBodySize > 10 * 1024 && e.push({
      url: i.name.slice(0, 100),
      transferKB: Math.round(i.transferSize / 1024),
      decodedKB: Math.round(i.decodedBodySize / 1024)
    });
  const t = e.length;
  let n;
  return t === 0 ? n = 100 : t <= 2 ? n = 70 : t <= 5 ? n = 45 : n = Math.max(10, 100 - t * 10), {
    id: "compression",
    title: "资源压缩",
    score: n,
    rating: q(n),
    value: t === 0 ? "所有资源已压缩" : `${t} 个资源未开启 gzip/br 压缩`,
    details: { count: t, resources: e.slice(0, 10) }
  };
}
function fn() {
  const e = performance.getEntriesByType("resource").filter(
    (r) => r.initiatorType === "css" && /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(r.name)
  ), t = [], n = e.filter((r) => r.transferSize > 100 * 1024);
  n.length > 0 && t.push(`${n.length} 个字体文件 >100KB`);
  let i = 0;
  try {
    for (const r of Array.from(document.styleSheets))
      try {
        for (const l of Array.from(r.cssRules || []))
          if (l instanceof CSSFontFaceRule) {
            const c = l.style.getPropertyValue("font-display");
            (!c || c === "auto") && i++;
          }
      } catch {
      }
  } catch {
  }
  i > 0 && t.push(`${i} 个 @font-face 缺少 font-display: swap`);
  const o = n.length + i;
  let a;
  return o === 0 ? a = 100 : o <= 2 ? a = 70 : a = Math.max(20, 100 - o * 15), {
    id: "font-loading",
    title: "字体加载",
    score: a,
    rating: q(a),
    value: o === 0 ? "字体加载良好" : t.join("; "),
    details: { fontCount: e.length, largeFonts: n.length, missingFontDisplay: i }
  };
}
function mn() {
  const s = [
    cn(),
    un(),
    dn(),
    hn(),
    pn(),
    fn()
  ], e = {
    good: s.filter((t) => t.rating === "good").length,
    warning: s.filter((t) => t.rating === "needs-improvement").length,
    poor: s.filter((t) => t.rating === "poor").length
  };
  return {
    timestamp: Date.now(),
    url: location.href,
    audits: s,
    summary: e
  };
}
function gn() {
  const s = an(), e = mn(), t = [
    tn(),
    nn(s),
    rn()
    // Performance 类别的分数由服务端 log-normal 计算，这里不重复
  ];
  return we(), {
    timestamp: Date.now(),
    url: location.href,
    userAgent: navigator.userAgent,
    categories: t,
    performanceDiagnostics: e.audits
  };
}
const ue = {
  none: { latency: 0, downloadKbps: 1 / 0 },
  "3g": { latency: 300, downloadKbps: 750 },
  "2g": { latency: 600, downloadKbps: 250 },
  offline: { latency: 0, downloadKbps: 0 }
};
class bn {
  constructor() {
    this.preset = "none", this.originalFetch = null, this.originalXHROpen = null, this.originalXHRSend = null, this.active = !1;
  }
  setPreset(e) {
    this.preset = e, e === "none" ? this.stop() : this.active || this.start();
  }
  start() {
    this.active || typeof window > "u" || (this.active = !0, this.patchFetch(), this.patchXHR());
  }
  patchFetch() {
    this.originalFetch = window.fetch.bind(window);
    const e = this;
    window.fetch = async function(t, n) {
      const i = ue[e.preset];
      if (i.downloadKbps === 0)
        throw new TypeError("Failed to fetch: Network offline (throttled)");
      return i.latency > 0 && await new Promise((o) => setTimeout(o, i.latency)), e.originalFetch(t, n);
    };
  }
  patchXHR() {
    const e = this;
    this.originalXHROpen = XMLHttpRequest.prototype.open, this.originalXHRSend = XMLHttpRequest.prototype.send, XMLHttpRequest.prototype.send = function(t) {
      const n = ue[e.preset], i = this;
      if (n.downloadKbps === 0) {
        setTimeout(() => {
          Object.defineProperty(i, "status", { value: 0, writable: !1 }), i.dispatchEvent(new Event("error"));
        }, 0);
        return;
      }
      n.latency > 0 ? setTimeout(() => {
        e.originalXHRSend.call(i, t);
      }, n.latency) : e.originalXHRSend.call(i, t);
    };
  }
  stop() {
    !this.active || typeof window > "u" || (this.active = !1, this.originalFetch && (window.fetch = this.originalFetch, this.originalFetch = null), this.originalXHROpen && (XMLHttpRequest.prototype.open = this.originalXHROpen, this.originalXHROpen = null), this.originalXHRSend && (XMLHttpRequest.prototype.send = this.originalXHRSend, this.originalXHRSend = null));
  }
  destroy() {
    this.stop();
  }
}
class de {
  constructor() {
    this.rules = [], this.originalFetch = null, this.originalXHROpen = null, this.originalXHRSend = null, this.active = !1;
  }
  start() {
    this.active || typeof window > "u" || (this.active = !0, this.patchFetch(), this.patchXHR());
  }
  matchRule(e, t) {
    return this.rules.find((n) => {
      if (n.enabled === !1) return !1;
      const i = (() => {
        try {
          return new RegExp(n.pattern).test(e);
        } catch {
          return e.includes(n.pattern);
        }
      })(), o = !n.method || n.method.toUpperCase() === t.toUpperCase();
      return i && o;
    });
  }
  patchFetch() {
    this.originalFetch = window.fetch.bind(window);
    const e = this;
    window.fetch = async function(t, n) {
      var r;
      const i = typeof t == "string" ? t : t instanceof URL ? t.href : t.url, o = ((n == null ? void 0 : n.method) ?? "GET").toUpperCase(), a = e.matchRule(i, o);
      return a ? ((r = e.onMatch) == null || r.call(e, a.id, i), a.delay && a.delay > 0 && await new Promise((l) => setTimeout(l, a.delay)), new Response(a.body, {
        status: a.status,
        headers: { "Content-Type": "application/json", ...a.headers }
      })) : e.originalFetch(t, n);
    };
  }
  patchXHR() {
    const e = this;
    this.originalXHROpen = XMLHttpRequest.prototype.open, this.originalXHRSend = XMLHttpRequest.prototype.send;
    const t = this.originalXHROpen;
    XMLHttpRequest.prototype.open = function(i, o, ...a) {
      return this.__mockUrl = typeof o == "string" ? o : o.href, this.__mockMethod = i, t.call(this, i, o, ...a);
    };
    const n = this.originalXHRSend;
    XMLHttpRequest.prototype.send = function(i) {
      var l;
      const o = this.__mockUrl || "", a = this.__mockMethod || "GET", r = e.matchRule(o, a);
      if (r) {
        (l = e.onMatch) == null || l.call(e, r.id, o), setTimeout(() => {
          Object.defineProperty(this, "status", {
            value: r.status,
            writable: !1,
            configurable: !0
          }), Object.defineProperty(this, "statusText", {
            value: "OK",
            writable: !1,
            configurable: !0
          }), Object.defineProperty(this, "responseText", {
            value: r.body,
            writable: !1,
            configurable: !0
          }), Object.defineProperty(this, "response", {
            value: r.body,
            writable: !1,
            configurable: !0
          }), Object.defineProperty(this, "readyState", {
            value: 4,
            writable: !1,
            configurable: !0
          });
          const d = Object.entries({ "Content-Type": "application/json", ...r.headers }).map(([p, h]) => `${p}: ${h}`).join(`\r
`);
          Object.defineProperty(this, "getAllResponseHeaders", {
            value: () => d,
            configurable: !0
          }), this.dispatchEvent(new Event("readystatechange")), this.dispatchEvent(new Event("load")), this.dispatchEvent(new Event("loadend"));
        }, Math.max(0, r.delay ?? 0));
        return;
      }
      n.call(this, i);
    };
  }
  stop() {
    !this.active || typeof window > "u" || (this.active = !1, this.originalFetch && (window.fetch = this.originalFetch, this.originalFetch = null), this.originalXHROpen && (XMLHttpRequest.prototype.open = this.originalXHROpen, this.originalXHROpen = null), this.originalXHRSend && (XMLHttpRequest.prototype.send = this.originalXHRSend, this.originalXHRSend = null));
  }
  addRule(e) {
    const t = Date.now().toString(36) + Math.random().toString(36).slice(2);
    return this.rules.push({ ...e, id: t }), t;
  }
  removeRule(e) {
    this.rules = this.rules.filter((t) => t.id !== e);
  }
  clearRules() {
    this.rules = [];
  }
  getRules() {
    return [...this.rules];
  }
  updateRule(e, t) {
    const n = this.rules.find((i) => i.id === e);
    n && Object.assign(n, t);
  }
}
const yn = 5, he = 50, F = 100;
function M(s, e = 0, t) {
  if (s === null) return { t: "null" };
  if (s === void 0) return { t: "undefined" };
  const n = typeof s;
  if (n === "string") return { t: "str", v: s };
  if (n === "number") return { t: "num", v: s };
  if (n === "boolean") return { t: "bool", v: s };
  if (n === "bigint") return { t: "bigint", v: String(s) };
  if (n === "symbol") return { t: "sym", v: s.toString() };
  if (n === "function") return { t: "fn", name: s.name || "(anonymous)" };
  const i = s;
  if (t || (t = /* @__PURE__ */ new WeakSet()), t.has(i)) return { t: "circ" };
  if (t.add(i), s instanceof RegExp) return { t: "regexp", src: s.source, flags: s.flags };
  if (s instanceof Date) return { t: "date", iso: s.toISOString() };
  if (s instanceof Error) return { t: "err", name: s.name, msg: s.message, stack: s.stack };
  if (e >= yn)
    return Array.isArray(s) ? { t: "arr", items: [], len: s.length, more: !0 } : { t: "obj", tag: pe(s), props: [], more: !0 };
  if (s instanceof Map) {
    const c = [];
    let d = 0;
    for (const [p, h] of s) {
      if (d++ >= F) break;
      c.push([M(p, e + 1, t), M(h, e + 1, t)]);
    }
    return { t: "map", entries: c, size: s.size };
  }
  if (s instanceof Set) {
    const c = [];
    let d = 0;
    for (const p of s) {
      if (d++ >= F) break;
      c.push(M(p, e + 1, t));
    }
    return { t: "set", values: c, size: s.size };
  }
  if (Array.isArray(s)) {
    const c = s.length > F;
    return { t: "arr", items: s.slice(0, F).map((p) => M(p, e + 1, t)), len: s.length, more: c };
  }
  const o = pe(s), a = Object.keys(i), r = a.length > he, l = a.slice(0, he).map((c) => [c, M(i[c], e + 1, t)]);
  return { t: "obj", tag: o, props: l, more: r };
}
function wn(s) {
  const e = /* @__PURE__ */ new WeakSet();
  return s.map((t) => M(t, 0, e));
}
function pe(s) {
  const t = Object.prototype.toString.call(s).match(/\[object (.+)\]/);
  return t ? t[1] : "Object";
}
const vn = 15;
class Sn {
  constructor(e) {
    this.listeners = [], this.shakeLastAcc = { x: 0, y: 0, z: 0 }, this.shakeLastTime = 0, this.cornerTapState = { count: 0, lastTime: 0, corner: -1 }, this.started = !1, this.config = {
      gestures: e.gestures ?? ["shake", "corner-tap"],
      onActivate: e.onActivate,
      keyShortcut: e.keyShortcut ?? "F8",
      shakeSensitivity: e.shakeSensitivity ?? 0.65,
      cornerTapCount: e.cornerTapCount ?? 3,
      cornerRadius: e.cornerRadius ?? 80
    };
  }
  start() {
    if (!(this.started || typeof window > "u")) {
      this.started = !0;
      for (const e of this.config.gestures)
        switch (e) {
          case "shake":
            this._startShake();
            break;
          case "corner-tap":
            this._startCornerTap();
            break;
          case "key":
            this._startKey();
            break;
        }
    }
  }
  stop() {
    for (const [e, t, n] of this.listeners)
      e.removeEventListener(t, n);
    this.listeners = [], this.started = !1;
  }
  _on(e, t, n) {
    e.addEventListener(t, n), this.listeners.push([e, t, n]);
  }
  _startShake() {
    if (!("DeviceMotionEvent" in window)) return;
    const e = vn * (1 - this.config.shakeSensitivity + 0.1), t = (n) => {
      const i = n.accelerationIncludingGravity;
      if (!i) return;
      const o = Date.now();
      if (o - this.shakeLastTime < 100) return;
      this.shakeLastTime = o;
      const a = Math.abs((i.x ?? 0) - this.shakeLastAcc.x), r = Math.abs((i.y ?? 0) - this.shakeLastAcc.y), l = Math.abs((i.z ?? 0) - this.shakeLastAcc.z);
      this.shakeLastAcc = { x: i.x ?? 0, y: i.y ?? 0, z: i.z ?? 0 }, a + r + l > e && this.config.onActivate();
    };
    this._on(window, "devicemotion", t);
  }
  _startCornerTap() {
    const { cornerRadius: e, cornerTapCount: t } = this.config, n = 800, i = (o) => {
      if (o.touches.length !== 1) return;
      const a = o.touches[0], r = window.innerWidth, l = window.innerHeight, c = a.clientX, d = a.clientY;
      let p = -1;
      if (c < e && d < e ? p = 0 : c > r - e && d < e ? p = 1 : c < e && d > l - e ? p = 2 : c > r - e && d > l - e && (p = 3), p === -1) {
        this.cornerTapState = { count: 0, lastTime: 0, corner: -1 };
        return;
      }
      const h = Date.now();
      if (h - this.cornerTapState.lastTime > n || p !== this.cornerTapState.corner) {
        this.cornerTapState = { count: 1, lastTime: h, corner: p };
        return;
      }
      this.cornerTapState.count++, this.cornerTapState.lastTime = h, this.cornerTapState.count >= t && (this.cornerTapState = { count: 0, lastTime: 0, corner: -1 }, this.config.onActivate());
    };
    this._on(window, "touchstart", i);
  }
  _startKey() {
    const t = this.config.keyShortcut.split("+").map((c) => c.trim()), n = t.pop() ?? "F8", i = t.includes("Alt"), o = t.includes("Ctrl") || t.includes("Control"), a = t.includes("Shift"), r = t.includes("Meta") || t.includes("Cmd"), l = (c) => {
      c.key === n && (i && !c.altKey || o && !c.ctrlKey || a && !c.shiftKey || r && !c.metaKey || (c.preventDefault(), this.config.onActivate()));
    };
    this._on(window, "keydown", l);
  }
}
class kn {
  constructor(e = {}) {
    this.entries = [], this.dirty = !1, this.maxEntries = e.maxEntries ?? 500, this.storageKey = e.storageKey ?? "_codeLog_offline_buf", this._load();
  }
  /** Record an event */
  push(e, t) {
    this.entries.push({ type: e, payload: t, ts: Date.now() }), this.entries.length > this.maxEntries && this.entries.shift(), this.dirty = !0;
  }
  /** Persist to localStorage */
  save() {
    if (this.dirty)
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.entries)), this.dirty = !1;
      } catch {
      }
  }
  /** Get all buffered entries and clear the buffer */
  flush() {
    const e = this.entries.slice();
    return this.entries = [], this.dirty = !0, this.save(), e;
  }
  /** Peek without clearing */
  peek() {
    return this.entries.slice();
  }
  get size() {
    return this.entries.length;
  }
  /** Clear without returning */
  clear() {
    this.entries = [], this.dirty = !0, this.save();
  }
  _load() {
    try {
      const e = localStorage.getItem(this.storageKey);
      e && (this.entries = JSON.parse(e));
    } catch {
      this.entries = [];
    }
  }
}
class fe {
  constructor() {
    this.plugins = /* @__PURE__ */ new Map(), this.ctx = null;
  }
  /** Set the context once CodeLog is initialised */
  setContext(e) {
    this.ctx = e;
  }
  /** Install and enable a plugin */
  async use(e) {
    var n;
    if (this.plugins.has(e.name)) {
      console.warn(`[codeLog] Plugin "${e.name}" is already installed.`);
      return;
    }
    const t = { plugin: e, state: "installed" };
    this.plugins.set(e.name, t), this.ctx && (await e.install(this.ctx), t.state = "enabled", (n = e.enable) == null || n.call(e));
  }
  /** Enable a previously disabled plugin */
  enable(e) {
    var n, i;
    const t = this.plugins.get(e);
    t && t.state === "disabled" && ((i = (n = t.plugin).enable) == null || i.call(n), t.state = "enabled");
  }
  /** Temporarily disable a plugin (preserves installed state) */
  disable(e) {
    var n, i;
    const t = this.plugins.get(e);
    !t || t.state !== "enabled" || ((i = (n = t.plugin).disable) == null || i.call(n), t.state = "disabled");
  }
  /** Fully remove and uninstall a plugin */
  remove(e) {
    var n, i, o, a;
    const t = this.plugins.get(e);
    t && (t.state === "enabled" && ((i = (n = t.plugin).disable) == null || i.call(n)), (a = (o = t.plugin).uninstall) == null || a.call(o), t.state = "uninstalled", this.plugins.delete(e));
  }
  /** Uninstall all plugins (called from CodeLog.destroy) */
  destroyAll() {
    for (const [e] of this.plugins)
      this.remove(e);
  }
  /** List installed plugins with their states */
  list() {
    return Array.from(this.plugins.entries()).map(([e, t]) => ({
      name: e,
      panelTitle: t.plugin.panelTitle,
      panelIcon: t.plugin.panelIcon,
      version: t.plugin.version,
      state: t.state
    }));
  }
  /** Get a plugin by name */
  get(e) {
    var t;
    return (t = this.plugins.get(e)) == null ? void 0 : t.plugin;
  }
}
const me = [
  "console",
  "network",
  "storage",
  "dom",
  "performance",
  "screenshot",
  "perf_run_raw",
  "error",
  "lifecycle",
  "custom"
];
class En {
  constructor(e = {}) {
    this.name = "DataHarborPlugin", this.entries = [], this.unsubscribers = [], this.visibilityHandler = null, this.maxEntries = e.maxEntries ?? 1e3, this.storageKey = e.storageKey ?? "_codelog_harbor", this.captureTypes = new Set(e.captureTypes ?? me), this.autoPersist = e.autoPersist ?? !0, this._loadFromStorage();
  }
  install(e) {
    for (const t of me) {
      if (!this.captureTypes.has(t)) continue;
      const n = e.dataBus.on(t, (i) => {
        this._push(t, i);
      });
      this.unsubscribers.push(n);
    }
    this.autoPersist && typeof document < "u" && (this.visibilityHandler = () => {
      document.visibilityState === "hidden" && this.persist();
    }, document.addEventListener("visibilitychange", this.visibilityHandler));
  }
  enable() {
  }
  disable() {
  }
  uninstall() {
    for (const e of this.unsubscribers) e();
    this.unsubscribers = [], this.visibilityHandler && (document.removeEventListener("visibilitychange", this.visibilityHandler), this.visibilityHandler = null);
  }
  /** Save current buffer to localStorage */
  persist() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.entries));
    } catch {
    }
  }
  /** Get all buffered entries */
  getEntries() {
    return this.entries.slice();
  }
  /** Export as JSON blob and trigger browser download */
  exportJSON(e = `codelog-harbor-${Date.now()}.json`) {
    const t = JSON.stringify({ version: 1, entries: this.entries }, null, 2), n = new Blob([t], { type: "application/json" }), i = URL.createObjectURL(n), o = document.createElement("a");
    o.href = i, o.download = e, o.click(), URL.revokeObjectURL(i);
  }
  /** Export console entries as plain text log */
  exportLog(e = `codelog-log-${Date.now()}.txt`) {
    const t = this.entries.filter((a) => a.type === "console").map((a) => {
      const r = a.payload;
      return `[${new Date(a.ts).toISOString()}] [${(r.level ?? "log").toUpperCase()}] ${r.message ?? ""}`;
    }), n = new Blob([t.join(`
`)], { type: "text/plain" }), i = URL.createObjectURL(n), o = document.createElement("a");
    o.href = i, o.download = e, o.click(), URL.revokeObjectURL(i);
  }
  /** Clear the buffer and remove from localStorage */
  clear() {
    this.entries = [];
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
    }
  }
  get size() {
    return this.entries.length;
  }
  _push(e, t) {
    this.entries.push({ type: e, payload: t, ts: Date.now() }), this.entries.length > this.maxEntries && this.entries.shift();
  }
  _loadFromStorage() {
    try {
      const e = localStorage.getItem(this.storageKey);
      if (e) {
        const t = JSON.parse(e);
        this.entries = Array.isArray(t) ? t : [];
      }
    } catch {
      this.entries = [];
    }
  }
}
class xn {
  constructor(e = {}) {
    this.name = "RRWebPlugin", this.ctx = null, this.stopFn = null, this.events = [], this.chunkIndex = 0, this.enabled = !1, this.opts = e;
  }
  async install(e) {
    this.ctx = e, await this._start(), this.enabled = !0;
  }
  enable() {
    this.enabled || (this._start(), this.enabled = !0);
  }
  disable() {
    var e;
    this.enabled = !1, (e = this.stopFn) == null || e.call(this), this.stopFn = null;
  }
  uninstall() {
    this.disable(), this.events = [], this.ctx = null;
  }
  /** Get all recorded events without clearing */
  getEvents() {
    return this.events.slice();
  }
  /** Clear the event buffer */
  clearEvents() {
    this.events = [], this.chunkIndex = 0;
  }
  /** Download events as JSON for offline replay */
  exportRecording(e = `rrweb-recording-${Date.now()}.json`) {
    const t = new Blob([JSON.stringify(this.events)], { type: "application/json" }), n = URL.createObjectURL(t), i = document.createElement("a");
    i.href = n, i.download = e, i.click(), URL.revokeObjectURL(n);
  }
  async _start() {
    let e;
    try {
      e = await new Function('return import("rrweb")')();
    } catch {
      console.warn("[RRWebPlugin] rrweb is not installed. Run: npm install rrweb");
      return;
    }
    const t = this.opts.chunkSize ?? 200;
    this.stopFn = e.record({
      emit: (n, i) => {
        i && this._flushChunk(), this.events.push(n), this.events.length >= t && this._flushChunk();
      },
      checkoutEveryNms: this.opts.checkoutEveryNms ?? 1e4,
      slimDOMOptions: this.opts.slimDOMOptions
    });
  }
  _flushChunk() {
    var t;
    if (this.events.length === 0) return;
    const e = this.events.splice(0);
    this.chunkIndex += 1, this.opts.autoUpload !== !1 && ((t = this.ctx) != null && t.serverUrl) && this._upload(e);
  }
  _upload(e) {
    const t = `${this.ctx.serverUrl}/api/rrweb-recording`;
    fetch(t, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chunkIndex: this.chunkIndex, events: e })
    }).catch(() => {
    });
  }
}
class Tn {
  constructor(e = {}) {
    this.name = "OSpyPlugin", this.entries = [], this.errorCount = 0, this.unsubscribers = [], this.badge = null, this.popup = null, this.popupOpen = !1, this.enabled = !1, this.opts = e, this.maxEntries = e.maxEntries ?? 500;
  }
  install(e) {
    const t = e.dataBus.on("console", (i) => {
      this._addEntry(i);
    });
    this.unsubscribers.push(t);
    const n = e.dataBus.on("error", (i) => {
      this._addEntry({ level: "error", message: i.message ?? "Error", ...i }), this.errorCount += 1, this._updateBadge();
    });
    this.unsubscribers.push(n), this._mountBadge(), this.enabled = !0;
  }
  enable() {
    this.badge && (this.badge.style.display = "flex"), this.enabled = !0;
  }
  disable() {
    this.badge && (this.badge.style.display = "none"), this.enabled = !1;
  }
  uninstall() {
    var e, t;
    for (const n of this.unsubscribers) n();
    this.unsubscribers = [], (e = this.badge) == null || e.remove(), (t = this.popup) == null || t.remove(), this.badge = null, this.popup = null, this.enabled = !1;
  }
  _addEntry(e) {
    const t = {
      ts: e.timestamp ?? Date.now(),
      level: e.level ?? "log",
      message: e.message ?? String(e)
    };
    this.entries.push(t), this.entries.length > this.maxEntries && this.entries.shift(), (t.level === "error" || t.level === "warn") && this._updateBadge();
  }
  _mountBadge() {
    if (typeof document > "u") return;
    const e = this.opts.position ?? "bottom-right", t = {
      bottom: e.includes("bottom") ? "16px" : "auto",
      top: e.includes("top") ? "16px" : "auto",
      right: e.includes("right") ? "16px" : "auto",
      left: e.includes("left") ? "16px" : "auto"
    }, n = document.createElement("div");
    n.id = "__ospy_badge__", Object.assign(n.style, {
      position: "fixed",
      zIndex: "2147483647",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 12px",
      borderRadius: "20px",
      backgroundColor: "#1a1a2e",
      color: "#fff",
      fontSize: "12px",
      fontFamily: "system-ui, sans-serif",
      cursor: "pointer",
      boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
      userSelect: "none",
      ...t
    }), n.innerHTML = '<span style="font-size:14px">🔍</span> <span id="__ospy_count__">0 logs</span>', n.addEventListener("click", () => this._togglePopup()), document.body.appendChild(n), this.badge = n;
  }
  _updateBadge() {
    if (!this.badge) return;
    const e = this.badge.querySelector("#__ospy_count__");
    if (!e) return;
    const t = this.errorCount;
    e.textContent = `${this.entries.length} logs${t > 0 ? ` · ${t} errors` : ""}`, this.badge.style.backgroundColor = t > 0 ? "#c0392b" : "#1a1a2e";
  }
  _togglePopup() {
    var e;
    this.popupOpen ? ((e = this.popup) == null || e.remove(), this.popup = null, this.popupOpen = !1) : this._openPopup();
  }
  _openPopup() {
    if (typeof document > "u") return;
    const e = document.createElement("div");
    Object.assign(e.style, {
      position: "fixed",
      bottom: "60px",
      right: "16px",
      zIndex: "2147483646",
      width: "420px",
      maxHeight: "60vh",
      backgroundColor: "#1a1a2e",
      color: "#e0e0e0",
      borderRadius: "8px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      fontFamily: "monospace",
      fontSize: "12px",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden"
    });
    const t = document.createElement("div");
    Object.assign(t.style, {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "8px 12px",
      borderBottom: "1px solid #333",
      color: "#fff",
      fontWeight: "bold"
    }), t.innerHTML = "<span>🔍 OSpyPlugin — Local Logs</span>";
    const n = document.createElement("button");
    n.textContent = "✕", Object.assign(n.style, {
      background: "none",
      border: "none",
      color: "#999",
      cursor: "pointer",
      fontSize: "14px"
    }), n.addEventListener("click", () => this._togglePopup()), t.appendChild(n), e.appendChild(t);
    const i = document.createElement("div");
    Object.assign(i.style, { flex: "1", overflow: "auto", padding: "4px 0" });
    const o = this.entries.slice(-200);
    for (const a of o) {
      const r = document.createElement("div");
      Object.assign(r.style, {
        padding: "4px 12px",
        borderBottom: "1px solid #252540",
        color: Cn(a.level),
        lineHeight: "1.5"
      });
      const l = new Date(a.ts).toLocaleTimeString("zh-CN", { hour12: !1 });
      r.textContent = `[${l}] [${a.level.toUpperCase()}] ${a.message}`, i.appendChild(r);
    }
    if (o.length === 0) {
      const a = document.createElement("div");
      Object.assign(a.style, { padding: "16px", textAlign: "center", color: "#666" }), a.textContent = "No logs yet", i.appendChild(a);
    }
    e.appendChild(i), document.body.appendChild(e), this.popup = e, this.popupOpen = !0, i.scrollTop = i.scrollHeight;
  }
}
function Cn(s) {
  switch (s) {
    case "error":
      return "#ff6b6b";
    case "warn":
      return "#ffd93d";
    case "info":
      return "#74b9ff";
    default:
      return "#a8e6cf";
  }
}
const Ln = "0.1.0", Rn = 3e4, O = Symbol.for("codelog.instance");
class In {
  constructor(e) {
    var r, l, c, d, p;
    if (this.heartbeatTimerId = null, this.originalConsole = null, this.erudaInitialized = !1, this.eruda = null, this.networkInterceptor = null, this.wsInterceptor = null, this.sseInterceptor = null, this.beaconInterceptor = null, this.storageReader = null, this.errorInterceptor = null, this.domCollector = null, this.performanceCollector = null, this.screenshotCollector = null, this.zenMode = !1, this.perfRunning = !1, this.perfRunCollector = null, this.perfRunStartTime = 0, this.lastPerfRunSession = null, this.prePerfRunVitals = [], this.networkThrottle = null, this.mockApi = null, this.visibilityHandler = null, this.beforeUnloadHandler = null, this.systemCollector = null, this.idbInterceptor = null, this.gestureActivator = null, this.offlineBuffer = null, this.pluginManager = new fe(), !e.projectId)
      throw new Error("projectId is required");
    if (globalThis[O] && console.warn("codeLog: 检测到已存在的实例，多个实例可能导致竞态条件"), this.projectId = e.projectId, this.platform = e.platform ?? new st(), this.deviceInfo = xe(e.projectId, this.platform), this.tabId = Se(), this.heartbeatIntervalMs = e.heartbeatInterval ?? Rn, this.consoleProcessor = e.consoleProcessor, this.networkProcessor = e.networkProcessor, this.storageProcessor = e.storageProcessor, this.databaseProcessor = e.databaseProcessor, this.disabledPlugins = new Set(e.disabledPlugins ?? []), ((r = e.offline) == null ? void 0 : r.enabled) !== !1 && typeof localStorage < "u" && (this.offlineBuffer = new kn(e.offline ?? {})), this.dataBus = new Le(), this.reporter = new qe(this.deviceInfo, this.tabId, this.platform), this.reporter.attachDataBus(this.dataBus), this.offlineBuffer) {
      const h = this.offlineBuffer;
      this.dataBus.on("console", (g) => h.push("console", g)), this.dataBus.on("error", (g) => h.push("error", g)), typeof document < "u" && document.addEventListener("visibilitychange", () => {
        document.visibilityState === "hidden" && h.save();
      });
    }
    this.erudaPlugin = new nt();
    const n = e.server ?? An(e.port);
    this.resolvedServerUrl = n, this.platform.storage.getItem(`codelog_remote_${this.projectId}`) === "false" || this.reporter.connect(n), this.disabledPlugins.has("console") || this.interceptConsole(), this.networkConfig = e.network, this.disabledPlugins.has("network") || this.initNetworkInterceptor(e.network), this.disabledPlugins.has("storage") || this.initStorageReader(), e.captureErrors !== !1 && !this.disabledPlugins.has("error") && this.initErrorInterceptor(), ((l = e.dom) == null ? void 0 : l.enabled) !== !1 && !this.disabledPlugins.has("dom") && this.initDOMCollector((c = e.dom) == null ? void 0 : c.initialDelay), ((d = e.performance) == null ? void 0 : d.enabled) !== !1 && !this.disabledPlugins.has("performance") && this.initPerformanceCollector(), this.disabledPlugins.has("screenshot") || this.initScreenshotCollector(), this.reporter.onStartPerfRun(() => {
      this.startPerfRun();
    }), ln(), this.reporter.onStopPerfRun(() => {
      this.stopPerfRun();
    }), this.reporter.onPerfRunDone((h) => {
      this.dataBus.emit("perf_run_done", h);
      const S = { A: "🏆", B: "🥈", C: "🥉", D: "⚠️", F: "❌" }[h.grade] ?? "🏁";
      this.dataBus.emit("console", {
        timestamp: Date.now(),
        level: "log",
        message: `[codeLog] ${S} 跑分完成！综合分: ${h.total} (${h.grade}) — 请去 Web 面板查看详情`,
        args: [`[codeLog] ${S} 跑分完成！综合分: ${h.total} (${h.grade}) — 请去 Web 面板查看详情`]
      });
    }), this.reporter.onSetNetworkThrottle((h) => {
      this.setNetworkThrottle(h);
    }), this.reporter.onAddMock((h) => {
      this.mockApi || (this.mockApi = new de(), this.mockApi.onMatch = (g, S) => {
        this.reporter.reportMockMatch(g, S);
      }, this.mockApi.start()), this.mockApi.addRule(h);
    }), this.reporter.onRemoveMock((h) => {
      this.removeMock(h);
    }), this.reporter.onClearMocks(() => {
      this.clearMocks();
    }), this.reporter.onUpdateMockRule((h, g) => {
      var S;
      (S = this.mockApi) == null || S.updateRule(h, { enabled: g });
    }), this.reporter.onRequestIDBSnapshot(async () => {
      if (this.idbInterceptor)
        try {
          const h = await this.idbInterceptor.takeSnapshot();
          this.reporter.reportIDBSnapshot(h);
        } catch {
        }
    }), this.reporter.onRequestIDBStoreData(async (h, g, S, k, C) => {
      if (this.idbInterceptor)
        try {
          const m = await this.idbInterceptor.getStoreData(h, g, S, k);
          this.reporter.reportIDBStoreData({ ...m, reqId: C });
        } catch {
        }
    }), this.reporter.onGetComputedStyles((h) => {
      try {
        const g = document.querySelector(h);
        if (!g) return;
        const S = window.getComputedStyle(g), k = [
          "color",
          "background-color",
          "background",
          "font-size",
          "font-family",
          "font-weight",
          "font-style",
          "line-height",
          "letter-spacing",
          "text-align",
          "text-decoration",
          "display",
          "position",
          "top",
          "right",
          "bottom",
          "left",
          "width",
          "height",
          "min-width",
          "max-width",
          "min-height",
          "max-height",
          "margin",
          "margin-top",
          "margin-right",
          "margin-bottom",
          "margin-left",
          "padding",
          "padding-top",
          "padding-right",
          "padding-bottom",
          "padding-left",
          "border",
          "border-radius",
          "outline",
          "overflow",
          "overflow-x",
          "overflow-y",
          "z-index",
          "opacity",
          "visibility",
          "cursor",
          "flex",
          "flex-direction",
          "flex-wrap",
          "justify-content",
          "align-items",
          "align-self",
          "grid",
          "grid-template-columns",
          "grid-template-rows",
          "transform",
          "transition",
          "animation",
          "box-shadow",
          "text-shadow",
          "pointer-events",
          "user-select"
        ], C = {};
        for (const m of k) {
          const b = S.getPropertyValue(m);
          b && (C[m] = b);
        }
        this.reporter.reportComputedStyles(h, C);
      } catch {
      }
    }), this.reporter.onSetElementAttr((h, g, S) => {
      var k;
      try {
        const C = document.querySelector(h);
        if (!C) return;
        S === "" ? C.removeAttribute(g) : C.setAttribute(g, S), (k = this.domCollector) == null || k.collect();
      } catch {
      }
    }), this.reporter.onStartElementPicker(() => {
      let h = null;
      const g = (b) => {
        if (b.id) return `#${b.id}`;
        const y = b.tagName.toLowerCase(), v = Array.from(b.classList).slice(0, 2).join(".");
        return v ? `${y}.${v}` : y;
      }, S = (b) => {
        const y = b.target;
        if (!y || y === h) return;
        const v = y.getBoundingClientRect();
        h || (h = document.createElement("div"), h.style.cssText = [
          "position:fixed",
          "pointer-events:none",
          "z-index:2147483647",
          "border:2px solid #007acc",
          "background:rgba(0,122,204,0.15)",
          "box-sizing:border-box",
          "transition:all 60ms ease"
        ].join(";"), document.body.appendChild(h)), h.style.top = `${v.top}px`, h.style.left = `${v.left}px`, h.style.width = `${v.width}px`, h.style.height = `${v.height}px`;
      }, k = (b) => {
        var R;
        b.preventDefault(), b.stopPropagation();
        const y = b.target;
        if (C(), !y) return;
        const v = g(y);
        this.reporter.reportPickedElement(v, y.tagName), (R = this.domCollector) == null || R.collect();
      }, C = () => {
        document.removeEventListener("mousemove", S, !0), document.removeEventListener("click", k, !0), document.removeEventListener("keydown", m, !0), h && (h.remove(), h = null), document.body.style.cursor = "";
      }, m = (b) => {
        b.key === "Escape" && C();
      };
      document.body.style.cursor = "crosshair", document.addEventListener("mousemove", S, !0), document.addEventListener("click", k, !0), document.addEventListener("keydown", m, !0);
    }), globalThis[O] = this, this.heartbeatTimerId = this.platform.timer.setInterval(() => {
      Te(this.projectId, this.platform), this.reporter.updateDeviceInfo();
    }, this.heartbeatIntervalMs), ((p = e.eruda) == null ? void 0 : p.enabled) !== !1 && this.initEruda(e.eruda, e.lang), this.dataBus.emit("lifecycle", {
      event: "connect",
      url: typeof location < "u" ? location.href : void 0
    }), this.visibilityHandler = () => {
      const h = document.visibilityState === "visible" ? "page_show" : "page_hide";
      this.dataBus.emit("lifecycle", { event: h, url: location.href });
    }, document.addEventListener("visibilitychange", this.visibilityHandler), this.beforeUnloadHandler = () => {
      this.dataBus.emit("lifecycle", { event: "page_unload", url: location.href });
    }, window.addEventListener("beforeunload", this.beforeUnloadHandler), this.disabledPlugins.has("system") || (this.systemCollector = new et((h) => {
      this.dataBus.emit("system", h);
    }), this.systemCollector.startWatching()), this.disabledPlugins.has("indexeddb") || (this.idbInterceptor = new tt((h) => {
      if (this.databaseProcessor) {
        const g = this.databaseProcessor({
          dbName: h.dbName,
          storeName: h.storeName,
          operation: h.operation,
          key: h.key,
          value: h.value
        });
        if (!g) return;
        this.dataBus.emit("indexeddb", { ...h, ...g });
        return;
      }
      this.dataBus.emit("indexeddb", h);
    }), this.idbInterceptor.start()), e.gesture && (this.gestureActivator = new Sn(e.gesture), this.gestureActivator.start()), this.pluginManager = new fe();
    const o = n ? n.replace(/^ws:\/\//, "http://").replace(/^wss:\/\//, "https://").replace(/\/ws$/, "") : void 0;
    this.pluginManager.setContext({
      dataBus: this.dataBus,
      projectId: this.projectId,
      serverUrl: o
    });
    for (const h of e.plugins ?? [])
      this.pluginManager.use(h);
    setTimeout(() => {
      const h = this.pluginManager.list();
      h.length > 0 && this.reporter.announcePlugins(h);
    }, 2e3);
  }
  async initEruda(e, t) {
    var n, i, o, a, r, l, c;
    try {
      const d = await import("./eruda-IIUjv_5a.js").then((p) => p.e);
      if (this.eruda = d.default || d, this.eruda && typeof this.eruda.init == "function") {
        this.eruda.init({
          tool: e == null ? void 0 : e.tool,
          autoScale: (e == null ? void 0 : e.autoScale) ?? !0,
          useShadowDom: !0,
          defaults: e == null ? void 0 : e.defaults,
          lang: (() => {
            try {
              const g = typeof localStorage < "u" && localStorage.getItem("codelog-lang");
              if (g === "en") return "en";
              if (g === "zh") return "zh-CN";
            } catch {
            }
            return t === "en" ? "en" : "zh-CN";
          })()
        }), typeof localStorage < "u" && Object.keys(localStorage).filter((g) => g.startsWith("eruda")).forEach((g) => localStorage.removeItem(g));
        const p = (i = (n = this.eruda).get) == null ? void 0 : i.call(n, "entryBtn");
        (a = (o = p == null ? void 0 : p.config) == null ? void 0 : o.set) == null || a.call(o, "rememberPos", !1);
        const h = (l = (r = this.eruda).get) == null ? void 0 : l.call(r, "console");
        (c = h == null ? void 0 : h.restoreConsole) == null || c.call(h), this.erudaPlugin.attach(this.eruda, this.dataBus, this.deviceInfo.deviceId), this.erudaPlugin.setReinitCallback(() => {
          var m, b, y, v, R, I, L, A, _, N, B, V, G;
          if (!this.erudaInitialized || !this.eruda) return;
          const g = (m = this.eruda.get) == null ? void 0 : m._isShow, S = (b = this.eruda.get) == null ? void 0 : b._curTool;
          this.eruda.destroy(), this.eruda.init({
            tool: e == null ? void 0 : e.tool,
            autoScale: (e == null ? void 0 : e.autoScale) ?? !0,
            useShadowDom: !0,
            defaults: e == null ? void 0 : e.defaults,
            lang: (() => {
              try {
                const J = typeof localStorage < "u" && localStorage.getItem("codelog-lang");
                if (J === "en") return "en";
                if (J === "zh") return "zh-CN";
              } catch {
              }
              return t === "en" ? "en" : "zh-CN";
            })()
          });
          const k = (v = (y = this.eruda).get) == null ? void 0 : v.call(y, "console");
          (R = k == null ? void 0 : k.restoreConsole) == null || R.call(k);
          const C = (L = (I = this.eruda).get) == null ? void 0 : L.call(I, "entryBtn");
          (_ = (A = C == null ? void 0 : C.config) == null ? void 0 : A.set) == null || _.call(A, "rememberPos", !1), this.erudaPlugin.attach(this.eruda, this.dataBus, this.deviceInfo.deviceId), g && ((B = (N = this.eruda).get) == null || B.call(N).show(), S && ((G = (V = this.eruda).get) == null || G.call(V).showTool(S)));
        }), this.erudaInitialized = !0;
      } else
        console.warn("codeLog: Eruda 初始化失败 - 无效的 eruda 模块");
    } catch (d) {
      console.warn("codeLog: Eruda 加载失败", d);
    }
  }
  interceptConsole() {
    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug,
      trace: console.trace,
      clear: console.clear
    };
    const e = this;
    let t = 0;
    const n = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map(), o = (m, b, y = !1) => function(...v) {
      try {
        let R = P(v), I = v;
        if (e.consoleProcessor) {
          const B = e.consoleProcessor({ level: m, message: R, args: v, timestamp: Date.now() });
          if (!B) {
            b.apply(console, v);
            return;
          }
          R = B.message, I = B.args;
        }
        const L = Me(I), A = ze(I), _ = wn(I), N = {
          timestamp: Date.now(),
          level: m,
          message: R,
          args: I,
          serializedArgs: _,
          indent: t,
          ...L.length > 0 ? { cssStyles: L } : {},
          ...A ? { styledParts: A } : {},
          ...y ? { stack: U(new Error().stack) } : {}
        };
        e.dataBus.emit("console", N);
      } catch {
      }
      b.apply(console, v);
    };
    console.log = o("log", this.originalConsole.log), console.warn = o("warn", this.originalConsole.warn), console.error = o("error", this.originalConsole.error, !0), console.info = o("info", this.originalConsole.info), console.debug = o("debug", this.originalConsole.debug), console.trace = o("warn", this.originalConsole.trace, !0);
    const a = console.table;
    console.table = function(m, b) {
      try {
        let y = [];
        Array.isArray(m) ? y = m.map(
          (v, R) => v !== null && typeof v == "object" ? { "(index)": R, ...v } : { "(index)": R, Value: v }
        ) : m !== null && typeof m == "object" && (y = Object.entries(m).map(([v, R]) => ({
          "(index)": v,
          Value: R
        }))), e.dataBus.emit("console", {
          timestamp: Date.now(),
          level: "table",
          message: P([m]),
          args: [m],
          indent: t,
          tableData: y
        });
      } catch {
      }
      a == null || a.apply(console, [m]);
    };
    const r = console.group, l = console.groupCollapsed, c = console.groupEnd;
    console.group = function(...m) {
      try {
        e.dataBus.emit("console", {
          timestamp: Date.now(),
          level: "group",
          message: m.length ? P(m) : "console.group",
          args: m,
          indent: t
        }), t++;
      } catch {
      }
      r == null || r.apply(console, m);
    }, console.groupCollapsed = function(...m) {
      try {
        e.dataBus.emit("console", {
          timestamp: Date.now(),
          level: "group-collapsed",
          message: m.length ? P(m) : "console.groupCollapsed",
          args: m,
          indent: t
        }), t++;
      } catch {
      }
      l == null || l.apply(console, m);
    }, console.groupEnd = function() {
      try {
        t > 0 && t--, e.dataBus.emit("console", {
          timestamp: Date.now(),
          level: "group-end",
          message: "",
          args: [],
          indent: t
        });
      } catch {
      }
      c == null || c.apply(console);
    };
    const d = console.count, p = console.countReset;
    console.count = function(m = "default") {
      try {
        const b = (i.get(m) ?? 0) + 1;
        i.set(m, b), e.dataBus.emit("console", {
          timestamp: Date.now(),
          level: "count",
          message: `${m}: ${b}`,
          args: [`${m}: ${b}`],
          indent: t
        });
      } catch {
      }
      d == null || d.call(console, m);
    }, console.countReset = function(m = "default") {
      try {
        i.set(m, 0), e.dataBus.emit("console", {
          timestamp: Date.now(),
          level: "count",
          message: `${m}: 0`,
          args: [`${m}: 0`],
          indent: t
        });
      } catch {
      }
      p == null || p.call(console, m);
    };
    const h = console.time, g = console.timeEnd, S = console.timeLog;
    console.time = function(m = "default") {
      try {
        n.set(m, performance.now());
      } catch {
      }
      h == null || h.call(console, m);
    }, console.timeEnd = function(m = "default") {
      try {
        const b = n.get(m), y = b !== void 0 ? (performance.now() - b).toFixed(3) : "?";
        n.delete(m), e.dataBus.emit("console", {
          timestamp: Date.now(),
          level: "time-log",
          message: `${m}: ${y}ms`,
          args: [`${m}: ${y}ms`],
          indent: t
        });
      } catch {
      }
      g == null || g.call(console, m);
    }, console.timeLog = function(m = "default", ...b) {
      try {
        const y = n.get(m), v = y !== void 0 ? (performance.now() - y).toFixed(3) : "?";
        e.dataBus.emit("console", {
          timestamp: Date.now(),
          level: "time-log",
          message: `${m}: ${v}ms ${b.length ? P(b) : ""}`.trim(),
          args: [`${m}: ${v}ms`, ...b],
          indent: t
        });
      } catch {
      }
      S == null || S.call(console, m, ...b);
    };
    const k = console.assert;
    console.assert = function(m, ...b) {
      if (!m)
        try {
          const y = b.length ? `Assertion failed: ${P(b)}` : "Assertion failed";
          e.dataBus.emit("console", {
            timestamp: Date.now(),
            level: "assert",
            message: y,
            args: b.length ? b : ["Assertion failed"],
            indent: t,
            stack: U(new Error().stack)
          });
        } catch {
        }
      k == null || k.apply(console, [m, ...b]);
    };
    const C = console.clear;
    console.clear = function() {
      try {
        e.dataBus.emit("console", {
          timestamp: Date.now(),
          level: "log",
          message: "--- console cleared ---",
          args: ["--- console cleared ---"],
          indent: 0
        });
      } catch {
      }
      C == null || C.call(console);
    };
  }
  initNetworkInterceptor(e) {
    const t = this.dataBus, n = this.networkProcessor, i = (o) => {
      if (n) {
        const a = n({
          url: o.url,
          method: o.method,
          type: o.type,
          status: o.status,
          requestBody: o.requestBody,
          responseBody: o.responseBody
        });
        if (!a) return;
        t.emit("network", { ...o, ...a });
        return;
      }
      t.emit("network", o);
    };
    this.networkInterceptor = new Oe(i, e), this.networkInterceptor.start(), this.wsInterceptor = new He(i), this.wsInterceptor.start(), this.sseInterceptor = new _e(i), this.sseInterceptor.start(), this.beaconInterceptor = new Ne(i), this.beaconInterceptor.start();
  }
  initStorageReader() {
    const e = this.dataBus, t = this.storageProcessor;
    this.storageReader = new je((n) => {
      if (t) {
        const i = t({
          localStorage: n.localStorage,
          sessionStorage: n.sessionStorage,
          cookies: n.cookies
        });
        if (!i) return;
        e.emit("storage", { ...n, ...i });
        return;
      }
      e.emit("storage", n);
    }), this.storageReader.watch(), this.reporter.onRefreshStorage(() => {
      var n;
      (n = this.storageReader) == null || n.readAndReport();
    });
  }
  initErrorInterceptor() {
    this.errorInterceptor = new Fe(this.platform, this.dataBus), this.errorInterceptor.start();
  }
  initDOMCollector(e = 2e3) {
    const t = this.dataBus;
    this.domCollector = new Ve(this.platform, (n) => {
      t.emit("dom", n);
    }), this.platform.timer.setTimeout(() => {
      var n;
      (n = this.domCollector) == null || n.collect();
    }, e), this.reporter.onRefreshDOM(() => {
      var n;
      (n = this.domCollector) == null || n.collect();
    });
  }
  initPerformanceCollector() {
    this.performanceCollector = new re(this.dataBus), this.performanceCollector.start();
  }
  initScreenshotCollector() {
    this.screenshotCollector = new Ye(this.dataBus), this.reporter.onTakeScreenshot(() => {
      var e;
      (e = this.screenshotCollector) == null || e.capture();
    }), this.reporter.onZenMode((e) => {
      e ? this.enterZenMode() : this.exitZenMode();
    });
  }
  /** 手动触发截图（供外部调用） */
  async takeScreenshot() {
    var e;
    return (e = this.screenshotCollector) == null ? void 0 : e.capture();
  }
  startPerfRun() {
    var e, t;
    this.perfRunning || (this.prePerfRunVitals = ((t = (e = this.performanceCollector) == null ? void 0 : e.getSnapshot()) == null ? void 0 : t.vitals) ?? [], this.enterZenMode(!0), this.perfRunCollector = new re(this.dataBus), this.perfRunCollector.start(), this.perfRunStartTime = Date.now(), this.perfRunning = !0, this.dataBus.emit("console", {
      timestamp: Date.now(),
      level: "log",
      message: "[codeLog] 🏁 跑分开始，10 秒后自动上传...",
      args: ["[codeLog] 🏁 跑分开始，10 秒后自动上传..."]
    }));
  }
  async stopPerfRun() {
    var r, l;
    if (!this.perfRunning) return null;
    const e = ((r = this.perfRunCollector) == null ? void 0 : r.getSnapshot()) ?? {
      vitals: [],
      samples: [],
      longTasks: [],
      resources: [],
      interactions: []
    };
    (l = this.perfRunCollector) == null || l.destroy(), this.perfRunCollector = null, this.exitZenMode(!0);
    const t = new Set(e.vitals.map((c) => c.name)), n = [
      ...this.prePerfRunVitals.filter((c) => !t.has(c.name)),
      ...e.vitals
    ];
    e.vitals = n, this.prePerfRunVitals = [];
    const i = gn(), o = Date.now(), a = {
      sessionId: Date.now().toString(36),
      tabId: this.tabId,
      startTime: this.perfRunStartTime,
      endTime: o,
      duration: o - this.perfRunStartTime,
      snapshot: e,
      audit: i
    };
    return this.dataBus.emit("perf_run_raw", a), this.perfRunning = !1, this.dataBus.emit("console", {
      timestamp: Date.now(),
      level: "log",
      message: "[codeLog] 🏁 跑分数据已上传，服务正在计算分数...",
      args: ["[codeLog] 🏁 跑分数据已上传，服务正在计算分数..."]
    }), a;
  }
  getPerfReport() {
    return this.lastPerfRunSession;
  }
  setNetworkThrottle(e) {
    this.networkThrottle || (this.networkThrottle = new bn()), this.networkThrottle.setPreset(e);
  }
  addMock(e, t) {
    return this.mockApi || (this.mockApi = new de(), this.mockApi.onMatch = (n, i) => {
      this.reporter.reportMockMatch(n, i);
    }, this.mockApi.start()), this.mockApi.addRule({ pattern: e, ...t });
  }
  removeMock(e) {
    var t;
    (t = this.mockApi) == null || t.removeRule(e);
  }
  clearMocks() {
    var e;
    (e = this.mockApi) == null || e.clearRules();
  }
  getMocks() {
    var e;
    return ((e = this.mockApi) == null ? void 0 : e.getRules()) ?? [];
  }
  /**
   * 禅模式：停止所有高开销采集（FPS/PerformanceObserver/Network/Storage 监听），
   * 只保留 console + error 捕获和 WebSocket 传输。
   * 适合跑性能报告时使用，避免 SDK 自身干扰测量结果。
   */
  enterZenMode(e = !1) {
    var t, n;
    this.zenMode || (this.zenMode = !0, this.performanceCollector && (this.performanceCollector.destroy(), this.performanceCollector = null), this.networkInterceptor && (this.networkInterceptor.stop(), this.networkInterceptor = null), this.wsInterceptor && (this.wsInterceptor.stop(), this.wsInterceptor = null), this.sseInterceptor && (this.sseInterceptor.stop(), this.sseInterceptor = null), this.beaconInterceptor && (this.beaconInterceptor.stop(), this.beaconInterceptor = null), (t = this.storageReader) == null || t.unwatch(), (n = this.domCollector) == null || n.destroy(), this.domCollector = null, e || this.dataBus.emit("console", {
      timestamp: Date.now(),
      level: "warn",
      message: "[codeLog] Zen Mode ON — 已停止高开销采集",
      args: ["[codeLog] Zen Mode ON — 已停止高开销采集"]
    }));
  }
  /**
   * 退出禅模式，恢复所有采集器。
   */
  exitZenMode(e = !1) {
    this.zenMode && (this.zenMode = !1, this.initNetworkInterceptor(this.networkConfig), this.initStorageReader(), this.initPerformanceCollector(), e || this.dataBus.emit("console", {
      timestamp: Date.now(),
      level: "log",
      message: "[codeLog] Zen Mode OFF — 已恢复所有采集",
      args: ["[codeLog] Zen Mode OFF — 已恢复所有采集"]
    }));
  }
  /** 当前是否处于禅模式 */
  isZenMode() {
    return this.zenMode;
  }
  enableRemote() {
    this.reporter.enableRemote();
  }
  disableRemote() {
    this.reporter.disableRemote();
  }
  isRemoteEnabled() {
    return this.reporter.isRemoteEnabled();
  }
  /** 上报自定义事件 */
  report(e, t) {
    this.dataBus.emit("custom", { name: e, data: t });
  }
  /**
   * Upload buffered console logs to the server for offline replay.
   * Call this to persist the current session's logs before the page unloads.
   */
  async uploadLogs(e) {
    var i, o, a;
    if (!this.resolvedServerUrl) return null;
    const t = this.resolvedServerUrl.replace(/^ws:\/\//, "http://").replace(/^wss:\/\//, "https://").replace(/\/ws$/, ""), n = ((a = (o = (i = this.dataBus).getBuffer) == null ? void 0 : o.call(i, "console")) == null ? void 0 : a.map((r) => ({
      timestamp: r.timestamp,
      level: r.level,
      message: r.message,
      stack: r.stack,
      tabId: this.tabId
    }))) ?? [];
    try {
      const r = await fetch(`${t}/api/saved-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: this.deviceInfo.deviceId,
          ua: this.deviceInfo.ua,
          projectId: this.projectId,
          startTime: (e == null ? void 0 : e.startTime) ?? Date.now() - 36e5,
          endTime: (e == null ? void 0 : e.endTime) ?? Date.now(),
          logs: n
        })
      });
      return r.ok ? (await r.json()).id ?? null : null;
    } catch {
      return null;
    }
  }
  /**
   * Flush the offline buffer: upload buffered events to the server and clear the buffer.
   * Returns the saved session ID, or null if upload failed.
   */
  async flushOfflineBuffer() {
    var i, o;
    if (!this.offlineBuffer || !this.resolvedServerUrl) return null;
    const e = this.offlineBuffer.flush();
    if (e.length === 0) return null;
    const t = this.resolvedServerUrl.replace(/^ws:\/\//, "http://").replace(/^wss:\/\//, "https://").replace(/\/ws$/, ""), n = e.filter((a) => a.type === "console" || a.type === "error").map((a) => {
      var r, l, c;
      return {
        timestamp: a.ts,
        level: ((r = a.payload) == null ? void 0 : r.level) ?? "log",
        message: ((l = a.payload) == null ? void 0 : l.message) ?? "",
        stack: (c = a.payload) == null ? void 0 : c.stack,
        tabId: this.tabId
      };
    });
    try {
      const a = await fetch(`${t}/api/saved-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: this.deviceInfo.deviceId,
          ua: this.deviceInfo.ua,
          projectId: this.projectId,
          startTime: ((i = e[0]) == null ? void 0 : i.ts) ?? Date.now(),
          endTime: ((o = e[e.length - 1]) == null ? void 0 : o.ts) ?? Date.now(),
          logs: n
        })
      });
      return a.ok ? (await a.json()).id ?? null : null;
    } catch {
      return null;
    }
  }
  destroy() {
    this.dataBus.emit("lifecycle", { event: "disconnect" }), this.visibilityHandler && (document.removeEventListener("visibilitychange", this.visibilityHandler), this.visibilityHandler = null), this.beforeUnloadHandler && (window.removeEventListener("beforeunload", this.beforeUnloadHandler), this.beforeUnloadHandler = null), this.heartbeatTimerId !== null && (this.platform.timer.clearInterval(this.heartbeatTimerId), this.heartbeatTimerId = null), this.originalConsole && (console.log = this.originalConsole.log, console.warn = this.originalConsole.warn, console.error = this.originalConsole.error, console.info = this.originalConsole.info, console.debug = this.originalConsole.debug, console.trace = this.originalConsole.trace, console.clear = this.originalConsole.clear, this.originalConsole = null), globalThis[O] === this && delete globalThis[O], this.erudaPlugin.detach(), this.erudaInitialized && this.eruda && (this.eruda.destroy(), this.erudaInitialized = !1, this.eruda = null), this.networkInterceptor && (this.networkInterceptor.stop(), this.networkInterceptor = null), this.wsInterceptor && (this.wsInterceptor.stop(), this.wsInterceptor = null), this.sseInterceptor && (this.sseInterceptor.stop(), this.sseInterceptor = null), this.beaconInterceptor && (this.beaconInterceptor.stop(), this.beaconInterceptor = null), this.errorInterceptor && (this.errorInterceptor.stop(), this.errorInterceptor = null), this.domCollector && (this.domCollector.destroy(), this.domCollector = null), this.performanceCollector && (this.performanceCollector.destroy(), this.performanceCollector = null), this.storageReader && (this.storageReader.unwatch(), this.storageReader = null), this.systemCollector && (this.systemCollector.stopWatching(), this.systemCollector = null), this.idbInterceptor && (this.idbInterceptor.stop(), this.idbInterceptor = null), this.gestureActivator && (this.gestureActivator.stop(), this.gestureActivator = null), this.networkThrottle && (this.networkThrottle.destroy(), this.networkThrottle = null), this.mockApi && (this.mockApi.stop(), this.mockApi = null), this.perfRunCollector && (this.perfRunCollector.destroy(), this.perfRunCollector = null), this.reporter.detachDataBus(), this.dataBus.clear(), this.pluginManager.destroyAll(), this.reporter.disconnect();
  }
  /** Install a plugin dynamically at runtime */
  async use(e) {
    await this.pluginManager.use(e), this.reporter.announcePlugins(this.pluginManager.list());
  }
  /** Enable a previously disabled plugin */
  enablePlugin(e) {
    this.pluginManager.enable(e), this.reporter.announcePlugins(this.pluginManager.list());
  }
  /** Disable a plugin without uninstalling it */
  disablePlugin(e) {
    this.pluginManager.disable(e), this.reporter.announcePlugins(this.pluginManager.list());
  }
  /** Remove and uninstall a plugin */
  removePlugin(e) {
    this.pluginManager.remove(e), this.reporter.announcePlugins(this.pluginManager.list());
  }
  /** List all installed plugins */
  listPlugins() {
    return this.pluginManager.list();
  }
}
let z = null;
function Dn(s) {
  if (z)
    z.destroy(), z = null;
  else {
    const e = globalThis[O];
    e && typeof e.destroy == "function" && e.destroy();
  }
  return z = new In(s), z;
}
function $n() {
  return z;
}
function An(s) {
  if (!s) return;
  const e = typeof location < "u" && location.protocol === "https:" ? "wss" : "ws", t = typeof location < "u" ? location.hostname : "localhost";
  return `${e}://${t}:${s}`;
}
export {
  st as BrowserAdapter,
  In as CodeLog,
  En as DataHarborPlugin,
  Tn as OSpyPlugin,
  xn as RRWebPlugin,
  In as default,
  $n as getInstance,
  Dn as init,
  An as resolveServerUrl,
  Ln as version
};
