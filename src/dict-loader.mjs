import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT } from './config.mjs';

export const DEFAULT_DICT_DIR = path.join(PROJECT_ROOT, 'dict');

const LOCAL_LOAD_ORDER = [
  'common.json',
  'sidebar.json',
  'chat.json',
  'settings.json',
  'customizations.json',
  'swarm.json'
];

const UPSTREAM_LOAD_ORDER = [
  'zh-CN.json',
  'swarm.json',
  'official-plugin-descriptions.json'
];

function extractEntriesAndPatterns(parsed) {
  const entries = {};
  const patterns = [];

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { entries, patterns };
  }

  // 支持三种标准词库结构：
  // 1) { entries: { k: v } }
  // 2) { exact: { k: v }, patterns: [{ regex, replacement }], rules: [...] }
  // 3) { k: { translation: v } }（如 official-plugin-descriptions.json）
  const rawMap =
    parsed.exact && typeof parsed.exact === 'object'
      ? parsed.exact
      : parsed.entries && typeof parsed.entries === 'object'
        ? parsed.entries
        : parsed;

  for (const [k, rawVal] of Object.entries(rawMap)) {
    if (k === '_meta' || k === 'scope' || k === 'selectors' || k === 'attributeSelectors' || k === 'patterns' || k === 'rules') {
      continue;
    }
    const key = k.trim();
    // 跳过单个标点符号键（如 "."），避免污染全局 UI
    if (!key || (key.length === 1 && !/[A-Za-z0-9]/.test(key))) continue;

    let val = null;
    if (typeof rawVal === 'string') {
      val = rawVal.trim();
    } else if (rawVal && typeof rawVal === 'object' && typeof rawVal.translation === 'string') {
      val = rawVal.translation.trim();
    }
    if (val) {
      entries[key] = val;
    }
  }

  const rawPatterns = [
    ...(Array.isArray(parsed.patterns) ? parsed.patterns : []),
    ...(Array.isArray(parsed.rules) ? parsed.rules : [])
  ];

  for (const item of rawPatterns) {
    if (!item || typeof item !== 'object') continue;
    const pat = typeof item.regex === 'string' ? item.regex : item.pattern;
    const rep = typeof item.replacement === 'string' ? item.replacement : item.replace;
    if (typeof pat !== 'string' || typeof rep !== 'string' || !pat) continue;
    // 预先校验正则合法性
    new RegExp(pat, item.flags || '');
    patterns.push({
      pattern: pat,
      flags: item.flags || '',
      replace: rep
    });
  }

  return { entries, patterns };
}

export function loadDictionaries(dictDir = DEFAULT_DICT_DIR) {
  if (!fs.existsSync(dictDir)) {
    throw new Error(`词库目录不存在: ${dictDir}`);
  }

  const allRootFiles = fs
    .readdirSync(dictDir)
    .filter((f) => f.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));

  const localBaseFiles = [
    ...LOCAL_LOAD_ORDER.filter((f) => allRootFiles.includes(f)),
    ...allRootFiles.filter(
      (f) => !LOCAL_LOAD_ORDER.includes(f) && f !== 'patterns.json' && f !== 'user-custom.json'
    )
  ];

  const entries = {};
  const swarmEntries = {};
  const zhCnCoreKeys = new Set();
  const sources = {};
  const modules = [];
  const patterns = [];
  const seenPatternKeys = new Set();

  function addPatternList(list) {
    for (const p of list) {
      const sig = `${p.pattern}::${p.flags || ''}`;
      if (seenPatternKeys.has(sig)) continue;
      seenPatternKeys.add(sig);
      patterns.push(p);
    }
  }

  // 第 1 层：本地基础补充词库（兜底）
  for (const file of localBaseFiles) {
    const fullPath = path.join(dictDir, file);
    const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const extracted = extractEntriesAndPatterns(parsed);
    let count = 0;
    for (const [k, v] of Object.entries(extracted.entries)) {
      entries[k] = v;
      sources[k] = file;
      if (file === 'swarm.json') {
        swarmEntries[k] = v;
      }
      count++;
    }
    modules.push({
      file,
      layer: 'local-base',
      module: parsed._meta?.module || file.replace(/\.json$/, ''),
      description: parsed._meta?.description || '',
      count
    });
  }

  // 第 2 层：上游 MIT 社区校对词库（dict/upstream/，覆盖本地推测词条，确保准确度与全量覆盖）
  const upstreamDir = path.join(dictDir, 'upstream');
  let upstreamMeta = null;
  let upstreamEntryCount = 0;
  let upstreamPatternCount = 0;

  if (fs.existsSync(upstreamDir)) {
    const metaPath = path.join(upstreamDir, '_meta.json');
    if (fs.existsSync(metaPath)) {
      try {
        upstreamMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      } catch {}
    }

    const upstreamFiles = fs
      .readdirSync(upstreamDir)
      .filter((f) => f.endsWith('.json') && f !== '_meta.json')
      .sort((a, b) => a.localeCompare(b));

    const orderedUpstream = [
      ...UPSTREAM_LOAD_ORDER.filter((f) => upstreamFiles.includes(f)),
      ...upstreamFiles.filter((f) => !UPSTREAM_LOAD_ORDER.includes(f))
    ];

    for (const file of orderedUpstream) {
      const fullPath = path.join(upstreamDir, file);
      const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      const extracted = extractEntriesAndPatterns(parsed);
      const isSwarmScoped = file === 'swarm.json' || parsed.scope?.includes('swarm');
      let count = 0;
      for (const [k, v] of Object.entries(extracted.entries)) {
        if (isSwarmScoped) {
          swarmEntries[k] = v;
          // 仅当全局核心词库 zh-CN.json 未定义该短词时才同步进全局词库，防止 Swarm 专属词（如 Next->下一帧, New->新消息）污染全局 UI
          if (!zhCnCoreKeys.has(k)) {
            entries[k] = v;
            sources[k] = `upstream/${file}`;
          }
        } else {
          entries[k] = v;
          sources[k] = `upstream/${file}`;
          if (file === 'zh-CN.json') {
            zhCnCoreKeys.add(k);
          }
        }
        count++;
      }
      upstreamEntryCount += count;
      upstreamPatternCount += extracted.patterns.length;
      addPatternList(extracted.patterns);
      modules.push({
        file: `upstream/${file}`,
        layer: 'upstream-mit',
        module: `upstream:${file.replace(/\.json$/, '')}`,
        description: '上游 MIT 社区校对词库 (yiheng8023/antigravity-chinese)',
        count
      });
    }
  }

  // 本地正则模板（补充在上游正则之后）
  const patternsPath = path.join(dictDir, 'patterns.json');
  if (fs.existsSync(patternsPath)) {
    const parsed = JSON.parse(fs.readFileSync(patternsPath, 'utf8'));
    const extracted = extractEntriesAndPatterns(parsed);
    addPatternList(extracted.patterns);
  }

  // 第 3 层（最高优先级）：用户自定义词库 user-custom.json
  // 支持 "English": "中文" 覆盖译文，或 "English": "" 强制保留英文原文
  const keepOriginal = [];
  const customPath = path.join(dictDir, 'user-custom.json');
  if (fs.existsSync(customPath)) {
    const parsed = JSON.parse(fs.readFileSync(customPath, 'utf8'));
    const customEntries = parsed.entries && typeof parsed.entries === 'object' ? parsed.entries : {};
    let count = 0;
    for (const [rawKey, rawVal] of Object.entries(customEntries)) {
      const k = String(rawKey ?? '').trim();
      if (!k) continue;
      const v = String(rawVal ?? '').trim();
      if (!v) {
        delete entries[k];
        delete swarmEntries[k];
        keepOriginal.push(k);
      } else {
        entries[k] = v;
        swarmEntries[k] = v;
        sources[k] = 'user-custom.json';
      }
      count++;
    }
    modules.push({
      file: 'user-custom.json',
      layer: 'user-custom',
      module: 'user-custom',
      description: parsed._meta?.description || '用户自定义词库（最高优先级）',
      count
    });
  }

  return {
    entries,
    swarmEntries,
    patterns,
    keepOriginal,
    sources,
    modules,
    upstreamMeta,
    stats: {
      totalEntries: Object.keys(entries).length,
      swarmEntriesCount: Object.keys(swarmEntries).length,
      totalPatterns: patterns.length,
      keepOriginalCount: keepOriginal.length,
      upstreamEntries: upstreamEntryCount,
      upstreamPatterns: upstreamPatternCount,
      filesLoaded: modules.length + (fs.existsSync(patternsPath) ? 1 : 0)
    }
  };
}

