import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInjectorScript,
  compilePatterns,
  looksLikeNonUiText,
  translateRawString
} from '../src/injector-runtime.mjs';
import { DEFAULT_DICT_DIR, loadDictionaries } from '../src/dict-loader.mjs';

test('精确匹配保留首尾空白，正则模板正确翻译动态计数与时间', () => {
  const bundle = loadDictionaries(DEFAULT_DICT_DIR);
  const compiled = compilePatterns(bundle.patterns);

  assert.equal(translateRawString('  New Conversation  ', bundle.entries, compiled), '  新建对话  ');
  assert.equal(translateRawString('5 minutes ago', bundle.entries, compiled), '5 分钟前');
  assert.equal(translateRawString('1 file changed', bundle.entries, compiled), '已变更 1 个文件');
  assert.equal(translateRawString('3 files changed', bundle.entries, compiled), '已变更 3 个文件');
  assert.equal(translateRawString('Thought for 12s', bundle.entries, compiled), '已思考 12 秒');
  assert.equal(translateRawString('Step 2 of 5', bundle.entries, compiled), '第 2 / 5 步');
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
  assert.equal(translateRawString('D:\\Github_Ku\\Settings', bundle.entries, compiled), null);
  assert.equal(translateRawString('const Settings = true;', bundle.entries, compiled), null);
});

test('生成的注入脚本语法合法且可解析', () => {
  const bundle = loadDictionaries(DEFAULT_DICT_DIR);
  const script = buildInjectorScript({
    enabled: true,
    entries: bundle.entries,
    patterns: bundle.patterns,
    ignoreSelectors: ['.monaco-editor'],
    maxTextLength: 220
  });
  assert.ok(script.includes('window.__AG_ZH__'));
  assert.doesNotThrow(() => new Function(script));
});
