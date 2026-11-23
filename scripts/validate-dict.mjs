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
      if (typeof v !== 'string') {
        console.error(`[错误] ${file} 中词条 "${k}" 的译文非字符串`);
        process.exit(1);
      }
      if (!v.trim() && file !== 'user-custom.json') {
        console.error(`[错误] ${file} 中词条 "${k}" 的译文为空`);
        process.exit(1);
      }
      if (seenKeys.has(k) && file !== 'user-custom.json') {
        console.warn(`[提示] 本地词条 "${k}" 同时存在于 ${seenKeys.get(k)} 与 ${file}`);
        warnings++;
      }
      seenKeys.set(k, file);
    }
  }

  const bundle = loadDictionaries(DEFAULT_DICT_DIR);
  console.log(
    `[校验通过] 共 ${bundle.stats.filesLoaded} 个词库文件，合并后 ${bundle.stats.totalEntries} 条精确词条（含上游 MIT 词库 ${bundle.stats.upstreamEntries} 条），${bundle.stats.totalPatterns} 条正则规则，${warnings} 条本地重复提示。`
  );
}

main();
