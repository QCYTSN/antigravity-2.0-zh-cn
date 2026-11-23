import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PROJECT_ROOT } from '../src/config.mjs';

const UPSTREAM_REPO = 'yiheng8023/antigravity-chinese';
const UPSTREAM_BRANCH = 'main';
const UPSTREAM_DIR = path.join(PROJECT_ROOT, 'dict', 'upstream');

const FILES_TO_SYNC = [
  { remote: 'dict/zh-CN.json', local: 'zh-CN.json' },
  { remote: 'dict/scoped/swarm.json', local: 'swarm.json' },
  { remote: 'dict/scoped/official-plugin-descriptions.json', local: 'official-plugin-descriptions.json' }
];

async function fetchRemoteFile(remotePath) {
  const rawUrl = `https://raw.githubusercontent.com/${UPSTREAM_REPO}/${UPSTREAM_BRANCH}/${remotePath}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(rawUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (resp.ok) {
      return await resp.text();
    }
  } catch {
    // 若直连 GitHub Raw 超时，则自动回退到 gh api（若本机已安装 gh）
  }

  try {
    return execFileSync(
      'gh',
      [
        'api',
        `repos/${UPSTREAM_REPO}/contents/${remotePath}?ref=${UPSTREAM_BRANCH}`,
        '-H',
        'Accept: application/vnd.github.raw'
      ],
      { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 20000, windowsHide: true }
    );
  } catch (err) {
    throw new Error(`拉取 ${remotePath} 失败（请检查网络连接或本地代理 / gh 登录状态）: ${err.message}`);
  }
}

function validateUpstreamJson(name, text) {
  const parsed = JSON.parse(text);
  const exactObj = parsed.exact || parsed.entries || (typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {});
  const patternsArr = [...(parsed.patterns || []), ...(parsed.rules || [])];
  for (const p of patternsArr) {
    const pat = p?.regex ?? p?.pattern;
    if (typeof pat === 'string' && pat) {
      new RegExp(pat, p.flags || '');
    }
  }
  return {
    exactCount: typeof exactObj === 'object' && exactObj ? Object.keys(exactObj).length : 0,
    patternCount: patternsArr.length
  };
}

async function main() {
  fs.mkdirSync(UPSTREAM_DIR, { recursive: true });
  console.log(`[同步上游词库] 来源: https://github.com/${UPSTREAM_REPO} (MIT License)`);

  const summary = [];
  for (const item of FILES_TO_SYNC) {
    console.log(`  -> 正在拉取 ${item.remote} ...`);
    const content = await fetchRemoteFile(item.remote);
    const stats = validateUpstreamJson(item.local, content);
    const targetPath = path.join(UPSTREAM_DIR, item.local);
    const tmpPath = `${targetPath}.tmp`;
    fs.writeFileSync(tmpPath, content, 'utf8');
    fs.renameSync(tmpPath, targetPath);
    summary.push({ file: item.local, ...stats, bytes: Buffer.byteLength(content, 'utf8') });
    console.log(
      `     完成: ${item.local} (${Math.round(Buffer.byteLength(content, 'utf8') / 1024)} KB, 精确=${stats.exactCount}, 正则=${stats.patternCount})`
    );
  }

  const meta = {
    source: `https://github.com/${UPSTREAM_REPO}`,
    license: 'MIT',
    branch: UPSTREAM_BRANCH,
    syncedAt: new Date().toISOString(),
    files: summary
  };
  fs.writeFileSync(
    path.join(UPSTREAM_DIR, '_meta.json'),
    `${JSON.stringify(meta, null, 2)}\n`,
    'utf8'
  );

  console.log('[同步完成] 上游社区词库已更新。如汉化启动器正在运行，将自动热推送到 Antigravity 2.0 窗口！');
}

main().catch((err) => {
  console.error(`[同步失败] ${err.message}`);
  process.exit(1);
});
