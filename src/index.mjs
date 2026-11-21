import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { PROJECT_ROOT, loadConfig, resolveAntigravityExe } from './config.mjs';
import { DEFAULT_DICT_DIR, loadDictionaries, watchDictionaries } from './dict-loader.mjs';
import { CdpLocalizationManager } from './cdp-manager.mjs';
import { startWebConsole } from './web-console.mjs';
import {
  buildChildProxyArgs,
  buildChildProxyEnv,
  resolveProxyConfig
} from './proxy.mjs';

function parseCliArgs(argv) {
  const args = argv.slice(2);
  const command = args.find((a) => !a.startsWith('--')) || 'launch';
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  return { command, flags };
}

async function isCdpAlive(host, port) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1200);
  try {
    const resp = await fetch(`http://${host}:${port}/json/version`, {
      signal: controller.signal
    });
    return resp.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function isAntigravityProcessRunning() {
  if (process.platform !== 'win32') return false;
  try {
    const out = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '(Get-Process -Name "Antigravity" -ErrorAction SilentlyContinue | Measure-Object).Count'
      ],
      { encoding: 'utf8', timeout: 3000, windowsHide: true }
    ).trim();
    return Number(out) > 0;
  } catch {
    return false;
  }
}

function openBrowserUrl(url) {
  if (process.platform === 'win32') {
    spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
  }
}

