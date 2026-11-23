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

test('精确匹配、空白规范化、快捷键保留、标点保留、上游长句与正则模板均正确工作', () => {
  const bundle = loadDictionaries(DEFAULT_DICT_DIR);
  const compiled = compilePatterns(bundle.patterns);
  const lower = buildLowerDict(bundle.entries);
  const opts = { maxLength: 1200, lowerDict: lower };

  assert.equal(translateRawString('  Orchestrator Model  ', bundle.entries, compiled, opts), '  编排模型  ');
  assert.equal(translateRawString('ORCHESTRATOR MODEL', bundle.entries, compiled, opts), '编排模型');
  assert.equal(translateRawString('Thinking\n  effort', bundle.entries, compiled, opts), '推理强度');
  assert.equal(translateRawString('Settings:', bundle.entries, compiled, opts), '设置：');
  assert.equal(translateRawString('New Conversation (Ctrl+N)', bundle.entries, compiled, opts), `${bundle.entries['New Conversation']} (Ctrl+N)`);
  assert.equal(translateRawString('85% left', bundle.entries, compiled, opts), '剩余 85%');
  assert.equal(translateRawString('5h limit', bundle.entries, compiled, opts), '5 小时限额');
  assert.equal(translateRawString('3mo', bundle.entries, compiled, opts), '3 个月前');
  assert.equal(translateRawString('Turn 3 of 6', bundle.entries, compiled, opts), '第 3 / 6 轮');
  assert.equal(
    translateRawString(
      'Controls how much time and quota the model spends reasoning before responding. Higher effort improves accuracy on hard problems, at the cost of slower responses and higher quota use.',
      bundle.entries,
      compiled,
      opts
    ),
    '控制模型在回复前用于推理的时间和额度。提高推理强度有助于更准确地处理难题，同时也会增加响应时间和额度消耗。'
  );
});

test('支持 keepOriginal 强制保留英文 与 keepEnglishTechLabels 技术档位保留英文', () => {
  const bundle = loadDictionaries(DEFAULT_DICT_DIR);
  const compiled = compilePatterns(bundle.patterns);
  const lower = buildLowerDict(bundle.entries);

  assert.equal(
    translateRawString('Turbo', bundle.entries, compiled, {
      lowerDict: lower,
      keepEnglishTechLabels: true
    }),
    null
  );
  assert.equal(
    translateRawString('Settings', bundle.entries, compiled, {
      lowerDict: lower,
      keepOriginalSet: new Set(['settings'])
    }),
    null
  );
});

test('高碰撞小写短词不走忽略大小写模糊翻译，路径/URL/文件名/代码受保护', () => {
  assert.equal(looksLikeNonUiText('https://antigravity.google/docs'), true);
  assert.equal(looksLikeNonUiText('D:\\Github_Ku\\antigravity-2.0-zh-cn'), true);
  assert.equal(looksLikeNonUiText('/usr/local/bin/node'), true);
  assert.equal(looksLikeNonUiText('config.json'), true);
  assert.equal(looksLikeNonUiText('injector-runtime.mjs'), true);
  assert.equal(looksLikeNonUiText('const x = () => { return 1; }'), true);

  const bundle = loadDictionaries(DEFAULT_DICT_DIR);
  const compiled = compilePatterns(bundle.patterns);
  const lower = buildLowerDict(bundle.entries);
  assert.equal(translateRawString('D:\\Github_Ku\\Settings', bundle.entries, compiled, { lowerDict: lower }), null);
  assert.equal(translateRawString('const Settings = true;', bundle.entries, compiled, { lowerDict: lower }), null);
});

test('生成的 v2.0.0 注入脚本语法合法且包含悬浮球与 attachShadow 拦截', () => {
  const bundle = loadDictionaries(DEFAULT_DICT_DIR);
  const script = buildInjectorScript({
    enabled: true,
    keepEnglishTechLabels: false,
    showFloatingToggle: true,
    entries: bundle.entries,
    patterns: bundle.patterns,
    keepOriginal: [],
    ignoreSelectors: ['.monaco-editor'],
    maxTextLength: 1200,
    sweepIntervalMs: 8000
  });
  assert.ok(script.includes('window.__AG_ZH__'));
  assert.ok(script.includes('attachShadow'));
  assert.ok(script.includes('ag-zh-floating-toggle'));
  assert.doesNotThrow(() => new Function(script));
});
