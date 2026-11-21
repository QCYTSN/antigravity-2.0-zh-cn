import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_DICT_DIR, loadDictionaries } from '../src/dict-loader.mjs';

function main() {
  const files = fs.readdirSync(DEFAULT_DICT_DIR).filter((f) => f.endsWith('.json'));
  const seenKeys = new Map();
  let warnings = 0;

  for (const file of files) {
    if (file === 'patterns.json') continue;
    const parsed = JSON.parse(fs.readFileSync(path.join(DEFAULT_DICT_DIR, file), 'utf8'));
    if (!parsed.entries || typeof parsed.entries !== 'object') {
      console.error(`[错误] ${file} 缺少 entries 对象`);
      process.exit(1);
    }
    for (const [k, v] of Object.entries(parsed.entries)) {
      if (typeof v !== 'string' || !v.trim()) {
        console.error(`[错误] ${file} 中词条 "${k}" 的译文为空或非字符串`);
        process.exit(1);
      }
      if (seenKeys.has(k) && file !== 'user-custom.json') {
        console.warn(`[提示] 词条 "${k}" 同时存在于 ${seenKeys.get(k)} 与 ${file}（后者覆盖前者）`);
        warnings++;
      }
      seenKeys.set(k, file);
    }
  }

  const bundle = loadDictionaries(DEFAULT_DICT_DIR);
  console.log(
    `[校验通过] 共 ${bundle.stats.filesLoaded} 个词库文件，${bundle.stats.totalEntries} 条精确词条，${bundle.stats.totalPatterns} 条正则规则，${warnings} 条重复提示。`
  );
}

main();
