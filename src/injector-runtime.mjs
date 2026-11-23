/**
 * Antigravity 2.0 高性能无损翻译内核 v2.0.0
 * （同时用于 Node 单元测试与 CDP 注入到 Antigravity 2.0 Electron 渲染层）
 *
 * 核心特性：
 * 1. React / Virtual DOM 绝对安全：仅修改 Text.nodeValue 与安全 UI 属性，不破坏节点树。
 * 2. 极致性能：LRU 翻译缓存（10,000 条）+ 已译文 O(1) 短路 Set + WeakMap 未命中缓存。
 * 3. 高精准覆盖：空白规范化 + 精确匹配 + 高碰撞短词保护的忽略大小写回退 + 快捷键保留匹配 + 末尾标签/标点保留 + 锚定正则模板。
 * 4. 精准防误伤：Antigravity 2.0 专属 DOM 隔离（Lexical 编辑器、用户消息、AI 正文/思考区、侧栏会话标题、项目卡片、代码查看器、焦点输入框）。
 * 5. 全域动态覆盖：documentElement + 同源 iframe + attachShadow 劫持 + class/data-testid 延迟挂载重扫。
 * 6. 无损可逆 & 悬浮球：记录每个节点原文，支持一键切回英文、保留技术档位英文、界面内可拖拽「中 / EN」悬浮切换按钮。
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

const SHORTCUT_SUFFIX_RE = /^(.+?)\s*(\((?:(?:Ctrl|Cmd|Alt|Shift|Opt|Option|Meta|⌘|⌃|⌥|⇧)\s*[+\-]?\s*)+[A-Za-z0-9,./;[\]\\`\-=←→↑↓↩↵⌫⎋Space]+\))$/;

export const LOWER_WORDS_EXCLUDE = new Set([
  'on', 'in', 'to', 'at', 'by', 'for', 'with', 'as', 'and', 'or', 'of', 'is', 'no', 'yes', 'off',
  'all', 'new', 'add', 'edit', 'open', 'view', 'run', 'set', 'get', 'end', 'top',
  'system', 'review', 'active', 'browser', 'global', 'including', 'file', 'files',
  'help', 'app', 'plan', 'search', 'coordinator', 'default', 'auto', 'name', 'type', 'path', 'size'
]);

export const TECH_ENGLISH_LABELS = new Set([
  'this conversation',
  'request review',
  'default',
  'auto',
  'turbo',
  'high',
  'medium',
  'low'
]);

export function normalizeLookupText(text) {
  return String(text ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function looksLikeNonUiText(text, maxLength = 1200) {
  if (typeof text !== 'string') return true;
  const trimmed = normalizeLookupText(text);
  if (!trimmed || trimmed.length > maxLength) return true;
  if (!/[A-Za-z]{2,}/.test(trimmed)) return true;
  if (/^(https?:\/\/|file:\/\/|mailto:|wss?:\/\/)/i.test(trimmed)) return true;
  if (/^[A-Za-z]:[\\/]/.test(trimmed)) return true;
  if (/^(\/|\.\/|\.\.\/|~\/)[\w.\-/]+/.test(trimmed)) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return true;
  if (/^[\w.-]+\.(js|mjs|cjs|ts|tsx|jsx|json|jsonl|md|py|go|rs|css|html|bat|ps1|vbs|sh|yml|yaml|toml|txt|log|png|jpg|jpeg|svg|gif|webp)$/i.test(trimmed)) {
    return true;
  }
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
    if (LOWER_WORDS_EXCLUDE.has(lk) && norm !== lk) continue;
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
    if (!LOWER_WORDS_EXCLUDE.has(lk) && Object.prototype.hasOwnProperty.call(lowerDict, lk)) {
      return lowerDict[lk];
    }
  }
  return null;
}

export function translateRawString(raw, dict, compiledPatterns, options = {}) {
  // 兼容旧签名 (raw, dict, compiledPatterns, maxLength, lowerDict)
  let maxLength = 1200;
  let lowerDict = null;
  let keepOriginalSet = null;
  let keepEnglishTechLabels = false;

  if (typeof options === 'number') {
    maxLength = options;
    lowerDict = arguments[4] || null;
  } else if (options && typeof options === 'object') {
    maxLength = options.maxLength || 1200;
    lowerDict = options.lowerDict || null;
    keepOriginalSet = options.keepOriginalSet || null;
    keepEnglishTechLabels = Boolean(options.keepEnglishTechLabels);
  }

  if (typeof raw !== 'string' || !raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  const normalized = normalizeLookupText(trimmed);
  if (!normalized) return null;

  const lowerNorm = normalized.toLowerCase();
  if (keepOriginalSet && keepOriginalSet.has(lowerNorm)) return null;
  if (keepEnglishTechLabels && TECH_ENGLISH_LABELS.has(lowerNorm)) return null;

  const effectiveLower = lowerDict || buildLowerDict(dict);

  // 1. 直接精确 / 安全忽略大小写匹配（先尝试 raw 原样以支持前后带空格的片段键，如 ", or "）
  let matched = Object.prototype.hasOwnProperty.call(dict, raw)
    ? dict[raw]
    : lookupDirect(normalized, dict, effectiveLower);

  if (Object.prototype.hasOwnProperty.call(dict, raw) && matched !== raw) {
    return matched;
  }

  // 2. 快捷键后缀保留匹配，如 "New Conversation (Ctrl+N)" -> "新建会话 (Ctrl+N)"
  if (!matched) {
    const scMatch = normalized.match(SHORTCUT_SUFFIX_RE);
    if (scMatch) {
      const actionBase = scMatch[1].trim();
      const chord = scMatch[2];
      const baseHit = lookupDirect(actionBase, dict, effectiveLower);
      if (baseHit) {
        matched = `${baseHit} ${chord}`;
      }
    }
  }

  // 3. 末尾括号标签匹配，如 "Model (optional)" / "Feature (Beta)"
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

  // 4. 末尾标点保留匹配，如 "Settings:" -> "设置：" / "Loading…" -> "加载中…"
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

  // 5. 锚定正则模板匹配（动态计数、时间、配额、欢迎语、报错等）
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
 * 构建注入到 Antigravity 2.0 Electron 渲染进程的完整运行时脚本（v2.0.0）。
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
    const SAFE_ATTRS = ['placeholder', 'title', 'aria-label', 'data-tooltip', 'alt'];
    const IDENTITY_ATTRS = new Set(['class', 'id', 'role', 'data-testid']);
    const OBSERVED_ATTRS = [...SAFE_ATTRS, 'class', 'id', 'role', 'data-testid'];

    const LOWER_WORDS_EXCLUDE = new Set(${JSON.stringify(Array.from(LOWER_WORDS_EXCLUDE))});
    const TECH_ENGLISH_LABELS = new Set(${JSON.stringify(Array.from(TECH_ENGLISH_LABELS))});
    const SHORTCUT_SUFFIX_RE = /^(.+?)\\s*(\\((?:(?:Ctrl|Cmd|Alt|Shift|Opt|Option|Meta|⌘|⌃|⌥|⇧)\\s*[+\\-]?\\s*)+[A-Za-z0-9,./;[\\]\\\\\`\\-=←→↑↓↩↵⌫⎋Space]+\\))$/;

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

    const LANG_PREF_KEY = 'agZhCnPrefEnabled';
    const TECH_PREF_KEY = 'agZhCnPrefKeepTechEn';
    const POS_PREF_KEY = 'agZhCnTogglePos';

    function loadPref(key) {
      try { return window.localStorage ? window.localStorage.getItem(key) : null; } catch { return null; }
    }
    function savePref(key, val) {
      try { if (window.localStorage) window.localStorage.setItem(key, val); } catch {}
    }

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
      if (/^[\\w.-]+\\.(js|mjs|cjs|ts|tsx|jsx|json|jsonl|md|py|go|rs|css|html|bat|ps1|vbs|sh|yml|yaml|toml|txt|log|png|jpg|jpeg|svg|gif|webp)$/i.test(trimmed)) {
        return true;
      }
      if (/[{};]{2,}|=>|\\b(const|let|var|function|import|export|return|SELECT|FROM)\\b/.test(trimmed)) {
        return true;
      }
      return false;
    }

    function buildDictIndexes(dict) {
      const lower = Object.create(null);
      const translatedVals = new Set();
      for (const k in dict) {
        if (!Object.prototype.hasOwnProperty.call(dict, k)) continue;
        const val = dict[k];
        translatedVals.add(val);
        const norm = normalizeText(k);
        if (!norm) continue;
        const lk = norm.toLowerCase();
        if (LOWER_WORDS_EXCLUDE.has(lk) && norm !== lk) continue;
        if (!Object.prototype.hasOwnProperty.call(lower, lk)) {
          lower[lk] = val;
        }
      }
      return { lower, translatedVals };
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

    if (window.__AG_ZH__ && typeof window.__AG_ZH__.update === 'function') {
      window.__AG_ZH__.update(PAYLOAD);
      return window.__AG_ZH__.getStats();
    }

    // WeakMap 挂载在 window 上，跨热更新保留所有原文记录
    const textRecords = window.__AG_ZH_TEXT_RECORDS__ || (window.__AG_ZH_TEXT_RECORDS__ = new WeakMap());
    const attrRecords = window.__AG_ZH_ATTR_RECORDS__ || (window.__AG_ZH_ATTR_RECORDS__ = new WeakMap());
    let unchangedTextCache = new WeakMap();
    const observedRoots = new WeakSet();
    const translationCache = new Map();
    const MAX_CACHE_SIZE = 10000;

    const initialIdx = buildDictIndexes(PAYLOAD.entries || {});
    const savedEnabled = loadPref(LANG_PREF_KEY);
    const savedTech = loadPref(TECH_PREF_KEY);

    const state = {
      enabled: savedEnabled !== null ? savedEnabled === '1' : Boolean(PAYLOAD.enabled),
      keepEnglishTechLabels: savedTech !== null ? savedTech === '1' : Boolean(PAYLOAD.keepEnglishTechLabels),
      showFloatingToggle: PAYLOAD.showFloatingToggle !== false,
      dict: PAYLOAD.entries || {},
      lowerDict: initialIdx.lower,
      translatedVals: initialIdx.translatedVals,
      patterns: compilePatterns(PAYLOAD.patterns),
      keepOriginalSet: new Set((PAYLOAD.keepOriginal || []).map((s) => normalizeText(s).toLowerCase())),
      ignoreSelectors: Array.isArray(PAYLOAD.ignoreSelectors) ? PAYLOAD.ignoreSelectors : [],
      ignoreSelectorJoined: Array.isArray(PAYLOAD.ignoreSelectors) ? PAYLOAD.ignoreSelectors.join(',') : '',
      maxTextLength: Number(PAYLOAD.maxTextLength) || 1200,
      sweepIntervalMs: Number(PAYLOAD.sweepIntervalMs) || 8000
    };

    let pendingNodes = new Set();
    let flushTimer = null;
    let sweepTimer = null;
    let floatingPillEl = null;

    function clearCaches() {
      translationCache.clear();
      unchangedTextCache = new WeakMap();
    }

    function cacheSet(key, val) {
      if (translationCache.size >= MAX_CACHE_SIZE) {
        const it = translationCache.keys();
        for (let i = 0; i < 1000; i++) {
          const oldKey = it.next().value;
          if (oldKey === undefined) break;
          translationCache.delete(oldKey);
        }
      }
      translationCache.set(key, val);
      return val;
    }

    function lookupDirect(text) {
      if (Object.prototype.hasOwnProperty.call(state.dict, text)) return state.dict[text];
      if (text.length >= 2) {
        const lk = text.toLowerCase();
        if (!LOWER_WORDS_EXCLUDE.has(lk) && Object.prototype.hasOwnProperty.call(state.lowerDict, lk)) {
          return state.lowerDict[lk];
        }
      }
      return null;
    }

    function translateRaw(raw) {
      if (typeof raw !== 'string' || !raw) return null;
      if (raw.length > state.maxTextLength + 40) return null;

      if (translationCache.has(raw)) {
        return translationCache.get(raw);
      }

      const trimmed = raw.trim();
      if (!trimmed || trimmed.length > state.maxTextLength) {
        return cacheSet(raw, null);
      }

      // 快速 O(1) 短路：已翻译文本或不含英文字母
      if (state.translatedVals.has(trimmed) || !/[A-Za-z]/.test(trimmed)) {
        return cacheSet(raw, null);
      }

      const normalized = normalizeText(trimmed);
      if (!normalized) return cacheSet(raw, null);

      const lowerNorm = normalized.toLowerCase();
      if (state.keepOriginalSet.has(lowerNorm)) return cacheSet(raw, null);
      if (state.keepEnglishTechLabels && TECH_ENGLISH_LABELS.has(lowerNorm)) {
        return cacheSet(raw, null);
      }

      if (Object.prototype.hasOwnProperty.call(state.dict, raw)) {
        const exactRaw = state.dict[raw];
        return cacheSet(raw, exactRaw !== raw ? exactRaw : null);
      }

      let matched = lookupDirect(normalized);

      if (!matched) {
        const scMatch = normalized.match(SHORTCUT_SUFFIX_RE);
        if (scMatch) {
          const baseHit = lookupDirect(scMatch[1].trim());
          if (baseHit) matched = baseHit + ' ' + scMatch[2];
        }
      }

      if (!matched) {
        for (let i = 0; i < TRAILING_TAG_MAP.length; i++) {
          const [regex, zhTag] = TRAILING_TAG_MAP[i];
          if (regex.test(normalized)) {
            const base = normalized.replace(regex, '').trim();
            const baseHit = lookupDirect(base);
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
            const baseHit = lookupDirect(base);
            if (baseHit) {
              matched = baseHit + zhPunct;
              break;
            }
          }
        }
      }

      if (!matched && !looksLikeNonUiText(normalized, state.maxTextLength)) {
        for (let i = 0; i < state.patterns.length; i++) {
          const rule = state.patterns[i];
          if (rule.regex.test(normalized)) {
            matched = normalized.replace(rule.regex, rule.replace);
            break;
          }
        }
      }

      if (!matched || matched === normalized) {
        return cacheSet(raw, null);
      }

      const idx = raw.indexOf(trimmed);
      const result = idx < 0 ? matched : raw.slice(0, idx) + matched + raw.slice(idx + trimmed.length);
      return cacheSet(raw, result);
    }

    function matchesIgnoreSelector(el) {
      if (!state.ignoreSelectorJoined) return false;
      try {
        if (typeof el.closest === 'function' && el.closest(state.ignoreSelectorJoined)) {
          return true;
        }
      } catch {
        for (let i = 0; i < state.ignoreSelectors.length; i++) {
          try {
            if (typeof el.closest === 'function' && el.closest(state.ignoreSelectors[i])) return true;
          } catch {}
        }
      }
      return false;
    }

    function shouldSkipElement(el, forAttr) {
      if (!el || el.nodeType !== 1) return false;
      if (!forAttr && SKIP_TAGS.has(el.tagName)) return true;

      // 焦点输入保护：正在输入的 Lexical / 输入框 / contenteditable 绝不触碰正文
      if (!forAttr) {
        try {
          const active = document.activeElement;
          if (
            active &&
            (active.isContentEditable ||
              active.tagName === 'INPUT' ||
              active.tagName === 'TEXTAREA' ||
              active.getAttribute?.('data-lexical-editor') === 'true') &&
            (active === el || active.contains(el))
          ) {
            return true;
          }
        } catch {}
      }

      let cur = forAttr ? el.parentElement : el;
      while (cur && cur.nodeType === 1) {
        if (!forAttr && (SKIP_TAGS.has(cur.tagName) || cur.isContentEditable)) return true;
        if (matchesIgnoreSelector(cur)) return true;
        const root = typeof cur.getRootNode === 'function' ? cur.getRootNode() : null;
        cur = root && root.host ? root.host : null;
      }
      return false;
    }

    function processTextNode(node) {
      try {
        if (!node || node.nodeType !== 3) return;
        const current = node.nodeValue || '';
        if (!current) return;

        const record = textRecords.get(node);
        if (!state.enabled) {
          if (record && current === record.translated) {
            node.nodeValue = record.raw;
          }
          return;
        }

        if (unchangedTextCache.get(node) === current) return;

        const parent = node.parentElement;
        if (!parent || shouldSkipElement(parent, false)) return;

        const raw = record && current === record.translated ? record.raw : current;
        const translated = translateRaw(raw);
        if (translated) {
          textRecords.set(node, { raw, translated });
          unchangedTextCache.delete(node);
          if (node.nodeValue !== translated) {
            node.nodeValue = translated;
          }
        } else {
          if (record && current === record.translated) {
            node.nodeValue = record.raw;
            textRecords.delete(node);
          }
          unchangedTextCache.set(node, node.nodeValue || '');
        }
      } catch {}
    }

    function processElementAttrs(el) {
      try {
        if (!el || el.nodeType !== 1) return;
        if (el.hasAttribute('data-ag-zh-ignore')) return;
        if (shouldSkipElement(el, true)) return;

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
          const translated = translateRaw(raw);
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
              if (m.type === 'characterData') {
                unchangedTextCache.delete(m.target);
                pendingNodes.add(m.target);
              } else if (m.type === 'attributes') {
                pendingNodes.add(m.target);
                if (IDENTITY_ATTRS.has(m.attributeName)) {
                  // 容器身份/类名异步补齐时重扫其子树
                  pendingNodes.add(m.target);
                }
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
          attributeFilter: OBSERVED_ATTRS
        });
      } catch {}
    }

    // Hook Element.prototype.attachShadow 以捕获后续动态挂载的 Shadow DOM
    try {
      const origAttachShadow = Element.prototype.attachShadow;
      if (typeof origAttachShadow === 'function' && !origAttachShadow.__agZhHooked) {
        const hooked = function (...args) {
          const sr = origAttachShadow.apply(this, args);
          try {
            if (sr) {
              observeRoot(sr);
              pendingNodes.add(sr);
              scheduleFlush();
            }
          } catch {}
          return sr;
        };
        hooked.__agZhHooked = true;
        Element.prototype.attachShadow = hooked;
      }
    } catch {}

    function walkSubtree(root) {
      try {
        if (!root) return;
        if (root.nodeType === 3) {
          processTextNode(root);
          return;
        }
        if (root.nodeType === 1) {
          if (root.hasAttribute('data-ag-zh-ignore')) return;
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
            if (node.hasAttribute('data-ag-zh-ignore')) continue;
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
          if (!node) continue;
          if (node.nodeType !== 11 && !node.isConnected) continue;
          walkSubtree(node);
        }
      }, 60);
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
      if (state.enabled && state.sweepIntervalMs >= 1000) {
        sweepTimer = setInterval(() => {
          if (state.enabled && !document.hidden) {
            fullScan();
          }
        }, state.sweepIntervalMs);
      }
    }

    function updateFloatingPillVisual() {
      if (!floatingPillEl) return;
      const label = state.enabled ? '中' : 'EN';
      const techTip = state.keepEnglishTechLabels ? '（技术档位保持英文）' : '';
      floatingPillEl.textContent = label;
      floatingPillEl.title =
        'Antigravity 2.0 无损汉化' + techTip + '\\n左键点击：切换 中 / EN\\n右键点击：切换“技术档位保留英文”\\n按住拖拽可移动位置';
      floatingPillEl.style.background = state.enabled
        ? 'rgba(59, 130, 246, 0.88)'
        : 'rgba(55, 65, 81, 0.85)';
    }

    function syncFloatingPill() {
      try {
        if (window !== window.top) return;
        if (!state.showFloatingToggle) {
          if (floatingPillEl && floatingPillEl.parentNode) {
            floatingPillEl.parentNode.removeChild(floatingPillEl);
          }
          floatingPillEl = null;
          return;
        }
        if (!document.body) return;
        if (floatingPillEl && floatingPillEl.isConnected) {
          updateFloatingPillVisual();
          return;
        }

        const pill = document.createElement('button');
        pill.type = 'button';
        pill.setAttribute('data-ag-zh-ignore', 'true');
        pill.id = 'ag-zh-floating-toggle';
        Object.assign(pill.style, {
          position: 'fixed',
          right: '14px',
          bottom: '14px',
          zIndex: '2147483640',
          width: '30px',
          height: '30px',
          borderRadius: '999px',
          border: '1px solid rgba(255,255,255,0.25)',
          color: '#ffffff',
          fontSize: '12px',
          fontWeight: '700',
          fontFamily: '"Segoe UI", "Microsoft YaHei", sans-serif',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.32)',
          backdropFilter: 'blur(6px)',
          opacity: '0.72',
          transition: 'opacity 0.15s ease, transform 0.15s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0',
          userSelect: 'none'
        });

        try {
          const savedPos = JSON.parse(loadPref(POS_PREF_KEY) || 'null');
          if (savedPos && typeof savedPos.x === 'number' && typeof savedPos.y === 'number') {
            pill.style.left = Math.max(8, Math.min(window.innerWidth - 38, savedPos.x)) + 'px';
            pill.style.top = Math.max(8, Math.min(window.innerHeight - 38, savedPos.y)) + 'px';
            pill.style.right = 'auto';
            pill.style.bottom = 'auto';
          }
        } catch {}

        pill.addEventListener('mouseenter', () => { pill.style.opacity = '1'; });
        pill.addEventListener('mouseleave', () => { pill.style.opacity = '0.72'; });

        let dragging = false;
        let moved = false;
        let startX = 0;
        let startY = 0;
        let origLeft = 0;
        let origTop = 0;

        pill.addEventListener('mousedown', (e) => {
          if (e.button !== 0) return;
          dragging = true;
          moved = false;
          startX = e.clientX;
          startY = e.clientY;
          const rect = pill.getBoundingClientRect();
          origLeft = rect.left;
          origTop = rect.top;
        });

        window.addEventListener('mousemove', (e) => {
          if (!dragging) return;
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
          if (!moved) return;
          const nx = Math.max(8, Math.min(window.innerWidth - 38, origLeft + dx));
          const ny = Math.max(8, Math.min(window.innerHeight - 38, origTop + dy));
          pill.style.left = nx + 'px';
          pill.style.top = ny + 'px';
          pill.style.right = 'auto';
          pill.style.bottom = 'auto';
        });

        window.addEventListener('mouseup', () => {
          if (!dragging) return;
          dragging = false;
          if (moved) {
            const rect = pill.getBoundingClientRect();
            savePref(POS_PREF_KEY, JSON.stringify({ x: Math.round(rect.left), y: Math.round(rect.top) }));
          }
        });

        pill.addEventListener('click', (e) => {
          if (moved) {
            e.preventDefault();
            return;
          }
          window.__AG_ZH__.setEnabled(!state.enabled);
        });

        pill.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          window.__AG_ZH__.setOptions({ keepEnglishTechLabels: !state.keepEnglishTechLabels });
        });

        document.body.appendChild(pill);
        floatingPillEl = pill;
        updateFloatingPillVisual();
      } catch {}
    }

    function collectFromRoot(root, found) {
      if (!root) return;

      function addCandidate(raw, hint) {
        if (typeof raw !== 'string') return;
        const text = normalizeText(raw);
        if (!text || text.length > 200) return;
        if (looksLikeNonUiText(text, 200)) return;
        if (/[\\u4e00-\\u9fff]/.test(text)) return;
        if (lookupDirect(text)) return;
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
          if (!parent || shouldSkipElement(parent, false)) continue;
          if (textRecords.has(node)) continue;
          try {
            const style = (parent.ownerDocument.defaultView || window).getComputedStyle(parent);
            if (style.display === 'none' || style.visibility === 'hidden') continue;
          } catch {}
          const hint = parent.getAttribute('role') || parent.tagName.toLowerCase();
          addCandidate(node.nodeValue, hint);
        } else if (node.nodeType === 1) {
          if (node.hasAttribute('data-ag-zh-ignore')) continue;
          if (!shouldSkipElement(node, true)) {
            for (let i = 0; i < SAFE_ATTRS.length; i++) {
              const attr = SAFE_ATTRS[i];
              if (node.hasAttribute(attr)) {
                addCandidate(node.getAttribute(attr), attr);
              }
            }
          }
          if (node.shadowRoot) collectFromRoot(node.shadowRoot, found);
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
      version: '2.0.0',
      update(nextPayload) {
        if (typeof nextPayload.enabled === 'boolean') {
          state.enabled = nextPayload.enabled;
          savePref(LANG_PREF_KEY, state.enabled ? '1' : '0');
        }
        if (typeof nextPayload.keepEnglishTechLabels === 'boolean') {
          state.keepEnglishTechLabels = nextPayload.keepEnglishTechLabels;
          savePref(TECH_PREF_KEY, state.keepEnglishTechLabels ? '1' : '0');
        }
        if (typeof nextPayload.showFloatingToggle === 'boolean') {
          state.showFloatingToggle = nextPayload.showFloatingToggle;
        }
        if (nextPayload.entries) {
          state.dict = nextPayload.entries;
          const idx = buildDictIndexes(nextPayload.entries);
          state.lowerDict = idx.lower;
          state.translatedVals = idx.translatedVals;
        }
        if (nextPayload.patterns) {
          state.patterns = compilePatterns(nextPayload.patterns);
        }
        if (Array.isArray(nextPayload.keepOriginal)) {
          state.keepOriginalSet = new Set(nextPayload.keepOriginal.map((s) => normalizeText(s).toLowerCase()));
        }
        if (Array.isArray(nextPayload.ignoreSelectors)) {
          state.ignoreSelectors = nextPayload.ignoreSelectors;
          state.ignoreSelectorJoined = nextPayload.ignoreSelectors.join(',');
        }
        if (nextPayload.maxTextLength) {
          state.maxTextLength = Number(nextPayload.maxTextLength) || 1200;
        }
        if (nextPayload.sweepIntervalMs) {
          state.sweepIntervalMs = Number(nextPayload.sweepIntervalMs) || 8000;
        }
        clearCaches();
        fullScan();
        syncFloatingPill();
        restartSweep();
        return this.getStats();
      },
      setEnabled(flag) {
        state.enabled = Boolean(flag);
        savePref(LANG_PREF_KEY, state.enabled ? '1' : '0');
        clearCaches();
        fullScan();
        syncFloatingPill();
        restartSweep();
        return this.getStats();
      },
      setOptions(opts = {}) {
        if (typeof opts.keepEnglishTechLabels === 'boolean') {
          state.keepEnglishTechLabels = opts.keepEnglishTechLabels;
          savePref(TECH_PREF_KEY, state.keepEnglishTechLabels ? '1' : '0');
        }
        if (typeof opts.showFloatingToggle === 'boolean') {
          state.showFloatingToggle = opts.showFloatingToggle;
        }
        clearCaches();
        fullScan();
        syncFloatingPill();
        return this.getStats();
      },
      collectUntranslated,
      getStats() {
        const tracked = countTracked();
        return {
          version: '2.0.0',
          enabled: state.enabled,
          keepEnglishTechLabels: state.keepEnglishTechLabels,
          showFloatingToggle: state.showFloatingToggle,
          translatedTexts: tracked.texts,
          translatedAttrs: tracked.attrs,
          dictSize: Object.keys(state.dict).length,
          patternCount: state.patterns.length,
          title: document.title || ''
        };
      }
    };

    const boot = () => {
      fullScan();
      syncFloatingPill();
      restartSweep();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }
    window.addEventListener('load', boot, { once: true });
    for (const delay of [200, 800, 2500]) {
      setTimeout(boot, delay);
    }

    return window.__AG_ZH__.getStats();
  } catch (err) {
    return { error: String(err && err.message ? err.message : err) };
  }
})();`;
}
