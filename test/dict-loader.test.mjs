import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_DICT_DIR,
  deleteUserCustomEntry,
  loadDictionaries,
  upsertUserCustomEntry
} from '../src/dict-loader.mjs';

test('默认词库完整合并本地与上游 MIT 社区词库（4500+ 精确词条与 400+ 正则模板）', () => {
  const bundle = loadDictionaries(DEFAULT_DICT_DIR);
  assert.ok(bundle.stats.totalEntries > 4500, `词条总数应大于 4500，实际为 ${bundle.stats.totalEntries}`);
  assert.ok(bundle.stats.totalPatterns > 400, `正则模板应大于 400，实际为 ${bundle.stats.totalPatterns}`);
  assert.ok(bundle.stats.upstreamEntries > 4500, '应已加载上游 MIT 社区词库');
  assert.equal(bundle.entries['Orchestrator Model'], '编排模型');
  assert.equal(bundle.entries['Thinking effort'], '推理强度');
  assert.equal(bundle.entries['Customize Sidebar'], '自定义侧栏');
});

test('三层优先级正确：user-custom > upstream > local-base，且支持空值强制保留英文', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-zh-dict-'));
  try {
    fs.mkdirSync(path.join(tmpDir, 'upstream'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'common.json'),
      JSON.stringify({ entries: { Settings: '本地设置', Save: '保存', KeepMe: '保留我' } }),
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'upstream', 'zh-CN.json'),
      JSON.stringify({
        exact: { Settings: '上游设置', KeepMe: '上游保留我' },
        patterns: [{ regex: '^(\\d+)% left$', replacement: '剩余 $1%' }]
      }),
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'user-custom.json'),
      JSON.stringify({ entries: { Settings: '个人偏好设置', KeepMe: '' } }),
      'utf8'
    );

    let bundle = loadDictionaries(tmpDir);
    assert.equal(bundle.entries['Settings'], '个人偏好设置');
    assert.equal(bundle.entries['Save'], '保存');
    assert.equal(bundle.entries['KeepMe'], undefined);
    assert.deepEqual(bundle.keepOriginal, ['KeepMe']);
    assert.equal(bundle.patterns.length, 1);

    upsertUserCustomEntry('Custom Label', '自定义标签', tmpDir);
    bundle = loadDictionaries(tmpDir);
    assert.equal(bundle.entries['Custom Label'], '自定义标签');

    deleteUserCustomEntry('Settings', tmpDir);
    bundle = loadDictionaries(tmpDir);
    assert.equal(bundle.entries['Settings'], '上游设置');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
