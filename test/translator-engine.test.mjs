import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInjectorScript,
  buildLowerDict,
  compilePatterns,
  looksLikeNonUiText,
  translateRawString
} from '../src/injector-runtime.mjs';
import { DEFAULT_DICT_DIR, loadDictionaries } from '../src/dict-loader.mjs';

test('精确匹配、忽略大小写、空白规范化、标点保留与正则模板均正确工作', () => {
  const bundle = loadDictionaries(DEFAULT_DICT_DIR);
  const compiled = compilePatterns(bundle.patterns);
  const lower = buildLowerDict(bundle.entries);

  assert.equal(translateRawString('  New Conversation  ', bundle.entries, compiled, 400, lower), '  新建对话  ');
  assert.equal(translateRawString('NEW CONVERSATION', bundle.entries, compiled, 400, lower), '新建对话');
  assert.equal(translateRawString('Tool\n  Execution\u00a0Policy', bundle.entries, compiled, 400, lower), '工具执行策略');
  assert.equal(translateRawString('Settings:', bundle.entries, compiled, 400, lower), '设置：');
  assert.equal(translateRawString('Loading…', bundle.entries, compiled, 400, lower), '加载中…');
  assert.equal(translateRawString('Model (optional)', bundle.entries, compiled, 400, lower), '模型（可选）');
  assert.equal(translateRawString('5m ago', bundle.entries, compiled, 400, lower), '5 分钟前');
  assert.equal(translateRawString('5 minutes ago', bundle.entries, compiled, 400, lower), '5 分钟前');
  assert.equal(translateRawString('1 file changed', bundle.entries, compiled, 400, lower), '已变更 1 个文件');
  assert.equal(translateRawString('3 files changed', bundle.entries, compiled, 400, lower), '已变更 3 个文件');
  assert.equal(translateRawString('Thought for 1m 20s', bundle.entries, compiled, 400, lower), '已思考 1 分 20 秒');
  assert.equal(translateRawString('Exit code: 0', bundle.entries, compiled, 400, lower), '退出码：0');
  assert.equal(translateRawString('Step 2 of 5', bundle.entries, compiled, 400, lower), '第 2 / 5 步');
});

test('用户内容防误伤：路径、URL、代码片段与超长文本不会被误判或误译', () => {
  assert.equal(looksLikeNonUiText('https://antigravity.google/docs'), true);
  assert.equal(looksLikeNonUiText('D:\\Github_Ku\\antigravity-2.0-zh-cn'), true);
  assert.equal(looksLikeNonUiText('/usr/local/bin/node'), true);
  assert.equal(looksLikeNonUiText('const x = () => { return 1; }'), true);
  assert.equal(looksLikeNonUiText('user@example.com'), true);
  assert.equal(looksLikeNonUiText('12345'), true);
  assert.equal(looksLikeNonUiText('A'), true);
  assert.equal(looksLikeNonUiText('New Conversation'), false);

  const bundle = loadDictionaries(DEFAULT_DICT_DIR);
  const compiled = compilePatterns(bundle.patterns);
  const lower = buildLowerDict(bundle.entries);
  assert.equal(translateRawString('D:\\Github_Ku\\Settings', bundle.entries, compiled, 400, lower), null);
  assert.equal(translateRawString('const Settings = true;', bundle.entries, compiled, 400, lower), null);
});

test('生成的注入脚本语法合法且可解析', () => {
  const bundle = loadDictionaries(DEFAULT_DICT_DIR);
  const script = buildInjectorScript({
    enabled: true,
    entries: bundle.entries,
    patterns: bundle.patterns,
    ignoreSelectors: ['.monaco-editor'],
    maxTextLength: 400,
    sweepIntervalMs: 2000
  });
  assert.ok(script.includes('window.__AG_ZH__'));
  assert.doesNotThrow(() => new Function(script));
});
