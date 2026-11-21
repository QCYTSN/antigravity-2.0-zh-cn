/**
 * 纯函数翻译内核（同时用于 Node 单元测试与注入到 Antigravity 2.0 渲染层）。
 * 设计目标：
 * 1. React / Virtual DOM 绝对安全：仅修改 Text.nodeValue 与指定 UI 属性，不破坏节点树。
 * 2. 高覆盖率智能匹配：空白规范化 + 精确匹配 + 忽略大小写匹配 + 末尾标点保留匹配 + 锚定正则模板。
 * 3. 防误伤保护：跳过代码块、编辑器、终端、输入正文、路径/URL/代码特征字符串。
 * 4. 全文档覆盖：支持 documentElement、Shadow DOM、同源 iframe 及轻量定时补扫。
 */

const TRAILING_PUNCT_MAP = [
  ['...', '...'],
  ['…', '…'],
  [':', '：'],
  ['?', '？'],
  ['!', '！'],
  ['*', '*']
];

const TRAILING_TAG_MAP = [
  [/\s*\(optional\)$/i, '（可选）'],
  [/\s*\(recommended\)$/i, '（推荐）'],
  [/\s*\(beta\)$/i, '（测试版）'],
  [/\s*\(experimental\)$/i, '（实验性）'],
  [/\s*\(default\)$/i, '（默认）']
];

export function normalizeLookupText(text) {
  return String(text ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function looksLikeNonUiText(text, maxLength = 400) {
  if (typeof text !== 'string') return true;
  const trimmed = normalizeLookupText(text);
  if (!trimmed || trimmed.length > maxLength) return true;
  if (!/[A-Za-z]{2,}/.test(trimmed)) return true;
  if (/^(https?:\/\/|file:\/\/|mailto:|wss?:\/\/)/i.test(trimmed)) return true;
  if (/^[A-Za-z]:[\\/]/.test(trimmed)) return true;
  if (/^(\/|\.\/|\.\.\/|~\/)[\w.\-/]+/.test(trimmed)) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return true;
  if (/[{};]{2,}|=>|\b(const|let|var|function|import|export|return|SELECT|FROM)\b/.test(trimmed)) {
    return true;
  }
  return false;
}

export function buildLowerDict(dict = {}) {
  const lower = Object.create(null);
  for (const [k, v] of Object.entries(dict)) {
    const norm = normalizeLookupText(k);
    if (!norm) continue;
    const lk = norm.toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(lower, lk)) {
      lower[lk] = v;
    }
  }
  return lower;
}

function lookupDirect(text, dict, lowerDict) {
  if (Object.prototype.hasOwnProperty.call(dict, text)) {
    return dict[text];
  }
  if (lowerDict && text.length >= 2) {
    const lk = text.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(lowerDict, lk)) {
      return lowerDict[lk];
    }
  }
  return null;
}

