import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChildProxyArgs,
  buildChildProxyEnv,
  normalizeProxyUrl,
  parseWindowsProxyServer,
  resolveProxyConfig
} from '../src/proxy.mjs';

test('normalizeProxyUrl 和 parseWindowsProxyServer 正确解析常见 Windows 代理格式', () => {
  assert.equal(normalizeProxyUrl('127.0.0.1:10910'), 'http://127.0.0.1:10910');
  assert.equal(normalizeProxyUrl('http://127.0.0.1:7897'), 'http://127.0.0.1:7897');
  assert.equal(parseWindowsProxyServer('127.0.0.1:10910'), 'http://127.0.0.1:10910');
  assert.equal(
    parseWindowsProxyServer('http=127.0.0.1:7890;https=127.0.0.1:7891'),
    'http://127.0.0.1:7891'
  );
  assert.equal(parseWindowsProxyServer(''), '');
});

test('resolveProxyConfig 按显式配置 -> 环境变量 -> 系统代理顺序探测', async () => {
  const disabled = await resolveProxyConfig({ proxyMode: 'none' });
  assert.equal(disabled.url, '');
  assert.equal(disabled.source, 'disabled');

  const explicit = await resolveProxyConfig({ proxyMode: '127.0.0.1:8888' });
  assert.equal(explicit.url, 'http://127.0.0.1:8888');
  assert.equal(explicit.source, 'config.json');

  const fromSys = await resolveProxyConfig(
    { proxyMode: 'auto' },
    {
      env: {},
      readSystemProxy: () => 'http://127.0.0.1:10910',
      probe: async (u) => u === 'http://127.0.0.1:10910'
    }
  );
  assert.equal(fromSys.url, 'http://127.0.0.1:10910');
  assert.equal(fromSys.source, 'windows-system-proxy');
});

test('buildChildProxyEnv 与 buildChildProxyArgs 正确注入代理并放行本地回环', () => {
  const env = buildChildProxyEnv({ PATH: 'C:\\Windows' }, 'http://127.0.0.1:10910');
  assert.equal(env.HTTP_PROXY, 'http://127.0.0.1:10910');
  assert.equal(env.HTTPS_PROXY, 'http://127.0.0.1:10910');
  assert.equal(env.NO_PROXY, 'localhost,127.0.0.1,::1');

  const args = buildChildProxyArgs('http://127.0.0.1:10910');
  assert.deepEqual(args, [
    '--proxy-server=http://127.0.0.1:10910',
    '--proxy-bypass-list=localhost;127.0.0.1;[::1]'
  ]);
});
