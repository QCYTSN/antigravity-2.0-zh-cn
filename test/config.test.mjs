import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { getCandidateExePaths, resolveAntigravityExe } from '../src/config.mjs';

test('Windows 默认路径探测优先包含 %LOCALAPPDATA%\\Programs\\Antigravity\\Antigravity.exe', () => {
  const candidates = getCandidateExePaths({
    LOCALAPPDATA: 'C:\\Users\\demo\\AppData\\Local',
    ProgramFiles: 'C:\\Program Files'
  });

  assert.equal(
    candidates[0],
    path.join('C:\\Users\\demo\\AppData\\Local', 'Programs', 'Antigravity', 'Antigravity.exe')
  );
});

test('config.json 手动指定 exePath 优先于自动探测', () => {
  const customPath = 'D:\\Custom\\Antigravity.exe';
  const res = resolveAntigravityExe(
    { exePath: customPath },
    {
      existsSync: (p) => p === customPath,
      allowRegistry: false
    }
  );
  assert.equal(res.path, customPath);
  assert.equal(res.source, 'config.json');
});

test('找不到程序时返回清晰错误提示', () => {
  const res = resolveAntigravityExe(
    { exePath: '' },
    {
      existsSync: () => false,
      env: {},
      allowRegistry: false
    }
  );
  assert.equal(res.path, '');
  assert.ok(res.error.includes('config.json'));
});
