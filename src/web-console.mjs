import http from 'node:http';
import {
  DEFAULT_DICT_DIR,
  deleteUserCustomEntry,
  loadDictionaries,
  loadUserCustomEntries,
  upsertUserCustomEntry
} from './dict-loader.mjs';

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8') || '{}';
        resolve(JSON.parse(text));
      } catch (err) {
        reject(new Error('JSON 格式错误'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function renderHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Antigravity 2.0 无损汉化控制台</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0f1117;
      --panel: #171a23;
      --border: #282d3d;
      --text: #e6e9f2;
      --muted: #9aa3b8;
      --accent: #4f8cff;
      --accent-hover: #6aa0ff;
      --ok: #34d399;
      --warn: #fbbf24;
      --danger: #f87171;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    .wrap { max-width: 1080px; margin: 0 auto; padding: 24px 20px 48px; }
    header {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
      gap: 16px; padding-bottom: 18px; border-bottom: 1px solid var(--border);
    }
    h1 { margin: 0; font-size: 22px; }
    .sub { color: var(--muted); font-size: 13px; margin-top: 4px; }
    .toolbar { display: flex; gap: 10px; align-items: center; }
    button {
      background: var(--accent); color: #fff; border: none; border-radius: 8px;
      padding: 8px 14px; font-size: 14px; cursor: pointer; font-weight: 500;
    }
    button:hover { background: var(--accent-hover); }
    button.secondary { background: #262c3d; color: var(--text); }
    button.secondary:hover { background: #31394f; }
    button.danger { background: #5a232a; color: #fecaca; }
    button.danger:hover { background: #752c35; }
    .grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px; margin: 20px 0;
    }
    .card {
      background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
      padding: 16px;
    }
    .card-label { color: var(--muted); font-size: 12px; }
    .card-val { font-size: 24px; font-weight: 700; margin-top: 4px; }
    .badge {
      display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px;
      border-radius: 999px; font-size: 12px; font-weight: 600;
    }
    .badge.ok { background: rgba(52,211,153,.15); color: var(--ok); }
    .badge.warn { background: rgba(251,191,36,.15); color: var(--warn); }
    .section {
      background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
      padding: 18px; margin-top: 18px;
    }
    .section-head {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
      gap: 10px; margin-bottom: 14px;
    }
    .section h2 { margin: 0; font-size: 16px; }
    input[type="text"] {
      background: #0d1016; border: 1px solid var(--border); color: var(--text);
      border-radius: 8px; padding: 8px 10px; font-size: 13px;
    }
    .row-form { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
    .row-form input { flex: 1; min-width: 200px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 9px 10px; border-bottom: 1px solid var(--border); }
    th { color: var(--muted); font-weight: 600; }
    code { background: #0d1016; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
    .muted { color: var(--muted); }
    .toast {
      position: fixed; right: 20px; bottom: 20px; background: #232838;
      border: 1px solid var(--accent); color: var(--text); padding: 10px 16px;
      border-radius: 10px; display: none; box-shadow: 0 10px 30px rgba(0,0,0,.4);
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div>
        <h1>Antigravity 2.0 无损汉化控制台</h1>
        <div class="sub">零侵入 CDP 动态渲染层汉化 · 词库修改实时热生效 · 不修改任何官方安装文件</div>
      </div>
      <div class="toolbar">
        <button id="toggleBtn">切换中/英文</button>
        <button class="secondary" id="reloadDictBtn">重新加载词库</button>
        <button class="secondary" id="refreshBtn">刷新状态</button>
      </div>
    </header>

    <div class="grid">
      <div class="card">
        <div class="card-label">汉化状态</div>
        <div class="card-val" id="enabledStatus">-</div>
      </div>
      <div class="card">
        <div class="card-label">CDP 连接状态</div>
        <div class="card-val" id="cdpStatus">-</div>
      </div>
      <div class="card">
        <div class="card-label">已挂载窗口数</div>
        <div class="card-val" id="targetCount">0</div>
      </div>
      <div class="card">
        <div class="card-label">词库规模（精确 + 正则）</div>
        <div class="card-val" id="dictCount">0</div>
      </div>
    </div>

    <div class="section">
      <div class="section-head">
        <h2>1. 已挂载的 Antigravity 2.0 渲染目标</h2>
        <span class="muted" id="endpointText"></span>
      </div>
      <table>
        <thead><tr><th>窗口标题</th><th>类型</th><th>已汉化文本节点</th><th>已汉化属性</th></tr></thead>
        <tbody id="targetsBody"><tr><td colspan="4" class="muted">加载中...</td></tr></tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-head">
        <h2>2. 新版本快速适配：扫描当前界面未翻译英文</h2>
        <button id="scanBtn">扫描当前界面</button>
      </div>
      <div class="sub" style="margin-bottom:12px;">
        仅采集按钮、菜单、标签、标题和提示占位符等 UI 控件，自动跳过代码区和对话正文。填好中文点“录入”即可实时生效并写入 <code>dict/user-custom.json</code>。
      </div>
      <table>
        <thead><tr><th>英文原文</th><th>控件类型</th><th>译文输入</th><th>操作</th></tr></thead>
        <tbody id="scanBody"><tr><td colspan="4" class="muted">点击右上角“扫描当前界面”即可捕获 Antigravity 2.0 新增未汉化词条。</td></tr></tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-head">
        <h2>3. 自定义词库管理（<code>dict/user-custom.json</code>，优先级最高）</h2>
        <input type="text" id="searchInput" placeholder="搜索自定义词条..." />
      </div>
      <form class="row-form" id="addForm">
        <input type="text" id="srcInput" placeholder="英文原文，例如：Scheduled Tasks" required />
        <input type="text" id="dstInput" placeholder="中文译文，例如：定时任务" required />
        <button type="submit">添加 / 覆盖并立即生效</button>
      </form>
      <table>
        <thead><tr><th>英文原文</th><th>中文译文</th><th style="width:100px;">操作</th></tr></thead>
        <tbody id="customBody"><tr><td colspan="3" class="muted">暂无自定义词条</td></tr></tbody>
      </table>
    </div>
  </div>
  <div class="toast" id="toast"></div>

  <script>
    let currentEnabled = true;
    let customEntries = {};

    function showToast(msg) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.style.display = 'block';
      clearTimeout(window.__toastTimer);
      window.__toastTimer = setTimeout(() => { el.style.display = 'none'; }, 2400);
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    async function api(path, opts = {}) {
      const resp = await fetch(path, {
        headers: { 'Content-Type': 'application/json' },
        ...opts
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || '请求失败');
      return data;
    }

    async function loadStatus() {
      const data = await api('/api/status');
      currentEnabled = data.enabled;
      document.getElementById('enabledStatus').innerHTML = data.enabled
        ? '<span class="badge ok">已开启中文</span>'
        : '<span class="badge warn">已暂停（原版英文）</span>';
      document.getElementById('toggleBtn').textContent = data.enabled ? '暂停汉化（切回英文）' : '开启中文汉化';
      document.getElementById('cdpStatus').innerHTML = data.cdpReachable
        ? '<span class="badge ok">已连接</span>'
        : '<span class="badge warn">等待连接</span>';
      document.getElementById('targetCount').textContent = String(data.attachedCount);
      document.getElementById('dictCount').textContent =
        data.dictStats.totalEntries + ' + ' + data.dictStats.totalPatterns;
      document.getElementById('endpointText').textContent = 'CDP: ' + data.cdpEndpoint;

      const tbody = document.getElementById('targetsBody');
      if (!data.targets.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="muted">尚未检测到运行中的 Antigravity 2.0 调试窗口</td></tr>';
      } else {
        tbody.innerHTML = data.targets.map((t) =>
          '<tr><td>' + escapeHtml(t.title) + '</td><td><code>' + escapeHtml(t.type) +
          '</code></td><td>' + t.translatedTexts + '</td><td>' + t.translatedAttrs + '</td></tr>'
        ).join('');
      }
    }

    async function loadCustom() {
      const data = await api('/api/custom');
      customEntries = data.entries || {};
      renderCustomTable();
    }

    function renderCustomTable() {
      const q = document.getElementById('searchInput').value.trim().toLowerCase();
      const rows = Object.entries(customEntries).filter(([k, v]) =>
        !q || k.toLowerCase().includes(q) || v.toLowerCase().includes(q)
      );
      const tbody = document.getElementById('customBody');
      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="muted">暂无自定义词条</td></tr>';
        return;
      }
      tbody.innerHTML = rows.map(([k, v]) =>
        '<tr><td><code>' + escapeHtml(k) + '</code></td><td>' + escapeHtml(v) +
        '</td><td><button class="danger" data-del="' + escapeHtml(k) + '">删除</button></td></tr>'
      ).join('');
    }

    document.getElementById('toggleBtn').addEventListener('click', async () => {
      await api('/api/toggle', { method: 'POST', body: JSON.stringify({ enabled: !currentEnabled }) });
      await loadStatus();
      showToast(currentEnabled ? '已开启中文汉化' : '已无损切回原版英文');
    });

    document.getElementById('reloadDictBtn').addEventListener('click', async () => {
      await api('/api/reload', { method: 'POST' });
      await Promise.all([loadStatus(), loadCustom()]);
      showToast('已重新加载全部词库并热推送到窗口');
    });

    document.getElementById('refreshBtn').addEventListener('click', () => {
      loadStatus().then(() => showToast('状态已刷新'));
    });

    document.getElementById('addForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const source = document.getElementById('srcInput').value.trim();
      const target = document.getElementById('dstInput').value.trim();
      if (!source || !target) return;
      await api('/api/custom', { method: 'POST', body: JSON.stringify({ source, target }) });
      document.getElementById('srcInput').value = '';
      document.getElementById('dstInput').value = '';
      await Promise.all([loadCustom(), loadStatus()]);
      showToast('已保存并实时生效：' + source + ' -> ' + target);
    });

    document.getElementById('customBody').addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-del]');
      if (!btn) return;
      const source = btn.getAttribute('data-del');
      await api('/api/custom', { method: 'DELETE', body: JSON.stringify({ source }) });
      await Promise.all([loadCustom(), loadStatus()]);
      showToast('已删除自定义词条：' + source);
    });

    document.getElementById('searchInput').addEventListener('input', renderCustomTable);

    document.getElementById('scanBtn').addEventListener('click', async () => {
      const tbody = document.getElementById('scanBody');
      tbody.innerHTML = '<tr><td colspan="4" class="muted">正在扫描窗口...</td></tr>';
      try {
        const data = await api('/api/collect');
        const items = data.items || [];
        if (!items.length) {
          tbody.innerHTML = '<tr><td colspan="4" class="muted">当前窗口未发现待翻译的 UI 英文词条（或窗口尚未连接）。</td></tr>';
          return;
        }
        tbody.innerHTML = items.map((item, idx) =>
          '<tr><td><code>' + escapeHtml(item.text) + '</code></td>' +
          '<td><code>' + escapeHtml(item.hint) + '</code> ×' + item.count + '</td>' +
          '<td><input type="text" id="tr_' + idx + '" placeholder="输入中文译文..." style="width:100%;" /></td>' +
          '<td><button data-save-idx="' + idx + '" data-src="' + escapeHtml(item.text) + '">录入</button></td></tr>'
        ).join('');
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="4" class="muted">扫描失败：' + escapeHtml(err.message) + '</td></tr>';
      }
    });

    document.getElementById('scanBody').addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-save-idx]');
      if (!btn) return;
      const idx = btn.getAttribute('data-save-idx');
      const source = btn.getAttribute('data-src');
      const input = document.getElementById('tr_' + idx);
      const target = input ? input.value.trim() : '';
      if (!target) {
        showToast('请先输入中文译文');
        return;
      }
      await api('/api/custom', { method: 'POST', body: JSON.stringify({ source, target }) });
      btn.closest('tr').remove();
      await Promise.all([loadCustom(), loadStatus()]);
      showToast('已录入并热生效：' + source + ' -> ' + target);
    });

    loadStatus();
    loadCustom();
    setInterval(loadStatus, 4000);
  </script>
</body>
</html>`;
}

export function startWebConsole({ manager, port, dictDir = DEFAULT_DICT_DIR, logger = console }) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);

    try {
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderHtml());
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/status') {
        const status = await manager.getStatus();
        sendJson(res, 200, status);
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/toggle') {
        const body = await readJsonBody(req);
        await manager.setEnabled(Boolean(body.enabled));
        sendJson(res, 200, { ok: true, enabled: manager.enabled });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/reload') {
        const bundle = loadDictionaries(dictDir);
        await manager.updateDictionaries(bundle);
        sendJson(res, 200, { ok: true, stats: bundle.stats });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/collect') {
        const items = await manager.collectUntranslatedAll();
        sendJson(res, 200, { items });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/custom') {
        sendJson(res, 200, { entries: loadUserCustomEntries(dictDir) });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/custom') {
        const body = await readJsonBody(req);
        const entries = upsertUserCustomEntry(body.source, body.target, dictDir);
        const bundle = loadDictionaries(dictDir);
        await manager.updateDictionaries(bundle);
        sendJson(res, 200, { ok: true, entries });
        return;
      }

      if (req.method === 'DELETE' && url.pathname === '/api/custom') {
        const body = await readJsonBody(req);
        const entries = deleteUserCustomEntry(body.source, dictDir);
        const bundle = loadDictionaries(dictDir);
        await manager.updateDictionaries(bundle);
        sendJson(res, 200, { ok: true, entries });
        return;
      }

      sendJson(res, 404, { error: 'Not Found' });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
  });

  return new Promise((resolve) => {
    server.on('error', (err) => {
      logger.warn(`[管理面板] 端口 ${port} 监听失败（可能已有实例运行）: ${err.message}`);
      resolve(null);
    });
    server.listen(port, '127.0.0.1', () => {
      logger.log(`[管理面板] 已就绪: http://127.0.0.1:${port}`);
      resolve(server);
    });
  });
}
