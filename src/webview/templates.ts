import type * as vscode from 'vscode';
import type { DashboardData, PresentationMode } from '../types';

export function getEmptyStateHtml(
  webview: vscode.Webview,
  compact: boolean,
  options?: { showOpenPanel?: boolean }
): string {
  const nonce = getNonce();
  const showOpenPanel = options?.showOpenPanel ?? true;
  const title = compact ? 'Code Info 侧边栏' : 'Code Info';
  const subtitle = compact ? '先切到插件加载今日统计，再按需执行项目分析。' : '先切到插件加载今日统计，再打开完整项目分析看板。';
  const openPanelButton = showOpenPanel ? '<button class="secondary" data-command="openPanel">打开看板</button>' : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin: 0; padding: 20px; color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); }
    .card { border: 1px solid var(--vscode-panel-border); border-radius: 14px; padding: 18px; background: var(--vscode-sideBar-background); }
    h1 { font-size: 18px; margin: 0 0 10px; }
    p { color: var(--vscode-descriptionForeground); line-height: 1.5; margin: 0 0 16px; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    button { border: 1px solid var(--vscode-button-border, transparent); border-radius: 8px; padding: 8px 12px; cursor: pointer; background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    button.secondary { background: transparent; color: var(--vscode-textLink-foreground); border-color: var(--vscode-panel-border); }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${subtitle}</p>
    <div class="actions">
      <button data-command="refreshToday">刷新今日统计</button>
      <button data-command="showStats">开始项目分析</button>
      ${openPanelButton}
    </div>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.addEventListener('click', (event) => {
      const element = event.target.closest('[data-command]');
      if (!element) return;
      vscode.postMessage({ command: element.getAttribute('data-command') });
    });
  </script>
</body>
</html>`;
}

export function getDashboardHtml(webview: vscode.Webview, data: DashboardData, presentation: PresentationMode): string {
  const nonce = getNonce();
  const payload = JSON.stringify({ data, presentation })
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Code Info</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: var(--vscode-editor-background);
      --panel: var(--vscode-sideBar-background);
      --panel-2: color-mix(in srgb, var(--panel) 88%, white 12%);
      --border: color-mix(in srgb, var(--vscode-panel-border) 72%, var(--accent) 28%);
      --border-soft: color-mix(in srgb, var(--vscode-panel-border) 84%, var(--accent) 16%);
      --text: var(--vscode-editor-foreground);
      --muted: var(--vscode-descriptionForeground);
      --accent: var(--vscode-textLink-foreground);
      --accent-soft: color-mix(in srgb, var(--accent) 14%, transparent);
      --panel-glow: color-mix(in srgb, var(--accent) 10%, transparent);
      --surface: color-mix(in srgb, var(--panel) 92%, var(--accent) 8%);
      --surface-hover: color-mix(in srgb, var(--panel) 86%, var(--accent) 14%);
      font-family: var(--vscode-font-family);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px;
      background:
        radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 9%, transparent), transparent 28%),
        radial-gradient(circle at left center, color-mix(in srgb, var(--accent) 6%, transparent), transparent 24%),
        var(--bg);
      color: var(--text);
      overflow-x: hidden;
    }
    body.compact { padding: 12px; }
    .page { display: grid; gap: 16px; }
    .hero, .card, .panel {
      position: relative;
      border: 1px solid var(--border-soft);
      border-radius: 14px;
      background: linear-gradient(180deg, color-mix(in srgb, var(--panel) 94%, var(--accent) 6%), var(--panel));
      box-shadow:
        0 0 0 1px color-mix(in srgb, var(--text) 3%, transparent) inset,
        0 10px 24px color-mix(in srgb, black 10%, transparent);
      min-width: 0;
      transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease, background 140ms ease;
    }
    .hero::before, .card::before, .panel::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, transparent), transparent 35%);
      opacity: 0.6;
    }
    .card:hover, .panel:hover, .hero:hover {
      border-color: var(--border);
      background: linear-gradient(180deg, var(--surface-hover), var(--panel));
      box-shadow:
        0 0 0 1px color-mix(in srgb, var(--accent) 10%, transparent) inset,
        0 14px 32px color-mix(in srgb, black 14%, transparent),
        0 0 0 1px var(--panel-glow);
      transform: translateY(-1px);
    }
    .hero { display: flex; justify-content: space-between; gap: 16px; padding: 18px; background: linear-gradient(135deg, var(--surface), var(--panel-2)); }
    .hero h1 { margin: 0; font-size: 20px; }
    .title-row, .section-title, .metric-head, .empty-title {
      display: grid;
      grid-template-columns: 16px minmax(0, 1fr);
      align-items: center;
      column-gap: 10px;
      min-width: 0;
    }
    .ui-icon {
      width: 16px;
      height: 16px;
      min-width: 16px;
      flex: none;
      display: grid;
      place-items: center;
      line-height: 0;
      align-self: center;
    }
    .ui-icon svg {
      width: 16px;
      height: 16px;
      display: block;
      overflow: visible;
      transform: none;
    }
    .title-row { margin-bottom: 8px; }
    .section-title h2,
    .metric-head .metric-label,
    .title-row h1 { margin: 0; }
    .title-row h1,
    .section-title h2,
    .metric-label,
    .action,
    .link-button { line-height: 1.25; }
    .section-title h2,
    .title-row h1,
    .metric-head .metric-label {
      align-self: center;
    }
    .hero p { margin: 0; color: var(--muted); line-height: 1.5; font-size: 13px; }
    .hero-meta { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; align-content: flex-start; }
    .action {
      border: 1px solid color-mix(in srgb, var(--vscode-button-border, var(--border-soft)) 70%, var(--accent) 30%);
      border-radius: 8px;
      background: linear-gradient(180deg, color-mix(in srgb, var(--vscode-button-background) 92%, white 8%), var(--vscode-button-background));
      color: var(--vscode-button-foreground);
      padding: 6px 12px;
      cursor: pointer;
      font: inherit;
      font-size: 13px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
    }
    .action .ui-icon { width: 14px; height: 14px; min-width: 14px; }
    .action .ui-icon svg { width: 14px; height: 14px; transform: none; }
    .action:hover {
      transform: translateY(-1px);
      border-color: var(--border);
      box-shadow: 0 8px 18px color-mix(in srgb, black 12%, transparent);
    }
    .action.secondary {
      background: color-mix(in srgb, var(--panel) 72%, transparent);
      color: var(--accent);
      border-color: var(--border-soft);
    }
    .badge {
      border-radius: 999px;
      padding: 6px 12px;
      background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 16%, transparent), color-mix(in srgb, var(--accent) 10%, transparent));
      color: var(--accent);
      border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
      font-size: 12px;
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 7%, transparent) inset;
    }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; }
    .card, .panel { padding: 16px; }
    .metric-head { color: var(--accent); align-items: center; }
    .metric-head .ui-icon { margin-top: 0; }
    .metric-label, .metric-value, .metric-sub { white-space: normal; overflow-wrap: anywhere; word-break: break-word; }
    .metric-label { font-size: 12px; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 8px; line-height: 1.4; }
    .metric-value { font-size: 24px; font-weight: 600; line-height: 1.25; }
    .metric-sub { margin-top: 8px; font-size: 12px; color: var(--muted); line-height: 1.5; }
    .grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); gap: 16px; }
    .panel h2 { margin: 0 0 6px; font-size: 15px; }
    .section-note { color: var(--muted); font-size: 12px; margin: 0 0 14px; line-height: 1.5; }
    .bars, .legend, .git-bars, .authors, .todo-summary, .tree-list { display: grid; gap: 12px; }
    .bar-row, .git-block { display: grid; gap: 6px; }
    .bar-head, .legend-item, .author-item, .todo-item, .tree-summary { display: flex; justify-content: space-between; gap: 12px; align-items: center; font-size: 13px; flex-wrap: wrap; min-width: 0; }
    .bar-track, .mini-track {
      height: 8px;
      border-radius: 999px;
      overflow: hidden;
      background: color-mix(in srgb, var(--text) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--border-soft) 70%, transparent);
    }
    .bar-fill, .mini-fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 72%, white 28%), var(--accent));
      opacity: 0.92;
      box-shadow: 0 0 18px color-mix(in srgb, var(--accent) 16%, transparent);
    }
    .stack {
      display: flex;
      height: 14px;
      overflow: hidden;
      border-radius: 999px;
      background: color-mix(in srgb, var(--text) 8%, transparent);
      margin-bottom: 14px;
      border: 1px solid color-mix(in srgb, var(--border-soft) 70%, transparent);
    }
    .legend-left, .author-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex: none; }
    .git-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .git-note, .empty-note {
      padding: 12px;
      border-radius: 10px;
      border: 1px dashed var(--border-soft);
      background: color-mix(in srgb, var(--panel) 90%, var(--accent) 10%);
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }
    .table-wrap { overflow-x: auto; width: 100%; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; white-space: nowrap; }
    th, td {
      text-align: left;
      padding: 10px 12px;
      border-bottom: 1px solid color-mix(in srgb, var(--border-soft) 74%, transparent);
      vertical-align: middle;
      transition: background 120ms ease;
    }
    tbody tr:hover td { background: color-mix(in srgb, var(--accent) 7%, transparent); }
    th {
      color: var(--muted);
      font-weight: 600;
      background: color-mix(in srgb, var(--panel) 80%, var(--accent) 20%);
      position: sticky;
      top: 0;
    }
    td.mono {
      font-family: var(--vscode-editor-font-family);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 0;
      min-width: 180px;
    }
    .muted { color: var(--muted); }
    .icon-muted { color: var(--muted); }
    .link-button {
      display: block;
      width: 100%;
      border: 0;
      padding: 0;
      background: transparent;
      color: var(--accent);
      cursor: pointer;
      text-align: left;
      font: inherit;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: color 120ms ease, transform 120ms ease;
    }
    .link-button:hover { color: color-mix(in srgb, var(--accent) 82%, white 18%); transform: translateX(1px); }
    .file-entry { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .file-icon {
      width: 16px;
      height: 16px;
      min-width: 16px;
      flex: none;
      display: grid;
      place-items: center;
      line-height: 0;
      align-self: center;
    }
    .file-icon svg { width: 16px; height: 16px; display: block; overflow: visible; transform: none; }
    details.tree-node {
      border: 1px solid color-mix(in srgb, var(--border-soft) 72%, transparent);
      border-radius: 10px;
      padding: 10px 12px;
      background: color-mix(in srgb, var(--panel) 88%, var(--accent) 12%);
      transition: border-color 120ms ease, background 120ms ease, box-shadow 120ms ease;
    }
    details.tree-node:hover {
      border-color: var(--border);
      background: color-mix(in srgb, var(--panel) 82%, var(--accent) 18%);
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 8%, transparent) inset;
    }
    details.tree-node > summary { cursor: pointer; list-style: none; }
    details.tree-node > summary::-webkit-details-marker { display: none; }
    .tree-children { margin-top: 10px; padding-left: 12px; display: grid; gap: 10px; border-left: 1px dashed color-mix(in srgb, var(--border) 70%, transparent); }
    .tree-files { margin-top: 10px; display: grid; gap: 8px; }
    .tree-files-title { font-size: 12px; color: var(--muted); display:flex; justify-content: space-between; gap: 10px; }
    .tree-file-row { display:flex; align-items:center; justify-content: space-between; gap: 12px; padding: 8px 10px; border: 1px solid color-mix(in srgb, var(--border-soft) 75%, transparent); border-radius: 10px; background: color-mix(in srgb, var(--panel) 92%, transparent); }
    .tree-file-row .file-entry { min-width: 0; }
    .tree-file-row .link-button { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tree-more { padding-left: 4px; }
    body.compact .page { gap: 12px; }
    body.compact .hero { flex-direction: column; padding: 14px; }
    body.compact .grid, body.compact .git-grid { grid-template-columns: 1fr; }
    body.compact .cards { grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); }
    body.compact .metric-value { font-size: 22px; }
    body.compact .card, body.compact .panel { padding: 14px; }
    @media (max-width: 960px) { .grid, .git-grid { grid-template-columns: 1fr; } .hero { flex-direction: column; } }
    @media (max-width: 320px) { .cards { grid-template-columns: 1fr; } }
  </style>
</head>
<body class="${presentation.compact ? 'compact' : ''}">
  <script nonce="${nonce}" id="__codeInfoPayload" type="application/json">${payload}</script>
  <div id="app" class="page"></div>
  <pre id="error" style="display:none;white-space:pre-wrap;padding:12px;border:1px solid var(--border);border-radius:12px;"></pre>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const errorBox = document.getElementById('error');
    const palette = ['#5B8FF9', '#5AD8A6', '#5D7092', '#F6BD16', '#E8684A', '#6DC8EC', '#9270CA', '#FF9D4D', '#269A99', '#FF99C3'];

    function showError(err) {
      if (!errorBox) return;
      errorBox.style.display = 'block';
      errorBox.textContent = String(err && (err.stack || err.message) ? (err.stack || err.message) : err);
    }
    window.addEventListener('error', (event) => showError(event.error || event.message || event));

    let data;
    let presentation;
    try {
      const raw = document.getElementById('__codeInfoPayload')?.textContent || '{}';
      const parsed = JSON.parse(raw);
      data = parsed.data || {};
      presentation = parsed.presentation;
    } catch (err) {
      showError(err);
      data = {};
      presentation = { compact: false, title: 'Code Info', subtitle: '' };
    }

    const projectStats = data.projectStats;
    const todayStats = data.todayStats;
    const app = document.getElementById('app');
    if (!app) {
      showError('Dashboard root not found.');
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
    function numberFormat(value) { return new Intl.NumberFormat('zh-CN').format(value || 0); }
    function bytesFormat(value) {
      if (value < 1024) return value + ' B';
      if (value < 1024 * 1024) return (value / 1024).toFixed(1) + ' KB';
      return (value / 1024 / 1024).toFixed(2) + ' MB';
    }
    function percent(value, total) { return !total ? '0%' : ((value / total) * 100).toFixed(1) + '%'; }
    function ratio(value) { return percent(value, 1); }
    function durationFormat(value) { return value < 1000 ? value + ' ms' : (value / 1000).toFixed(2) + ' s'; }
    function densityFormat(value) { return value === 0 ? '0 / KLOC' : (value * 1000).toFixed(1) + ' / KLOC'; }
    function icon(name, className) {
      const attrs = className ? ' class="' + className + '"' : '';
      const icons = {
        dashboard: '<svg' + attrs + ' viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 3.5h4v4h-4zM9.5 3.5h4v2.5h-4zM9.5 8.5h4v4h-4zM2.5 9.5h4v3h-4z"/></svg>',
        today: '<svg' + attrs + ' viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5h10v8H3z"/><path d="M5 2.5v3M11 2.5v3M3 6.5h10"/><path d="M8 9l1.5 1.5L12 8"/></svg>',
        project: '<svg' + attrs + ' viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4.5h4l1 1h6v6.5h-11z"/><path d="M5 8.5h6M5 11h4"/></svg>',
        refresh: '<svg' + attrs + ' viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4.5V8.5H9"/><path d="M12.4 8.2A5 5 0 1 1 8 3a4.9 4.9 0 0 1 3.2 1.2L13 5.8"/></svg>',
        detail: '<svg' + attrs + ' viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3.5h10v9H3z"/><path d="M5 6h6M5 8.5h6M5 11h4"/></svg>',
        scope: '<svg' + attrs + ' viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 3.5h11v9h-11z"/><path d="M5 6.5h6M6.5 3.5v9"/></svg>',
        export: '<svg' + attrs + ' viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5v7"/><path d="M5.5 7 8 9.5 10.5 7"/><path d="M3 11.5h10v2H3z"/></svg>',
        json: '<svg' + attrs + ' viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5c-1.3 0-2 .7-2 2v1c0 .8-.3 1.3-1 1.5.7.2 1 .7 1 1.5v1c0 1.3.7 2 2 2M10 3.5c1.3 0 2 .7 2 2v1c0 .8.3 1.3 1 1.5-.7.2-1 .7-1 1.5v1c0 1.3-.7 2-2 2"/></svg>',
        csv: '<svg' + attrs + ' viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3.5h10v9H3z"/><path d="M3 6.5h10M3 9.5h10M6.3 3.5v9M9.7 3.5v9"/></svg>',
        language: '<svg' + attrs + ' viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12.5 6.5 4h3l3 8.5"/><path d="M5.1 9.5h5.8"/></svg>',
        composition: '<svg' + attrs + ' viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11M2.8 10.5h10.4"/></svg>',
        module: '<svg' + attrs + ' viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="3.5" width="4" height="4"/><rect x="9.5" y="3.5" width="4" height="4"/><rect x="6" y="9" width="4" height="4"/><path d="M6.5 5.5h3M8 7.5V9"/></svg>',
        tree: '<svg' + attrs + ' viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="4" cy="4" r="1.5"/><circle cx="12" cy="4" r="1.5"/><circle cx="8" cy="12" r="1.5"/><path d="M5.5 4h5M8 5.5v5"/></svg>',
        git: '<svg' + attrs + ' viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="3.5" r="1.5"/><circle cx="11" cy="12.5" r="1.5"/><circle cx="11" cy="6.5" r="1.5"/><path d="M6.5 3.5h3v7.5"/></svg>',
        todo: '<svg' + attrs + ' viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5h10v8H3z"/><path d="M5 7.5h6M5 10h4"/><path d="M5.2 2.8 8 5.5l2.8-2.7"/></svg>',
        files: '<svg' + attrs + ' viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 2.5h5l2 2v9h-7z"/><path d="M9.5 2.5v2h2"/></svg>',
        newFile: '<svg' + attrs + ' viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 2.5h5l2 2v9h-7z"/><path d="M9.5 2.5v2h2M8 7v4M6 9h4"/></svg>',
        deletedFile: '<svg' + attrs + ' viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 2.5h5l2 2v9h-7z"/><path d="M9.5 2.5v2h2"/><path d="M6.2 8.2 9.8 11.8M9.8 8.2 6.2 11.8"/></svg>',
        diff: '<svg' + attrs + ' viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5h3M5.5 3v3"/><path d="M9 11.5h3"/><path d="M3 13.5h10"/></svg>',
        meta: '<svg' + attrs + ' viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="5.5"/><path d="M8 5.2v3.4M8 10.9h.01"/></svg>',
        lines: '<svg' + attrs + ' viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5h8M4 8h8M4 11.5h8"/></svg>',
        comment: '<svg' + attrs + ' viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5h10v6H7l-3 2z"/></svg>',
        average: '<svg' + attrs + ' viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 6 7l2 3 5-6"/><path d="M3 13.5h10"/></svg>'
      };
      return '<span class="ui-icon' + (className ? ' ' + className : '') + '">' + (icons[name] || icons.dashboard) + '</span>';
    }
    function metricCard(label, value, sub, iconName) {
      return '<div class="card"><div class="metric-head">' + icon(iconName || 'dashboard') + '<div class="metric-label">' + escapeHtml(label) + '</div></div><div class="metric-value">' + escapeHtml(value) + '</div><div class="metric-sub">' + escapeHtml(sub) + '</div></div>';
    }
    function getFileIconMeta(language, path) {
      const extension = (path.split('.').pop() || '').toLowerCase();
      const map = {
        typescript: { label: 'TS', color: '#3178C6' },
        typescriptreact: { label: 'TS', color: '#3178C6' },
        javascript: { label: 'JS', color: '#C7A200' },
        javascriptreact: { label: 'JS', color: '#C7A200' },
        python: { label: 'PY', color: '#3572A5' },
        java: { label: 'JV', color: '#B07219' },
        go: { label: 'GO', color: '#007D9C' },
        rust: { label: 'RS', color: '#B7410E' },
        json: { label: '{}', color: '#CB7E00' },
        markdown: { label: 'MD', color: '#519ABA' },
        html: { label: 'HT', color: '#E34C26' },
        css: { label: 'CS', color: '#563D7C' },
        scss: { label: 'SC', color: '#C6538C' },
        yaml: { label: 'YM', color: '#6E7681' },
        vue: { label: 'VU', color: '#41B883' },
        svelte: { label: 'SV', color: '#FF3E00' },
        shellscript: { label: 'SH', color: '#89E051' }
      };
      if (map[language]) {
        return map[language];
      }
      if (extension === 'ts' || extension === 'tsx') return { label: 'TS', color: '#3178C6' };
      if (extension === 'js' || extension === 'jsx') return { label: 'JS', color: '#C7A200' };
      if (extension === 'json') return { label: '{}', color: '#CB7E00' };
      if (extension === 'md') return { label: 'MD', color: '#519ABA' };
      return { label: 'FI', color: '#7A8AA0' };
    }
    function fileTypeIcon(language, path) {
      const meta = getFileIconMeta(language, path);
      return '<span class="file-icon" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" style="color:' + meta.color + '"><path d="M4 2.5h5l3 3v8H4z" fill="color-mix(in srgb, currentColor 12%, transparent)" stroke="currentColor" stroke-width="1.1"/><path d="M9 2.5v3h3" stroke="currentColor" stroke-width="1.1"/><text x="8" y="12" text-anchor="middle" font-size="4.1" font-family="var(--vscode-editor-font-family), var(--vscode-font-family)" fill="currentColor">' + escapeHtml(meta.label) + '</text></svg></span>';
    }
    function fileButton(label, resource, title) {
      const resolvedTitle = title || label;
      return '<button class="link-button" title="' + escapeHtml(resolvedTitle) + '" data-command="openFile" data-resource="' + escapeHtml(resource) + '">' + escapeHtml(label) + '</button>';
    }
    function renderBarList(items, labelKey, valueKey, formatter, emptyText) {
      if (!items || !items.length) return '<div class="empty-note">' + escapeHtml(emptyText) + '</div>';
      const max = items[0]?.[valueKey] ?? 1;
      return items.map((item) => {
        const value = item[valueKey];
        const label = item[labelKey];
        const width = Math.max((value / Math.max(max, 1)) * 100, value > 0 ? 3 : 0);
        return '<div class="bar-row"><div class="bar-head"><span title="' + escapeHtml(label) + '" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%;">' + escapeHtml(label) + '</span><span class="muted">' + formatter(value, item) + '</span></div><div class="bar-track"><div class="bar-fill" style="width:' + width + '%"></div></div></div>';
      }).join('');
    }
    function renderComposition(stats) {
      const items = [
        { label: '代码行', value: stats.totals.codeLines, color: '#5B8FF9' },
        { label: '注释行', value: stats.totals.commentLines, color: '#5AD8A6' },
        { label: '空行', value: stats.totals.blankLines, color: '#5D7092' }
      ];
      const total = Math.max(stats.totals.lines, 1);
      const stack = items.map((item) => '<div style="width:' + ((item.value / total) * 100) + '%;background:' + item.color + '"></div>').join('');
      const legend = items.map((item) => '<div class="legend-item"><div class="legend-left"><span class="dot" style="background:' + item.color + '"></span><span>' + escapeHtml(item.label) + '</span></div><span class="muted">' + numberFormat(item.value) + ' (' + percent(item.value, total) + ')</span></div>').join('');
      return '<div class="stack">' + stack + '</div><div class="legend">' + legend + '</div>';
    }
    function renderGitStats(stats) {
      if (!stats.git.available) return '<div class="git-note">当前工作区没有可读取的 Git 历史，或 Git 命令不可用。</div>';
      const maxCommits = Math.max(...stats.git.weeklyCommits.map((item) => item.commits), 1);
      const bars = stats.git.weeklyCommits.map((item) => {
        const width = item.commits === 0 ? 2 : (item.commits / maxCommits) * 100;
        return '<div class="git-block"><div class="bar-head"><span>' + escapeHtml(item.label) + '</span><span class="muted">' + numberFormat(item.commits) + ' commits</span></div><div class="mini-track"><div class="mini-fill" style="width:' + width + '%"></div></div></div>';
      }).join('');
      const authors = stats.git.topAuthors.length
        ? stats.git.topAuthors.map((item, index) => '<div class="author-item"><div class="author-left"><span class="dot" style="background:' + palette[index % palette.length] + '"></span><span>' + escapeHtml(item.name) + '</span></div><span class="muted">' + numberFormat(item.commits) + ' 次</span></div>').join('')
        : '<div class="muted">最近没有提交记录。</div>';
      return '<div class="git-grid"><div><div class="section-note">' + escapeHtml(stats.git.rangeLabel) + ' · 共 ' + numberFormat(stats.git.totalCommits) + ' 次提交</div><div class="git-bars">' + bars + '</div></div><div><div class="section-note">贡献者 Top 5</div><div class="authors">' + authors + '</div></div></div>';
    }
    function renderTodayFiles(files, emptyText) {
      if (!files || !files.length) return '<div class="empty-note">' + escapeHtml(emptyText) + '</div>';
      return '<div class="table-wrap"><table><thead><tr><th>文件</th><th>语言</th><th>状态</th><th>代码行</th><th>待办数</th><th>更新时间</th></tr></thead><tbody>' +
        files.slice(0, presentation.compact ? 6 : 12).map((file) => '<tr><td class="mono"><div class="file-entry">' + fileTypeIcon(file.language, file.path) + fileButton(file.path, file.resource) + '</div></td><td>' + escapeHtml(file.language) + '</td><td>' + escapeHtml(file.status === 'new' ? '新增' : '修改') + '</td><td>' + numberFormat(file.codeLines) + '</td><td>' + numberFormat(file.todoCounts.total) + '</td><td>' + escapeHtml(file.modifiedAt) + '</td></tr>').join('') +
      '</tbody></table></div>';
    }
    function renderDeletedFiles(files, emptyText) {
      if (!files || !files.length) return '<div class="empty-note">' + escapeHtml(emptyText) + '</div>';
      return '<div class="table-wrap"><table><thead><tr><th>文件</th></tr></thead><tbody>' +
        files.slice(0, presentation.compact ? 6 : 12).map((file) => '<tr><td class="mono">' + escapeHtml(file.path) + '</td></tr>').join('') +
      '</tbody></table></div>';
    }
    function renderLanguageTable(items) {
      return items.slice(0, presentation.compact ? 8 : 12).map((language, index) => '<tr><td><span class="dot" style="background:' + palette[index % palette.length] + '"></span> ' + escapeHtml(language.language) + '</td><td>' + numberFormat(language.files) + '</td><td>' + numberFormat(language.codeLines) + '</td><td>' + bytesFormat(language.bytes) + '</td><td>' + numberFormat(language.todoCount) + '</td></tr>').join('');
    }
    function renderLargestFiles(items) {
      return items.slice(0, presentation.compact ? 5 : 10).map((file) => '<tr><td class="mono"><div class="file-entry">' + fileTypeIcon(file.language, file.path) + fileButton(file.path, file.resource) + '</div></td><td>' + escapeHtml(file.language) + '</td><td>' + numberFormat(file.lines) + '</td><td>' + numberFormat(file.codeLines) + '</td><td>' + numberFormat(file.todoCounts.total) + '</td></tr>').join('');
    }
    function renderTodoSummary(items) {
      if (!items.length) return '<div class="empty-note">暂无 TODO / FIXME / HACK 标记。</div>';
      return '<div class="todo-summary">' + items.map((item) => '<div class="todo-item"><span>' + escapeHtml(item.keyword) + '</span><span class="muted">' + numberFormat(item.count) + '</span></div>').join('') + '</div>';
    }
    function renderTodoHotspots(items) {
      if (!items.length) return '<div class="empty-note">未发现待办热点文件。</div>';
      return '<div class="table-wrap"><table><thead><tr><th>文件</th><th>语言</th><th>总数</th><th>TODO</th><th>FIXME</th><th>HACK</th></tr></thead><tbody>' +
        items.slice(0, presentation.compact ? 5 : 10).map((file) => '<tr><td class="mono"><div class="file-entry">' + fileTypeIcon(file.language, file.path) + fileButton(file.path, file.resource) + '</div></td><td>' + escapeHtml(file.language) + '</td><td>' + numberFormat(file.total) + '</td><td>' + numberFormat(file.todo) + '</td><td>' + numberFormat(file.fixme) + '</td><td>' + numberFormat(file.hack) + '</td></tr>').join('') +
      '</tbody></table></div>';
    }
    function normalizePath(value) {
      return String(value || '').replace(/\\\\/g, '/');
    }
    function buildDirectFileIndex(files) {
      const index = new Map();
      if (!files || !files.length) return index;
      for (const file of files) {
        const filePath = normalizePath(file.path);
        const parts = filePath.split('/').filter(Boolean);
        const dir = parts.length <= 1 ? '(root)' : parts.slice(0, -1).join('/');
        const list = index.get(dir) || [];
        list.push(file);
        index.set(dir, list);
      }
      return index;
    }
    const directFilesByDir = buildDirectFileIndex(projectStats?.files || []);
    function getDirectFilesUnder(directoryPath) {
      const target = normalizePath(directoryPath);
      return directFilesByDir.get(target) || [];
    }
    function renderTreeFiles(directoryPath, depth) {
      const files = getDirectFilesUnder(directoryPath);
      if (!files.length) return '';

      const maxFiles = presentation.compact ? 4 : (depth <= 1 ? 14 : 10);
      const shown = files.slice(0, maxFiles);
      const remaining = Math.max(files.length - shown.length, 0);
      const rows = shown.map((file) => {
        const name = normalizePath(file.path).split('/').pop() || file.path;
        return '<div class="tree-file-row"><div class="file-entry">' +
          fileTypeIcon(file.language, file.path) + fileButton(name, file.resource, file.path) +
        '</div><span class="muted">' + numberFormat(file.codeLines) + ' 行</span></div>';
      }).join('');
      const moreText = remaining > 0 ? '<div class="muted tree-more">… 还有 ' + numberFormat(remaining) + ' 个文件</div>' : '';
      return '<div class="tree-files"><div class="tree-files-title"><span>文件（当前目录）</span><span>' + numberFormat(files.length) + '</span></div>' + rows + moreText + '</div>';
    }
    function renderTreeNodes(nodes, depth) {
      if (!nodes || !nodes.length) return '<div class="empty-note">暂无目录树数据。</div>';
      const maxItems = depth === 0 ? (presentation.compact ? 6 : 14) : (presentation.compact ? 8 : 20);
      const shown = nodes.slice(0, maxItems);
      const remaining = Math.max(nodes.length - shown.length, 0);
      const moreHint = remaining > 0 ? '<div class="muted tree-more">… 还有 ' + numberFormat(remaining) + ' 个子目录</div>' : '';
      return '<div class="tree-list">' + shown.map((node) => {
        const children = node.children && node.children.length ? '<div class="tree-children">' + renderTreeNodes(node.children, depth + 1) + '</div>' : '';
        const files = renderTreeFiles(node.path, depth);
        const content = '<div class="tree-summary"><span>' + escapeHtml(node.path) + '</span><span class="muted">' + numberFormat(node.codeLines) + ' 行 · ' + numberFormat(node.files) + ' 文件</span></div>';
        const hasDetails = (node.children && node.children.length) || files;
        if (!hasDetails) {
          return '<div class="card">' + content + '</div>';
        }
        return '<details class="tree-node" ' + (depth === 0 ? 'open' : '') + '><summary>' + content + '</summary>' + children + files + '</details>';
      }).join('') + moreHint + '</div>';
    }

    const workspaceName = projectStats?.workspaceName || todayStats?.workspaceName || '当前工作区';
    const heroBadges = [];
    if (todayStats) heroBadges.push('<span class="badge">今日变更 ' + numberFormat(todayStats.totals.touchedFiles) + ' 文件</span>');
    if (todayStats) heroBadges.push('<span class="badge">今日新增 ' + numberFormat(todayStats.totals.newFiles) + ' 文件</span>');
    if (todayStats && todayStats.totals.deletedFiles) heroBadges.push('<span class="badge">今日删除 ' + numberFormat(todayStats.totals.deletedFiles) + ' 文件</span>');
    if (projectStats) heroBadges.push('<span class="badge">项目分析 ' + numberFormat(projectStats.totals.files) + ' 文件</span>');
    if (projectStats) heroBadges.push('<span class="badge">项目耗时 ' + escapeHtml(durationFormat(projectStats.analysisMeta.durationMs)) + '</span>');
    const actionsHtml = presentation.compact
      ? '<button class="action" data-command="refreshToday">' + icon('refresh') + '刷新今日统计</button>' +
        '<button class="action secondary" data-command="openPanel">' + icon('detail') + '详情分析</button>'
      : '<button class="action" data-command="refreshToday">' + icon('refresh') + '刷新今日统计</button>' +
        '<button class="action" data-command="showStats">' + icon('project') + '开始项目分析</button>' +
        '<button class="action secondary" data-command="refresh">' + icon('refresh') + '重新分析项目</button>' +
        '<button class="action secondary" data-command="selectScope">' + icon('scope') + '选择目录</button>' +
        '<button class="action secondary" data-command="openPanel">' + icon('detail') + '详细看板</button>' +
        '<button class="action secondary" data-command="exportJson"' + (projectStats ? '' : ' disabled') + '>' + icon('json') + '导出 JSON</button>' +
        '<button class="action secondary" data-command="exportCsv"' + (projectStats ? '' : ' disabled') + '>' + icon('csv') + '导出 CSV</button>';

    let html = '' +
      '<section class="hero">' +
        '<div><div class="title-row">' + icon(presentation.compact ? 'today' : 'dashboard') + '<h1>' + escapeHtml(presentation.title) + '</h1></div><p>' + escapeHtml(presentation.subtitle) + '<br>工作区：' + escapeHtml(workspaceName) + '</p><div class="hero-meta">' + heroBadges.join('') + '</div></div>' +
        '<div class="actions">' + actionsHtml + '</div>' +
      '</section>';

    if (todayStats) {
      html += '' +
        '<section class="panel"><div class="section-title">' + icon('today') + '<h2>今日统计分析</h2></div><div class="section-note">新增/修改基于文件时间戳；删除文件与增删行（如有）基于 Git 今日提交。</div></section>' +
        '<section class="cards">' +
          metricCard('今日变更文件', numberFormat(todayStats.totals.touchedFiles), '今天被修改或新增的文本文件', 'files') +
          metricCard('今日新增文件', numberFormat(todayStats.totals.newFiles), '通过文件创建时间判断的新文件', 'newFile') +
          metricCard('今日删除文件', numberFormat(todayStats.totals.deletedFiles), '基于 Git 今日提交（如可用）', 'deletedFile') +
          metricCard('今日代码变更', '+' + numberFormat(todayStats.totals.addedLines) + ' / -' + numberFormat(todayStats.totals.deletedLines), '基于 Git 今日提交（如可用）', 'diff') +
          metricCard('今日代码行', numberFormat(todayStats.totals.codeLines), '仅统计今日变更文件的当前代码量', 'lines') +
          metricCard('今日待办数', numberFormat(todayStats.totals.todoCount), '变更文件中的 TODO / FIXME / HACK', 'todo') +
          metricCard('主力语言', todayStats.insights.topLanguage, percent(todayStats.insights.topLanguageShare, 1) + ' 占比', 'language') +
          metricCard('最近活跃文件', todayStats.insights.topPath, '按更新时间和代码量排序', 'detail') +
        '</section>' +
        '<section class="grid">' +
          '<div class="panel"><div class="section-title">' + icon('language') + '<h2>今日语言分布</h2></div><div class="section-note">按今日变更文件的代码行统计。</div><div class="bars">' + renderBarList(todayStats.languages.slice(0, presentation.compact ? 6 : 8), 'language', 'codeLines', (value, item) => numberFormat(value) + ' 行 · ' + numberFormat(item.files) + ' 文件', '今日暂无语言数据') + '</div></div>' +
          '<div class="panel"><div class="section-title">' + icon('meta') + '<h2>今日元信息</h2></div><div class="section-note">本模块只在视图可见时刷新，避免长期常驻分析。</div><div class="todo-summary">' +
            '<div class="todo-item"><span>扫描范围</span><span class="muted">' + escapeHtml(todayStats.analysisMeta.scopeSummary) + '</span></div>' +
            '<div class="todo-item"><span>匹配文件</span><span class="muted">' + numberFormat(todayStats.analysisMeta.matchedFiles) + '</span></div>' +
            '<div class="todo-item"><span>今日变更</span><span class="muted">' + numberFormat(todayStats.analysisMeta.analyzedFiles) + '</span></div>' +
            '<div class="todo-item"><span>Git 统计</span><span class="muted">' + (todayStats.analysisMeta.gitAvailable ? ('从 ' + escapeHtml(todayStats.analysisMeta.gitSince || '今日 00:00') + ' 起') : '不可用') + '</span></div>' +
            '<div class="todo-item"><span>耗时</span><span class="muted">' + escapeHtml(durationFormat(todayStats.analysisMeta.durationMs)) + '</span></div>' +
          '</div></div>' +
        '</section>' +
        '<section class="panel"><div class="section-title">' + icon('newFile') + '<h2>今日新增文件</h2></div><div class="section-note">今天首次创建的文件。</div>' + renderTodayFiles(todayStats.newFiles, '今天还没有检测到新增文件。') + '</section>' +
        '<section class="panel"><div class="section-title">' + icon('files') + '<h2>今日变更文件</h2></div><div class="section-note">今天新增或修改过的文件清单，点击文件名可直接打开源码。</div>' + renderTodayFiles(todayStats.touchedFiles, '今天还没有检测到新增或修改过的文件。') + '</section>' +
        '<section class="panel"><div class="section-title">' + icon('deletedFile') + '<h2>今日删除文件</h2></div><div class="section-note">' + (todayStats.analysisMeta.gitAvailable ? '基于 Git 今日提交，仅展示文件路径。' : '当前工作区没有可用的 Git 数据，无法统计删除文件。') + '</div>' + renderDeletedFiles(todayStats.deletedFiles, '今天还没有检测到删除文件。') + '</section>';
    } else {
      html += '<section class="panel"><div class="section-title">' + icon('today') + '<h2>今日统计分析</h2></div><div class="empty-note">当前还没有今日统计数据。切到插件时会自动刷新，也可以手动点击“刷新今日统计”。</div></section>';
    }

    if (!presentation.compact && projectStats) {
      html += '' +
        '<section class="panel"><div class="section-title">' + icon('project') + '<h2>项目分析模块</h2></div><div class="section-note">手动触发的全量项目分析，适合看整体代码规模、目录结构和 Git 活动。</div></section>' +
        '<section class="cards">' +
          metricCard('总文件数', numberFormat(projectStats.totals.files), '参与统计的文本文件', 'files') +
          metricCard('代码行', numberFormat(projectStats.totals.codeLines), '有效代码规模', 'lines') +
          metricCard('注释密度', ratio(projectStats.insights.commentRatio), '注释行 / 代码行', 'comment') +
          metricCard('平均代码行', numberFormat(Math.round(projectStats.insights.averageCodeLinesPerFile)), '每个文件的平均代码行', 'average') +
          metricCard('待办总数', numberFormat(projectStats.insights.totalTodoCount), 'TODO / FIXME / HACK', 'todo') +
          metricCard('待办密度', densityFormat(projectStats.insights.todoDensity), '每千行代码的待办数', 'dashboard') +
          metricCard('主力语言', projectStats.insights.topLanguage, percent(projectStats.insights.topLanguageShare, 1) + ' 代码占比', 'language') +
          metricCard('核心模块', projectStats.insights.topDirectory, '当前代码量最高的模块', 'module') +
        '</section>' +
        '<section class="grid">' +
          '<div class="panel"><div class="section-title">' + icon('language') + '<h2>语言代码量排行</h2></div><div class="section-note">按有效代码行数倒序。</div><div class="bars">' + renderBarList(projectStats.languages.slice(0, presentation.compact ? 6 : 8), 'language', 'codeLines', (value, item) => numberFormat(value) + ' 行 · ' + numberFormat(item.files) + ' 文件', '暂无语言数据') + '</div></div>' +
          '<div class="panel"><div class="section-title">' + icon('composition') + '<h2>代码组成</h2></div><div class="section-note">区分代码、注释与空白占比。</div>' + renderComposition(projectStats) + '</div>' +
        '</section>' +
        '<section class="grid">' +
          '<div class="panel"><div class="section-title">' + icon('module') + '<h2>模块代码量排行</h2></div><div class="section-note">按目录深度聚合，可配合 codeInfo.analysis.moduleDepth 调整。</div><div class="bars">' + renderBarList(projectStats.directories.slice(0, presentation.compact ? 6 : 8), 'path', 'codeLines', (value, item) => numberFormat(value) + ' 行 · ' + numberFormat(item.files) + ' 文件', '暂无模块数据') + '</div></div>' +
          '<div class="panel"><div class="section-title">' + icon('todo') + '<h2>待办摘要</h2></div><div class="section-note">仅统计注释中的 TODO / FIXME / HACK 标记。</div>' + renderTodoSummary(projectStats.todoSummary) + '</div>' +
        '</section>' +
        '<section class="panel"><div class="section-title">' + icon('tree') + '<h2>模块目录树</h2></div><div class="section-note">支持逐层展开到最深目录，并展示当前目录下的文件（点击文件名可打开）。</div>' + renderTreeNodes(projectStats.directoryTree, 0) + '</section>' +
        '<section class="panel"><div class="section-title">' + icon('git') + '<h2>Git 提交趋势</h2></div><div class="section-note">基于当前工作区首个目录的 Git 历史。</div>' + renderGitStats(projectStats) + '</section>' +
        '<section class="panel"><div class="section-title">' + icon('todo') + '<h2>待办热点文件</h2></div><div class="section-note">点击文件名可直接打开源码定位待办。</div>' + renderTodoHotspots(projectStats.todoHotspots) + '</section>' +
        '<section class="panel"><div class="section-title">' + icon('language') + '<h2>语言统计明细</h2></div><div class="table-wrap"><table><thead><tr><th>语言</th><th>文件数</th><th>代码行</th><th>体积</th><th>待办数</th></tr></thead><tbody>' + renderLanguageTable(projectStats.languages) + '</tbody></table></div></section>' +
        '<section class="panel"><div class="section-title">' + icon('files') + '<h2>最大文件排行</h2></div><div class="section-note">点击文件名可直接打开源码。</div><div class="table-wrap"><table><thead><tr><th>文件</th><th>语言</th><th>总行数</th><th>代码行</th><th>待办数</th></tr></thead><tbody>' + renderLargestFiles(projectStats.largestFiles) + '</tbody></table></div></section>';
    } else if (!presentation.compact) {
      html += '<section class="panel"><div class="section-title">' + icon('project') + '<h2>项目分析模块</h2></div><div class="empty-note">当前还没有项目分析结果。点击“开始项目分析”后，会执行全量扫描并展示完整的项目级数据。</div></section>';
    }

    app.innerHTML = html;
    document.addEventListener('click', (event) => {
      const element = event.target.closest('[data-command]');
      if (!element) return;
      if (element.hasAttribute('disabled')) return;
      vscode.postMessage({
        command: element.getAttribute('data-command'),
        resource: element.getAttribute('data-resource') || undefined
      });
    });
  </script>
</body>
</html>`;
}

function getNonce(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  for (let index = 0; index < 32; index += 1) {
    value += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return value;
}
