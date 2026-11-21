import { buildInjectorScript } from './injector-runtime.mjs';

class CdpSession {
  constructor(target, onClose) {
    this.target = target;
    this.id = target.id;
    this.wsUrl = target.webSocketDebuggerUrl;
    this.onClose = onClose;
    this.ws = null;
    this.nextMsgId = 1;
    this.pending = new Map();
    this.preloadScriptId = null;
    this.lastStats = null;
    this.connected = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      this.ws = ws;
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          try {
            ws.close();
          } catch {}
          reject(new Error(`CDP 连接超时: ${this.wsUrl}`));
        }
      }, 6000);

      ws.addEventListener('open', () => {
        clearTimeout(timer);
        this.connected = true;
        if (!settled) {
          settled = true;
          resolve();
        }
      });

      ws.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(String(event.data));
          if (msg.id && this.pending.has(msg.id)) {
            const { resolve: res, reject: rej, timeout } = this.pending.get(msg.id);
            clearTimeout(timeout);
            this.pending.delete(msg.id);
            if (msg.error) {
              rej(new Error(msg.error.message || JSON.stringify(msg.error)));
            } else {
              res(msg.result);
            }
          }
        } catch {
          // 忽略无法解析的事件帧
        }
      });

      ws.addEventListener('error', (err) => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          reject(new Error(`CDP WebSocket 错误: ${err?.message || 'connection failed'}`));
        }
      });

      ws.addEventListener('close', () => {
        clearTimeout(timer);
        this.connected = false;
        for (const [, pending] of this.pending) {
          clearTimeout(pending.timeout);
          pending.reject(new Error('CDP 会话已关闭'));
        }
        this.pending.clear();
        this.onClose(this.id);
      });
    });
  }

  send(method, params = {}, timeoutMs = 8000) {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('CDP 会话未连接'));
    }
    const id = this.nextMsgId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP 调用超时: ${method}`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timeout });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async injectPayload(payload) {
    const script = buildInjectorScript(payload);

    // 启用 Page 域并注册新文档预注入（页面刷新/导航不闪英文）
    try {
      await this.send('Page.enable');
      if (this.preloadScriptId) {
        await this.send('Page.removeScriptToEvaluateOnNewDocument', {
          identifier: this.preloadScriptId
        }).catch(() => {});
      }
      const added = await this.send('Page.addScriptToEvaluateOnNewDocument', {
        source: script
      });
      this.preloadScriptId = added?.identifier || null;
    } catch {
      // 部分 iframe/webview 目标不支持 Page 域，降级为直接 Runtime.evaluate
    }

    const evalRes = await this.send('Runtime.evaluate', {
      expression: script,
      returnByValue: true,
      awaitPromise: false
    });

    if (evalRes?.result?.value) {
      this.lastStats = evalRes.result.value;
    }
    return this.lastStats;
  }

  async collectUntranslated() {
    const res = await this.send('Runtime.evaluate', {
      expression: 'window.__AG_ZH__ ? window.__AG_ZH__.collectUntranslated() : []',
      returnByValue: true
    });
    return Array.isArray(res?.result?.value) ? res.result.value : [];
  }

  async refreshStats() {
    const res = await this.send('Runtime.evaluate', {
      expression: 'window.__AG_ZH__ ? window.__AG_ZH__.getStats() : null',
      returnByValue: true
    });
    if (res?.result?.value) {
      this.lastStats = res.result.value;
    }
    return this.lastStats;
  }

  close() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
    }
  }
}

export class CdpLocalizationManager {
  constructor({ config, dictBundle, logger = console }) {
    this.config = config;
    this.dictBundle = dictBundle;
    this.enabled = Boolean(config.enabledOnStart);
    this.logger = logger;
    this.sessions = new Map();
    this.pollTimer = null;
    this.cdpReachable = false;
    this.lastError = '';
    this.isPolling = false;
    this.onStatusChange = null;
  }

  getPayload() {
    return {
      enabled: this.enabled,
      entries: this.dictBundle.entries,
      patterns: this.dictBundle.patterns,
      ignoreSelectors: this.config.ignoreSelectors,
      maxTextLength: this.config.maxTextLength
    };
  }

  isTargetSupported(target) {
    if (!target || !target.webSocketDebuggerUrl) return false;
    const type = target.type || '';
    if (!['page', 'webview', 'iframe', 'app'].includes(type)) return false;
    const url = String(target.url || '');
    // 绝不汉化 DevTools 自身或空白错误页
    if (url.startsWith('devtools://') || url.startsWith('chrome-error://')) return false;
    return true;
  }

  async fetchTargets() {
    const endpoint = `http://${this.config.cdpHost}:${this.config.cdpPort}/json/list`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const resp = await fetch(endpoint, { signal: controller.signal });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const list = await resp.json();
      this.cdpReachable = true;
      this.lastError = '';
      return Array.isArray(list) ? list : [];
    } catch (err) {
      this.cdpReachable = false;
      this.lastError = err.message;
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  async pollOnce() {
    if (this.isPolling) return;
    this.isPolling = true;
    try {
      const targets = await this.fetchTargets();
      const supported = targets.filter((t) => this.isTargetSupported(t));
      const aliveIds = new Set(supported.map((t) => t.id));

      // 清理已关闭的目标
      for (const [id, session] of this.sessions) {
        if (!aliveIds.has(id)) {
          session.close();
          this.sessions.delete(id);
        }
      }

      // 连接新出现的目标并注入汉化引擎
      for (const target of supported) {
        if (this.sessions.has(target.id)) continue;
        const session = new CdpSession(target, (closedId) => {
          this.sessions.delete(closedId);
          this.onStatusChange?.();
        });
        try {
          await session.connect();
          this.sessions.set(target.id, session);
          const stats = await session.injectPayload(this.getPayload());
          this.logger.log(
            `[汉化已挂载] ${target.title || target.type} (${target.url?.slice(0, 60) || 'no-url'}) -> 已替换 ${stats?.translatedTexts ?? 0} 处文本`
          );
          this.onStatusChange?.();
        } catch (err) {
          session.close();
          this.sessions.delete(target.id);
        }
      }
    } finally {
      this.isPolling = false;
    }
  }

  startPolling() {
    this.stopPolling();
    this.pollOnce();
    this.pollTimer = setInterval(() => {
      this.pollOnce();
    }, this.config.pollIntervalMs || 1500);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async broadcastUpdate() {
    const payload = this.getPayload();
    const results = [];
    for (const [id, session] of this.sessions) {
      try {
        const stats = await session.injectPayload(payload);
        results.push({ id, ok: true, stats });
      } catch (err) {
        results.push({ id, ok: false, error: err.message });
      }
    }
    this.onStatusChange?.();
    return results;
  }

  async setEnabled(flag) {
    this.enabled = Boolean(flag);
    return this.broadcastUpdate();
  }

  async updateDictionaries(nextBundle) {
    this.dictBundle = nextBundle;
    return this.broadcastUpdate();
  }

  async collectUntranslatedAll() {
    const merged = new Map();
    for (const session of this.sessions.values()) {
      try {
        const items = await session.collectUntranslated();
        for (const item of items) {
          const prev = merged.get(item.text);
          if (prev) {
            prev.count += item.count;
          } else {
            merged.set(item.text, { ...item });
          }
        }
      } catch {
        // 忽略单个目标采集失败
      }
    }
    return Array.from(merged.values()).sort(
      (a, b) => b.count - a.count || a.text.localeCompare(b.text)
    );
  }

  async getStatus() {
    const targets = [];
    for (const session of this.sessions.values()) {
      let stats = session.lastStats;
      try {
        stats = (await session.refreshStats()) || stats;
      } catch {}
      targets.push({
        id: session.id,
        type: session.target.type,
        title: stats?.title || session.target.title || '(未命名窗口)',
        url: session.target.url || '',
        translatedTexts: stats?.translatedTexts ?? 0,
        translatedAttrs: stats?.translatedAttrs ?? 0
      });
    }

    return {
      enabled: this.enabled,
      cdpReachable: this.cdpReachable,
      cdpEndpoint: `${this.config.cdpHost}:${this.config.cdpPort}`,
      lastError: this.lastError,
      attachedCount: targets.length,
      targets,
      dictStats: this.dictBundle.stats,
      modules: this.dictBundle.modules
    };
  }

  shutdown() {
    this.stopPolling();
    for (const session of this.sessions.values()) {
      session.close();
    }
    this.sessions.clear();
  }
}
