import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const PROJECT_ROOT = path.resolve(__dirname, '..');

export const DEFAULT_CONFIG = {
  exePath: '',
  proxyMode: 'auto',
  cdpPort: 9229,
  cdpHost: '127.0.0.1',
  webConsoleEnabled: true,
  webConsolePort: 19222,
  autoOpenConsole: false,
  enabledOnStart: true,
  watchDictionaries: true,
  pollIntervalMs: 1200,
  sweepIntervalMs: 2000,
  maxTextLength: 400,
  extraLaunchArgs: [],
  ignoreSelectors: [
    '[data-ag-zh-ignore]',
    '[contenteditable="true"]',
    '[contenteditable=""]',
    '.monaco-editor',
    '.cm-editor',
    '.xterm',
    '.terminal',
    '[data-testid*="message-content"]',
    '[data-testid*="code-block"]',
    '[data-role="user"]',
    '.user-message-content'
  ]
};

export function loadConfig(configPath = path.join(PROJECT_ROOT, 'config.json')) {
  let userConfig = {};
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf8');
      userConfig = JSON.parse(raw);
    } catch (err) {
      throw new Error(`配置文件解析失败 (${configPath}): ${err.message}`);
    }
  }

  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    ignoreSelectors: Array.isArray(userConfig.ignoreSelectors)
      ? userConfig.ignoreSelectors
      : DEFAULT_CONFIG.ignoreSelectors,
    extraLaunchArgs: Array.isArray(userConfig.extraLaunchArgs)
      ? userConfig.extraLaunchArgs
      : DEFAULT_CONFIG.extraLaunchArgs
  };
}

export function getCandidateExePaths(env = process.env) {
  const candidates = [];
  const localAppData = env.LOCALAPPDATA || '';
  const programFiles = env.ProgramFiles || env.PROGRAMFILES || '';
  const programFilesX86 = env['ProgramFiles(x86)'] || '';
  const userProfile = env.USERPROFILE || '';

  if (localAppData) {
    candidates.push(
      path.join(localAppData, 'Programs', 'Antigravity', 'Antigravity.exe'),
      path.join(localAppData, 'Antigravity', 'Antigravity.exe'),
      path.join(localAppData, 'Google', 'Antigravity', 'Antigravity.exe')
    );
  }
  if (programFiles) {
    candidates.push(
      path.join(programFiles, 'Antigravity', 'Antigravity.exe'),
      path.join(programFiles, 'Google', 'Antigravity', 'Antigravity.exe')
    );
  }
  if (programFilesX86) {
    candidates.push(
      path.join(programFilesX86, 'Antigravity', 'Antigravity.exe')
    );
  }
  if (userProfile) {
    candidates.push(
      path.join(userProfile, 'AppData', 'Local', 'Programs', 'Antigravity', 'Antigravity.exe')
    );
  }

  return [...new Set(candidates.filter(Boolean))];
}

function queryWindowsRegistryForAntigravity() {
  if (process.platform !== 'win32') return '';
  try {
    const script = [
      "$paths = @(",
      "  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',",
      "  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',",
      "  'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'",
      ");",
      "$item = Get-ItemProperty $paths -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match 'Antigravity' -and $_.DisplayName -notmatch 'IDE' } | Select-Object -First 1;",
      "if ($item -and $item.InstallLocation) {",
      "  $exe = Join-Path $item.InstallLocation 'Antigravity.exe';",
      "  if (Test-Path $exe) { Write-Output $exe }",
      "} elseif ($item -and $item.DisplayIcon) {",
      "  $icon = ($item.DisplayIcon -split ',')[0].Trim('\"');",
      "  if ($icon -match 'Antigravity\\.exe$' -and (Test-Path $icon)) { Write-Output $icon }",
      "}"
    ].join(' ');

    const out = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { encoding: 'utf8', timeout: 4000, windowsHide: true }
    ).trim();

    return out && fs.existsSync(out) ? out : '';
  } catch {
    return '';
  }
}

export function resolveAntigravityExe(config, options = {}) {
  const { existsSync = fs.existsSync, env = process.env, allowRegistry = true } = options;

  if (config.exePath && config.exePath.trim()) {
    const expanded = config.exePath.replace(/%([^%]+)%/g, (_, key) => env[key] || `%${key}%`);
    if (existsSync(expanded)) {
      return { path: expanded, source: 'config.json' };
    }
    return {
      path: '',
      source: 'config.json (missing)',
      error: `config.json 中配置的 exePath 不存在: ${expanded}`
    };
  }

  for (const candidate of getCandidateExePaths(env)) {
    if (existsSync(candidate)) {
      return { path: candidate, source: 'auto-detect' };
    }
  }

  if (allowRegistry) {
    const regPath = queryWindowsRegistryForAntigravity();
    if (regPath) {
      return { path: regPath, source: 'registry' };
    }
  }

  return {
    path: '',
    source: 'not-found',
    error: '未能自动找到 Antigravity 2.0 (Antigravity.exe)，请在 config.json 中手动填写 exePath。'
  };
}
