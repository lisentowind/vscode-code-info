import type * as vscode from 'vscode';
import type { PresentationMode, WorkspaceStats } from '../types';

export function getEmptyStateHtml(
  webview: vscode.Webview,
  compact: boolean,
  options?: { showOpenPanel?: boolean }
): string {
  const nonce = getNonce();
  const showOpenPanel = options?.showOpenPanel ?? true;
  const title = compact ? 'Code Info 侧边栏' : 'Code Info';
  const subtitle = compact ? '先运行一次分析，再在这里查看概览。' : '先运行一次分析，再查看详细统计面板。';
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
      <button data-command="showStats">开始分析</button>
      <button class="secondary" data-command="selectScope">选择目录</button>
      ${openPanelButton}
    </div>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.addEventListener('click', (event) => {
      const element = event.target.closest('[data-command]');
      if (!element) {
        return;
      }
      vscode.postMessage({ command: element.getAttribute('data-command') });
    });
  </script>
</body>
</html>`;
}

export function getDashboardHtml(webview: vscode.Webview, stats: WorkspaceStats, presentation: PresentationMode): string {
  const nonce = getNonce();
  const payload = JSON.stringify({ stats, presentation })
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
      --border: var(--vscode-panel-border);
      --text: var(--vscode-editor-foreground);
      --muted: var(--vscode-descriptionForeground);
      --accent: var(--vscode-textLink-foreground);
      --accent-soft: color-mix(in srgb, var(--accent) 16%, transparent);
      font-family: var(--vscode-font-family);
    }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 20px; background: var(--bg); color: var(--text); overflow-x: hidden; }
    body.compact { padding: 12px; }
    .page { display: grid; gap: 16px; }
    .hero, .card, .panel {
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--panel);
      min-width: 0;
    }
    .hero {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      padding: 18px;
      background: linear-gradient(135deg, var(--panel), var(--panel-2));
    }
    .hero h1 { margin: 0 0 8px; font-size: 20px; }
    .hero p { margin: 0; color: var(--muted); line-height: 1.5; font-size: 13px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .action {
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 6px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      padding: 6px 12px;
      cursor: pointer;
      font: inherit;
      font-size: 13px;
    }
    .action.secondary {
      background: transparent;
      color: var(--accent);
      border-color: var(--border);
    }
    .badges { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    .badge {
      border-radius: 999px;
      padding: 6px 12px;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 12px;
      max-width: 100%;
    }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; }
    .card, .panel { padding: 16px; }
    .metric-label { font-size: 12px; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 8px; }
    .metric-value { font-size: 24px; font-weight: 600; }
    .metric-sub { margin-top: 8px; font-size: 12px; color: var(--muted); line-height: 1.5; }
    .grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); gap: 16px; }
    .panel h2 { margin: 0 0 6px; font-size: 15px; }
    .section-note { color: var(--muted); font-size: 12px; margin: 0 0 14px; line-height: 1.5; }
    .bars, .legend, .git-bars, .authors, .todo-summary { display: grid; gap: 12px; }
    .bar-row, .git-block { display: grid; gap: 6px; }
    .bar-head, .legend-item, .author-item, .todo-item {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      font-size: 13px;
      flex-wrap: wrap;
      min-width: 0;
    }
    .bar-track, .mini-track {
      height: 8px;
      border-radius: 999px;
      overflow: hidden;
      background: color-mix(in srgb, var(--text) 8%, transparent);
    }
    .bar-fill, .mini-fill { height: 100%; border-radius: inherit; background: var(--accent); opacity: 0.85; }
    .stack {
      display: flex;
      height: 14px;
      overflow: hidden;
      border-radius: 999px;
      background: color-mix(in srgb, var(--text) 8%, transparent);
      margin-bottom: 14px;
    }
    .legend-left, .author-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex: none; }
    .git-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .git-note {
      padding: 12px;
      border-radius: 8px;
      border: 1px dashed var(--border);
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }
    .table-wrap { overflow-x: auto; width: 100%; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; white-space: nowrap; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent); vertical-align: top; }
    th { color: var(--muted); font-weight: 600; }
    td.mono { font-family: var(--vscode-editor-font-family); white-space: normal; word-break: break-all; min-width: 160px; }
    .muted { color: var(--muted); }
    .link-button {
      border: 0;
      padding: 0;
      background: transparent;
      color: var(--accent);
      cursor: pointer;
      text-align: left;
      font: inherit;
      word-break: break-all;
    }
    .empty-note {
      padding: 12px;
      border-radius: 8px;
      border: 1px dashed var(--border);
      color: var(--muted);
      font-size: 13px;
    }
    body.compact .page { gap: 12px; }
    body.compact .hero { flex-direction: column; padding: 14px; gap: 12px; }
    body.compact .grid, body.compact .git-grid { grid-template-columns: 1fr; }
    body.compact .cards { grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); }
    body.compact .action { padding: 6px 10px; }
    body.compact .metric-value { font-size: 22px; }
    body.compact .card, body.compact .panel { padding: 14px; }
    @media (max-width: 960px) {
      .grid, .git-grid { grid-template-columns: 1fr; }
      .hero { flex-direction: column; }
    }
    @media (max-width: 320px) {
      .cards { grid-template-columns: 1fr; }
    }
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
      if (!errorBox) {
        return;
      }
      errorBox.style.display = 'block';
      errorBox.textContent = String(err && (err.stack || err.message) ? (err.stack || err.message) : err);
    }

    window.addEventListener('error', (event) => {
      showError(event.error || event.message || event);
    });

    let stats;
    let presentation;
    try {
      const raw = document.getElementById('__codeInfoPayload')?.textContent || '{}';
      const parsed = JSON.parse(raw);
      stats = parsed.stats;
      presentation = parsed.presentation;
    } catch (err) {
      showError(err);
      stats = undefined;
      presentation = { compact: false, title: 'Code Info', subtitle: '' };
    }

    const app = document.getElementById('app');
    if (!stats || !app) {
      showError('No stats payload. Try running Analyze again.');
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function numberFormat(value) {
      return new Intl.NumberFormat('zh-CN').format(value);
    }

    function bytesFormat(value) {
      if (value < 1024) return value + ' B';
      if (value < 1024 * 1024) return (value / 1024).toFixed(1) + ' KB';
      return (value / 1024 / 1024).toFixed(2) + ' MB';
    }

    function percent(value, total) {
      if (!total) return '0%';
      return ((value / total) * 100).toFixed(1) + '%';
    }

    function durationFormat(value) {
      if (value < 1000) return value + ' ms';
      return (value / 1000).toFixed(2) + ' s';
    }

    function densityFormat(value) {
      return value === 0 ? '0 / KLOC' : (value * 1000).toFixed(1) + ' / KLOC';
    }

    function metricCard(label, value, sub) {
      return '<div class="card">' +
        '<div class="metric-label">' + escapeHtml(label) + '</div>' +
        '<div class="metric-value">' + escapeHtml(value) + '</div>' +
        '<div class="metric-sub">' + escapeHtml(sub) + '</div>' +
      '</div>';
    }

    function fileButton(path, resource) {
      return '<button class="link-button" data-command="openFile" data-resource="' + escapeHtml(resource) + '">' + escapeHtml(path) + '</button>';
    }

    function renderBarList(items, valueKey, formatter, emptyText) {
      if (!items.length) {
        return '<div class="empty-note">' + escapeHtml(emptyText) + '</div>';
      }

      const max = items[0]?.[valueKey] ?? 1;
      return items.map((item) => {
        const value = item[valueKey];
        const width = Math.max((value / Math.max(max, 1)) * 100, value > 0 ? 3 : 0);
        return '<div class="bar-row">' +
          '<div class="bar-head"><span>' + escapeHtml(item.path || item.language || item.keyword) + '</span><span class="muted">' + formatter(value, item) + '</span></div>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + width + '%"></div></div>' +
        '</div>';
      }).join('');
    }

    function renderComposition() {
      const items = [
        { label: '代码行', value: stats.totals.codeLines, color: '#5B8FF9' },
        { label: '注释行', value: stats.totals.commentLines, color: '#5AD8A6' },
        { label: '空行', value: stats.totals.blankLines, color: '#5D7092' }
      ];
      const total = Math.max(stats.totals.lines, 1);
      const stack = items.map((item) => '<div style="width:' + ((item.value / total) * 100) + '%;background:' + item.color + '"></div>').join('');
      const legend = items.map((item) => {
        return '<div class="legend-item">' +
          '<div class="legend-left"><span class="dot" style="background:' + item.color + '"></span><span>' + escapeHtml(item.label) + '</span></div>' +
          '<span class="muted">' + numberFormat(item.value) + ' (' + percent(item.value, total) + ')</span>' +
        '</div>';
      }).join('');

      return '<div class="stack">' + stack + '</div><div class="legend">' + legend + '</div>';
    }

    function renderGitStats() {
      if (!stats.git.available) {
        return '<div class="git-note">当前工作区没有可读取的 Git 历史，或 Git 命令不可用。</div>';
      }

      const maxCommits = Math.max(...stats.git.weeklyCommits.map((item) => item.commits), 1);
      const bars = stats.git.weeklyCommits.map((item) => {
        const width = item.commits === 0 ? 2 : (item.commits / maxCommits) * 100;
        return '<div class="git-block">' +
          '<div class="bar-head"><span>' + escapeHtml(item.label) + '</span><span class="muted">' + numberFormat(item.commits) + ' commits</span></div>' +
          '<div class="mini-track"><div class="mini-fill" style="width:' + width + '%"></div></div>' +
        '</div>';
      }).join('');

      const authors = stats.git.topAuthors.length
        ? stats.git.topAuthors.map((item, index) => '<div class="author-item">' +
            '<div class="author-left"><span class="dot" style="background:' + palette[index % palette.length] + '"></span><span>' + escapeHtml(item.name) + '</span></div>' +
            '<span class="muted">' + numberFormat(item.commits) + ' 次</span>' +
          '</div>').join('')
        : '<div class="muted">最近没有提交记录。</div>';

      return '<div class="git-grid">' +
        '<div><div class="section-note">' + escapeHtml(stats.git.rangeLabel) + ' · 共 ' + numberFormat(stats.git.totalCommits) + ' 次提交</div><div class="git-bars">' + bars + '</div></div>' +
        '<div><div class="section-note">贡献者 Top 5</div><div class="authors">' + authors + '</div></div>' +
      '</div>';
    }

    function renderLanguageTable(items) {
      return items.slice(0, presentation.compact ? 8 : 12).map((language, index) => '<tr>' +
        '<td><span class="dot" style="background:' + palette[index % palette.length] + '"></span> ' + escapeHtml(language.language) + '</td>' +
        '<td>' + numberFormat(language.files) + '</td>' +
        '<td>' + numberFormat(language.codeLines) + '</td>' +
        '<td>' + bytesFormat(language.bytes) + '</td>' +
        '<td>' + numberFormat(language.todoCount) + '</td>' +
      '</tr>').join('');
    }

    function renderLargestFiles(items) {
      return items.slice(0, presentation.compact ? 5 : 10).map((file) => '<tr>' +
        '<td class="mono">' + fileButton(file.path, file.resource) + '</td>' +
        '<td>' + escapeHtml(file.language) + '</td>' +
        '<td>' + numberFormat(file.lines) + '</td>' +
        '<td>' + numberFormat(file.codeLines) + '</td>' +
        '<td>' + numberFormat(file.todoCounts.total) + '</td>' +
      '</tr>').join('');
    }

    function renderTodoSummary(items) {
      if (!items.length) {
        return '<div class="empty-note">暂无 TODO / FIXME / HACK 标记。</div>';
      }

      return '<div class="todo-summary">' + items.map((item) => '<div class="todo-item">' +
        '<span>' + escapeHtml(item.keyword) + '</span>' +
        '<span class="muted">' + numberFormat(item.count) + '</span>' +
      '</div>').join('') + '</div>';
    }

    function renderTodoHotspots(items) {
      if (!items.length) {
        return '<div class="empty-note">未发现待办热点文件。</div>';
      }

      return '<div class="table-wrap"><table>' +
        '<thead><tr><th>文件</th><th>语言</th><th>总数</th><th>TODO</th><th>FIXME</th><th>HACK</th></tr></thead>' +
        '<tbody>' + items.slice(0, presentation.compact ? 5 : 10).map((file) => '<tr>' +
          '<td class="mono">' + fileButton(file.path, file.resource) + '</td>' +
          '<td>' + escapeHtml(file.language) + '</td>' +
          '<td>' + numberFormat(file.total) + '</td>' +
          '<td>' + numberFormat(file.todo) + '</td>' +
          '<td>' + numberFormat(file.fixme) + '</td>' +
          '<td>' + numberFormat(file.hack) + '</td>' +
        '</tr>').join('') + '</tbody>' +
      '</table></div>';
    }

    app.innerHTML = '' +
      '<section class="hero">' +
        '<div>' +
          '<h1>' + escapeHtml(presentation.title) + '</h1>' +
          '<p>' + escapeHtml(presentation.subtitle) + '<br>生成时间：' + escapeHtml(stats.generatedAt) + '</p>' +
          '<div class="badges">' +
            '<span class="badge">范围：' + escapeHtml(stats.analysisMeta.scopeSummary) + '</span>' +
            '<span class="badge">分析 ' + numberFormat(stats.analysisMeta.analyzedFiles) + ' / ' + numberFormat(stats.analysisMeta.matchedFiles) + ' 文件</span>' +
            '<span class="badge">跳过二进制 ' + numberFormat(stats.analysisMeta.skippedBinaryFiles) + '</span>' +
            '<span class="badge">耗时 ' + escapeHtml(durationFormat(stats.analysisMeta.durationMs)) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="actions">' +
          '<button class="action" data-command="refresh">重新分析</button>' +
          '<button class="action secondary" data-command="selectScope">选择目录</button>' +
          '<button class="action secondary" data-command="openPanel">详细看板</button>' +
          '<button class="action secondary" data-command="exportJson">导出 JSON</button>' +
          '<button class="action secondary" data-command="exportCsv">导出 CSV</button>' +
        '</div>' +
      '</section>' +
      '<section class="cards">' +
        metricCard('总文件数', numberFormat(stats.totals.files), '参与统计的文本文件') +
        metricCard('代码行', numberFormat(stats.totals.codeLines), '有效代码规模') +
        metricCard('注释密度', percent(stats.insights.commentRatio, 1), '注释行 / 代码行') +
        metricCard('平均代码行', numberFormat(Math.round(stats.insights.averageCodeLinesPerFile)), '每个文件的平均代码行') +
        metricCard('待办总数', numberFormat(stats.insights.totalTodoCount), 'TODO / FIXME / HACK') +
        metricCard('待办密度', densityFormat(stats.insights.todoDensity), '每千行代码的待办数') +
        metricCard('主力语言', stats.insights.topLanguage, percent(stats.insights.topLanguageShare, 1) + ' 代码占比') +
        metricCard('核心模块', stats.insights.topDirectory, '当前代码量最高的模块') +
      '</section>' +
      '<section class="grid">' +
        '<div class="panel">' +
          '<h2>语言代码量排行</h2>' +
          '<div class="section-note">按有效代码行数倒序，快速判断主要技术栈。</div>' +
          '<div class="bars">' + renderBarList(stats.languages.slice(0, presentation.compact ? 6 : 8), 'codeLines', (value) => numberFormat(value) + ' 行', '暂无语言数据') + '</div>' +
        '</div>' +
        '<div class="panel">' +
          '<h2>代码组成</h2>' +
          '<div class="section-note">区分有效代码、注释与空白占比。</div>' +
          renderComposition() +
        '</div>' +
      '</section>' +
      '<section class="grid">' +
        '<div class="panel">' +
          '<h2>模块代码量排行</h2>' +
          '<div class="section-note">按目录聚合，帮助你从模块视角审视项目结构。</div>' +
          '<div class="bars">' + renderBarList(stats.directories.slice(0, presentation.compact ? 6 : 8), 'codeLines', (value, item) => numberFormat(value) + ' 行 · ' + numberFormat(item.files) + ' 文件', '暂无模块数据') + '</div>' +
        '</div>' +
        '<div class="panel">' +
          '<h2>待办摘要</h2>' +
          '<div class="section-note">仅统计注释中的 TODO / FIXME / HACK 标记。</div>' +
          renderTodoSummary(stats.todoSummary) +
        '</div>' +
      '</section>' +
      '<section class="panel">' +
        '<h2>Git 提交趋势</h2>' +
        '<div class="section-note">基于当前工作区首个目录的 Git 历史。</div>' +
        renderGitStats() +
      '</section>' +
      '<section class="panel">' +
        '<h2>待办热点文件</h2>' +
        '<div class="section-note">点击文件名可直接打开源码定位待办。</div>' +
        renderTodoHotspots(stats.todoHotspots) +
      '</section>' +
      '<section class="panel">' +
        '<h2>语言统计明细</h2>' +
        '<div class="table-wrap">' +
          '<table>' +
            '<thead><tr><th>语言</th><th>文件数</th><th>代码行</th><th>体积</th><th>待办数</th></tr></thead>' +
            '<tbody>' + renderLanguageTable(stats.languages) + '</tbody>' +
          '</table>' +
        '</div>' +
      '</section>' +
      '<section class="panel">' +
        '<h2>最大文件排行</h2>' +
        '<div class="section-note">点击文件名可直接打开源码。</div>' +
        '<div class="table-wrap">' +
          '<table>' +
            '<thead><tr><th>文件</th><th>语言</th><th>总行数</th><th>代码行</th><th>待办数</th></tr></thead>' +
            '<tbody>' + renderLargestFiles(stats.largestFiles) + '</tbody>' +
          '</table>' +
        '</div>' +
      '</section>';

    document.addEventListener('click', (event) => {
      const element = event.target.closest('[data-command]');
      if (!element) {
        return;
      }

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
