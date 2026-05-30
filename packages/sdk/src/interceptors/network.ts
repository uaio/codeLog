import type { NetworkRequestEntry, NetworkInterceptorConfig } from '../types/index.js';

/** 生成唯一请求 ID */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** 截断字符串到指定字节大小 */
function truncateToSize(str: string, maxSize: number): string {
  if (!str) return str;
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  if (bytes.length <= maxSize) {
    return str;
  }
  // 截断并添加标记
  return str.slice(0, Math.floor(maxSize / 2)) + '...[truncated]';
}

/** 检查 URL 是否匹配忽略模式 */
function shouldIgnoreUrl(url: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern);
      if (regex.test(url)) {
        return true;
      }
    } catch {
      // 忽略无效的正则表达式
    }
  }
  return false;
}

/** 从 Headers 对象转换为普通对象 */
function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

/** 从 PerformanceResourceTiming 提取时间阶段（ms） */
function getResourceTimingPhases(
  url: string,
  startTime: number,
): NetworkRequestEntry['timingPhases'] | undefined {
  try {
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    // 匹配 URL + 请求开始时间（±500ms 容差）
    const entry = entries.find(
      (e) => e.name === url || (e.name.endsWith(url) && Math.abs(e.startTime - (startTime - performance.timeOrigin)) < 500),
    );
    if (!entry || entry.startTime === 0) return undefined;
    const dns = entry.domainLookupEnd - entry.domainLookupStart;
    const tcp = entry.connectEnd - entry.connectStart;
    const ssl = entry.secureConnectionStart > 0 ? entry.connectEnd - entry.secureConnectionStart : 0;
    const request = entry.responseStart - entry.requestStart;
    const response = entry.responseEnd - entry.responseStart;
    const total = entry.responseEnd - entry.startTime;
    return {
      dns: Math.max(0, dns),
      tcp: Math.max(0, tcp),
      ssl: Math.max(0, ssl),
      request: Math.max(0, request),
      response: Math.max(0, response),
      total: Math.max(0, total),
    };
  } catch {
    return undefined;
  }
}

/** 从响应头提取响应体大小（bytes） */
function extractResponseSize(
  responseHeaders: Record<string, string> | undefined,
  responseBody: string | undefined,
): number | undefined {
  if (responseHeaders) {
    const cl = responseHeaders['content-length'];
    if (cl) {
      const n = parseInt(cl, 10);
      if (!isNaN(n)) return n;
    }
  }
  if (responseBody) {
    return new TextEncoder().encode(responseBody).length;
  }
  return undefined;
}

export type NetworkReportCallback = (
  entry: Omit<NetworkRequestEntry, 'deviceId' | 'tabId'>,
) => void;

export class NetworkInterceptor {
  private config: Required<NetworkInterceptorConfig>;
  private onReport: NetworkReportCallback;
  private originalFetch: typeof fetch | null = null;
  private originalXhrOpen: typeof XMLHttpRequest.prototype.open | null = null;
  private originalXhrSend: typeof XMLHttpRequest.prototype.send | null = null;
  private originalXhrSetRequestHeader: typeof XMLHttpRequest.prototype.setRequestHeader | null =
    null;

  constructor(onReport: NetworkReportCallback, config?: NetworkInterceptorConfig) {
    this.onReport = onReport;
    this.config = {
      enabled: config?.enabled ?? true,
      maxRequestBodySize: config?.maxRequestBodySize ?? 10240,
      maxResponseBodySize: config?.maxResponseBodySize ?? 10240,
      ignoreUrls: config?.ignoreUrls ?? [],
    };
  }

  /** 启动拦截 */
  start(): void {
    if (!this.config.enabled) return;

    this.interceptFetch();
    this.interceptXHR();
  }

  /** 停止拦截 */
  stop(): void {
    if (this.originalFetch) {
      window.fetch = this.originalFetch;
      this.originalFetch = null;
    }

    if (this.originalXhrOpen && this.originalXhrSend && this.originalXhrSetRequestHeader) {
      XMLHttpRequest.prototype.open = this.originalXhrOpen;
      XMLHttpRequest.prototype.send = this.originalXhrSend;
      XMLHttpRequest.prototype.setRequestHeader = this.originalXhrSetRequestHeader;
      this.originalXhrOpen = null;
      this.originalXhrSend = null;
      this.originalXhrSetRequestHeader = null;
    }
  }

