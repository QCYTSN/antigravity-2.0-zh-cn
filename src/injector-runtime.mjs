/**
 * 纯函数翻译内核（同时用于 Node 单元测试与注入到 Antigravity 2.0 渲染层）。
 * 设计目标：
 * 1. React / Virtual DOM 绝对安全：仅修改 Text.nodeValue 与指定 UI 属性，不破坏节点树。
 * 2. 防误伤保护：跳过代码块、编辑器、终端、输入正文、路径/URL/代码特征字符串。
 * 3. 无损可逆：完整记录原文，支持随时热切换回原版英文。
 */

export function looksLikeNonUiText(text, maxLength = 220) {
  if (typeof text !== 'string') return true;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > maxLength) return true;
  // 必须包含至少 2 个连续英文字母（避免单字母快捷键/符号/纯数字）
  if (!/[A-Za-z]{2,}/.test(trimmed)) return true;
  // 跳过 URL、邮箱、Windows/POSIX 文件路径
  if (/^(https?:\/\/|file:\/\/|mailto:|wss?:\/\/)/i.test(trimmed)) return true;
  if (/^[A-Za-z]:[\\/]/.test(trimmed)) return true;
  if (/^(\/|\.\/|\.\.\/|~\/)[\w.\-/]+/.test(trimmed)) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return true;
  // 跳过明显代码片段
  if (/[{};]{2,}|=>|\b(const|let|var|function|import|export|return|SELECT|FROM)\b/.test(trimmed)) {
    return true;
  }
  return false;
}

export function translateRawString(raw, dict, compiledPatterns, maxLength = 220) {
  if (typeof raw !== 'string' || !raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > maxLength) return null;

  // 1. 精确匹配（O(1)，优先保留原始首尾空白）
  let matched = Object.prototype.hasOwnProperty.call(dict, trimmed) ? dict[trimmed] : null;

  // 2. 正则模板匹配（仅对严格锚定的 UI 动态文本生效）
  if (!matched && !looksLikeNonUiText(trimmed, maxLength)) {
    for (let i = 0; i < compiledPatterns.length; i++) {
      const rule = compiledPatterns[i];
      if (rule.regex.test(trimmed)) {
        matched = trimmed.replace(rule.regex, rule.replace);
        break;
      }
    }
  }

  if (!matched || matched === trimmed) return null;

  const leading = raw.slice(0, raw.indexOf(trimmed));
  const trailing = raw.slice(raw.indexOf(trimmed) + trimmed.length);
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
      // 跳过无效正则，防止单条规则影响整体
    }
  }
  return list;
}

/**
 * 构建注入到 Antigravity 2.0 Electron 渲染进程的完整脚本。
 * 幂等设计：重复注入时自动热更新词库与开关状态，不会产生重复 Observer。
 */
