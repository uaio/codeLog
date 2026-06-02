function H(i) {
  let e = 0;
  for (let t = 0; t < i.length; t++) {
    const s = i.charCodeAt(t);
    e = (e << 5) - e + s, e = e & e;
  }
  return Math.abs(e).toString(16);
}
function L(i) {
  let e = 2166136261;
  for (let t = 0; t < i.length; t++)
    e ^= i.charCodeAt(t), e = e * 16777619 >>> 0;
  return e.toString(16).padStart(8, "0");
}
function ne(...i) {
  const e = L(i.slice(0, Math.ceil(i.length / 2)).join("|")), t = L(i.slice(Math.ceil(i.length / 2)).join("|"));
  return e + t;
}
function oe() {
  return "tab-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}
const j = "_codelog_fp";
function re() {
  try {
    const e = localStorage.getItem(j);
    if (e && /^[0-9a-f]{16,}$/.test(e))
      return e;
  } catch {
  }
  const i = ie();
  try {
    localStorage.setItem(j, i);
  } catch {
  }
  return i;
}
function ie() {
  const i = [
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
    ae(),
    // WebGL renderer
    ce(),
    // Audio context fingerprint
    le()
  ];
  return ne(...i);
}
function ae() {
  try {
    const i = document.createElement("canvas");
    i.width = 240, i.height = 60;
    const e = i.getContext("2d");
    return e ? (e.fillStyle = "#f0f0f0", e.fillRect(0, 0, 240, 60), e.fillStyle = "#1a1a2e", e.font = '14px "Arial", sans-serif', e.fillText("codeLog 🔍 BrowserFP", 10, 22), e.font = 'bold 11px "Courier New", monospace', e.fillStyle = "#16213e", e.fillText("abcdef ABCDEF 012345", 10, 42), e.strokeStyle = "#0f3460", e.lineWidth = 1.5, e.beginPath(), e.arc(200, 30, 18, 0, Math.PI * 2), e.stroke(), L(i.toDataURL().slice(22, 100))) : "no-canvas";
  } catch {
    return "canvas-blocked";
  }
}
function ce() {
  try {
    const i = document.createElement("canvas"), e = i.getContext("webgl") ?? i.getContext("experimental-webgl");
    if (!e) return "no-webgl";
    const t = e.getExtension("WEBGL_debug_renderer_info");
    return t ? e.getParameter(t.UNMASKED_RENDERER_WEBGL) : "no-ext";
  } catch {
    return "webgl-blocked";
  }
}
function le() {
  try {
    const i = window.AudioContext ?? window.webkitAudioContext;
    if (!i) return "no-audio";
    const e = new i(), t = e.createOscillator(), s = e.createAnalyser(), n = e.createGain();
    n.gain.value = 0, t.connect(s), s.connect(n), n.connect(e.destination), t.start(0);
    const o = new Float32Array(s.frequencyBinCount);
    s.getFloatFrequencyData(o), t.stop(), e.close();
    const r = o.slice(0, 32).join(",");
    return L(r);
  } catch {
    return "audio-blocked";
  }
}
function he(i, e) {
  try {
    if (typeof window < "u" && typeof localStorage < "u") {
      const n = re(), o = e.device.getUrl(), r = L(o);
      return `${H(i)}-${n}-${r}`;
    }
  } catch {
  }
  const t = e.device.getUserAgent(), s = e.device.getUrl();
  return H(t + i + s);
}
function ue(i, e) {
  const t = he(i, e), s = `_codelog_connect_${i}`, n = e.storage.getItem(s);
  return n || e.storage.setItem(s, Date.now().toString()), {
    deviceId: t,
    projectId: i,
    ua: e.device.getUserAgent(),
    screen: e.device.getScreen(),
    pixelRatio: e.device.getPixelRatio(),
    language: e.device.getLanguage(),
    url: e.device.getUrl(),
    connectTime: n ? parseInt(n) : Date.now(),
    lastActiveTime: Date.now()
  };
}
function de(i, e) {
  e.storage.setItem(`codelog_last_active_${i}`, Date.now().toString());
}
class pe {
  constructor() {
    this.listeners = /* @__PURE__ */ new Map();
  }
  emit(e, t) {
    const s = this.listeners.get(e);
    if (!(!s || s.size === 0))
      for (const n of s)
        try {
          n(t);
        } catch {
        }
  }
  /** 订阅事件，返回取消订阅函数 */
  on(e, t) {
    return this.listeners.has(e) || this.listeners.set(e, /* @__PURE__ */ new Set()), this.listeners.get(e).add(t), () => this.off(e, t);
  }
  off(e, t) {
    var s;
    (s = this.listeners.get(e)) == null || s.delete(t);
  }
  /** 清除所有监听器（用于 destroy） */
  clear() {
    this.listeners.clear();
  }
}
class fe {
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
class ge {
  constructor(e, t, s) {
    this.conn = null, this.state = "disconnected", this.reconnectAttempts = 0, this.maxReconnectAttempts = 10, this.reconnectDelay = 3e3, this.shouldReconnect = !0, this.reconnectTimer = null;
    let n = e.server || "";
    if (e.secret && n) {
      const o = n.includes("?") ? "&" : "?";
      n = `${n}${o}apiKey=${encodeURIComponent(e.secret)}`;
    }
    this.serverUrl = n, this.events = t, this.messageQueue = new fe(100), this.platform = s;
  }
  connect() {
    var e, t;
    if (!(!this.shouldReconnect || !this.serverUrl) && !(this.state === "connecting" || this.state === "connected")) {
      this.state = "connecting", this.reconnectAttempts++;
      try {
        this.conn = this.platform.createWebSocket(this.serverUrl, {
          onOpen: () => {
            var n, o, r;
            this.state = "connected", this.reconnectAttempts = 0, (o = (n = this.events).onConnect) == null || o.call(n);
            const s = this.messageQueue.dequeueAll();
            for (const a of s)
              (r = this.conn) == null || r.send(a);
          },
          onMessage: (s) => {
            var n, o;
            (o = (n = this.events).onMessage) == null || o.call(n, s);
          },
          onClose: () => {
            var s, n;
            this.state = "disconnected", (n = (s = this.events).onDisconnect) == null || n.call(s), this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts && (this.reconnectTimer = this.platform.timer.setTimeout(() => {
              this.reconnectTimer = null, this.connect();
            }, this.reconnectDelay));
          },
          onError: (s) => {
            var n, o;
            this.state = "error", (o = (n = this.events).onError) == null || o.call(n, s);
          }
        });
      } catch (s) {
        this.state = "error", (t = (e = this.events).onError) == null || t.call(e, s);
      }
    }
  }
  send(e) {
    var t, s;
    if (this.state === "connected" && this.conn)
      try {
        this.conn.send(e);
      } catch (n) {
        this.state = "error", (s = (t = this.events).onError) == null || s.call(t, n);
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
class me {
  constructor(e = 100) {
    this.maxPerSecond = e, this.count = 0, this.resetTime = 0;
  }
  /** 检查是否超过速率限制，返回 true 表示允许 */
  check() {
    const e = Date.now();
    return e > this.resetTime + 1e3 && (this.count = 0, this.resetTime = e), this.count >= this.maxPerSecond ? !1 : (this.count++, !0);
  }
}
function x(i) {
  return i.length === 0 ? "" : typeof i[0] == "string" && /%[sdifoOc]/.test(i[0]) ? ye(i[0], i.slice(1)) : i.map((e) => {
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
function ye(i, e) {
  let t = 0;
  const s = i.replace(/%([sdifoOc])/g, (o, r) => {
    if (t >= e.length) return `%${r}`;
    const a = e[t++];
    switch (r) {
      case "s":
        return a === void 0 ? "undefined" : a === null ? "null" : String(a);
      case "d":
      case "i":
        return String(parseInt(String(a), 10));
      case "f":
        return String(parseFloat(String(a)));
      case "o":
      case "O":
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      case "c":
        return "";
      default:
        return `%${r}`;
    }
  }), n = e.slice(t).map((o) => {
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
  return n ? `${s} ${n}` : s;
}
function be(i) {
  const e = [];
  if (typeof i[0] != "string") return e;
  let t = 1;
  const s = i[0], n = /%([sdifoOc])/g;
  let o;
  for (; (o = n.exec(s)) !== null && !(t >= i.length); )
    o[1] === "c" && e.push(String(i[t])), t++;
  return e;
}
function we(i) {
  if (typeof i[0] != "string") return null;
  const e = i[0];
  if (!/%c/.test(e)) return null;
  const t = [];
  let s = 1, n = 0, o;
  const r = /%([sdifoOc])/g;
  let a;
  for (; (a = r.exec(e)) !== null; )
    if (a[1] === "c") {
      const u = e.slice(n, a.index);
      u && t.push({ text: u, style: o }), o = s < i.length ? String(i[s]) : void 0, s++, n = a.index + a[0].length;
    } else
      s < i.length && s++;
  const c = e.slice(n);
  return c && t.push({ text: c, style: o }), t.length === 0 ? null : t;
}
function O(i) {
  return i ? i.split(`
`).filter(
    (s) => !s.includes("interceptConsole") && !s.includes("serializeArgs") && !s.includes("cleanStackTrace")
  ).join(`
`) : void 0;
}
class Se {
  constructor(e, t, s) {
    this.transport = null, this.remoteEnabled = !0, this.onRefreshStorageCallback = null, this.onRefreshDOMCallback = null, this.onTakeScreenshotCallback = null, this.onZenModeCallback = null, this.onStartPerfRunCallback = null, this.onStopPerfRunCallback = null, this.onPerfRunDoneCallback = null, this.onSetNetworkThrottleCallback = null, this.onAddMockCallback = null, this.onRemoveMockCallback = null, this.onClearMocksCallback = null, this.onUpdateMockRuleCallback = null, this.onRequestIDBSnapshotCallback = null, this.onRequestIDBStoreDataCallback = null, this.onGetComputedStylesCallback = null, this.onSetElementAttrCallback = null, this.onStartElementPickerCallback = null, this.executeJsBus = null, this.rateLimiter = new me(100), this.dataBusUnsubscribers = [], this.deviceInfo = e, this.tabId = t, this.platform = s;
  }
  connect(e) {
    this.remoteEnabled && (this.serverUrl = e ?? this.serverUrl, this.transport = new ge(
      { projectId: this.deviceInfo.projectId, server: this.serverUrl },
      {
        onConnect: () => {
          this.sendRegisterMessage();
        },
        onMessage: (t) => {
          var s, n, o, r, a, c, l, u, d, h, f, b, w, S, p, g, m;
          if (t.type === "refresh_storage" && ((s = this.onRefreshStorageCallback) == null || s.call(this)), t.type === "refresh_dom" && ((n = this.onRefreshDOMCallback) == null || n.call(this)), t.type === "take_screenshot" && ((o = this.onTakeScreenshotCallback) == null || o.call(this)), t.type === "execute_js" && t.code && this.executeJsBus && this.runCode(t.code, this.executeJsBus), t.type === "reload_page")
            try {
              window.location.reload();
            } catch {
            }
          if (t.type === "set_storage")
            try {
              t.storageType === "cookie" ? (async () => {
                var I;
                const v = t.key, k = t.value ?? "";
                if (typeof ((I = window.cookieStore) == null ? void 0 : I.set) == "function") {
                  const C = { name: v, value: k };
                  t.path && (C.path = t.path), t.domain && (C.domain = t.domain), t.expires && (C.expires = t.expires), t.secure !== void 0 && (C.secure = t.secure), t.sameSite && (C.sameSite = t.sameSite), await window.cookieStore.set(C);
                } else {
                  let C = `${encodeURIComponent(v)}=${encodeURIComponent(k)}`;
                  C += `; path=${t.path ?? "/"}`, t.domain && (C += `; domain=${t.domain}`), t.expires && (C += `; expires=${new Date(t.expires).toUTCString()}`), t.secure && (C += "; Secure"), t.sameSite && (C += `; SameSite=${t.sameSite}`), document.cookie = C;
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
                const y = ["/", "/"], v = encodeURIComponent(t.key);
                for (const k of y)
                  document.cookie = `${v}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${k}`;
              } else
                (t.storageType === "session" ? sessionStorage : localStorage).removeItem(t.key);
            } catch {
            }
          if (t.type === "highlight_element" && t.selector && this.highlightElement(t.selector, t.duration ?? 3e3), t.type === "zen_mode" && ((r = this.onZenModeCallback) == null || r.call(this, !!t.enabled)), t.type === "start_perf_run" && ((a = this.onStartPerfRunCallback) == null || a.call(this)), t.type === "stop_perf_run" && ((c = this.onStopPerfRunCallback) == null || c.call(this)), t.type === "perf_run_done" && t.score && ((l = this.onPerfRunDoneCallback) == null || l.call(this, t.score)), t.type === "set_network_throttle" && t.preset && ((u = this.onSetNetworkThrottleCallback) == null || u.call(this, t.preset)), t.type === "add_mock" && t.rule && ((d = this.onAddMockCallback) == null || d.call(this, t.rule)), t.type === "remove_mock" && t.id && ((h = this.onRemoveMockCallback) == null || h.call(this, t.id)), t.type === "clear_mocks" && ((f = this.onClearMocksCallback) == null || f.call(this)), t.type === "update_mock_rule" && t.id && ((b = this.onUpdateMockRuleCallback) == null || b.call(this, t.id, t.enabled ?? !0)), t.type === "request_idb_snapshot" && ((w = this.onRequestIDBSnapshotCallback) == null || w.call(this)), t.type === "request_idb_store_data" && ((S = this.onRequestIDBStoreDataCallback) == null || S.call(
            this,
            t.dbName,
            t.storeName,
            t.page ?? 0,
            t.pageSize ?? 50,
            t.reqId ?? ""
          )), t.type === "idb_clear_store" && t.dbName && t.storeName)
            try {
              const y = indexedDB.open(t.dbName);
              y.onsuccess = () => {
                const v = y.result;
                try {
                  const k = v.transaction(t.storeName, "readwrite");
                  k.objectStore(t.storeName).clear(), k.oncomplete = () => {
                    v.close();
                  }, k.onerror = () => {
                    v.close();
                  };
                } catch {
                  v.close();
                }
              };
            } catch {
            }
          if (t.type === "idb_put_record" && t.dbName && t.storeName && t.value !== void 0)
            try {
              const y = indexedDB.open(t.dbName);
              y.onsuccess = () => {
                const v = y.result;
                try {
                  const k = v.transaction(t.storeName, "readwrite"), I = k.objectStore(t.storeName), C = I.keyPath !== null ? I.put(t.value) : I.put(t.value, t.key);
                  C.onsuccess = () => {
                  }, k.oncomplete = () => {
                    v.close();
                  }, k.onerror = () => {
                    v.close();
                  };
                } catch {
                  v.close();
                }
              };
            } catch {
            }
          t.type === "get_computed_styles" && t.selector && ((p = this.onGetComputedStylesCallback) == null || p.call(this, t.selector)), t.type === "set_element_attr" && t.selector && t.attr !== void 0 && ((g = this.onSetElementAttrCallback) == null || g.call(this, t.selector, t.attr, t.value ?? "")), t.type === "start_element_picker" && ((m = this.onStartElementPickerCallback) == null || m.call(this));
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
      e.on("perf_run_raw", (t) => this.reportPerfRunRaw(t))
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
      const s = (0, eval)(e);
      s !== void 0 && t.emit("console", {
        timestamp: Date.now(),
        level: "repl-output",
        message: x([s]),
        args: [s]
      });
    } catch (s) {
      const n = s instanceof Error ? s.message : String(s);
      t.emit("console", {
        timestamp: Date.now(),
        level: "error",
        message: n,
        args: [n]
      });
    }
  }
  highlightElement(e, t) {
    if (!(typeof document > "u"))
      try {
        const s = document.querySelector(e);
        if (!s) return;
        const n = s.style.outline, o = s.style.backgroundColor;
        s.style.outline = "3px solid #ff4d4f", s.style.backgroundColor = "rgba(255,77,79,0.15)", s.scrollIntoView({ behavior: "smooth", block: "center" }), setTimeout(() => {
          s.style.outline = n, s.style.backgroundColor = o;
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
function z() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
function R(i, e) {
  return !i || new TextEncoder().encode(i).length <= e ? i : i.slice(0, Math.floor(e / 2)) + "...[truncated]";
}
function q(i, e) {
  for (const t of e)
    try {
      if (new RegExp(t).test(i))
        return !0;
    } catch {
    }
  return !1;
}
function _(i) {
  const e = {};
  return i.forEach((t, s) => {
    e[s] = t;
  }), e;
}
function N(i, e) {
  try {
    const s = performance.getEntriesByType("resource").find(
      (u) => u.name === i || u.name.endsWith(i) && Math.abs(u.startTime - (e - performance.timeOrigin)) < 500
    );
    if (!s || s.startTime === 0) return;
    const n = s.domainLookupEnd - s.domainLookupStart, o = s.connectEnd - s.connectStart, r = s.secureConnectionStart > 0 ? s.connectEnd - s.secureConnectionStart : 0, a = s.responseStart - s.requestStart, c = s.responseEnd - s.responseStart, l = s.responseEnd - s.startTime;
    return {
      dns: Math.max(0, n),
      tcp: Math.max(0, o),
      ssl: Math.max(0, r),
      request: Math.max(0, a),
      response: Math.max(0, c),
      total: Math.max(0, l)
    };
  } catch {
    return;
  }
}
function F(i, e) {
  if (i) {
    const t = i["content-length"];
    if (t) {
      const s = parseInt(t, 10);
      if (!isNaN(s)) return s;
    }
  }
  if (e)
    return new TextEncoder().encode(e).length;
}
class ve {
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
    window.fetch = function(t, s) {
      var d, h;
      const n = z(), o = Date.now();
      let r, a = ((d = s == null ? void 0 : s.method) == null ? void 0 : d.toUpperCase()) || "GET", c, l, u;
      try {
        u = (h = new Error().stack) == null ? void 0 : h.split(`
`).slice(3, 8).join(`
`);
      } catch {
      }
      if (typeof t == "string" ? r = t : t instanceof URL ? r = t.toString() : t instanceof Request ? (r = t.url, a = t.method.toUpperCase(), c = _(t.headers)) : r = String(t), q(r, e.config.ignoreUrls))
        return e.originalFetch.call(window, t, s);
      if (s && (s.headers && (s.headers instanceof Headers ? c = _(s.headers) : typeof s.headers == "object" && (c = s.headers)), s.body))
        if (typeof s.body == "string")
          l = R(s.body, e.config.maxRequestBodySize);
        else if (s.body instanceof FormData)
          l = "[FormData]";
        else
          try {
            l = R(
              JSON.stringify(s.body),
              e.config.maxRequestBodySize
            );
          } catch {
            l = "[Body]";
          }
      return e.originalFetch.call(window, t, s).then(async (f) => {
        const b = Date.now() - o;
        let w;
        try {
          w = _(f.headers);
        } catch {
        }
        let S;
        try {
          const p = f.clone(), g = (w == null ? void 0 : w["content-type"]) ?? "";
          if (g.includes("application/json")) {
            const m = await p.text();
            S = R(m, e.config.maxResponseBodySize);
          } else if (g.includes("text/")) {
            const m = await p.text();
            S = R(m, e.config.maxResponseBodySize);
          } else if (g) {
            const m = await p.blob();
            if (m.size <= e.config.maxResponseBodySize) {
              const y = await m.arrayBuffer(), v = new Uint8Array(y);
              let k = "";
              v.forEach((I) => {
                k += String.fromCharCode(I);
              }), S = `[binary: ${m.type}, ${m.size}B] ` + btoa(k).slice(0, 200);
            } else
              S = `[binary: ${m.type}, ${m.size}B, EXCEED_SIZE]`;
          } else {
            const m = await p.text();
            S = R(m, e.config.maxResponseBodySize);
          }
        } catch {
        }
        return e.onReport({
          id: n,
          timestamp: o,
          method: a,
          url: r,
          status: f.status,
          statusText: f.statusText,
          requestHeaders: c,
          requestBody: l,
          responseHeaders: w,
          responseBody: S,
          duration: b,
          type: "fetch",
          responseSize: F(w, S),
          timingPhases: N(r, o),
          initiator: u
        }), f;
      }).catch((f) => {
        const b = Date.now() - o;
        throw e.onReport({
          id: n,
          timestamp: o,
          method: a,
          url: r,
          requestHeaders: c,
          requestBody: l,
          duration: b,
          type: "fetch",
          error: f.message,
          initiator: u
        }), f;
      });
    };
  }
  /** 拦截 XMLHttpRequest */
  interceptXHR() {
    const e = this;
    this.originalXhrOpen = XMLHttpRequest.prototype.open, this.originalXhrSend = XMLHttpRequest.prototype.send, this.originalXhrSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    const t = /* @__PURE__ */ new WeakMap();
    XMLHttpRequest.prototype.open = function(s, n, o = !0, r, a) {
      var u;
      let c;
      try {
        c = (u = new Error().stack) == null ? void 0 : u.split(`
`).slice(3, 8).join(`
`);
      } catch {
      }
      const l = {
        requestId: z(),
        startTime: 0,
        method: s.toUpperCase(),
        url: typeof n == "string" ? n : n.toString(),
        requestHeaders: {},
        initiator: c
      };
      return t.set(this, l), e.originalXhrOpen.call(this, s, n, o, r, a);
    }, XMLHttpRequest.prototype.setRequestHeader = function(s, n) {
      const o = t.get(this);
      return o && (o.requestHeaders[s] = n), e.originalXhrSetRequestHeader.call(this, s, n);
    }, XMLHttpRequest.prototype.send = function(s) {
      const n = t.get(this);
      if (!n)
        return e.originalXhrSend.call(this, s);
      if (q(n.url, e.config.ignoreUrls))
        return e.originalXhrSend.call(this, s);
      if (n.startTime = Date.now(), s)
        if (typeof s == "string")
          n.requestBody = R(s, e.config.maxRequestBodySize);
        else if (s instanceof FormData)
          n.requestBody = "[FormData]";
        else
          try {
            n.requestBody = R(
              JSON.stringify(s),
              e.config.maxRequestBodySize
            );
          } catch {
            n.requestBody = "[Body]";
          }
      const o = () => {
        const a = Date.now() - n.startTime;
        let c;
        try {
          const u = this.getAllResponseHeaders();
          if (u) {
            const d = {};
            u.split(`\r
`).forEach((h) => {
              const [f, b] = h.split(": ");
              f && b && (d[f] = b);
            }), Object.keys(d).length > 0 && (c = d);
          }
        } catch {
        }
        let l;
        try {
          const u = this.responseType;
          if (!u || u === "text" || u === "json") {
            const d = u === "json" ? JSON.stringify(this.response) : this.responseText;
            d && (l = R(d, e.config.maxResponseBodySize));
          } else if (u === "arraybuffer" && this.response instanceof ArrayBuffer) {
            const d = new Uint8Array(this.response);
            if (d.byteLength <= e.config.maxResponseBodySize) {
              let h = "";
              d.forEach((f) => {
                h += String.fromCharCode(f);
              }), l = `[arraybuffer: ${d.byteLength}B] ` + btoa(h).slice(0, 200);
            } else
              l = `[arraybuffer: ${d.byteLength}B, EXCEED_SIZE]`;
          } else u === "blob" && this.response instanceof Blob ? l = `[blob: ${this.response.type}, ${this.response.size}B${this.response.size > e.config.maxResponseBodySize ? ", EXCEED_SIZE" : ""}]` : u === "document" && (l = "[document]");
        } catch {
        }
        e.onReport({
          id: n.requestId,
          timestamp: n.startTime,
          method: n.method,
          url: n.url,
          status: this.status,
          statusText: this.statusText,
          requestHeaders: n.requestHeaders,
          requestBody: n.requestBody,
          responseHeaders: c,
          responseBody: l,
          duration: a,
          type: "xhr",
          withCredentials: this.withCredentials,
          responseSize: F(c, l),
          timingPhases: N(n.url, n.startTime),
          initiator: n.initiator
        });
      }, r = () => {
        const a = Date.now() - n.startTime;
        e.onReport({
          id: n.requestId,
          timestamp: n.startTime,
          method: n.method,
          url: n.url,
          requestHeaders: n.requestHeaders,
          requestBody: n.requestBody,
          duration: a,
          type: "xhr",
          error: "Network error"
        });
      };
      return this.addEventListener("load", o), this.addEventListener("error", r), e.originalXhrSend.call(this, s);
    };
  }
}
class ke {
  constructor(e) {
    this.originalWebSocket = null, this.connections = /* @__PURE__ */ new Map(), this.onReport = e;
  }
  start() {
    if (typeof WebSocket > "u") return;
    this.originalWebSocket = WebSocket;
    const e = this, t = WebSocket;
    window.WebSocket = function(s, n) {
      const o = n !== void 0 ? new t(s, n) : new t(s), r = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, a = String(s), c = {
        id: r,
        url: a,
        openTime: Date.now(),
        messageCount: 0
      };
      e.connections.set(o, c), o.addEventListener("open", () => {
        c.openTime = Date.now(), e.onReport({
          id: r,
          method: "WS",
          url: a,
          type: "ws",
          wsEventType: "open",
          wsConnectionId: r,
          status: 101,
          statusText: "Switching Protocols",
          timestamp: Date.now()
        });
      }), o.addEventListener("message", (u) => {
        c.messageCount++;
        const d = typeof u.data == "string" ? u.data : u.data instanceof ArrayBuffer ? `[Binary ArrayBuffer: ${u.data.byteLength} bytes]` : u.data instanceof Blob ? `[Blob: ${u.data.size} bytes]` : String(u.data);
        e.onReport({
          id: `${r}-recv-${c.messageCount}`,
          method: "WS",
          url: a,
          type: "ws",
          wsEventType: "message",
          wsDirection: "receive",
          wsConnectionId: r,
          responseBody: d,
          timestamp: Date.now()
        });
      }), o.addEventListener("error", () => {
        e.onReport({
          id: `${r}-err`,
          method: "WS",
          url: a,
          type: "ws",
          wsEventType: "error",
          wsConnectionId: r,
          error: "WebSocket error",
          timestamp: Date.now()
        }), e.connections.delete(o);
      }), o.addEventListener("close", (u) => {
        const d = Date.now() - c.openTime;
        e.onReport({
          id: `${r}-close`,
          method: "WS",
          url: a,
          type: "ws",
          wsEventType: "close",
          wsConnectionId: r,
          status: u.code,
          statusText: u.reason || "Connection closed",
          duration: d,
          messageCount: c.messageCount,
          timestamp: Date.now()
        }), e.connections.delete(o);
      });
      const l = o.send.bind(o);
      return o.send = (u) => {
        c.messageCount++;
        const d = typeof u == "string" ? u : u instanceof ArrayBuffer ? `[Binary ArrayBuffer: ${u.byteLength} bytes]` : u instanceof Blob ? `[Blob: ${u.size} bytes]` : `[Binary: ${u.byteLength} bytes]`;
        e.onReport({
          id: `${r}-send-${c.messageCount}`,
          method: "WS",
          url: a,
          type: "ws",
          wsEventType: "message",
          wsDirection: "send",
          wsConnectionId: r,
          requestBody: d,
          timestamp: Date.now()
        }), l(u);
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
class Ce {
  constructor(e) {
    this.originalEventSource = null, this.onReport = e;
  }
  start() {
    if (typeof EventSource > "u") return;
    this.originalEventSource = EventSource;
    const e = this, t = EventSource;
    window.EventSource = function(s, n) {
      const o = new t(s, n), r = `sse-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, a = String(s);
      let c = Date.now(), l = 0;
      return o.addEventListener("open", () => {
        c = Date.now(), e.onReport({
          id: r,
          method: "SSE",
          url: a,
          type: "sse",
          wsEventType: "open",
          status: 200,
          statusText: "OK",
          timestamp: Date.now()
        });
      }), o.addEventListener("message", (u) => {
        l++, e.onReport({
          id: `${r}-msg-${l}`,
          method: "SSE",
          url: a,
          type: "sse",
          wsEventType: "message",
          wsDirection: "receive",
          responseBody: u.data,
          timestamp: Date.now()
        });
      }), o.addEventListener("error", () => {
        const u = Date.now() - c;
        e.onReport({
          id: `${r}-err`,
          method: "SSE",
          url: a,
          type: "sse",
          wsEventType: "error",
          error: o.readyState === EventSource.CLOSED ? "Connection closed" : "SSE error",
          duration: u,
          messageCount: l,
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
class Ie {
  constructor(e) {
    this.originalSendBeacon = null, this.onReport = e;
  }
  start() {
    if (typeof (navigator == null ? void 0 : navigator.sendBeacon) != "function") return;
    this.originalSendBeacon = navigator.sendBeacon.bind(navigator);
    const e = this;
    navigator.sendBeacon = function(t, s) {
      const n = `beacon-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, o = String(t);
      let r;
      if (s != null)
        if (typeof s == "string")
          r = s;
        else if (s instanceof Blob)
          r = `[Blob: ${s.size} bytes, type: ${s.type || "unknown"}]`;
        else if (s instanceof FormData) {
          const c = [];
          s.forEach((l, u) => {
            c.push(`${u}=${typeof l == "string" ? l : "[File]"}`);
          }), r = c.join("&");
        } else s instanceof URLSearchParams ? r = s.toString() : (s instanceof ArrayBuffer || ArrayBuffer.isView(s)) && (r = `[Binary: ${s instanceof ArrayBuffer, s.byteLength} bytes]`);
      const a = e.originalSendBeacon(t, s);
      return e.onReport({
        id: n,
        method: "BEACON",
        url: o,
        type: "beacon",
        requestBody: r,
        status: a ? 200 : 0,
        statusText: a ? "Queued" : "Failed",
        timestamp: Date.now()
      }), a;
    };
  }
  stop() {
    this.originalSendBeacon && (navigator.sendBeacon = this.originalSendBeacon, this.originalSendBeacon = null);
  }
}
class Re {
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
    let s = 0, n = 0;
    try {
      for (let a = 0; a < localStorage.length; a++) {
        const c = localStorage.key(a);
        if (c) {
          const l = localStorage.getItem(c) || "";
          e[c] = l, s += c.length + l.length;
        }
      }
    } catch {
    }
    try {
      for (let a = 0; a < sessionStorage.length; a++) {
        const c = sessionStorage.key(a);
        if (c) {
          const l = sessionStorage.getItem(c) || "";
          t[c] = l, n += c.length + l.length;
        }
      }
    } catch {
    }
    let o = "", r;
    try {
      o = document.cookie, typeof window < "u" && "cookieStore" in window && (r = (await window.cookieStore.getAll()).map((c) => ({
        name: c.name,
        value: c.value,
        path: c.path,
        domain: c.domain,
        expires: c.expires != null ? new Date(c.expires).toISOString() : void 0,
        secure: c.secure,
        sameSite: c.sameSite
      })));
    } catch {
    }
    return {
      timestamp: Date.now(),
      localStorage: e,
      sessionStorage: t,
      cookies: o,
      cookieEntries: r,
      localStorageSize: s,
      sessionStorageSize: n
    };
  }
  // ─── Private helpers ───────────────────────────────────────────────────────
  debouncedReport() {
    this.debounceTimer && clearTimeout(this.debounceTimer), this.debounceTimer = setTimeout(() => {
      this.readAndReport();
    }, 200);
  }
  patchStorageObject(e, t) {
    const s = this;
    try {
      const n = e.setItem.bind(e);
      t === "local" ? this.origLocalSetItem = n : this.origSessionSetItem = n, e.setItem = function(a, c) {
        n(a, c), s.debouncedReport();
      };
      const o = e.removeItem.bind(e);
      t === "local" ? this.origLocalRemoveItem = o : this.origSessionRemoveItem = o, e.removeItem = function(a) {
        o(a), s.debouncedReport();
      };
      const r = e.clear.bind(e);
      t === "local" ? this.origLocalClear = r : this.origSessionClear = r, e.clear = function() {
        r(), s.debouncedReport();
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
      const e = this, t = Document.prototype, s = Object.getOwnPropertyDescriptor(t, "cookie") ?? Object.getOwnPropertyDescriptor(document, "cookie");
      if (!s || !s.configurable || !s.set) return;
      this.cookieDescriptor = s, Object.defineProperty(document, "cookie", {
        configurable: !0,
        enumerable: !0,
        get() {
          return s.get.call(document);
        },
        set(n) {
          s.set.call(document, n), e.debouncedReport();
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
class Ee {
  constructor(e, t) {
    this.errorHandler = null, this.rejectionHandler = null, this.started = !1, this.reporting = !1, this.platform = e, this.bus = t;
  }
  start() {
    this.started || typeof window > "u" || (this.started = !0, this.errorHandler = (e) => {
      if (this.reporting) return;
      if (e.target instanceof HTMLElement) {
        const a = e.target, c = a.src || a.href || "", l = a.tagName.toLowerCase(), u = `[Resource Error] Failed to load <${l}>${c ? `: ${c}` : ""}`;
        this.safeReport({ timestamp: Date.now(), level: "error", message: u }), this.bus.emit("error", { source: "resource", message: u, url: c, tag: l });
        return;
      }
      const t = e, s = t.error, n = s != null && s.stack ? O(s.stack) : t.filename ? `    at ${t.filename}:${t.lineno}:${t.colno}` : void 0, o = (s == null ? void 0 : s.name) ?? "Error", r = {
        timestamp: Date.now(),
        level: "error",
        message: `[Uncaught ${o}] ${t.message}`,
        stack: n
      };
      this.safeReport(r), this.bus.emit("error", {
        source: "uncaught",
        message: t.message,
        stack: n,
        filename: t.filename,
        lineno: t.lineno,
        colno: t.colno
      });
    }, this.rejectionHandler = (e) => {
      if (this.reporting) return;
      const t = e.reason;
      let s, n;
      t instanceof Error ? (s = `[Unhandled Promise Rejection] ${t.message}`, n = O(t.stack)) : s = `[Unhandled Promise Rejection] ${String(t)}`, this.safeReport({ timestamp: Date.now(), level: "error", message: s, stack: n }), this.bus.emit("error", {
        source: "unhandledrejection",
        message: s,
        stack: n,
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
const xe = /* @__PURE__ */ new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "CANVAS"]), Te = /* @__PURE__ */ new Set([
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
]), U = 8, X = 30, De = 150, Be = 8;
function ee(i, e) {
  var r;
  const t = i.tagName;
  if (xe.has(t)) return null;
  const s = { tag: t.toLowerCase() };
  i.id && (s.id = i.id), i.className && typeof i.className == "string" && i.className.trim() && (s.className = i.className.trim());
  const n = {};
  let o = 0;
  for (const a of Array.from(i.attributes))
    if (!(a.name === "id" || a.name === "class") && !Te.has(a.name.toLowerCase()) && !a.name.startsWith("on")) {
      if (o >= Be) break;
      n[a.name] = a.value.slice(0, 200), o++;
    }
  if (o > 0 && (s.attrs = n), e >= U - 2 || i.children.length === 0) {
    const a = (r = i.textContent) == null ? void 0 : r.trim().slice(0, De);
    a && (s.text = a);
  }
  if (e < U) {
    const a = [], c = Array.from(i.children), l = c.length;
    for (const u of c.slice(0, X)) {
      const d = ee(u, e + 1);
      d && a.push(d);
    }
    a.length > 0 && (s.children = a), l > X && (s.childCount = l);
  } else
    s.childCount = i.children.length;
  return s;
}
class Me {
  constructor(e, t) {
    this.refreshHandler = null, this.platform = e, this.callback = t;
  }
  /** 采集并上报一次 DOM 快照 */
  collect() {
    if (!(typeof document > "u"))
      try {
        const e = document.documentElement, t = ee(e, 0);
        if (!t) return;
        let s;
        try {
          const n = document.documentElement.outerHTML;
          s = n.length > 512e3 ? n.slice(0, 512e3) + `
<!-- [truncated] -->` : n;
        } catch {
        }
        this.callback({
          timestamp: Date.now(),
          url: window.location.href,
          title: document.title,
          dom: t,
          htmlSnapshot: s
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
const Le = 3e3, Pe = 120, Oe = 100, W = 200, Ae = 100, $ = 200;
class K {
  constructor(e) {
    this.samples = [], this.vitals = [], this.longTasks = [], this.resources = [], this.interactions = [], this.marks = [], this.rafHandle = 0, this.intervalHandle = null, this.observers = [], this.destroyed = !1, this.fpsFrames = 0, this.fpsLastTick = performance.now(), this.bus = e;
  }
  async start() {
    await this.collectVitals(), this.startFPSLoop(), this.startSamplingInterval(), this.observeLongTasks(), this.observeResources(), this.observeInteractions(), this.observeUserMarks();
  }
  async collectVitals() {
    try {
      const { onLCP: e, onCLS: t, onFCP: s, onTTFB: n, onINP: o, onFID: r } = await import("./web-vitals-Bpb2w_6o.js"), a = (c, l, u) => {
        const d = this.vitals.findIndex((f) => f.name === c), h = { name: c, value: Math.round(l * 100) / 100, rating: u };
        d >= 0 ? this.vitals[d] = h : this.vitals.push(h), this.flush();
      };
      e((c) => a("LCP", c.value, c.rating)), t((c) => a("CLS", c.value, c.rating)), s((c) => a("FCP", c.value, c.rating)), n((c) => a("TTFB", c.value, c.rating));
      try {
        o((c) => a("INP", c.value, c.rating));
      } catch {
      }
      try {
        r((c) => a("FID", c.value, c.rating));
      } catch {
      }
    } catch (e) {
      console.warn("[codeLog] web-vitals unavailable", e);
    }
  }
  observeLongTasks() {
    try {
      const e = new PerformanceObserver((t) => {
        for (const s of t.getEntries())
          this.longTasks.push({
            startTime: Math.round(s.startTime),
            duration: Math.round(s.duration),
            name: s.name
          }), this.longTasks.length > Oe && this.longTasks.shift();
        this.flush();
      });
      e.observe({ entryTypes: ["longtask"] }), this.observers.push(e);
    } catch {
    }
  }
  observeResources() {
    try {
      const e = performance.getEntriesByType("resource");
      for (const s of e.slice(-W))
        this.resources.push(this.mapResource(s));
      const t = new PerformanceObserver((s) => {
        for (const n of s.getEntries())
          this.resources.push(this.mapResource(n)), this.resources.length > W && this.resources.shift();
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
        for (const s of t.getEntries()) {
          const n = s;
          this.interactions.push({
            type: n.name,
            duration: Math.round(n.duration),
            startTime: Math.round(n.startTime),
            target: (() => {
              const o = n.target;
              if (o instanceof Element)
                return `${o.tagName.toLowerCase()}${o.id ? "#" + o.id : ""}`;
            })()
          }), this.interactions.length > Ae && this.interactions.shift();
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
      for (const n of e)
        this.marks.push({ name: n.name, startTime: Math.round(n.startTime), type: "mark" }), this.marks.length > $ && this.marks.shift();
      const t = performance.getEntriesByType("measure");
      for (const n of t)
        this.marks.push({ name: n.name, startTime: Math.round(n.startTime), duration: Math.round(n.duration), type: "measure" }), this.marks.length > $ && this.marks.shift();
      const s = new PerformanceObserver((n) => {
        for (const o of n.getEntries()) {
          const r = o.entryType;
          this.marks.push({
            name: o.name,
            startTime: Math.round(o.startTime),
            ...o.duration ? { duration: Math.round(o.duration) } : {},
            type: r
          }), this.marks.length > $ && this.marks.shift();
        }
        this.flush();
      });
      s.observe({ entryTypes: ["mark", "measure"] }), this.observers.push(s);
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
      const e = performance.now(), t = (e - this.fpsLastTick) / 1e3, s = t > 0 ? Math.round(this.fpsFrames / t) : 0;
      this.fpsFrames = 0, this.fpsLastTick = e;
      const n = {
        ts: Date.now(),
        fps: Math.min(s, 120)
      };
      performance.memory && (n.heapUsed = parseFloat((performance.memory.usedJSHeapSize / 1048576).toFixed(2)), n.heapTotal = parseFloat((performance.memory.totalJSHeapSize / 1048576).toFixed(2))), this.samples.push(n), this.samples.length > Pe && this.samples.shift(), this.flush();
    }, Le);
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
class _e {
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
        }), s = t.toDataURL("image/png");
        this.bus.emit("screenshot", {
          timestamp: Date.now(),
          dataUrl: s,
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
class $e {
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
    var c;
    const e = navigator;
    let t;
    if (e.connection) {
      const l = e.connection;
      t = {
        type: l.type,
        effectiveType: l.effectiveType,
        downlink: l.downlink,
        rtt: l.rtt,
        saveData: l.saveData
      };
    }
    let s;
    if (e.getBattery)
      try {
        const l = await e.getBattery();
        s = {
          charging: l.charging,
          level: Math.round(l.level * 100),
          chargingTime: isFinite(l.chargingTime) ? l.chargingTime : void 0,
          dischargingTime: isFinite(l.dischargingTime) ? l.dischargingTime : void 0
        };
      } catch {
      }
    const n = ((c = screen.orientation) == null ? void 0 : c.type) ?? void 0, o = (() => {
      try {
        const l = document.createElement("canvas");
        return l.width = 1, l.height = 1, l.toDataURL("image/webp").startsWith("data:image/webp");
      } catch {
        return !1;
      }
    })(), r = (() => {
      try {
        const l = document.createElement("canvas");
        return !!(l.getContext("webgl") || l.getContext("experimental-webgl"));
      } catch {
        return !1;
      }
    })(), a = (() => {
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
        orientation: n
      },
      hardware: {
        cpuCores: navigator.hardwareConcurrency,
        memory: e.deviceMemory,
        maxTouchPoints: navigator.maxTouchPoints
      },
      connection: t,
      battery: s,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: (/* @__PURE__ */ new Date()).getTimezoneOffset(),
      features: {
        // Core APIs
        webGL: r,
        webGL2: a,
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
class He {
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
    ].forEach((s) => {
      const n = IDBObjectStore.prototype[s];
      typeof n == "function" && (IDBObjectStore.prototype[s] = function(...o) {
        const r = Date.now(), a = this.transaction.db.name, c = this.name, l = `idb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, u = n.apply(this, o);
        return u.addEventListener("success", () => {
          if (!e.enabled) return;
          const d = u.result;
          let h;
          try {
            Array.isArray(d) ? h = `[Array(${d.length})]` : d && typeof d == "object" && d instanceof IDBCursor ? h = "[IDBCursor]" : h = d;
          } catch {
            h = "[unserializable]";
          }
          e.onReport({
            id: l,
            dbName: a,
            storeName: c,
            operation: s,
            key: o[0],
            value: s === "put" || s === "add" ? o[0] : void 0,
            result: h,
            duration: Date.now() - r,
            timestamp: r
          });
        }), u.addEventListener("error", () => {
          var d;
          e.enabled && e.onReport({
            id: l,
            dbName: a,
            storeName: c,
            operation: s,
            key: o[0],
            error: ((d = u.error) == null ? void 0 : d.message) ?? "Unknown IDB error",
            duration: Date.now() - r,
            timestamp: r
          });
        }), u;
      });
    });
  }
  stop() {
    this.enabled = !1;
  }
  /** Take a full snapshot of all IndexedDB databases (structure only, no record data). */
  async takeSnapshot() {
    var s;
    if (typeof indexedDB > "u") return { ts: Date.now(), databases: [] };
    let e = [];
    try {
      e = await ((s = indexedDB.databases) == null ? void 0 : s.call(indexedDB)) ?? [];
    } catch {
      return { ts: Date.now(), databases: [] };
    }
    const t = [];
    for (const { name: n, version: o } of e)
      if (n)
        try {
          const r = await this._inspectDatabase(n, o);
          t.push(r);
        } catch {
        }
    return { ts: Date.now(), databases: t };
  }
  /** Fetch paginated records from a specific store. */
  async getStoreData(e, t, s = 0, n = 50) {
    return new Promise((o, r) => {
      const a = indexedDB.open(e);
      a.onsuccess = () => {
        const c = a.result;
        if (!c.objectStoreNames.contains(t))
          return c.close(), o({ dbName: e, storeName: t, records: [], keys: [], total: 0, page: s, pageSize: n });
        const u = c.transaction(t, "readonly").objectStore(t), d = u.keyPath, h = u.count();
        h.onsuccess = () => {
          const f = h.result, b = s * n, w = [], S = [];
          let p = 0;
          const g = u.openCursor();
          g.onsuccess = () => {
            const m = g.result;
            if (!m)
              return c.close(), o({ dbName: e, storeName: t, records: w, keys: S, keyPath: d, total: f, page: s, pageSize: n });
            if (p < b) {
              p++, m.continue();
              return;
            }
            if (w.length < n) {
              try {
                w.push(JSON.parse(JSON.stringify(m.value)));
              } catch {
                w.push(String(m.value));
              }
              S.push(m.key), m.continue();
            } else
              c.close(), o({ dbName: e, storeName: t, records: w, keys: S, keyPath: d, total: f, page: s, pageSize: n });
          }, g.onerror = () => {
            c.close(), o({ dbName: e, storeName: t, records: w, keys: S, keyPath: d, total: f, page: s, pageSize: n });
          };
        }, h.onerror = () => {
          c.close(), r(new Error("Count failed"));
        };
      }, a.onerror = () => r(new Error(`Cannot open ${e}`));
    });
  }
  _inspectDatabase(e, t) {
    return new Promise((s, n) => {
      const o = indexedDB.open(e, t);
      o.onsuccess = () => {
        const r = o.result, a = [], c = Array.from(r.objectStoreNames);
        if (c.length === 0)
          return r.close(), s({ name: e, version: r.version, stores: a });
        let l = c.length;
        const u = r.transaction(c, "readonly");
        c.forEach((d) => {
          const h = u.objectStore(d), f = Array.from(h.indexNames).map((S) => {
            const p = h.index(S);
            return {
              name: S,
              keyPath: p.keyPath,
              unique: p.unique,
              multiEntry: p.multiEntry
            };
          }), b = h.count(), w = {
            name: d,
            keyPath: h.keyPath,
            autoIncrement: h.autoIncrement,
            indexes: f,
            count: 0
          };
          b.onsuccess = () => {
            w.count = b.result, a.push(w), l--, l === 0 && (r.close(), s({ name: e, version: r.version, stores: a }));
          }, b.onerror = () => {
            a.push(w), l--, l === 0 && (r.close(), s({ name: e, version: r.version, stores: a }));
          };
        });
      }, o.onerror = () => n(new Error(`Cannot open ${e}`)), o.onblocked = () => n(new Error(`${e} is blocked`));
    });
  }
}
const E = {
  zh: {
    pageId: "页面 ID",
    perf: "⚡ 跑分",
    perfStart: "🏁 开始跑分",
    perfStop: "⏹ 停止",
    copied: "✓ 已复制",
    clickCopy: "点击复制"
  },
  en: {
    pageId: "Page ID",
    perf: "⚡ Perf",
    perfStart: "🏁 Start",
    perfStop: "⏹ Stop",
    copied: "✓ Copied",
    clickCopy: "Click to copy"
  }
};
class je {
  constructor() {
    this.eruda = null, this.unsubscribers = [], this.lang = "zh", this.pageId = null, this.codelog = null, this.perfRunning = !1, this.onDevToolsShow = null, this.settingsItemsAdded = !1, this.settingsItemCount = 0;
  }
  /** 将 Eruda 实例与 DataBus 绑定（可在 Eruda 异步加载完成后调用） */
  attach(e, t, s, n) {
    if (this.eruda = e, this.codelog = s ?? null, this.pageId = n ?? null, this.settingsItemsAdded = !1, this.settingsItemCount = 0, this.detach(), this.lang = this.detectInitialLang(), this.syncErudaLang(this.lang), this.unsubscribers.push(
      t.on("console", (o) => {
        this.forwardToEruda(o);
      })
    ), typeof document < "u") {
      const o = e.get();
      o != null && o.on && (this.onDevToolsShow = () => {
        setTimeout(() => {
          this.renderInfoPanel(), this.bindInfoPanelHandlers();
        }, 150);
      }, o.on("show", this.onDevToolsShow)), setTimeout(() => this.renderInfoPanel(), 1200), setTimeout(() => this.addSettingsItems(), 1200), setTimeout(() => this.customizeEntryButton(), 1200);
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
    const s = e.level, n = t[s];
    typeof n == "function" && (e.args && e.args.length > 0 ? n.call(t, ...e.args) : n.call(t, e.message));
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
    var s, n;
    const t = e === "zh" ? "zh-CN" : "en";
    (n = (s = this.eruda) == null ? void 0 : s.i18n) == null || n.setLang(t);
  }
  /** Render (or re-render) all CodeLog-injected Info panel items with current language */
  renderInfoPanel() {
    var s;
    const e = (s = this.eruda) == null ? void 0 : s.get("info");
    if (!e || typeof e.add != "function") return;
    const t = E[this.lang];
    for (const n of [E.zh.pageId, E.en.pageId, E.zh.perf, E.en.perf])
      try {
        e.remove(n);
      } catch {
      }
    if (this.pageId) {
      const n = this.pageId.length > 20 ? `${this.pageId.slice(0, 10)}…${this.pageId.slice(-6)}` : this.pageId;
      e.add(
        t.pageId,
        `<span id="codelog-pageid-info" title="${t.clickCopy}" style="cursor:pointer;font-family:monospace;font-size:11px;color:#3b5bdb;word-break:break-all;">${n}</span>`
      );
    }
    if (this.codelog) {
      const n = this.perfRunning ? t.perfStop : t.perfStart;
      e.add(
        t.perf,
        `<span id="codelog-perf-btn" style="cursor:pointer;padding:2px 8px;background:#111;color:#fff;border-radius:4px;font-size:12px;">${n}</span>`
      );
    }
    setTimeout(() => this.bindInfoPanelHandlers(), 300);
  }
  /** Add language + theme selects to top of Settings panel (called once after attach) */
  addSettingsItems() {
    var o, r;
    if (this.settingsItemsAdded) return;
    const e = (o = this.eruda) == null ? void 0 : o.get("settings");
    if (!e || typeof e.select != "function") return;
    let t = 0;
    const s = {
      get: (a) => this.lang === "zh" ? "中文" : "English",
      set: (a, c) => {
        const l = c === "中文" ? "zh" : "en";
        try {
          localStorage.setItem("codelog-lang", l);
        } catch {
        }
        location.reload();
      }
    };
    e.select(s, "lang", "语言 / Language", ["中文", "English"]), t++;
    const n = (r = this.eruda) == null ? void 0 : r.get();
    if (n != null && n.config) {
      const a = [
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
      ], c = {
        get: (l) => a.includes(n.config.get("theme")) ? "Dark" : "Light",
        set: (l, u) => {
          n.config.set("theme", u);
        }
      };
      e.select(c, "theme", "主题 / Theme", ["Light", "Dark"]), t++;
    }
    e.separator(), t++, this.settingsItemCount = t, this.settingsItemsAdded = !0, setTimeout(() => this.moveSettingsItemsToTop(), 300);
  }
  /** Move our injected settings items (last N children) to the top of the Settings panel */
  moveSettingsItemsToTop() {
    const e = this.getErudaShadowRoot();
    if (!e) return;
    const t = e.querySelector(".luna-setting");
    if (!t) return;
    const s = Array.from(t.children), n = this.settingsItemCount;
    if (s.length < n) return;
    const o = s.slice(-n);
    for (let r = o.length - 1; r >= 0; r--)
      t.insertBefore(o[r], t.firstChild);
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
    const s = e.getElementById("codelog-perf-btn");
    if (s && this.codelog) {
      const n = E[this.lang];
      s.onclick = async () => {
        this.perfRunning ? (this.perfRunning = !1, s.textContent = n.perfStart, await this.codelog.stopPerfRun()) : (this.perfRunning = !0, s.textContent = n.perfStop, this.codelog.startPerfRun());
      };
    }
  }
  /** Attach open/close CSS class to entry button for styling hooks */
  customizeEntryButton() {
    var s;
    const e = this.getErudaShadowRoot();
    if (!e) {
      setTimeout(() => this.customizeEntryButton(), 500);
      return;
    }
    const t = (s = this.eruda) == null ? void 0 : s.get();
    t != null && t.on && (t.on("show", () => {
      var n;
      (n = e.querySelector(".eruda-entry-btn")) == null || n.classList.add("codelog-open");
    }), t.on("hide", () => {
      var n;
      (n = e.querySelector(".eruda-entry-btn")) == null || n.classList.remove("codelog-open");
    }));
  }
  copyToClipboard(e, t, s) {
    const n = E[this.lang], o = () => {
      setTimeout(() => {
        t.textContent = s;
      }, 1500);
    };
    if (navigator.clipboard)
      navigator.clipboard.writeText(e).then(() => {
        t.textContent = n.copied, o();
      });
    else {
      const r = document.createElement("input");
      r.value = e, document.body.appendChild(r), r.select(), document.execCommand("copy"), document.body.removeChild(r), t.textContent = n.copied, o();
    }
  }
}
class ze {
  constructor(e, t) {
    this.ws = new WebSocket(e), this.ws.onopen = () => t.onOpen(), this.ws.onmessage = (s) => {
      try {
        t.onMessage(JSON.parse(s.data));
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
class qe {
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
    return new ze(e, t);
  }
}
function B(i) {
  return i >= 75 ? "good" : i >= 50 ? "needs-improvement" : "poor";
}
function Ne() {
  const i = document.querySelectorAll("*"), e = i.length;
  let t = 0;
  function s(r, a) {
    if (a > t && (t = a), !(a > 50))
      for (let c = 0; c < r.children.length && c < 100; c++)
        s(r.children[c], a + 1);
  }
  s(document.documentElement, 0);
  let n = 0;
  i.forEach((r) => {
    r.children.length > n && (n = r.children.length);
  });
  let o;
  return e <= 800 ? o = 100 : e <= 1500 ? o = 75 : e <= 3e3 ? o = 50 : o = Math.max(0, 100 - Math.floor(e / 100)), {
    id: "dom-size",
    title: "DOM 规模",
    score: o,
    rating: B(o),
    value: `${e} 个元素, 深度 ${t}, 最大宽度 ${n}`,
    details: { totalElements: e, maxDepth: t, maxWidth: n }
  };
}
function Fe() {
  const i = [];
  document.querySelectorAll("script[src]").forEach((s) => {
    const n = s;
    !n.async && !n.defer && n.type !== "module" && i.push({ tag: "script", url: n.src });
  }), document.querySelectorAll('link[rel="stylesheet"]').forEach((s) => {
    const n = s;
    n.media !== "print" && !n.disabled && i.push({ tag: "link/css", url: n.href });
  });
  const e = i.length;
  let t;
  return e === 0 ? t = 100 : e <= 2 ? t = 75 : e <= 5 ? t = 50 : t = Math.max(10, 100 - e * 10), {
    id: "render-blocking",
    title: "渲染阻塞资源",
    score: t,
    rating: B(t),
    value: e === 0 ? "无阻塞资源" : `${e} 个渲染阻塞资源`,
    details: { count: e, resources: i.slice(0, 10) }
  };
}
function Ue() {
  const i = [];
  document.querySelectorAll("img").forEach((s) => {
    const n = s;
    if (!n.src || n.src.startsWith("data:")) return;
    if (n.naturalWidth > 0 && n.width > 0 && n.naturalWidth * n.naturalHeight / (n.width * n.height) > 4 && i.push({
      src: n.src.slice(0, 100),
      problem: "oversized",
      naturalSize: `${n.naturalWidth}x${n.naturalHeight}`,
      displaySize: `${n.width}x${n.height}`
    }), n.getBoundingClientRect().top > window.innerHeight * 1.5 && n.loading !== "lazy" && i.push({
      src: n.src.slice(0, 100),
      problem: "missing-lazy-load"
    }), !n.hasAttribute("width") && !n.hasAttribute("height") && !n.style.width && !n.style.height) {
      const r = getComputedStyle(n);
      (r.width === "auto" || r.height === "auto") && i.push({
        src: n.src.slice(0, 100),
        problem: "missing-dimensions"
      });
    }
  });
  const e = i.length;
  let t;
  return e === 0 ? t = 100 : e <= 2 ? t = 75 : e <= 5 ? t = 50 : t = Math.max(10, 100 - e * 8), {
    id: "image-optimization",
    title: "图片优化",
    score: t,
    rating: B(t),
    value: e === 0 ? "图片优化良好" : `${e} 张图片存在优化空间`,
    details: { count: e, issues: i.slice(0, 10) }
  };
}
function Xe() {
  const i = performance.getEntriesByType("resource");
  let e = 0;
  const t = [];
  for (const r of i) {
    const a = Math.round(r.transferSize / 1024);
    e += a, r.transferSize > 100 * 1024 && t.push({
      url: r.name.slice(0, 100),
      sizeKB: a,
      type: r.initiatorType
    });
  }
  const s = {};
  for (const r of i) {
    const a = r.initiatorType || "other";
    s[a] = (s[a] || 0) + Math.round(r.transferSize / 1024);
  }
  const n = t.length;
  let o;
  return e <= 500 ? o = 100 : e <= 1500 ? o = 75 : e <= 3e3 ? o = 50 : o = Math.max(10, 100 - Math.floor(e / 100)), {
    id: "resource-size",
    title: "资源体积",
    score: o,
    rating: B(o),
    value: `总传输 ${e}KB, ${n} 个大资源(>100KB)`,
    details: { totalTransferKB: e, largeCount: n, byType: s, largeResources: t.slice(0, 10) }
  };
}
function We() {
  const i = performance.getEntriesByType("resource"), e = [];
  for (const n of i)
    n.transferSize > 1024 && n.decodedBodySize > 0 && n.transferSize / n.decodedBodySize > 0.9 && n.decodedBodySize > 10 * 1024 && e.push({
      url: n.name.slice(0, 100),
      transferKB: Math.round(n.transferSize / 1024),
      decodedKB: Math.round(n.decodedBodySize / 1024)
    });
  const t = e.length;
  let s;
  return t === 0 ? s = 100 : t <= 2 ? s = 70 : t <= 5 ? s = 45 : s = Math.max(10, 100 - t * 10), {
    id: "compression",
    title: "资源压缩",
    score: s,
    rating: B(s),
    value: t === 0 ? "所有资源已压缩" : `${t} 个资源未开启 gzip/br 压缩`,
    details: { count: t, resources: e.slice(0, 10) }
  };
}
function Ke() {
  const e = performance.getEntriesByType("resource").filter(
    (a) => a.initiatorType === "css" && /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(a.name)
  ), t = [], s = e.filter((a) => a.transferSize > 100 * 1024);
  s.length > 0 && t.push(`${s.length} 个字体文件 >100KB`);
  let n = 0;
  try {
    for (const a of Array.from(document.styleSheets))
      try {
        for (const c of Array.from(a.cssRules || []))
          if (c instanceof CSSFontFaceRule) {
            const l = c.style.getPropertyValue("font-display");
            (!l || l === "auto") && n++;
          }
      } catch {
      }
  } catch {
  }
  n > 0 && t.push(`${n} 个 @font-face 缺少 font-display: swap`);
  const o = s.length + n;
  let r;
  return o === 0 ? r = 100 : o <= 2 ? r = 70 : r = Math.max(20, 100 - o * 15), {
    id: "font-loading",
    title: "字体加载",
    score: r,
    rating: B(r),
    value: o === 0 ? "字体加载良好" : t.join("; "),
    details: { fontCount: e.length, largeFonts: s.length, missingFontDisplay: n }
  };
}
function Je() {
  const i = [
    Ne(),
    Fe(),
    Ue(),
    Xe(),
    We(),
    Ke()
  ], e = {
    good: i.filter((t) => t.rating === "good").length,
    warning: i.filter((t) => t.rating === "needs-improvement").length,
    poor: i.filter((t) => t.rating === "poor").length
  };
  return {
    timestamp: Date.now(),
    url: location.href,
    audits: i,
    summary: e
  };
}
const J = {
  none: { latency: 0, downloadKbps: 1 / 0 },
  "3g": { latency: 300, downloadKbps: 750 },
  "2g": { latency: 600, downloadKbps: 250 },
  offline: { latency: 0, downloadKbps: 0 }
};
class Ge {
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
    window.fetch = async function(t, s) {
      const n = J[e.preset];
      if (n.downloadKbps === 0)
        throw new TypeError("Failed to fetch: Network offline (throttled)");
      return n.latency > 0 && await new Promise((o) => setTimeout(o, n.latency)), e.originalFetch(t, s);
    };
  }
  patchXHR() {
    const e = this;
    this.originalXHROpen = XMLHttpRequest.prototype.open, this.originalXHRSend = XMLHttpRequest.prototype.send, XMLHttpRequest.prototype.send = function(t) {
      const s = J[e.preset], n = this;
      if (s.downloadKbps === 0) {
        setTimeout(() => {
          Object.defineProperty(n, "status", { value: 0, writable: !1 }), n.dispatchEvent(new Event("error"));
        }, 0);
        return;
      }
      s.latency > 0 ? setTimeout(() => {
        e.originalXHRSend.call(n, t);
      }, s.latency) : e.originalXHRSend.call(n, t);
    };
  }
  stop() {
    !this.active || typeof window > "u" || (this.active = !1, this.originalFetch && (window.fetch = this.originalFetch, this.originalFetch = null), this.originalXHROpen && (XMLHttpRequest.prototype.open = this.originalXHROpen, this.originalXHROpen = null), this.originalXHRSend && (XMLHttpRequest.prototype.send = this.originalXHRSend, this.originalXHRSend = null));
  }
  destroy() {
    this.stop();
  }
}
class G {
  constructor() {
    this.rules = [], this.originalFetch = null, this.originalXHROpen = null, this.originalXHRSend = null, this.active = !1;
  }
  start() {
    this.active || typeof window > "u" || (this.active = !0, this.patchFetch(), this.patchXHR());
  }
  matchRule(e, t) {
    return this.rules.find((s) => {
      if (s.enabled === !1) return !1;
      const n = (() => {
        try {
          return new RegExp(s.pattern).test(e);
        } catch {
          return e.includes(s.pattern);
        }
      })(), o = !s.method || s.method.toUpperCase() === t.toUpperCase();
      return n && o;
    });
  }
  patchFetch() {
    this.originalFetch = window.fetch.bind(window);
    const e = this;
    window.fetch = async function(t, s) {
      var a;
      const n = typeof t == "string" ? t : t instanceof URL ? t.href : t.url, o = ((s == null ? void 0 : s.method) ?? "GET").toUpperCase(), r = e.matchRule(n, o);
      return r ? ((a = e.onMatch) == null || a.call(e, r.id, n), r.delay && r.delay > 0 && await new Promise((c) => setTimeout(c, r.delay)), new Response(r.body, {
        status: r.status,
        headers: { "Content-Type": "application/json", ...r.headers }
      })) : e.originalFetch(t, s);
    };
  }
  patchXHR() {
    const e = this;
    this.originalXHROpen = XMLHttpRequest.prototype.open, this.originalXHRSend = XMLHttpRequest.prototype.send;
    const t = this.originalXHROpen;
    XMLHttpRequest.prototype.open = function(n, o, ...r) {
      return this.__mockUrl = typeof o == "string" ? o : o.href, this.__mockMethod = n, t.call(this, n, o, ...r);
    };
    const s = this.originalXHRSend;
    XMLHttpRequest.prototype.send = function(n) {
      var c;
      const o = this.__mockUrl || "", r = this.__mockMethod || "GET", a = e.matchRule(o, r);
      if (a) {
        (c = e.onMatch) == null || c.call(e, a.id, o), setTimeout(() => {
          Object.defineProperty(this, "status", {
            value: a.status,
            writable: !1,
            configurable: !0
          }), Object.defineProperty(this, "statusText", {
            value: "OK",
            writable: !1,
            configurable: !0
          }), Object.defineProperty(this, "responseText", {
            value: a.body,
            writable: !1,
            configurable: !0
          }), Object.defineProperty(this, "response", {
            value: a.body,
            writable: !1,
            configurable: !0
          }), Object.defineProperty(this, "readyState", {
            value: 4,
            writable: !1,
            configurable: !0
          });
          const u = Object.entries({ "Content-Type": "application/json", ...a.headers }).map(([d, h]) => `${d}: ${h}`).join(`\r
`);
          Object.defineProperty(this, "getAllResponseHeaders", {
            value: () => u,
            configurable: !0
          }), this.dispatchEvent(new Event("readystatechange")), this.dispatchEvent(new Event("load")), this.dispatchEvent(new Event("loadend"));
        }, Math.max(0, a.delay ?? 0));
        return;
      }
      s.call(this, n);
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
    const s = this.rules.find((n) => n.id === e);
    s && Object.assign(s, t);
  }
}
const Ze = 5, Z = 50, P = 100;
function T(i, e = 0, t) {
  if (i === null) return { t: "null" };
  if (i === void 0) return { t: "undefined" };
  const s = typeof i;
  if (s === "string") return { t: "str", v: i };
  if (s === "number") return { t: "num", v: i };
  if (s === "boolean") return { t: "bool", v: i };
  if (s === "bigint") return { t: "bigint", v: String(i) };
  if (s === "symbol") return { t: "sym", v: i.toString() };
  if (s === "function") return { t: "fn", name: i.name || "(anonymous)" };
  const n = i;
  if (t || (t = /* @__PURE__ */ new WeakSet()), t.has(n)) return { t: "circ" };
  if (t.add(n), i instanceof RegExp) return { t: "regexp", src: i.source, flags: i.flags };
  if (i instanceof Date) return { t: "date", iso: i.toISOString() };
  if (i instanceof Error) return { t: "err", name: i.name, msg: i.message, stack: i.stack };
  if (e >= Ze)
    return Array.isArray(i) ? { t: "arr", items: [], len: i.length, more: !0 } : { t: "obj", tag: V(i), props: [], more: !0 };
  if (i instanceof Map) {
    const l = [];
    let u = 0;
    for (const [d, h] of i) {
      if (u++ >= P) break;
      l.push([T(d, e + 1, t), T(h, e + 1, t)]);
    }
    return { t: "map", entries: l, size: i.size };
  }
  if (i instanceof Set) {
    const l = [];
    let u = 0;
    for (const d of i) {
      if (u++ >= P) break;
      l.push(T(d, e + 1, t));
    }
    return { t: "set", values: l, size: i.size };
  }
  if (Array.isArray(i)) {
    const l = i.length > P;
    return { t: "arr", items: i.slice(0, P).map((d) => T(d, e + 1, t)), len: i.length, more: l };
  }
  const o = V(i), r = Object.keys(n), a = r.length > Z, c = r.slice(0, Z).map((l) => [l, T(n[l], e + 1, t)]);
  return { t: "obj", tag: o, props: c, more: a };
}
function Ve(i) {
  const e = /* @__PURE__ */ new WeakSet();
  return i.map((t) => T(t, 0, e));
}
function V(i) {
  const t = Object.prototype.toString.call(i).match(/\[object (.+)\]/);
  return t ? t[1] : "Object";
}
const Qe = 15;
class Ye {
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
    for (const [e, t, s] of this.listeners)
      e.removeEventListener(t, s);
    this.listeners = [], this.started = !1;
  }
  _on(e, t, s) {
    e.addEventListener(t, s), this.listeners.push([e, t, s]);
  }
  _startShake() {
    if (!("DeviceMotionEvent" in window)) return;
    const e = Qe * (1 - this.config.shakeSensitivity + 0.1), t = (s) => {
      const n = s.accelerationIncludingGravity;
      if (!n) return;
      const o = Date.now();
      if (o - this.shakeLastTime < 100) return;
      this.shakeLastTime = o;
      const r = Math.abs((n.x ?? 0) - this.shakeLastAcc.x), a = Math.abs((n.y ?? 0) - this.shakeLastAcc.y), c = Math.abs((n.z ?? 0) - this.shakeLastAcc.z);
      this.shakeLastAcc = { x: n.x ?? 0, y: n.y ?? 0, z: n.z ?? 0 }, r + a + c > e && this.config.onActivate();
    };
    this._on(window, "devicemotion", t);
  }
  _startCornerTap() {
    const { cornerRadius: e, cornerTapCount: t } = this.config, s = 800, n = (o) => {
      if (o.touches.length !== 1) return;
      const r = o.touches[0], a = window.innerWidth, c = window.innerHeight, l = r.clientX, u = r.clientY;
      let d = -1;
      if (l < e && u < e ? d = 0 : l > a - e && u < e ? d = 1 : l < e && u > c - e ? d = 2 : l > a - e && u > c - e && (d = 3), d === -1) {
        this.cornerTapState = { count: 0, lastTime: 0, corner: -1 };
        return;
      }
      const h = Date.now();
      if (h - this.cornerTapState.lastTime > s || d !== this.cornerTapState.corner) {
        this.cornerTapState = { count: 1, lastTime: h, corner: d };
        return;
      }
      this.cornerTapState.count++, this.cornerTapState.lastTime = h, this.cornerTapState.count >= t && (this.cornerTapState = { count: 0, lastTime: 0, corner: -1 }, this.config.onActivate());
    };
    this._on(window, "touchstart", n);
  }
  _startKey() {
    const t = this.config.keyShortcut.split("+").map((l) => l.trim()), s = t.pop() ?? "F8", n = t.includes("Alt"), o = t.includes("Ctrl") || t.includes("Control"), r = t.includes("Shift"), a = t.includes("Meta") || t.includes("Cmd"), c = (l) => {
      l.key === s && (n && !l.altKey || o && !l.ctrlKey || r && !l.shiftKey || a && !l.metaKey || (l.preventDefault(), this.config.onActivate()));
    };
    this._on(window, "keydown", c);
  }
}
class et {
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
class Q {
  constructor() {
    this.plugins = /* @__PURE__ */ new Map(), this.ctx = null;
  }
  /** Set the context once CodeLog is initialised */
  setContext(e) {
    this.ctx = e;
  }
  /** Install and enable a plugin */
  async use(e) {
    var s;
    if (this.plugins.has(e.name)) {
      console.warn(`[codeLog] Plugin "${e.name}" is already installed.`);
      return;
    }
    const t = { plugin: e, state: "installed" };
    this.plugins.set(e.name, t), this.ctx && (await e.install(this.ctx), t.state = "enabled", (s = e.enable) == null || s.call(e));
  }
  /** Enable a previously disabled plugin */
  enable(e) {
    var s, n;
    const t = this.plugins.get(e);
    t && t.state === "disabled" && ((n = (s = t.plugin).enable) == null || n.call(s), t.state = "enabled");
  }
  /** Temporarily disable a plugin (preserves installed state) */
  disable(e) {
    var s, n;
    const t = this.plugins.get(e);
    !t || t.state !== "enabled" || ((n = (s = t.plugin).disable) == null || n.call(s), t.state = "disabled");
  }
  /** Fully remove and uninstall a plugin */
  remove(e) {
    var s, n, o, r;
    const t = this.plugins.get(e);
    t && (t.state === "enabled" && ((n = (s = t.plugin).disable) == null || n.call(s)), (r = (o = t.plugin).uninstall) == null || r.call(o), t.state = "uninstalled", this.plugins.delete(e));
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
const Y = [
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
class rt {
  constructor(e = {}) {
    this.name = "DataHarborPlugin", this.entries = [], this.unsubscribers = [], this.visibilityHandler = null, this.maxEntries = e.maxEntries ?? 1e3, this.storageKey = e.storageKey ?? "_codelog_harbor", this.captureTypes = new Set(e.captureTypes ?? Y), this.autoPersist = e.autoPersist ?? !0, this._loadFromStorage();
  }
  install(e) {
    for (const t of Y) {
      if (!this.captureTypes.has(t)) continue;
      const s = e.dataBus.on(t, (n) => {
        this._push(t, n);
      });
      this.unsubscribers.push(s);
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
    const t = JSON.stringify({ version: 1, entries: this.entries }, null, 2), s = new Blob([t], { type: "application/json" }), n = URL.createObjectURL(s), o = document.createElement("a");
    o.href = n, o.download = e, o.click(), URL.revokeObjectURL(n);
  }
  /** Export console entries as plain text log */
  exportLog(e = `codelog-log-${Date.now()}.txt`) {
    const t = this.entries.filter((r) => r.type === "console").map((r) => {
      const a = r.payload;
      return `[${new Date(r.ts).toISOString()}] [${(a.level ?? "log").toUpperCase()}] ${a.message ?? ""}`;
    }), s = new Blob([t.join(`
`)], { type: "text/plain" }), n = URL.createObjectURL(s), o = document.createElement("a");
    o.href = n, o.download = e, o.click(), URL.revokeObjectURL(n);
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
class it {
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
    const t = new Blob([JSON.stringify(this.events)], { type: "application/json" }), s = URL.createObjectURL(t), n = document.createElement("a");
    n.href = s, n.download = e, n.click(), URL.revokeObjectURL(s);
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
      emit: (s, n) => {
        n && this._flushChunk(), this.events.push(s), this.events.length >= t && this._flushChunk();
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
class at {
  constructor(e = {}) {
    this.name = "OSpyPlugin", this.entries = [], this.errorCount = 0, this.unsubscribers = [], this.badge = null, this.popup = null, this.popupOpen = !1, this.enabled = !1, this.opts = e, this.maxEntries = e.maxEntries ?? 500;
  }
  install(e) {
    const t = e.dataBus.on("console", (n) => {
      this._addEntry(n);
    });
    this.unsubscribers.push(t);
    const s = e.dataBus.on("error", (n) => {
      this._addEntry({ level: "error", message: n.message ?? "Error", ...n }), this.errorCount += 1, this._updateBadge();
    });
    this.unsubscribers.push(s), this._mountBadge(), this.enabled = !0;
  }
  enable() {
    this.badge && (this.badge.style.display = "flex"), this.enabled = !0;
  }
  disable() {
    this.badge && (this.badge.style.display = "none"), this.enabled = !1;
  }
  uninstall() {
    var e, t;
    for (const s of this.unsubscribers) s();
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
    }, s = document.createElement("div");
    s.id = "__ospy_badge__", Object.assign(s.style, {
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
    }), s.innerHTML = '<span style="font-size:14px">🔍</span> <span id="__ospy_count__">0 logs</span>', s.addEventListener("click", () => this._togglePopup()), document.body.appendChild(s), this.badge = s;
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
    const s = document.createElement("button");
    s.textContent = "✕", Object.assign(s.style, {
      background: "none",
      border: "none",
      color: "#999",
      cursor: "pointer",
      fontSize: "14px"
    }), s.addEventListener("click", () => this._togglePopup()), t.appendChild(s), e.appendChild(t);
    const n = document.createElement("div");
    Object.assign(n.style, { flex: "1", overflow: "auto", padding: "4px 0" });
    const o = this.entries.slice(-200);
    for (const r of o) {
      const a = document.createElement("div");
      Object.assign(a.style, {
        padding: "4px 12px",
        borderBottom: "1px solid #252540",
        color: tt(r.level),
        lineHeight: "1.5"
      });
      const c = new Date(r.ts).toLocaleTimeString("zh-CN", { hour12: !1 });
      a.textContent = `[${c}] [${r.level.toUpperCase()}] ${r.message}`, n.appendChild(a);
    }
    if (o.length === 0) {
      const r = document.createElement("div");
      Object.assign(r.style, { padding: "16px", textAlign: "center", color: "#666" }), r.textContent = "No logs yet", n.appendChild(r);
    }
    e.appendChild(n), document.body.appendChild(e), this.popup = e, this.popupOpen = !0, n.scrollTop = n.scrollHeight;
  }
}
function tt(i) {
  switch (i) {
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
const ct = "0.1.0", st = 3e4, M = Symbol.for("codelog.instance");
class nt {
  constructor(e) {
    var a, c, l, u, d;
    if (this.heartbeatTimerId = null, this.originalConsole = null, this.erudaInitialized = !1, this.eruda = null, this.networkInterceptor = null, this.wsInterceptor = null, this.sseInterceptor = null, this.beaconInterceptor = null, this.storageReader = null, this.errorInterceptor = null, this.domCollector = null, this.performanceCollector = null, this.screenshotCollector = null, this.zenMode = !1, this.perfRunning = !1, this.perfRunCollector = null, this.perfRunStartTime = 0, this.lastPerfRunSession = null, this.networkThrottle = null, this.mockApi = null, this.visibilityHandler = null, this.beforeUnloadHandler = null, this.systemCollector = null, this.idbInterceptor = null, this.gestureActivator = null, this.offlineBuffer = null, this.pluginManager = new Q(), !e.projectId)
      throw new Error("projectId is required");
    if (globalThis[M] && console.warn("codeLog: 检测到已存在的实例，多个实例可能导致竞态条件"), this.projectId = e.projectId, this.platform = e.platform ?? new qe(), this.deviceInfo = ue(e.projectId, this.platform), this.tabId = oe(), this.heartbeatIntervalMs = e.heartbeatInterval ?? st, this.consoleProcessor = e.consoleProcessor, this.networkProcessor = e.networkProcessor, this.storageProcessor = e.storageProcessor, this.databaseProcessor = e.databaseProcessor, this.disabledPlugins = new Set(e.disabledPlugins ?? []), ((a = e.offline) == null ? void 0 : a.enabled) !== !1 && typeof localStorage < "u" && (this.offlineBuffer = new et(e.offline ?? {})), this.dataBus = new pe(), this.reporter = new Se(this.deviceInfo, this.tabId, this.platform), this.reporter.attachDataBus(this.dataBus), this.offlineBuffer) {
      const h = this.offlineBuffer;
      this.dataBus.on("console", (f) => h.push("console", f)), this.dataBus.on("error", (f) => h.push("error", f)), typeof document < "u" && document.addEventListener("visibilitychange", () => {
        document.visibilityState === "hidden" && h.save();
      });
    }
    this.erudaPlugin = new je();
    const s = e.server ?? ot(e.port);
    this.resolvedServerUrl = s, this.platform.storage.getItem(`codelog_remote_${this.projectId}`) === "false" || this.reporter.connect(s), this.disabledPlugins.has("console") || this.interceptConsole(), this.networkConfig = e.network, this.disabledPlugins.has("network") || this.initNetworkInterceptor(e.network), this.disabledPlugins.has("storage") || this.initStorageReader(), e.captureErrors !== !1 && !this.disabledPlugins.has("error") && this.initErrorInterceptor(), ((c = e.dom) == null ? void 0 : c.enabled) !== !1 && !this.disabledPlugins.has("dom") && this.initDOMCollector((l = e.dom) == null ? void 0 : l.initialDelay), ((u = e.performance) == null ? void 0 : u.enabled) !== !1 && !this.disabledPlugins.has("performance") && this.initPerformanceCollector(), this.disabledPlugins.has("screenshot") || this.initScreenshotCollector(), this.reporter.onStartPerfRun(() => {
      this.startPerfRun();
    }), this.reporter.onStopPerfRun(() => {
      this.stopPerfRun();
    }), this.reporter.onPerfRunDone((h) => {
      const b = { A: "🏆", B: "🥈", C: "🥉", D: "⚠️", F: "❌" }[h.grade] ?? "🏁";
      this.dataBus.emit("console", {
        timestamp: Date.now(),
        level: "log",
        message: `[codeLog] ${b} 跑分完成！综合分: ${h.total} (${h.grade}) — 请去 Web 面板查看详情`,
        args: [`[codeLog] ${b} 跑分完成！综合分: ${h.total} (${h.grade}) — 请去 Web 面板查看详情`]
      });
    }), this.reporter.onSetNetworkThrottle((h) => {
      this.setNetworkThrottle(h);
    }), this.reporter.onAddMock((h) => {
      this.mockApi || (this.mockApi = new G(), this.mockApi.onMatch = (f, b) => {
        this.reporter.reportMockMatch(f, b);
      }, this.mockApi.start()), this.mockApi.addRule(h);
    }), this.reporter.onRemoveMock((h) => {
      this.removeMock(h);
    }), this.reporter.onClearMocks(() => {
      this.clearMocks();
    }), this.reporter.onUpdateMockRule((h, f) => {
      var b;
      (b = this.mockApi) == null || b.updateRule(h, { enabled: f });
    }), this.reporter.onRequestIDBSnapshot(async () => {
      if (this.idbInterceptor)
        try {
          const h = await this.idbInterceptor.takeSnapshot();
          this.reporter.reportIDBSnapshot(h);
        } catch {
        }
    }), this.reporter.onRequestIDBStoreData(async (h, f, b, w, S) => {
      if (this.idbInterceptor)
        try {
          const p = await this.idbInterceptor.getStoreData(h, f, b, w);
          this.reporter.reportIDBStoreData({ ...p, reqId: S });
        } catch {
        }
    }), this.reporter.onGetComputedStyles((h) => {
      try {
        const f = document.querySelector(h);
        if (!f) return;
        const b = window.getComputedStyle(f), w = [
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
        ], S = {};
        for (const p of w) {
          const g = b.getPropertyValue(p);
          g && (S[p] = g);
        }
        this.reporter.reportComputedStyles(h, S);
      } catch {
      }
    }), this.reporter.onSetElementAttr((h, f, b) => {
      var w;
      try {
        const S = document.querySelector(h);
        if (!S) return;
        b === "" ? S.removeAttribute(f) : S.setAttribute(f, b), (w = this.domCollector) == null || w.collect();
      } catch {
      }
    }), this.reporter.onStartElementPicker(() => {
      let h = null;
      const f = (g) => {
        if (g.id) return `#${g.id}`;
        const m = g.tagName.toLowerCase(), y = Array.from(g.classList).slice(0, 2).join(".");
        return y ? `${m}.${y}` : m;
      }, b = (g) => {
        const m = g.target;
        if (!m || m === h) return;
        const y = m.getBoundingClientRect();
        h || (h = document.createElement("div"), h.style.cssText = [
          "position:fixed",
          "pointer-events:none",
          "z-index:2147483647",
          "border:2px solid #007acc",
          "background:rgba(0,122,204,0.15)",
          "box-sizing:border-box",
          "transition:all 60ms ease"
        ].join(";"), document.body.appendChild(h)), h.style.top = `${y.top}px`, h.style.left = `${y.left}px`, h.style.width = `${y.width}px`, h.style.height = `${y.height}px`;
      }, w = (g) => {
        var v;
        g.preventDefault(), g.stopPropagation();
        const m = g.target;
        if (S(), !m) return;
        const y = f(m);
        this.reporter.reportPickedElement(y, m.tagName), (v = this.domCollector) == null || v.collect();
      }, S = () => {
        document.removeEventListener("mousemove", b, !0), document.removeEventListener("click", w, !0), document.removeEventListener("keydown", p, !0), h && (h.remove(), h = null), document.body.style.cursor = "";
      }, p = (g) => {
        g.key === "Escape" && S();
      };
      document.body.style.cursor = "crosshair", document.addEventListener("mousemove", b, !0), document.addEventListener("click", w, !0), document.addEventListener("keydown", p, !0);
    }), globalThis[M] = this, this.heartbeatTimerId = this.platform.timer.setInterval(() => {
      de(this.projectId, this.platform), this.reporter.updateDeviceInfo();
    }, this.heartbeatIntervalMs), ((d = e.eruda) == null ? void 0 : d.enabled) !== !1 && this.initEruda(e.eruda, e.lang), this.dataBus.emit("lifecycle", {
      event: "connect",
      url: typeof location < "u" ? location.href : void 0
    }), this.visibilityHandler = () => {
      const h = document.visibilityState === "visible" ? "page_show" : "page_hide";
      this.dataBus.emit("lifecycle", { event: h, url: location.href });
    }, document.addEventListener("visibilitychange", this.visibilityHandler), this.beforeUnloadHandler = () => {
      this.dataBus.emit("lifecycle", { event: "page_unload", url: location.href });
    }, window.addEventListener("beforeunload", this.beforeUnloadHandler), this.disabledPlugins.has("system") || (this.systemCollector = new $e((h) => {
      this.dataBus.emit("system", h);
    }), this.systemCollector.startWatching()), this.disabledPlugins.has("indexeddb") || (this.idbInterceptor = new He((h) => {
      if (this.databaseProcessor) {
        const f = this.databaseProcessor({
          dbName: h.dbName,
          storeName: h.storeName,
          operation: h.operation,
          key: h.key,
          value: h.value
        });
        if (!f) return;
        this.dataBus.emit("indexeddb", { ...h, ...f });
        return;
      }
      this.dataBus.emit("indexeddb", h);
    }), this.idbInterceptor.start()), e.gesture && (this.gestureActivator = new Ye(e.gesture), this.gestureActivator.start()), this.pluginManager = new Q();
    const o = s ? s.replace(/^ws:\/\//, "http://").replace(/^wss:\/\//, "https://").replace(/\/ws$/, "") : void 0;
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
    var s, n, o, r, a, c, l;
    try {
      const u = await import("./eruda-CeLRF2MY.js").then((d) => d.e);
      if (this.eruda = u.default || u, this.eruda && typeof this.eruda.init == "function") {
        this.eruda.init({
          tool: e == null ? void 0 : e.tool,
          autoScale: (e == null ? void 0 : e.autoScale) ?? !0,
          useShadowDom: !0,
          defaults: e == null ? void 0 : e.defaults,
          lang: (() => {
            try {
              const f = typeof localStorage < "u" && localStorage.getItem("codelog-lang");
              if (f === "en") return "en";
              if (f === "zh") return "zh-CN";
            } catch {
            }
            return t === "en" ? "en" : "zh-CN";
          })()
        }), typeof localStorage < "u" && Object.keys(localStorage).filter((f) => f.startsWith("eruda")).forEach((f) => localStorage.removeItem(f));
        const d = (n = (s = this.eruda).get) == null ? void 0 : n.call(s, "entryBtn");
        (r = (o = d == null ? void 0 : d.config) == null ? void 0 : o.set) == null || r.call(o, "rememberPos", !1);
        const h = (c = (a = this.eruda).get) == null ? void 0 : c.call(a, "console");
        (l = h == null ? void 0 : h.restoreConsole) == null || l.call(h), this.erudaPlugin.attach(this.eruda, this.dataBus, this, this.deviceInfo.deviceId), this.erudaInitialized = !0;
      } else
        console.warn("codeLog: Eruda 初始化失败 - 无效的 eruda 模块");
    } catch (u) {
      console.warn("codeLog: Eruda 加载失败", u);
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
    const s = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Map(), o = (p, g, m = !1) => function(...y) {
      try {
        let v = x(y), k = y;
        if (e.consoleProcessor) {
          const A = e.consoleProcessor({ level: p, message: v, args: y, timestamp: Date.now() });
          if (!A) {
            g.apply(console, y);
            return;
          }
          v = A.message, k = A.args;
        }
        const I = be(k), C = we(k), te = Ve(k), se = {
          timestamp: Date.now(),
          level: p,
          message: v,
          args: k,
          serializedArgs: te,
          indent: t,
          ...I.length > 0 ? { cssStyles: I } : {},
          ...C ? { styledParts: C } : {},
          ...m ? { stack: O(new Error().stack) } : {}
        };
        e.dataBus.emit("console", se);
      } catch {
      }
      g.apply(console, y);
    };
    console.log = o("log", this.originalConsole.log), console.warn = o("warn", this.originalConsole.warn), console.error = o("error", this.originalConsole.error, !0), console.info = o("info", this.originalConsole.info), console.debug = o("debug", this.originalConsole.debug), console.trace = o("warn", this.originalConsole.trace, !0);
    const r = console.table;
    console.table = function(p, g) {
      try {
        let m = [];
        Array.isArray(p) ? m = p.map(
          (y, v) => y !== null && typeof y == "object" ? { "(index)": v, ...y } : { "(index)": v, Value: y }
        ) : p !== null && typeof p == "object" && (m = Object.entries(p).map(([y, v]) => ({
          "(index)": y,
          Value: v
        }))), e.dataBus.emit("console", {
          timestamp: Date.now(),
          level: "table",
          message: x([p]),
          args: [p],
          indent: t,
          tableData: m
        });
      } catch {
      }
      r == null || r.apply(console, [p]);
    };
    const a = console.group, c = console.groupCollapsed, l = console.groupEnd;
    console.group = function(...p) {
      try {
        e.dataBus.emit("console", {
          timestamp: Date.now(),
          level: "group",
          message: p.length ? x(p) : "console.group",
          args: p,
          indent: t
        }), t++;
      } catch {
      }
      a == null || a.apply(console, p);
    }, console.groupCollapsed = function(...p) {
      try {
        e.dataBus.emit("console", {
          timestamp: Date.now(),
          level: "group-collapsed",
          message: p.length ? x(p) : "console.groupCollapsed",
          args: p,
          indent: t
        }), t++;
      } catch {
      }
      c == null || c.apply(console, p);
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
      l == null || l.apply(console);
    };
    const u = console.count, d = console.countReset;
    console.count = function(p = "default") {
      try {
        const g = (n.get(p) ?? 0) + 1;
        n.set(p, g), e.dataBus.emit("console", {
          timestamp: Date.now(),
          level: "count",
          message: `${p}: ${g}`,
          args: [`${p}: ${g}`],
          indent: t
        });
      } catch {
      }
      u == null || u.call(console, p);
    }, console.countReset = function(p = "default") {
      try {
        n.set(p, 0), e.dataBus.emit("console", {
          timestamp: Date.now(),
          level: "count",
          message: `${p}: 0`,
          args: [`${p}: 0`],
          indent: t
        });
      } catch {
      }
      d == null || d.call(console, p);
    };
    const h = console.time, f = console.timeEnd, b = console.timeLog;
    console.time = function(p = "default") {
      try {
        s.set(p, performance.now());
      } catch {
      }
      h == null || h.call(console, p);
    }, console.timeEnd = function(p = "default") {
      try {
        const g = s.get(p), m = g !== void 0 ? (performance.now() - g).toFixed(3) : "?";
        s.delete(p), e.dataBus.emit("console", {
          timestamp: Date.now(),
          level: "time-log",
          message: `${p}: ${m}ms`,
          args: [`${p}: ${m}ms`],
          indent: t
        });
      } catch {
      }
      f == null || f.call(console, p);
    }, console.timeLog = function(p = "default", ...g) {
      try {
        const m = s.get(p), y = m !== void 0 ? (performance.now() - m).toFixed(3) : "?";
        e.dataBus.emit("console", {
          timestamp: Date.now(),
          level: "time-log",
          message: `${p}: ${y}ms ${g.length ? x(g) : ""}`.trim(),
          args: [`${p}: ${y}ms`, ...g],
          indent: t
        });
      } catch {
      }
      b == null || b.call(console, p, ...g);
    };
    const w = console.assert;
    console.assert = function(p, ...g) {
      if (!p)
        try {
          const m = g.length ? `Assertion failed: ${x(g)}` : "Assertion failed";
          e.dataBus.emit("console", {
            timestamp: Date.now(),
            level: "assert",
            message: m,
            args: g.length ? g : ["Assertion failed"],
            indent: t,
            stack: O(new Error().stack)
          });
        } catch {
        }
      w == null || w.apply(console, [p, ...g]);
    };
    const S = console.clear;
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
      S == null || S.call(console);
    };
  }
  initNetworkInterceptor(e) {
    const t = this.dataBus, s = this.networkProcessor, n = (o) => {
      if (s) {
        const r = s({
          url: o.url,
          method: o.method,
          type: o.type,
          status: o.status,
          requestBody: o.requestBody,
          responseBody: o.responseBody
        });
        if (!r) return;
        t.emit("network", { ...o, ...r });
        return;
      }
      t.emit("network", o);
    };
    this.networkInterceptor = new ve(n, e), this.networkInterceptor.start(), this.wsInterceptor = new ke(n), this.wsInterceptor.start(), this.sseInterceptor = new Ce(n), this.sseInterceptor.start(), this.beaconInterceptor = new Ie(n), this.beaconInterceptor.start();
  }
  initStorageReader() {
    const e = this.dataBus, t = this.storageProcessor;
    this.storageReader = new Re((s) => {
      if (t) {
        const n = t({
          localStorage: s.localStorage,
          sessionStorage: s.sessionStorage,
          cookies: s.cookies
        });
        if (!n) return;
        e.emit("storage", { ...s, ...n });
        return;
      }
      e.emit("storage", s);
    }), this.storageReader.watch(), this.reporter.onRefreshStorage(() => {
      var s;
      (s = this.storageReader) == null || s.readAndReport();
    });
  }
  initErrorInterceptor() {
    this.errorInterceptor = new Ee(this.platform, this.dataBus), this.errorInterceptor.start();
  }
  initDOMCollector(e = 2e3) {
    const t = this.dataBus;
    this.domCollector = new Me(this.platform, (s) => {
      t.emit("dom", s);
    }), this.platform.timer.setTimeout(() => {
      var s;
      (s = this.domCollector) == null || s.collect();
    }, e), this.reporter.onRefreshDOM(() => {
      var s;
      (s = this.domCollector) == null || s.collect();
    });
  }
  initPerformanceCollector() {
    this.performanceCollector = new K(this.dataBus), this.performanceCollector.start();
  }
  initScreenshotCollector() {
    this.screenshotCollector = new _e(this.dataBus), this.reporter.onTakeScreenshot(() => {
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
    this.perfRunning || (this.enterZenMode(), this.perfRunCollector = new K(this.dataBus), this.perfRunCollector.start(), this.perfRunStartTime = Date.now(), this.perfRunning = !0, this.dataBus.emit("console", {
      timestamp: Date.now(),
      level: "log",
      message: "[codeLog] 🏁 跑分开始...",
      args: ["[codeLog] 🏁 跑分开始..."]
    }));
  }
  async stopPerfRun() {
    var o, r;
    if (!this.perfRunning) return null;
    const e = ((o = this.perfRunCollector) == null ? void 0 : o.getSnapshot()) ?? {
      vitals: [],
      samples: [],
      longTasks: [],
      resources: [],
      interactions: []
    };
    (r = this.perfRunCollector) == null || r.destroy(), this.perfRunCollector = null, this.exitZenMode();
    const t = Je(), s = Date.now(), n = {
      sessionId: Date.now().toString(36),
      tabId: this.tabId,
      startTime: this.perfRunStartTime,
      endTime: s,
      duration: s - this.perfRunStartTime,
      snapshot: e,
      audit: t
    };
    return this.dataBus.emit("perf_run_raw", n), this.perfRunning = !1, this.dataBus.emit("console", {
      timestamp: Date.now(),
      level: "log",
      message: "[codeLog] 🏁 跑分数据已上传，服务正在计算分数...",
      args: ["[codeLog] 🏁 跑分数据已上传，服务正在计算分数..."]
    }), n;
  }
  getPerfReport() {
    return this.lastPerfRunSession;
  }
  setNetworkThrottle(e) {
    this.networkThrottle || (this.networkThrottle = new Ge()), this.networkThrottle.setPreset(e);
  }
  addMock(e, t) {
    return this.mockApi || (this.mockApi = new G(), this.mockApi.onMatch = (s, n) => {
      this.reporter.reportMockMatch(s, n);
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
  enterZenMode() {
    var e, t;
    this.zenMode || (this.zenMode = !0, this.performanceCollector && (this.performanceCollector.destroy(), this.performanceCollector = null), this.networkInterceptor && (this.networkInterceptor.stop(), this.networkInterceptor = null), this.wsInterceptor && (this.wsInterceptor.stop(), this.wsInterceptor = null), this.sseInterceptor && (this.sseInterceptor.stop(), this.sseInterceptor = null), this.beaconInterceptor && (this.beaconInterceptor.stop(), this.beaconInterceptor = null), (e = this.storageReader) == null || e.unwatch(), (t = this.domCollector) == null || t.destroy(), this.domCollector = null, this.dataBus.emit("console", {
      timestamp: Date.now(),
      level: "warn",
      message: "[codeLog] Zen Mode ON — 已停止高开销采集",
      args: ["[codeLog] Zen Mode ON — 已停止高开销采集"]
    }));
  }
  /**
   * 退出禅模式，恢复所有采集器。
   */
  exitZenMode() {
    this.zenMode && (this.zenMode = !1, this.initNetworkInterceptor(this.networkConfig), this.initStorageReader(), this.initPerformanceCollector(), this.dataBus.emit("console", {
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
    var n, o, r;
    if (!this.resolvedServerUrl) return null;
    const t = this.resolvedServerUrl.replace(/^ws:\/\//, "http://").replace(/^wss:\/\//, "https://").replace(/\/ws$/, ""), s = ((r = (o = (n = this.dataBus).getBuffer) == null ? void 0 : o.call(n, "console")) == null ? void 0 : r.map((a) => ({
      timestamp: a.timestamp,
      level: a.level,
      message: a.message,
      stack: a.stack,
      tabId: this.tabId
    }))) ?? [];
    try {
      const a = await fetch(`${t}/api/saved-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: this.deviceInfo.deviceId,
          ua: this.deviceInfo.ua,
          projectId: this.projectId,
          startTime: (e == null ? void 0 : e.startTime) ?? Date.now() - 36e5,
          endTime: (e == null ? void 0 : e.endTime) ?? Date.now(),
          logs: s
        })
      });
      return a.ok ? (await a.json()).id ?? null : null;
    } catch {
      return null;
    }
  }
  /**
   * Flush the offline buffer: upload buffered events to the server and clear the buffer.
   * Returns the saved session ID, or null if upload failed.
   */
  async flushOfflineBuffer() {
    var n, o;
    if (!this.offlineBuffer || !this.resolvedServerUrl) return null;
    const e = this.offlineBuffer.flush();
    if (e.length === 0) return null;
    const t = this.resolvedServerUrl.replace(/^ws:\/\//, "http://").replace(/^wss:\/\//, "https://").replace(/\/ws$/, ""), s = e.filter((r) => r.type === "console" || r.type === "error").map((r) => {
      var a, c, l;
      return {
        timestamp: r.ts,
        level: ((a = r.payload) == null ? void 0 : a.level) ?? "log",
        message: ((c = r.payload) == null ? void 0 : c.message) ?? "",
        stack: (l = r.payload) == null ? void 0 : l.stack,
        tabId: this.tabId
      };
    });
    try {
      const r = await fetch(`${t}/api/saved-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: this.deviceInfo.deviceId,
          ua: this.deviceInfo.ua,
          projectId: this.projectId,
          startTime: ((n = e[0]) == null ? void 0 : n.ts) ?? Date.now(),
          endTime: ((o = e[e.length - 1]) == null ? void 0 : o.ts) ?? Date.now(),
          logs: s
        })
      });
      return r.ok ? (await r.json()).id ?? null : null;
    } catch {
      return null;
    }
  }
  destroy() {
    this.dataBus.emit("lifecycle", { event: "disconnect" }), this.visibilityHandler && (document.removeEventListener("visibilitychange", this.visibilityHandler), this.visibilityHandler = null), this.beforeUnloadHandler && (window.removeEventListener("beforeunload", this.beforeUnloadHandler), this.beforeUnloadHandler = null), this.heartbeatTimerId !== null && (this.platform.timer.clearInterval(this.heartbeatTimerId), this.heartbeatTimerId = null), this.originalConsole && (console.log = this.originalConsole.log, console.warn = this.originalConsole.warn, console.error = this.originalConsole.error, console.info = this.originalConsole.info, console.debug = this.originalConsole.debug, console.trace = this.originalConsole.trace, console.clear = this.originalConsole.clear, this.originalConsole = null), globalThis[M] === this && delete globalThis[M], this.erudaPlugin.detach(), this.erudaInitialized && this.eruda && (this.eruda.destroy(), this.erudaInitialized = !1, this.eruda = null), this.networkInterceptor && (this.networkInterceptor.stop(), this.networkInterceptor = null), this.wsInterceptor && (this.wsInterceptor.stop(), this.wsInterceptor = null), this.sseInterceptor && (this.sseInterceptor.stop(), this.sseInterceptor = null), this.beaconInterceptor && (this.beaconInterceptor.stop(), this.beaconInterceptor = null), this.errorInterceptor && (this.errorInterceptor.stop(), this.errorInterceptor = null), this.domCollector && (this.domCollector.destroy(), this.domCollector = null), this.performanceCollector && (this.performanceCollector.destroy(), this.performanceCollector = null), this.storageReader && (this.storageReader.unwatch(), this.storageReader = null), this.systemCollector && (this.systemCollector.stopWatching(), this.systemCollector = null), this.idbInterceptor && (this.idbInterceptor.stop(), this.idbInterceptor = null), this.gestureActivator && (this.gestureActivator.stop(), this.gestureActivator = null), this.networkThrottle && (this.networkThrottle.destroy(), this.networkThrottle = null), this.mockApi && (this.mockApi.stop(), this.mockApi = null), this.perfRunCollector && (this.perfRunCollector.destroy(), this.perfRunCollector = null), this.reporter.detachDataBus(), this.dataBus.clear(), this.pluginManager.destroyAll(), this.reporter.disconnect();
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
let D = null;
function lt(i) {
  if (D)
    D.destroy(), D = null;
  else {
    const e = globalThis[M];
    e && typeof e.destroy == "function" && e.destroy();
  }
  return D = new nt(i), D;
}
function ht() {
  return D;
}
function ot(i) {
  if (!i) return;
  const e = typeof location < "u" && location.protocol === "https:" ? "wss" : "ws", t = typeof location < "u" ? location.hostname : "localhost";
  return `${e}://${t}:${i}`;
}
export {
  qe as BrowserAdapter,
  nt as CodeLog,
  rt as DataHarborPlugin,
  at as OSpyPlugin,
  it as RRWebPlugin,
  nt as default,
  ht as getInstance,
  lt as init,
  ot as resolveServerUrl,
  ct as version
};
