import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT } from './config.mjs';

export const DEFAULT_DICT_DIR = path.join(PROJECT_ROOT, 'dict');

const LOAD_ORDER = [
  'common.json',
  'sidebar.json',
  'chat.json',
  'settings.json',
  'customizations.json'
];

export function loadDictionaries(dictDir = DEFAULT_DICT_DIR) {
  if (!fs.existsSync(dictDir)) {
    throw new Error(`词库目录不存在: ${dictDir}`);
  }

  const allFiles = fs
    .readdirSync(dictDir)
    .filter((f) => f.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));

  const orderedEntryFiles = [
    ...LOAD_ORDER.filter((f) => allFiles.includes(f)),
    ...allFiles.filter(
      (f) => !LOAD_ORDER.includes(f) && f !== 'patterns.json' && f !== 'user-custom.json'
    ),
    ...(allFiles.includes('user-custom.json') ? ['user-custom.json'] : [])
  ];

  const entries = {};
  const sources = {};
  const modules = [];

  for (const file of orderedEntryFiles) {
    const fullPath = path.join(dictDir, file);
    const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const fileEntries = parsed.entries && typeof parsed.entries === 'object' ? parsed.entries : {};
    let count = 0;

    for (const [k, v] of Object.entries(fileEntries)) {
      if (typeof k !== 'string' || typeof v !== 'string') continue;
      const key = k.trim();
      const val = v.trim();
      if (!key || !val) continue;
      entries[key] = val;
      sources[key] = file;
      count++;
    }

    modules.push({
      file,
      module: parsed._meta?.module || file.replace(/\.json$/, ''),
      description: parsed._meta?.description || '',
      count
    });
  }

  const patterns = [];
  const patternsPath = path.join(dictDir, 'patterns.json');
  if (fs.existsSync(patternsPath)) {
    const parsed = JSON.parse(fs.readFileSync(patternsPath, 'utf8'));
    if (Array.isArray(parsed.patterns)) {
      for (const item of parsed.patterns) {
        if (!item || typeof item.pattern !== 'string' || typeof item.replace !== 'string') {
          continue;
        }
        // Validate regex syntax eagerly
        new RegExp(item.pattern, item.flags || '');
        patterns.push({
          pattern: item.pattern,
          flags: item.flags || '',
          replace: item.replace
        });
      }
    }
  }

  return {
    entries,
    patterns,
    sources,
    modules,
    stats: {
      totalEntries: Object.keys(entries).length,
      totalPatterns: patterns.length,
      filesLoaded: orderedEntryFiles.length + (fs.existsSync(patternsPath) ? 1 : 0)
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
    const v = String(entries[key] ?? '').trim();
    if (k && v) {
      sorted[k] = v;
    }
  }

  const payload = {
    _meta: {
      module: 'user-custom',
      description:
        '用户自定义词库（优先级最高，覆盖默认词库；修改后自动热更新生效，也可通过本地管理面板在线添加）'
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
  if (!k || !v) {
    throw new Error('原文和译文均不能为空');
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
  const watcher = fs.watch(dictDir, (_eventType, filename) => {
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
  });

  return () => {
    if (timer) clearTimeout(timer);
    watcher.close();
  };
}