export function buildInjectorScript(payload) {
  const serializedPayload = JSON.stringify(payload);

  return `(() => {
  const PAYLOAD = ${serializedPayload};
  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'KBD', 'SAMP', 'VAR',
    'SVG', 'MATH', 'TEXTAREA', 'INPUT', 'CANVAS', 'IFRAME', 'VIDEO', 'AUDIO'
  ]);
  const SAFE_ATTRS = ['placeholder', 'title', 'aria-label', 'data-tooltip'];
  const UI_COLLECT_SELECTOR = [
    'button', 'a', 'label', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'dt', 'summary',
    '[role="button"]', '[role="menuitem"]', '[role="tab"]', '[role="option"]',
    '[role="switch"]', '[role="checkbox"]', '[role="radio"]', '[role="heading"]',
    'nav span', 'aside span', 'header span'
  ].join(',');

  function looksLikeNonUiText(text, maxLength) {
    if (typeof text !== 'string') return true;
    const trimmed = text.trim();
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

  function compilePatterns(patterns) {
    const out = [];
    for (const p of (patterns || [])) {
      try {
        out.push({ regex: new RegExp(p.pattern, p.flags || ''), replace: p.replace });
      } catch {}
    }
    return out;
  }

  function translateRaw(raw, dict, patterns, maxLength) {
    if (typeof raw !== 'string' || !raw) return null;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length > maxLength) return null;

    let matched = Object.prototype.hasOwnProperty.call(dict, trimmed) ? dict[trimmed] : null;
    if (!matched && !looksLikeNonUiText(trimmed, maxLength)) {
      for (let i = 0; i < patterns.length; i++) {
        const rule = patterns[i];
        if (rule.regex.test(trimmed)) {
          matched = trimmed.replace(rule.regex, rule.replace);
          break;
        }
      }
    }
    if (!matched || matched === trimmed) return null;
    const idx = raw.indexOf(trimmed);
    return raw.slice(0, idx) + matched + raw.slice(idx + trimmed.length);
  }

  if (window.__AG_ZH__ && typeof window.__AG_ZH__.update === 'function') {
    window.__AG_ZH__.update(PAYLOAD);
    return window.__AG_ZH__.getStats();
  }

  const textRecords = new WeakMap();
  const attrRecords = new WeakMap();
  const observedRoots = new WeakSet();
  const observers = [];

  const state = {
    enabled: Boolean(PAYLOAD.enabled),
    dict: PAYLOAD.entries || {},
    patterns: compilePatterns(PAYLOAD.patterns),
    ignoreSelectors: Array.isArray(PAYLOAD.ignoreSelectors) ? PAYLOAD.ignoreSelectors : [],
    maxTextLength: Number(PAYLOAD.maxTextLength) || 220,
    translatedTextCount: 0,
    translatedAttrCount: 0
  };

  let pendingNodes = new Set();
  let flushTimer = null;

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
    // INPUT / TEXTAREA 的 placeholder / title / aria-label 允许翻译，但仍跳过代码编辑器内部
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

    let raw = current;
    if (record) {
      if (current === record.translated) {
        raw = record.raw;
      } else {
        // React 已更新该节点的原文
        raw = current;
      }
    }

    const translated = translateRaw(raw, state.dict, state.patterns, state.maxTextLength);
    if (translated) {
      textRecords.set(node, { raw, translated });
      if (node.nodeValue !== translated) {
        node.nodeValue = translated;
      }
    } else if (record && current === record.translated) {
      // 词条被删除后自动还原原文
      node.nodeValue = record.raw;
      textRecords.delete(node);
    }
  }

  function processElementAttrs(el) {
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
      const translated = translateRaw(raw, state.dict, state.patterns, state.maxTextLength);
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
  }

  function observeRoot(root) {
    if (!root || observedRoots.has(root)) return;
    observedRoots.add(root);

    const observer = new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        if (m.type === 'characterData') {
          pendingNodes.add(m.target);
        } else if (m.type === 'attributes') {
          pendingNodes.add(m.target);
        } else if (m.type === 'childList') {
          for (let j = 0; j < m.addedNodes.length; j++) {
            pendingNodes.add(m.addedNodes[j]);
          }
        }
      }
      scheduleFlush();
    });

    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: SAFE_ATTRS
    });
    observers.push(observer);
  }

  function walkSubtree(root) {
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
    }

    const walker = document.createTreeWalker(
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
      }
    }
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
    if (!document.body) return;
    observeRoot(document.body);
    walkSubtree(document.body);
  }

  function collectUntranslated() {
    const found = new Map();
    const roots = [document.body].filter(Boolean);

    function addCandidate(raw, hint) {
      if (typeof raw !== 'string') return;
      const text = raw.trim();
      if (!text || text.length > 100) return;
      if (looksLikeNonUiText(text, 100)) return;
      // 如果包含中文则说明已汉化或本就是中文
      if (/[\\u4e00-\\u9fff]/.test(text)) return;
      if (Object.prototype.hasOwnProperty.call(state.dict, text)) return;
      const existing = found.get(text);
      if (existing) {
        existing.count += 1;
      } else {
        found.set(text, { text, hint, count: 1 });
      }
    }

    for (const root of roots) {
      const elements = root.querySelectorAll(UI_COLLECT_SELECTOR);
      for (const el of elements) {
        if (shouldSkipElement(el)) continue;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const hint = el.getAttribute('role') || el.tagName.toLowerCase();

        for (const child of el.childNodes) {
          if (child.nodeType === 3) {
            const rec = textRecords.get(child);
            if (!rec) {
              addCandidate(child.nodeValue, hint);
            }
          }
        }
      }

      const attrEls = root.querySelectorAll('[placeholder],[title],[aria-label],[data-tooltip]');
      for (const el of attrEls) {
        if (shouldSkipAttrElement(el)) continue;
        for (const attr of SAFE_ATTRS) {
          const val = el.getAttribute(attr);
          if (val) addCandidate(val, attr);
        }
      }
    }

    return Array.from(found.values())
      .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
      .slice(0, 200);
  }

  function countTracked() {
    let texts = 0;
    let attrs = 0;
    if (!document.body) return { texts, attrs };
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      null
    );
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3 && textRecords.has(node)) texts++;
      else if (node.nodeType === 1 && attrRecords.has(node)) attrs += attrRecords.get(node).size;
    }
    return { texts, attrs };
  }

  window.__AG_ZH__ = {
    version: '1.0.0',
    update(nextPayload) {
      if (typeof nextPayload.enabled === 'boolean') {
        state.enabled = nextPayload.enabled;
      }
      if (nextPayload.entries) {
        state.dict = nextPayload.entries;
      }
      if (nextPayload.patterns) {
        state.patterns = compilePatterns(nextPayload.patterns);
      }
      if (Array.isArray(nextPayload.ignoreSelectors)) {
        state.ignoreSelectors = nextPayload.ignoreSelectors;
      }
      if (nextPayload.maxTextLength) {
        state.maxTextLength = Number(nextPayload.maxTextLength) || 220;
      }
      fullScan();
      return this.getStats();
    },
    setEnabled(flag) {
      state.enabled = Boolean(flag);
      fullScan();
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
    document.addEventListener('DOMContentLoaded', fullScan, { once: true });
  } else {
    fullScan();
  }

  return window.__AG_ZH__.getStats();
})();`;
}