function showWindowsAlert(title, message) {
  if (process.platform !== 'win32') return;
  try {
    const safeTitle = String(title).replace(/'/g, "''");
    const safeMessage = String(message).replace(/'/g, "''");
    const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('${safeMessage}', '${safeTitle}', 'OK', 'Information') | Out-Null`;
    const encoded = Buffer.from(ps, 'utf16le').toString('base64');
    execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
      { windowsHide: true, timeout: 60000 }
    );
  } catch {
    // 忽略弹窗失败
  }
}

async function runCheck(config) {
  console.log('=== Antigravity 2.0 无损汉化环境自检 ===');
  console.log(`Node.js 版本: ${process.version}`);
  console.log(
    `原生 WebSocket 支持: ${typeof globalThis.WebSocket === 'function' ? '正常' : '缺失（请升级 Node >= 22）'}`
  );

  const exe = resolveAntigravityExe(config);
  if (exe.path) {
    console.log(`Antigravity 2.0 程序路径: ${exe.path} (${exe.source})`);
  } else {
    console.log(`Antigravity 2.0 程序路径: 未找到 - ${exe.error}`);
  }

  const proxy = await resolveProxyConfig(config);
  if (proxy.url) {
    console.log(`本地代理自动探测: ${proxy.url} (${proxy.source}) [启动时将自动注入免 TUN 代理]`);
  } else {
    console.log(`本地代理自动探测: 未检测到本地代理 (${proxy.source}) [直连 / TUN 模式]`);
  }

  const bundle = loadDictionaries(DEFAULT_DICT_DIR);
  console.log(
    `词库加载状态: 正常（精确词条 ${bundle.stats.totalEntries} 条，正则模板 ${bundle.stats.totalPatterns} 条，共 ${bundle.stats.filesLoaded} 个文件）`
  );

  const cdpAlive = await isCdpAlive(config.cdpHost, config.cdpPort);
  console.log(
    `CDP 调试端口 (${config.cdpHost}:${config.cdpPort}): ${cdpAlive ? '在线（可直接热附着/扫描）' : '未开启'}`
  );
  console.log(`Antigravity 进程状态: ${isAntigravityProcessRunning() ? '运行中' : '未运行'}`);
}

async function runScan(config) {
  const cdpAlive = await isCdpAlive(config.cdpHost, config.cdpPort);
  if (!cdpAlive) {
    console.error(
      `[扫描失败] 本地 CDP 端口 ${config.cdpHost}:${config.cdpPort} 未开启。请先通过【启动中文版.bat】启动 Antigravity 2.0。`
    );
    process.exit(1);
  }

  const dictBundle = loadDictionaries(DEFAULT_DICT_DIR);
  const manager = new CdpLocalizationManager({ config, dictBundle });
  await manager.pollOnce();

  const items = await manager.collectUntranslatedAll();
  const outPath = path.join(PROJECT_ROOT, 'untranslated-report.json');
  const report = {
    generatedAt: new Date().toISOString(),
    totalFound: items.length,
    tip: '将需要补充的词条按 "英文原文": "中文译文" 格式写入 dict/user-custom.json 即可立即热生效。',
    items,
    templateEntries: Object.fromEntries(items.map((it) => [it.text, '']))
  };

  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[扫描完成] 共发现 ${items.length} 条未翻译的界面候选词条，已导出到: ${outPath}`);
  if (items.length > 0) {
    console.log('前 20 条高频候选词条:');
    for (const item of items.slice(0, 20)) {
      console.log(`  - (${item.hint} x${item.count}) ${item.text}`);
    }
  }
  manager.shutdown();
}

async function startEngine(config, { attachOnly, openConsole, guiAlert }) {
  if (typeof globalThis.WebSocket !== 'function') {
    const msg = '当前 Node.js 不支持内置 WebSocket，请安装 Node.js 22 或更高版本。';
    console.error(`[错误] ${msg}`);
    if (guiAlert) showWindowsAlert('Antigravity 2.0 无损汉化', msg);
    process.exit(1);
  }

  const dictBundle = loadDictionaries(DEFAULT_DICT_DIR);
  console.log(
    `[词库] 已加载 ${dictBundle.stats.totalEntries} 条精确词条 + ${dictBundle.stats.totalPatterns} 条正则模板`
  );

  const manager = new CdpLocalizationManager({ config, dictBundle });
  let spawnedByUs = false;

  if (!attachOnly) {
    const alreadyDebuggable = await isCdpAlive(config.cdpHost, config.cdpPort);
    if (alreadyDebuggable) {
      console.log(`[启动器] 检测到 CDP 端口 ${config.cdpPort} 已在线，直接热附着到当前实例。`);
    } else {
      if (isAntigravityProcessRunning()) {
        const msg =
          '检测到 Antigravity 2.0 已经在运行（且未开启本地调试端口）。\n\n' +
          '由于 Electron 单实例锁限制，请先彻底退出 Antigravity（包括右下角系统托盘图标），\n' +
          '然后再重新启动中文版快捷方式即可无损开启中文界面！';
        console.log('');
        console.log('==============================================================');
        console.log(msg);
        console.log('==============================================================');
        console.log('');
        if (guiAlert) showWindowsAlert('Antigravity 2.0 无损汉化', msg);
        process.exit(2);
      }

      const exe = resolveAntigravityExe(config);
      if (!exe.path) {
        console.error(`[错误] ${exe.error}`);
        if (guiAlert) showWindowsAlert('Antigravity 2.0 无损汉化', exe.error);
        process.exit(1);
      }

      // 自动探测并注入代理（兼容免 TUN 代理启动，避免后端语言服务失联导致项目对话列表为空）
      const proxy = await resolveProxyConfig(config);
      const childEnv = buildChildProxyEnv(process.env, proxy.url);
      const proxyArgs = buildChildProxyArgs(proxy.url);

      if (proxy.url) {
        console.log(`[代理] 已自动注入本地代理: ${proxy.url} (来源: ${proxy.source})`);
      } else {
        console.log(`[代理] 未检测到本地代理 (${proxy.source})，按直连/TUN 模式启动`);
      }

      const launchArgs = [
        ...proxyArgs,
        `--remote-debugging-address=${config.cdpHost}`,
        `--remote-debugging-port=${config.cdpPort}`,
        '--remote-allow-origins=*',
        ...config.extraLaunchArgs
      ];

      const exeDir = path.dirname(exe.path);
      console.log(`[启动器] 正在拉起 Antigravity 2.0: ${exe.path}`);
      console.log(`[工作目录] ${exeDir}`);

      const childProc = spawn(exe.path, launchArgs, {
        cwd: exeDir,
        env: childEnv,
        detached: true,
        stdio: 'ignore',
        windowsHide: false
      });

      childProc.on('error', (err) => {
        console.error(`[启动失败] ${err.message}`);
        if (guiAlert) showWindowsAlert('Antigravity 2.0 无损汉化', `启动失败: ${err.message}`);
        process.exit(1);
      });

      childProc.unref();
      spawnedByUs = true;
    }
  } else {
    console.log(`[热附着模式] 正在监听本地 CDP 端点 http://${config.cdpHost}:${config.cdpPort} ...`);
  }

  manager.startPolling();

  let stopWatch = null;
  if (config.watchDictionaries) {
    stopWatch = watchDictionaries(DEFAULT_DICT_DIR, (err, nextBundle) => {
      if (err) {
        console.error(`[词库热更新失败] ${err.message}`);
        return;
      }
      console.log(
        `[词库热更新] 检测到词库变更，已实时推送 (${nextBundle.stats.totalEntries} 条)`
      );
      manager.updateDictionaries(nextBundle);
    });
  }

  let webServer = null;
  if (config.webConsoleEnabled) {
    webServer = await startWebConsole({
      manager,
      port: config.webConsolePort,
      dictDir: DEFAULT_DICT_DIR
    });
    if (webServer && (openConsole || config.autoOpenConsole)) {
      openBrowserUrl(`http://127.0.0.1:${config.webConsolePort}`);
    }
  }

  const cleanup = () => {
    stopWatch?.();
    manager.shutdown();
    webServer?.close();
  };

  process.on('SIGINT', () => {
    console.log('\n[退出] 正在关闭汉化引擎（不会强制关闭 Antigravity）...');
    cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  if (spawnedByUs) {
    let everConnected = false;
    const lifecycleTimer = setInterval(() => {
      if (manager.cdpReachable) {
        everConnected = true;
      } else if (everConnected && !isAntigravityProcessRunning()) {
        clearInterval(lifecycleTimer);
        console.log('[退出] 检测到 Antigravity 2.0 已退出，汉化引擎自动结束。');
        cleanup();
        process.exit(0);
      }
    }, 5000);
    lifecycleTimer.unref();
  }
}

async function main() {
  const { command, flags } = parseCliArgs(process.argv);
  const config = loadConfig();

  if (command === 'check') {
    await runCheck(config);
    return;
  }

  if (command === 'scan') {
    await runScan(config);
    return;
  }

  if (command === 'attach') {
    await startEngine(config, {
      attachOnly: true,
      openConsole: flags.has('--ui'),
      guiAlert: flags.has('--gui-alert')
    });
    return;
  }

  await startEngine(config, {
    attachOnly: false,
    openConsole: flags.has('--ui'),
    guiAlert: flags.has('--gui-alert')
  });
}

main().catch((err) => {
  console.error(`[致命错误] ${err.message}`);
  process.exit(1);
});
