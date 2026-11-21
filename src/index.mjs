import { execFileSync, spawn } from 'node:child_process';
import { loadConfig, resolveAntigravityExe } from './config.mjs';
import { DEFAULT_DICT_DIR, loadDictionaries, watchDictionaries } from './dict-loader.mjs';
import { CdpLocalizationManager } from './cdp-manager.mjs';
import { startWebConsole } from './web-console.mjs';

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
  console.log(`原生 WebSocket 支持: ${typeof globalThis.WebSocket === 'function' ? '正常' : '缺失（请升级 Node >= 22）'}`);

  const exe = resolveAntigravityExe(config);
  if (exe.path) {
    console.log(`Antigravity 2.0 程序路径: ${exe.path} (${exe.source})`);
  } else {
    console.log(`Antigravity 2.0 程序路径: 未找到 - ${exe.error}`);
  }

  const bundle = loadDictionaries(DEFAULT_DICT_DIR);
  console.log(
    `词库加载状态: 正常（精确词条 ${bundle.stats.totalEntries} 条，正则模板 ${bundle.stats.totalPatterns} 条，共 ${bundle.stats.filesLoaded} 个文件）`
  );

  const cdpAlive = await isCdpAlive(config.cdpHost, config.cdpPort);
  console.log(
    `CDP 调试端口 (${config.cdpHost}:${config.cdpPort}): ${cdpAlive ? '在线（可直接热附着）' : '未开启'}`
  );
  console.log(`Antigravity 进程状态: ${isAntigravityProcessRunning() ? '运行中' : '未运行'}`);
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
  let childProc = null;

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

      const launchArgs = [
        `--remote-debugging-address=${config.cdpHost}`,
        `--remote-debugging-port=${config.cdpPort}`,
        '--remote-allow-origins=*',
        ...config.extraLaunchArgs
      ];

      console.log(`[启动器] 正在拉起 Antigravity 2.0: ${exe.path}`);
      childProc = spawn(exe.path, launchArgs, {
        detached: false,
        stdio: 'ignore',
        windowsHide: false
      });

      childProc.on('error', (err) => {
        console.error(`[启动失败] ${err.message}`);
        process.exit(1);
      });
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
    console.log('\n[退出] 正在关闭汉化引擎...');
    cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  if (childProc) {
    childProc.on('exit', (code) => {
      // 注意：部分 Electron 启动器主进程会立即拉起子进程并退出自身，因此仅在 CDP 彻底失联后退出
      setTimeout(async () => {
        const stillAlive = await isCdpAlive(config.cdpHost, config.cdpPort);
        if (!stillAlive && !isAntigravityProcessRunning()) {
          console.log(`[退出] Antigravity 2.0 已关闭 (exit=${code ?? 0})，汉化引擎自动退出。`);
          cleanup();
          process.exit(0);
        }
      }, 3000);
    });

    // 定期检测：如果所有 Antigravity 进程均已关闭且曾经连上过，则优雅退出不留僵尸进程
    let everConnected = false;
    const lifecycleTimer = setInterval(async () => {
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