  /** 拦截 Fetch API */
  private interceptFetch(): void {
    this.originalFetch = window.fetch;
    const self = this;

    window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const requestId = generateRequestId();
      const startTime = Date.now();

      // 解析请求信息
      let url: string;
      let method: string = init?.method?.toUpperCase() || 'GET';
      let requestHeaders: Record<string, string> | undefined;
      let requestBody: string | undefined;
      // Capture call stack at initiation point (skip 3 frames: Error, fetch wrapper, caller's caller)
      let initiator: string | undefined;
      try {
        initiator = new Error().stack?.split('\n').slice(3, 8).join('\n');
      } catch { /* ignore */ }

      if (typeof input === 'string') {
        url = input;
      } else if (input instanceof URL) {
        url = input.toString();
      } else if (input instanceof Request) {
        url = input.url;
        method = input.method.toUpperCase();
        requestHeaders = headersToObject(input.headers);
      } else {
        url = String(input);
      }

      // 检查是否忽略
      if (shouldIgnoreUrl(url, self.config.ignoreUrls)) {
        return self.originalFetch!.call(window, input, init);
      }

      // 处理 init 参数
      if (init) {
        if (init.headers) {
          if (init.headers instanceof Headers) {
            requestHeaders = headersToObject(init.headers);
          } else if (typeof init.headers === 'object') {
            requestHeaders = init.headers as Record<string, string>;
          }
        }
        if (init.body) {
          if (typeof init.body === 'string') {
            requestBody = truncateToSize(init.body, self.config.maxRequestBodySize);
          } else if (init.body instanceof FormData) {
            requestBody = '[FormData]';
          } else {
            try {
              requestBody = truncateToSize(
                JSON.stringify(init.body),
                self.config.maxRequestBodySize,
              );
            } catch {
              requestBody = '[Body]';
            }
          }
        }
      }

      return self
        .originalFetch!.call(window, input, init)
        .then(async (response) => {
          const duration = Date.now() - startTime;

          // 获取响应头（需先获取，用于判断 Content-Type）
          let responseHeaders: Record<string, string> | undefined;
          try {
            responseHeaders = headersToObject(response.headers);
          } catch {
            // 忽略
          }

          // 按 Content-Type 选择响应体读取方式，避免二进制内容变乱码
          let responseBody: string | undefined;
          try {
            const clonedResponse = response.clone();
            const ct = responseHeaders?.['content-type'] ?? '';
            if (ct.includes('application/json')) {
              const text = await clonedResponse.text();
              responseBody = truncateToSize(text, self.config.maxResponseBodySize);
            } else if (ct.includes('text/')) {
              const text = await clonedResponse.text();
              responseBody = truncateToSize(text, self.config.maxResponseBodySize);
            } else if (ct) {
              // 二进制响应：转 base64 摘要（仅取前 maxResponseBodySize 字节）
              const blob = await clonedResponse.blob();
              if (blob.size <= self.config.maxResponseBodySize) {
                const buf = await blob.arrayBuffer();
                const bytes = new Uint8Array(buf);
                let binary = '';
                bytes.forEach((b) => { binary += String.fromCharCode(b); });
                responseBody = `[binary: ${blob.type}, ${blob.size}B] ` +
                  btoa(binary).slice(0, 200);
              } else {
                responseBody = `[binary: ${blob.type}, ${blob.size}B, EXCEED_SIZE]`;
              }
            } else {
              const text = await clonedResponse.text();
              responseBody = truncateToSize(text, self.config.maxResponseBodySize);
            }
          } catch {
            // 响应体可能已被读取或不可读
          }

          self.onReport({
            id: requestId,
            timestamp: startTime,
            method,
            url,
            status: response.status,
            statusText: response.statusText,
            requestHeaders,
            requestBody,
            responseHeaders,
            responseBody,
            duration,
            type: 'fetch',
            responseSize: extractResponseSize(responseHeaders, responseBody),
            timingPhases: getResourceTimingPhases(url, startTime),
            initiator,
          });

          return response;
        })
        .catch((error: Error) => {
          const duration = Date.now() - startTime;

          self.onReport({
            id: requestId,
            timestamp: startTime,
            method,
            url,
            requestHeaders,
            requestBody,
            duration,
            type: 'fetch',
            error: error.message,
            initiator,
          });

          throw error;
        });
    };
  }

  /** 拦截 XMLHttpRequest */
  private interceptXHR(): void {
    const self = this;

    // 保存原始方法
    this.originalXhrOpen = XMLHttpRequest.prototype.open;
    this.originalXhrSend = XMLHttpRequest.prototype.send;
    this.originalXhrSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

    // XHR 上下文数据存储
    const xhrContextMap = new WeakMap<
      XMLHttpRequest,
      {
        requestId: string;
        startTime: number;
        method: string;
        url: string;
        requestHeaders: Record<string, string>;
        requestBody?: string;
        initiator?: string;
      }
    >();

    // 拦截 open
    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      async: boolean = true,
      username?: string | null,
      password?: string | null,
    ) {
      let initiator: string | undefined;
      try {
        initiator = new Error().stack?.split('\n').slice(3, 8).join('\n');
      } catch { /* ignore */ }
      const context = {
        requestId: generateRequestId(),
        startTime: 0,
        method: method.toUpperCase(),
        url: typeof url === 'string' ? url : url.toString(),
        requestHeaders: {},
        initiator,
      };
      xhrContextMap.set(this, context);
      return self.originalXhrOpen!.call(this, method, url, async, username as any, password as any);
    };

    // 拦截 setRequestHeader
    XMLHttpRequest.prototype.setRequestHeader = function (name: string, value: string) {
      const context = xhrContextMap.get(this);
      if (context) {
        context.requestHeaders[name] = value;
      }
      return self.originalXhrSetRequestHeader!.call(this, name, value);
    };

    // 拦截 send
    XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      const context = xhrContextMap.get(this);
      if (!context) {
        return self.originalXhrSend!.call(this, body);
      }

      // 检查是否忽略
      if (shouldIgnoreUrl(context.url, self.config.ignoreUrls)) {
        return self.originalXhrSend!.call(this, body);
      }

      context.startTime = Date.now();

      // 处理请求体
      if (body) {
        if (typeof body === 'string') {
          context.requestBody = truncateToSize(body, self.config.maxRequestBodySize);
        } else if (body instanceof FormData) {
          context.requestBody = '[FormData]';
        } else {
          try {
            context.requestBody = truncateToSize(
              JSON.stringify(body),
              self.config.maxRequestBodySize,
            );
          } catch {
            context.requestBody = '[Body]';
          }
        }
      }

      // 监听响应
      const onLoad = () => {
        const duration = Date.now() - context.startTime;

        // 获取响应头
        let responseHeaders: Record<string, string> | undefined;
        try {
          const headerStr = this.getAllResponseHeaders();
          if (headerStr) {
            const headers: Record<string, string> = {};
            headerStr.split('\r\n').forEach((line) => {
              const [key, value] = line.split(': ');
              if (key && value) {
                headers[key] = value;
              }
            });
            if (Object.keys(headers).length > 0) {
              responseHeaders = headers;
            }
          }
        } catch {
          // 忽略
        }

        // 按 responseType 读取响应体，避免 blob/arraybuffer 时 responseText 为空
        let responseBody: string | undefined;
        try {
          const rt = this.responseType;
          if (!rt || rt === 'text' || rt === 'json') {
            const text = rt === 'json'
              ? JSON.stringify(this.response)
              : this.responseText;
            if (text) {
              responseBody = truncateToSize(text, self.config.maxResponseBodySize);
            }
          } else if (rt === 'arraybuffer' && this.response instanceof ArrayBuffer) {
            const bytes = new Uint8Array(this.response);
            if (bytes.byteLength <= self.config.maxResponseBodySize) {
              let binary = '';
              bytes.forEach((b) => { binary += String.fromCharCode(b); });
              responseBody = `[arraybuffer: ${bytes.byteLength}B] ` + btoa(binary).slice(0, 200);
            } else {
              responseBody = `[arraybuffer: ${bytes.byteLength}B, EXCEED_SIZE]`;
            }
          } else if (rt === 'blob' && this.response instanceof Blob) {
            responseBody = `[blob: ${this.response.type}, ${this.response.size}B${this.response.size > self.config.maxResponseBodySize ? ', EXCEED_SIZE' : ''}]`;
          } else if (rt === 'document') {
            responseBody = `[document]`;
          }
        } catch {
          // 响应体可能不可读
        }

        self.onReport({
          id: context.requestId,
          timestamp: context.startTime,
          method: context.method,
          url: context.url,
          status: this.status,
          statusText: this.statusText,
          requestHeaders: context.requestHeaders,
          requestBody: context.requestBody,
          responseHeaders,
          responseBody,
          duration,
          type: 'xhr',
          withCredentials: this.withCredentials,
          responseSize: extractResponseSize(responseHeaders, responseBody),
          timingPhases: getResourceTimingPhases(context.url, context.startTime),
          initiator: context.initiator,
        });
      };

      const onError = () => {
        const duration = Date.now() - context.startTime;

        self.onReport({
          id: context.requestId,
          timestamp: context.startTime,
          method: context.method,
          url: context.url,
          requestHeaders: context.requestHeaders,
          requestBody: context.requestBody,
          duration,
          type: 'xhr',
          error: 'Network error',
        });
      };

      this.addEventListener('load', onLoad);
      this.addEventListener('error', onError);

      return self.originalXhrSend!.call(this, body);
    };
  }
}
