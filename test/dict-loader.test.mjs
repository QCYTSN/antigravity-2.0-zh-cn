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

test('默认词库完整加载且包含核心 Antigravity 2.0 词条', () => {
  const bundle = loadDictionaries(DEFAULT_DICT_DIR);
  assert.ok(bundle.stats.totalEntries > 200, '词条总数应大于 200');
  assert.ok(bundle.stats.totalPatterns >= 15, '正则模板应不少于 15 条');
  assert.equal(bundle.entries['New Conversation'], '新建对话');
  assert.equal(bundle.entries['Scheduled Tasks'], '定时任务');
  assert.equal(bundle.entries['Tool Execution Policy'], '工具执行策略');
  assert.equal(bundle.entries['Background Tasks'], '后台任务');
});

test('user-custom.json 拥有最高覆盖优先级并支持原子增删', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-zh-dict-'));
  try {
    fs.writeFileSync(
      path.join(tmpDir, 'common.json'),
      JSON.stringify({ entries: { Settings: '设置', Save: '保存' } }),
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'user-custom.json'),
      JSON.stringify({ entries: { Settings: '系统偏好设置' } }),
      'utf8'
    );

    let bundle = loadDictionaries(tmpDir);
    assert.equal(bundle.entries['Settings'], '系统偏好设置');
    assert.equal(bundle.entries['Save'], '保存');

    upsertUserCustomEntry('Custom Label', '自定义标签', tmpDir);
    bundle = loadDictionaries(tmpDir);
    assert.equal(bundle.entries['Custom Label'], '自定义标签');

    deleteUserCustomEntry('Settings', tmpDir);
    bundle = loadDictionaries(tmpDir);
    assert.equal(bundle.entries['Settings'], '设置');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
