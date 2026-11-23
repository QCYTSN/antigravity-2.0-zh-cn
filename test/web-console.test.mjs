import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startWebConsole } from '../src/web-console.mjs';
import { loadDictionaries } from '../src/dict-loader.mjs';

test('本地 Web 控制台 API 支持状态查询、开关切换与自定义词条热增删', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-zh-web-'));
  fs.writeFileSync(
    path.join(tmpDir, 'common.json'),
    JSON.stringify({ entries: { Save: '保存' } }),
    'utf8'
  );
  fs.writeFileSync(
    path.join(tmpDir, 'user-custom.json'),
    JSON.stringify({ entries: {} }),
    'utf8'
  );

  let enabled = true;
  let keepEnglishTechLabels = false;
  let showFloatingToggle = true;
  let bundle = loadDictionaries(tmpDir);
  let updateCalls = 0;

  const mockManager = {
    get enabled() {
      return enabled;
    },
    get keepEnglishTechLabels() {
      return keepEnglishTechLabels;
    },
    get showFloatingToggle() {
      return showFloatingToggle;
    },
    async getStatus() {
      return {
        enabled,
        keepEnglishTechLabels,
        showFloatingToggle,
        cdpReachable: false,
        cdpEndpoint: '127.0.0.1:9229',
        attachedCount: 0,
        targets: [],
        dictStats: bundle.stats,
        upstreamMeta: null,
        modules: bundle.modules
      };
    },
    async setEnabled(flag) {
      enabled = Boolean(flag);
    },
    async setOptions(opts = {}) {
      if (typeof opts.keepEnglishTechLabels === 'boolean') {
        keepEnglishTechLabels = opts.keepEnglishTechLabels;
      }
      if (typeof opts.showFloatingToggle === 'boolean') {
        showFloatingToggle = opts.showFloatingToggle;
      }
    },
    async updateDictionaries(next) {
      bundle = next;
      updateCalls++;
    },
    async collectUntranslatedAll() {
      return [{ text: 'Untranslated Button', hint: 'button', count: 1 }];
    }
  };

  const server = await startWebConsole({
    manager: mockManager,
    port: 0,
    dictDir: tmpDir,
    logger: { log() {}, warn() {} }
  });

  try {
    assert.ok(server, 'Web 控制台应成功监听');
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;

    // 1. HTML 页面可访问
    const htmlResp = await fetch(`${base}/`);
    assert.equal(htmlResp.status, 200);
    const html = await htmlResp.text();
    assert.ok(html.includes('Antigravity 2.0 无损汉化控制台'));

    // 2. 切换中/英文开关 & 偏好开关
    const toggleResp = await fetch(`${base}/api/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false })
    });
    const toggleData = await toggleResp.json();
    assert.equal(toggleData.enabled, false);
    assert.equal(enabled, false);

    const optResp = await fetch(`${base}/api/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keepEnglishTechLabels: true, showFloatingToggle: false })
    });
    const optData = await optResp.json();
    assert.equal(optData.keepEnglishTechLabels, true);
    assert.equal(optData.showFloatingToggle, false);

    // 3. 在线添加自定义词条并触发热更新
    const addResp = await fetch(`${base}/api/custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'Swarm', target: '多智能体协同' })
    });
    assert.equal(addResp.status, 200);
    assert.equal(updateCalls, 1);
    assert.equal(bundle.entries['Swarm'], '多智能体协同');

    // 4. 采集未翻译词条接口
    const collectResp = await fetch(`${base}/api/collect`);
    const collectData = await collectResp.json();
    assert.equal(collectData.items.length, 1);
    assert.equal(collectData.items[0].text, 'Untranslated Button');

    // 5. 删除自定义词条
    const delResp = await fetch(`${base}/api/custom`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'Swarm' })
    });
    assert.equal(delResp.status, 200);
    assert.equal(bundle.entries['Swarm'], undefined);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