export function translateRawString(raw, dict, compiledPatterns, maxLength = 400, lowerDict = null) {
  if (typeof raw !== 'string' || !raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  const normalized = normalizeLookupText(trimmed);
  if (!normalized) return null;

  const effectiveLower = lowerDict || buildLowerDict(dict);

  // 1. 直接精确 / 忽略大小写匹配
  let matched = lookupDirect(normalized, dict, effectiveLower);

  // 2. 末尾括号标签匹配，如 "Model (optional)" / "Feature (Beta)"
  if (!matched) {
    for (let i = 0; i < TRAILING_TAG_MAP.length; i++) {
      const [regex, zhTag] = TRAILING_TAG_MAP[i];
      if (regex.test(normalized)) {
        const base = normalized.replace(regex, '').trim();
        const baseHit = lookupDirect(base, dict, effectiveLower);
        if (baseHit) {
          matched = `${baseHit}${zhTag}`;
          break;
        }
      }
    }
  }

  // 3. 末尾标点保留匹配，如 "Settings:" -> "设置：" / "Loading…" -> "加载中…"
  if (!matched) {
    for (let i = 0; i < TRAILING_PUNCT_MAP.length; i++) {
      const [enPunct, zhPunct] = TRAILING_PUNCT_MAP[i];
      if (normalized.endsWith(enPunct) && normalized.length > enPunct.length + 1) {
        const base = normalized.slice(0, -enPunct.length).trim();
        const baseHit = lookupDirect(base, dict, effectiveLower);
        if (baseHit) {
          matched = `${baseHit}${zhPunct}`;
          break;
        }
      }
    }
  }

  // 4. 锚定正则模板匹配（动态计数、时间、状态等）
  if (!matched && !looksLikeNonUiText(normalized, maxLength)) {
    for (let i = 0; i < compiledPatterns.length; i++) {
      const rule = compiledPatterns[i];
      if (rule.regex.test(normalized)) {
        matched = normalized.replace(rule.regex, rule.replace);
        break;
      }
    }
  }

  if (!matched || matched === normalized) return null;

  const startIdx = raw.indexOf(trimmed);
  if (startIdx < 0) return matched;
  const leading = raw.slice(0, startIdx);
  const trailing = raw.slice(startIdx + trimmed.length);
  return `${leading}${matched}${trailing}`;
}

export function compilePatterns(patterns = []) {
  const list = [];
  for (const item of patterns) {
    try {
      list.push({
        regex: new RegExp(item.pattern, item.flags || ''),
        replace: item.replace
      });
    } catch {
      // 跳过无效正则
    }
  }
  return list;
}

/**
 * 构建注入到 Antigravity 2.0 Electron 渲染进程的完整脚本。
 */
export function buildInjectorScript(payload) {
  const serializedPayload = JSON.stringify(payload);

  return `(() => {
  try {
    const PAYLOAD = ${serializedPayload};
    const SKIP_TAGS = new Set([
      'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'KBD', 'SAMP', 'VAR',
      'SVG', 'MATH', 'TEXTAREA', 'INPUT', 'CANVAS', 'VIDEO', 'AUDIO'
    ]);
    const SAFE_ATTRS = ['placeholder', 'title', 'aria-label', 'data-tooltip'];
    const TRAILING_PUNCT_MAP = [
      ['...', '...'],
      ['…', '…'],
      [':', '：'],
      ['?', '？'],
      ['!', '！'],
      ['*', '*']
    ];
    const TRAILING_TAG_MAP = [
      [/\\s*\\(optional\\)$/i, '（可选）'],
      [/\\s*\\(recommended\\)$/i, '（推荐）'],
      [/\\s*\\(beta\\)$/i, '（测试版）'],
      [/\\s*\\(experimental\\)$/i, '（实验性）'],
      [/\\s*\\(default\\)$/i, '（默认）']
    ];

    function normalizeText(text) {
      return String(text || '').replace(/\\u00a0/g, ' ').replace(/\\s+/g, ' ').trim();
    }

    function looksLikeNonUiText(text, maxLength) {
      if (typeof text !== 'string') return true;
      const trimmed = normalizeText(text);
      if (!trimmed || trimmed.length > maxLength) return true;
      if (!/[A-Za-z]{2,}/.test(trimmed)) return true;
      if (/^(https?:\\/\\/|file:\\/\\/|mailto:|wss?:\\/\\/)/i.test(trimmed)) return true;
      if (/^[A-Za-z]:[\\\\/]/.test(trimmed)) return true;
      if (/^(\\/|\\.\\/|\\.\\.\\/|~\\/)[\\w.\\-/]+/.test(trimmed)) return true;
      if (/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(trimmed)) return true;
      if (/[{};]{2,}|=>|\\b(const|let|var|function|import|export|return|SELECT|FROM)\\b/.test(trimmed)) {
        return true;
      }
      return false;
    }

    function buildLowerDict(dict) {
      const lower = Object.create(null);
      for (const k in dict) {
        if (!Object.prototype.hasOwnProperty.call(dict, k)) continue;
        const norm = normalizeText(k);
        if (!norm) continue;
        const lk = norm.toLowerCase();
        if (!Object.prototype.hasOwnProperty.call(lower, lk)) {
          lower[lk] = dict[k];
        }
      }
      return lower;
    }

    function compilePatterns(patterns) {
      const out = [];
      for (const p of (patterns || [])) {
        try {
          out.push({ regex: new RegExp(p.pattern, p.flags || ''), replace: p.replace });
        } catch {}
      }
      return out;
    }

    function lookupDirect(text, dict, lowerDict) {
      if (Object.prototype.hasOwnProperty.call(dict, text)) return dict[text];
      if (text.length >= 2) {
        const lk = text.toLowerCase();
        if (Object.prototype.hasOwnProperty.call(lowerDict, lk)) return lowerDict[lk];
      }
      return null;
    }

    function translateRaw(raw, dict, lowerDict, patterns, maxLength) {
      if (typeof raw !== 'string' || !raw) return null;
      const trimmed = raw.trim();
      if (!trimmed || trimmed.length > maxLength) return null;
      const normalized = normalizeText(trimmed);
      if (!normalized) return null;

      let matched = lookupDirect(normalized, dict, lowerDict);

      if (!matched) {
        for (let i = 0; i < TRAILING_TAG_MAP.length; i++) {
          const [regex, zhTag] = TRAILING_TAG_MAP[i];
          if (regex.test(normalized)) {
            const base = normalized.replace(regex, '').trim();
            const baseHit = lookupDirect(base, dict, lowerDict);
            if (baseHit) {
              matched = baseHit + zhTag;
              break;
            }
          }
        }
      }

      if (!matched) {
        for (let i = 0; i < TRAILING_PUNCT_MAP.length; i++) {
          const [enPunct, zhPunct] = TRAILING_PUNCT_MAP[i];
          if (normalized.endsWith(enPunct) && normalized.length > enPunct.length + 1) {
            const base = normalized.slice(0, -enPunct.length).trim();
            const baseHit = lookupDirect(base, dict, lowerDict);
            if (baseHit) {
              matched = baseHit + zhPunct;
              break;
            }
          }
        }
      }

      if (!matched && !looksLikeNonUiText(normalized, maxLength)) {
        for (let i = 0; i < patterns.length; i++) {
          const rule = patterns[i];
          if (rule.regex.test(normalized)) {
            matched = normalized.replace(rule.regex, rule.replace);
            break;
          }
        }
      }

      if (!matched || matched === normalized) return null;
      const idx = raw.indexOf(trimmed);
      if (idx < 0) return matched;
      return raw.slice(0, idx) + matched + raw.slice(idx + trimmed.length);
    }

    if (window.__AG_ZH__ && typeof window.__AG_ZH__.update === 'function') {
      window.__AG_ZH__.update(PAYLOAD);
      return window.__AG_ZH__.getStats();
    }

    const textRecords = new WeakMap();
    const attrRecords = new WeakMap();
    const observedRoots = new WeakSet();

    const state = {
      enabled: Boolean(PAYLOAD.enabled),
      dict: PAYLOAD.entries || {},
      lowerDict: buildLowerDict(PAYLOAD.entries || {}),
      patterns: compilePatterns(PAYLOAD.patterns),
      ignoreSelectors: Array.isArray(PAYLOAD.ignoreSelectors) ? PAYLOAD.ignoreSelectors : [],
      maxTextLength: Number(PAYLOAD.maxTextLength) || 400,
      sweepIntervalMs: Number(PAYLOAD.sweepIntervalMs) || 2000
    };

    let pendingNodes = new Set();
    let flushTimer = null;
    let sweepTimer = null;

    function shouldSkipElement(el) {
      if (!el || el.nodeType !== 1) return false;
      let cur = el;
      while (cur && cur.nodeType === 1) {
        if (SKIP_TAGS.has(cur.tagName)) return true;
        for (let i = 0; i < state.ignoreSelectors.length; i++) {
          try {
            if (cur.matches(state.ignoreSelectors[i])) return true;
          } catch {}
        }
        cur = cur.parentElement;
      }
      return false;
    }

    function shouldSkipAttrElement(el) {
      if (!el || el.nodeType !== 1) return false;
      let cur = el.parentElement;
      while (cur && cur.nodeType === 1) {
        for (let i = 0; i < state.ignoreSelectors.length; i++) {
          try {
            if (cur.matches(state.ignoreSelectors[i])) return true;
          } catch {}
        }
        cur = cur.parentElement;
      }
      return false;
    }

    function processTextNode(node) {
      try {
        if (!node || node.nodeType !== 3) return;
        const parent = node.parentElement;
        if (!parent || shouldSkipElement(parent)) return;

        const current = node.nodeValue || '';
        const record = textRecords.get(node);

        if (!state.enabled) {
          if (record && current === record.translated) {
            node.nodeValue = record.raw;
          }
          return;
        }

        const raw = record && current === record.translated ? record.raw : current;
        const translated = translateRaw(raw, state.dict, state.lowerDict, state.patterns, state.maxTextLength);
        if (translated) {
          textRecords.set(node, { raw, translated });
          if (node.nodeValue !== translated) {
            node.nodeValue = translated;
          }
        } else if (record && current === record.translated) {
          node.nodeValue = record.raw;
          textRecords.delete(node);
        }
      } catch {}
    }

    function processElementAttrs(el) {
      try {
        if (!el || el.nodeType !== 1) return;
        if (shouldSkipAttrElement(el)) return;

        let map = attrRecords.get(el);
        for (let i = 0; i < SAFE_ATTRS.length; i++) {
          const attr = SAFE_ATTRS[i];
          if (!el.hasAttribute(attr)) continue;
          const current = el.getAttribute(attr) || '';
          const record = map ? map.get(attr) : null;

          if (!state.enabled) {
            if (record && current === record.translated) {
              el.setAttribute(attr, record.raw);
            }
            continue;
          }

          const raw = record && current === record.translated ? record.raw : current;
          const translated = translateRaw(raw, state.dict, state.lowerDict, state.patterns, state.maxTextLength);
          if (translated) {
            if (!map) {
              map = new Map();
              attrRecords.set(el, map);
            }
            map.set(attr, { raw, translated });
            if (el.getAttribute(attr) !== translated) {
              el.setAttribute(attr, translated);
            }
          } else if (record && current === record.translated) {
            el.setAttribute(attr, record.raw);
            map.delete(attr);
          }
        }
      } catch {}
    }

    function observeRoot(root) {
      try {
        if (!root || observedRoots.has(root)) return;
        observedRoots.add(root);

        const observer = new MutationObserver((mutations) => {
          try {
            for (let i = 0; i < mutations.length; i++) {
              const m = mutations[i];
              if (m.type === 'characterData' || m.type === 'attributes') {
                pendingNodes.add(m.target);
              } else if (m.type === 'childList') {
                for (let j = 0; j < m.addedNodes.length; j++) {
                  pendingNodes.add(m.addedNodes[j]);
                }
              }
            }
            scheduleFlush();
          } catch {}
        });

        observer.observe(root, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
          attributeFilter: SAFE_ATTRS
        });
      } catch {}
    }

    function walkSubtree(root) {
      try {
        if (!root) return;
        if (root.nodeType === 3) {
          processTextNode(root);
          return;
        }
        if (root.nodeType === 1) {
          processElementAttrs(root);
          if (root.shadowRoot) {
            observeRoot(root.shadowRoot);
            walkSubtree(root.shadowRoot);
          }
          if (root.tagName === 'IFRAME') {
            try {
              const subDoc = root.contentDocument;
              if (subDoc && subDoc.documentElement) {
                observeRoot(subDoc.documentElement);
                walkSubtree(subDoc.documentElement);
              }
            } catch {}
          }
        }

        const doc = root.ownerDocument || document;
        const walker = doc.createTreeWalker(
          root,
          NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
          null
        );
        let node;
        while ((node = walker.nextNode())) {
          if (node.nodeType === 3) {
            processTextNode(node);
          } else if (node.nodeType === 1) {
            processElementAttrs(node);
            if (node.shadowRoot) {
              observeRoot(node.shadowRoot);
              walkSubtree(node.shadowRoot);
            }
            if (node.tagName === 'IFRAME') {
              try {
                const subDoc = node.contentDocument;
                if (subDoc && subDoc.documentElement) {
                  observeRoot(subDoc.documentElement);
                  walkSubtree(subDoc.documentElement);
                }
              } catch {}
            }
          }
        }
      } catch {}
    }

    function scheduleFlush() {
      if (flushTimer !== null) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        const batch = Array.from(pendingNodes);
        pendingNodes = new Set();
        for (let i = 0; i < batch.length; i++) {
          const node = batch[i];
          if (!node || !node.isConnected) continue;
          walkSubtree(node);
        }
      }, 30);
    }

    function fullScan() {
      const root = document.documentElement || document.body;
      if (!root) return;
      observeRoot(root);
      walkSubtree(root);
    }

    function restartSweep() {
      if (sweepTimer) {
        clearInterval(sweepTimer);
        sweepTimer = null;
      }
      if (state.enabled && state.sweepIntervalMs >= 500) {
        sweepTimer = setInterval(() => {
          if (state.enabled && !document.hidden) {
            fullScan();
          }
        }, state.sweepIntervalMs);
      }
    }

    function collectFromRoot(root, found) {
      if (!root) return;

      function addCandidate(raw, hint) {
        if (typeof raw !== 'string') return;
        const text = normalizeText(raw);
        if (!text || text.length > 160) return;
        if (looksLikeNonUiText(text, 160)) return;
        if (/[\\u4e00-\\u9fff]/.test(text)) return;
        if (lookupDirect(text, state.dict, state.lowerDict)) return;
        const existing = found.get(text);
        if (existing) {
          existing.count += 1;
        } else {
          found.set(text, { text, hint, count: 1 });
        }
      }

      const doc = root.ownerDocument || document;
      const walker = doc.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        null
      );
      let node;
      while ((node = walker.nextNode())) {
        if (node.nodeType === 3) {
          const parent = node.parentElement;
          if (!parent || shouldSkipElement(parent)) continue;
          if (textRecords.has(node)) continue;
          try {
            const style = (parent.ownerDocument.defaultView || window).getComputedStyle(parent);
            if (style.display === 'none' || style.visibility === 'hidden') continue;
          } catch {}
          const hint = parent.getAttribute('role') || parent.tagName.toLowerCase();
          addCandidate(node.nodeValue, hint);
        } else if (node.nodeType === 1) {
          if (!shouldSkipAttrElement(node)) {
            for (let i = 0; i < SAFE_ATTRS.length; i++) {
              const attr = SAFE_ATTRS[i];
              if (node.hasAttribute(attr)) {
                addCandidate(node.getAttribute(attr), attr);
              }
            }
          }
          if (node.shadowRoot) {
            collectFromRoot(node.shadowRoot, found);
          }
          if (node.tagName === 'IFRAME') {
            try {
              if (node.contentDocument && node.contentDocument.body) {
                collectFromRoot(node.contentDocument.body, found);
              }
            } catch {}
          }
        }
      }
    }

    function collectUntranslated() {
      const found = new Map();
      try {
        collectFromRoot(document.body || document.documentElement, found);
      } catch {}
      return Array.from(found.values())
        .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
        .slice(0, 300);
    }

    function countTrackedInRoot(root, acc) {
      if (!root) return;
      const doc = root.ownerDocument || document;
      const walker = doc.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        null
      );
      let node;
      while ((node = walker.nextNode())) {
        if (node.nodeType === 3 && textRecords.has(node)) acc.texts++;
        else if (node.nodeType === 1) {
          if (attrRecords.has(node)) acc.attrs += attrRecords.get(node).size;
          if (node.shadowRoot) countTrackedInRoot(node.shadowRoot, acc);
          if (node.tagName === 'IFRAME') {
            try {
              if (node.contentDocument && node.contentDocument.body) {
                countTrackedInRoot(node.contentDocument.body, acc);
              }
            } catch {}
          }
        }
      }
    }

    function countTracked() {
      const acc = { texts: 0, attrs: 0 };
      try {
        countTrackedInRoot(document.documentElement || document.body, acc);
      } catch {}
      return acc;
    }

    window.__AG_ZH__ = {
      version: '1.1.0',
      update(nextPayload) {
        if (typeof nextPayload.enabled === 'boolean') {
          state.enabled = nextPayload.enabled;
        }
        if (nextPayload.entries) {
          state.dict = nextPayload.entries;
          state.lowerDict = buildLowerDict(nextPayload.entries);
        }
        if (nextPayload.patterns) {
          state.patterns = compilePatterns(nextPayload.patterns);
        }
        if (Array.isArray(nextPayload.ignoreSelectors)) {
          state.ignoreSelectors = nextPayload.ignoreSelectors;
        }
        if (nextPayload.maxTextLength) {
          state.maxTextLength = Number(nextPayload.maxTextLength) || 400;
        }
        if (nextPayload.sweepIntervalMs) {
          state.sweepIntervalMs = Number(nextPayload.sweepIntervalMs) || 2000;
        }
        fullScan();
        restartSweep();
        return this.getStats();
      },
      setEnabled(flag) {
        state.enabled = Boolean(flag);
        fullScan();
        restartSweep();
        return this.getStats();
      },
      collectUntranslated,
      getStats() {
        const tracked = countTracked();
        return {
          enabled: state.enabled,
          translatedTexts: tracked.texts,
          translatedAttrs: tracked.attrs,
          dictSize: Object.keys(state.dict).length,
          patternCount: state.patterns.length,
          title: document.title || ''
        };
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        fullScan();
        restartSweep();
      }, { once: true });
    } else {
      fullScan();
      restartSweep();
    }

    return window.__AG_ZH__.getStats();
  } catch (err) {
    return { error: String(err && err.message ? err.message : err) };
  }
})();`;
}