export function loadUserCustomEntries(dictDir = DEFAULT_DICT_DIR) {
  const customPath = path.join(dictDir, 'user-custom.json');
  if (!fs.existsSync(customPath)) {
    return {};
  }
  const parsed = JSON.parse(fs.readFileSync(customPath, 'utf8'));
  return parsed.entries && typeof parsed.entries === 'object' ? { ...parsed.entries } : {};
}

export function saveUserCustomEntries(entries, dictDir = DEFAULT_DICT_DIR) {
  const customPath = path.join(dictDir, 'user-custom.json');
  const sorted = {};
  for (const key of Object.keys(entries).sort((a, b) => a.localeCompare(b))) {
    const k = key.trim();
    if (!k) continue;
    // 允许空字符串 ""，代表显式强制保留英文原文
    sorted[k] = String(entries[key] ?? '').trim();
  }

  const payload = {
    _meta: {
      module: 'user-custom',
      description:
        '用户自定义词库（优先级最高，覆盖默认及上游词库；译文留空 "" 表示强制保留英文原文；修改后自动热更新生效）'
    },
    entries: sorted
  };

  const tempPath = `${customPath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, customPath);
  return sorted;
}

export function upsertUserCustomEntry(sourceText, translatedText, dictDir = DEFAULT_DICT_DIR) {
  const k = String(sourceText ?? '').trim();
  const v = String(translatedText ?? '').trim();
  if (!k) {
    throw new Error('英文原文不能为空');
  }
  const current = loadUserCustomEntries(dictDir);
  current[k] = v;
  return saveUserCustomEntries(current, dictDir);
}

export function deleteUserCustomEntry(sourceText, dictDir = DEFAULT_DICT_DIR) {
  const k = String(sourceText ?? '').trim();
  const current = loadUserCustomEntries(dictDir);
  delete current[k];
  return saveUserCustomEntries(current, dictDir);
}

export function watchDictionaries(dictDir, onReload, debounceMs = 250) {
  let timer = null;
  const watchers = [];

  const trigger = (filename) => {
    if (filename && !filename.endsWith('.json')) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        const bundle = loadDictionaries(dictDir);
        onReload(null, bundle);
      } catch (err) {
        onReload(err, null);
      }
    }, debounceMs);
  };

  watchers.push(fs.watch(dictDir, (_eventType, filename) => trigger(filename)));

  const upstreamDir = path.join(dictDir, 'upstream');
  if (fs.existsSync(upstreamDir)) {
    watchers.push(fs.watch(upstreamDir, (_eventType, filename) => trigger(filename)));
  }

  return () => {
    if (timer) clearTimeout(timer);
    for (const w of watchers) {
      try {
        w.close();
      } catch {}
    }
  };
}
