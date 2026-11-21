import net from 'node:net';
import { execFileSync } from 'node:child_process';

const COMMON_PROXY_PORTS = [10910, 7897, 7890, 10909, 7898, 10809, 10808];

export function normalizeProxyUrl(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    return trimmed;
  }
  return `http://${trimmed}`;
}

export function parseWindowsProxyServer(serverString) {
  const raw = String(serverString ?? '').trim();
  if (!raw) return '';
  const parts = raw.split(';').map((s) => s.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.toLowerCase().startsWith('https=')) {
      return normalizeProxyUrl(part.slice(6));
    }
  }
  for (const part of parts) {
    if (part.toLowerCase().startsWith('http=')) {
      return normalizeProxyUrl(part.slice(5));
    }
  }
  for (const part of parts) {
    if (!part.includes('=')) {
      return normalizeProxyUrl(part);
    }
  }
  return '';
}

export function readWindowsSystemProxy() {
  if (process.platform !== 'win32') return '';
  try {
    const script = [
      "$p = Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -ErrorAction SilentlyContinue;",
      'if ($p -and $p.ProxyEnable -eq 1 -and $p.ProxyServer) { Write-Output $p.ProxyServer }'
    ].join(' ');
    const out = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { encoding: 'utf8', timeout: 3000, windowsHide: true }
    ).trim();
    return parseWindowsProxyServer(out);
  } catch {
    return '';
  }
}

export function tcpProbeProxy(proxyUrl, timeoutMs = 300) {
  return new Promise((resolve) => {
    try {
      const u = new URL(normalizeProxyUrl(proxyUrl));
      const host = u.hostname || '127.0.0.1';
      const port = Number(u.port) || (u.protocol === 'https:' ? 443 : 80);
      if (!port || port < 1 || port > 65535) {
        resolve(false);
        return;
      }

      const socket = net.createConnection({ host, port });
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        try {
          socket.destroy();
        } catch {}
        resolve(ok);
      };

      socket.setTimeout(timeoutMs);
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => finish(false));
      socket.once('error', () => finish(false));
    } catch {
      resolve(false);
    }
  });
}

export async function resolveProxyConfig(config = {}, options = {}) {
  const {
    env = process.env,
    readSystemProxy = readWindowsSystemProxy,
    probe = tcpProbeProxy
  } = options;

  const mode = String(config.proxyMode ?? 'auto').trim();
  if (!mode || mode.toLowerCase() === 'none' || mode.toLowerCase() === 'off' || mode === 'false') {
    return { url: '', source: 'disabled' };
  }

  if (mode.toLowerCase() !== 'auto') {
    return { url: normalizeProxyUrl(mode), source: 'config.json' };
  }

  // 1. 优先读取显式环境变量
  const envKeys = ['ANTIGRAVITY_PROXY_URL', 'HTTPS_PROXY', 'HTTP_PROXY', 'https_proxy', 'http_proxy'];
  for (const key of envKeys) {
    const val = normalizeProxyUrl(env[key]);
    if (val && (await probe(val))) {
      return { url: val, source: `env:${key}` };
    }
  }

  // 2. 读取 Windows 系统代理
  const sysProxy = readSystemProxy();
  if (sysProxy && (await probe(sysProxy))) {
    return { url: sysProxy, source: 'windows-system-proxy' };
  }

  // 3. 探测常见本地代理端口（Clash / FlClash / v2rayN）
  for (const port of COMMON_PROXY_PORTS) {
    const candidate = `http://127.0.0.1:${port}`;
    if (await probe(candidate)) {
      return { url: candidate, source: `local-port:${port}` };
    }
  }

  return { url: '', source: 'direct' };
}

export function buildChildProxyEnv(baseEnv, proxyUrl) {
  const env = { ...baseEnv };
  if (!proxyUrl) return env;
  const noProxy = 'localhost,127.0.0.1,::1';
  env.HTTP_PROXY = proxyUrl;
  env.HTTPS_PROXY = proxyUrl;
  env.ALL_PROXY = proxyUrl;
  env.NO_PROXY = noProxy;
  env.http_proxy = proxyUrl;
  env.https_proxy = proxyUrl;
  env.all_proxy = proxyUrl;
  env.no_proxy = noProxy;
  return env;
}

export function buildChildProxyArgs(proxyUrl) {
  if (!proxyUrl) return [];
  return [
    `--proxy-server=${proxyUrl}`,
    '--proxy-bypass-list=localhost;127.0.0.1;[::1]'
  ];
}
