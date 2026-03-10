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
      --border: var(--vscode-panel-border);
      --text: var(--vscode-editor-foreground);
      --muted: var(--vscode-descriptionForeground);
      --accent: var(--vscode-textLink-foreground);
      --accent-soft: color-mix(in srgb, var(--accent) 14%, transparent);
      font-family: var(--vscode-font-family);
    }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 20px; background: var(--bg); color: var(--text); overflow-x: hidden; }
    body.compact { padding: 12px; }
    .page { display: grid; gap: 16px; }
    .hero, .card, .panel { border: 1px solid var(--border); border-radius: 12px; background: var(--panel); min-width: 0; }
    .hero { display: flex; justify-content: space-between; gap: 16px; padding: 18px; background: linear-gradient(135deg, var(--panel), var(--panel-2)); }
    .hero h1 { margin: 0 0 8px; font-size: 20px; }
    .hero p { margin: 0; color: var(--muted); line-height: 1.5; font-size: 13px; }
    .hero-meta { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; align-content: flex-start; }
    .action { border: 1px solid var(--vscode-button-border, transparent); border-radius: 6px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); padding: 6px 12px; cursor: pointer; font: inherit; font-size: 13px; }
    .action.secondary { background: transparent; color: var(--accent); border-color: var(--border); }
    .badge { border-radius: 999px; padding: 6px 12px; background: var(--accent-soft); color: var(--accent); font-size: 12px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; }
    .card, .panel { padding: 16px; }
    .metric-label { font-size: 12px; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 8px; }
    .metric-value { font-size: 24px; font-weight: 600; }
    .metric-sub { margin-top: 8px; font-size: 12px; color: var(--muted); line-height: 1.5; }
    .grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); gap: 16px; }
    .panel h2 { margin: 0 0 6px; font-size: 15px; }
    .section-note { color: var(--muted); font-size: 12px; margin: 0 0 14px; line-height: 1.5; }
    .bars, .legend, .git-bars, .authors, .todo-summary, .tree-list { display: grid; gap: 12px; }
    .bar-row, .git-block { display: grid; gap: 6px; }
    .bar-head, .legend-item, .author-item, .todo-item, .tree-summary { display: flex; justify-content: space-between; gap: 12px; align-items: center; font-size: 13px; flex-wrap: wrap; min-width: 0; }
    .bar-track, .mini-track { height: 8px; border-radius: 999px; overflow: hidden; background: color-mix(in srgb, var(--text) 8%, transparent); }
    .bar-fill, .mini-fill { height: 100%; border-radius: inherit; background: var(--accent); opacity: 0.85; }
    .stack { display: flex; height: 14px; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--text) 8%, transparent); margin-bottom: 14px; }
    .legend-left, .author-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex: none; }
    .git-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .git-note, .empty-note { padding: 12px; border-radius: 8px; border: 1px dashed var(--border); color: var(--muted); font-size: 13px; line-height: 1.5; }
    .table-wrap { overflow-x: auto; width: 100%; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; white-space: nowrap; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent); vertical-align: top; }
    th { color: var(--muted); font-weight: 600; }
    td.mono { font-family: var(--vscode-editor-font-family); white-space: normal; word-break: break-all; min-width: 160px; }
    .muted { color: var(--muted); }
    .link-button { border: 0; padding: 0; background: transparent; color: var(--accent); cursor: pointer; text-align: left; font: inherit; word-break: break-all; }
    details.tree-node { border: 1px solid color-mix(in srgb, var(--border) 60%, transparent); border-radius: 8px; padding: 10px 12px; }
    details.tree-node > summary { cursor: pointer; list-style: none; }
    details.tree-node > summary::-webkit-details-marker { display: none; }
    .tree-children { margin-top: 10px; padding-left: 12px; display: grid; gap: 10px; border-left: 1px dashed color-mix(in srgb, var(--border) 70%, transparent); }
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
    function metricCard(label, value, sub) {
      return '<div class="card"><div class="metric-label">' + escapeHtml(label) + '</div><div class="metric-value">' + escapeHtml(value) + '</div><div class="metric-sub">' + escapeHtml(sub) + '</div></div>';
    }
    function fileButton(path, resource) {
      return '<button class="link-button" data-command="openFile" data-resource="' + escapeHtml(resource) + '">' + escapeHtml(path) + '</button>';
    }
    function renderBarList(items, labelKey, valueKey, formatter, emptyText) {
      if (!items || !items.length) return '<div class="empty-note">' + escapeHtml(emptyText) + '</div>';
      const max = items[0]?.[valueKey] ?? 1;
      return items.map((item) => {
        const value = item[valueKey];
        const label = item[labelKey];
        const width = Math.max((value / Math.max(max, 1)) * 100, value > 0 ? 3 : 0);
        return '<div class="bar-row"><div class="bar-head"><span>' + escapeHtml(label) + '</span><span class="muted">' + formatter(value, item) + '</span></div><div class="bar-track"><div class="bar-fill" style="width:' + width + '%"></div></div></div>';
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
        files.slice(0, presentation.compact ? 6 : 12).map((file) => '<tr><td class="mono">' + fileButton(file.path, file.resource) + '</td><td>' + escapeHtml(file.language) + '</td><td>' + escapeHtml(file.status === 'new' ? '新增' : '修改') + '</td><td>' + numberFormat(file.codeLines) + '</td><td>' + numberFormat(file.todoCounts.total) + '</td><td>' + escapeHtml(file.modifiedAt) + '</td></tr>').join('') +
      '</tbody></table></div>';
    }
    function renderLanguageTable(items) {
      return items.slice(0, presentation.compact ? 8 : 12).map((language, index) => '<tr><td><span class="dot" style="background:' + palette[index % palette.length] + '"></span> ' + escapeHtml(language.language) + '</td><td>' + numberFormat(language.files) + '</td><td>' + numberFormat(language.codeLines) + '</td><td>' + bytesFormat(language.bytes) + '</td><td>' + numberFormat(language.todoCount) + '</td></tr>').join('');
    }
    function renderLargestFiles(items) {
      return items.slice(0, presentation.compact ? 5 : 10).map((file) => '<tr><td class="mono">' + fileButton(file.path, file.resource) + '</td><td>' + escapeHtml(file.language) + '</td><td>' + numberFormat(file.lines) + '</td><td>' + numberFormat(file.codeLines) + '</td><td>' + numberFormat(file.todoCounts.total) + '</td></tr>').join('');
    }
    function renderTodoSummary(items) {
      if (!items.length) return '<div class="empty-note">暂无 TODO / FIXME / HACK 标记。</div>';
      return '<div class="todo-summary">' + items.map((item) => '<div class="todo-item"><span>' + escapeHtml(item.keyword) + '</span><span class="muted">' + numberFormat(item.count) + '</span></div>').join('') + '</div>';
    }
    function renderTodoHotspots(items) {
      if (!items.length) return '<div class="empty-note">未发现待办热点文件。</div>';
      return '<div class="table-wrap"><table><thead><tr><th>文件</th><th>语言</th><th>总数</th><th>TODO</th><th>FIXME</th><th>HACK</th></tr></thead><tbody>' +
        items.slice(0, presentation.compact ? 5 : 10).map((file) => '<tr><td class="mono">' + fileButton(file.path, file.resource) + '</td><td>' + escapeHtml(file.language) + '</td><td>' + numberFormat(file.total) + '</td><td>' + numberFormat(file.todo) + '</td><td>' + numberFormat(file.fixme) + '</td><td>' + numberFormat(file.hack) + '</td></tr>').join('') +
      '</tbody></table></div>';
    }
    function renderTreeNodes(nodes, depth) {
      if (!nodes || !nodes.length) return '<div class="empty-note">暂无目录树数据。</div>';
      const maxItems = depth === 0 ? (presentation.compact ? 5 : 8) : 6;
      return '<div class="tree-list">' + nodes.slice(0, maxItems).map((node) => {
        const children = node.children && node.children.length ? '<div class="tree-children">' + renderTreeNodes(node.children, depth + 1) + '</div>' : '';
        const content = '<div class="tree-summary"><span>' + escapeHtml(node.path) + '</span><span class="muted">' + numberFormat(node.codeLines) + ' 行 · ' + numberFormat(node.files) + ' 文件</span></div>';
        if (!node.children || !node.children.length || depth >= 2) {
          return '<div class="card">' + content + '</div>';
        }
        return '<details class="tree-node" ' + (depth === 0 ? 'open' : '') + '><summary>' + content + '</summary>' + children + '</details>';
      }).join('') + '</div>';
    }

    const workspaceName = projectStats?.workspaceName || todayStats?.workspaceName || '当前工作区';
    const heroBadges = [];
    if (todayStats) heroBadges.push('<span class="badge">今日触达 ' + numberFormat(todayStats.totals.touchedFiles) + ' 文件</span>');
    if (todayStats) heroBadges.push('<span class="badge">今日新增 ' + numberFormat(todayStats.totals.newFiles) + ' 文件</span>');
    if (projectStats) heroBadges.push('<span class="badge">项目分析 ' + numberFormat(projectStats.totals.files) + ' 文件</span>');
    if (projectStats) heroBadges.push('<span class="badge">项目耗时 ' + escapeHtml(durationFormat(projectStats.analysisMeta.durationMs)) + '</span>');
    const actionsHtml = presentation.compact
      ? '<button class="action" data-command="refreshToday">刷新今日统计</button>' +
        '<button class="action secondary" data-command="openPanel">详情分析</button>'
      : '<button class="action" data-command="refreshToday">刷新今日统计</button>' +
        '<button class="action" data-command="showStats">开始项目分析</button>' +
        '<button class="action secondary" data-command="refresh">重新分析项目</button>' +
        '<button class="action secondary" data-command="selectScope">选择目录</button>' +
        '<button class="action secondary" data-command="openPanel">详细看板</button>' +
        '<button class="action secondary" data-command="exportJson"' + (projectStats ? '' : ' disabled') + '>导出 JSON</button>' +
        '<button class="action secondary" data-command="exportCsv"' + (projectStats ? '' : ' disabled') + '>导出 CSV</button>';

    let html = '' +
      '<section class="hero">' +
        '<div><h1>' + escapeHtml(presentation.title) + '</h1><p>' + escapeHtml(presentation.subtitle) + '<br>工作区：' + escapeHtml(workspaceName) + '</p><div class="hero-meta">' + heroBadges.join('') + '</div></div>' +
        '<div class="actions">' + actionsHtml + '</div>' +
      '</section>';

    if (todayStats) {
      html += '' +
        '<section class="panel"><h2>今日统计分析</h2><div class="section-note">切到插件视图时自动更新，仅分析今天新增或修改过的文件，避免实时全量扫描。</div></section>' +
        '<section class="cards">' +
          metricCard('今日触达文件', numberFormat(todayStats.totals.touchedFiles), '今天被修改或新增的文本文件') +
          metricCard('今日新增文件', numberFormat(todayStats.totals.newFiles), '通过文件创建时间判断的新文件') +
          metricCard('今日代码行', numberFormat(todayStats.totals.codeLines), '仅统计今日触达文件的当前代码量') +
          metricCard('今日待办数', numberFormat(todayStats.totals.todoCount), '触达文件中的 TODO / FIXME / HACK') +
          metricCard('主力语言', todayStats.insights.topLanguage, percent(todayStats.insights.topLanguageShare, 1) + ' 占比') +
          metricCard('最近活跃文件', todayStats.insights.topPath, '按更新时间和代码量排序') +
        '</section>' +
        '<section class="grid">' +
          '<div class="panel"><h2>今日语言分布</h2><div class="section-note">按今日触达文件的代码行统计。</div><div class="bars">' + renderBarList(todayStats.languages.slice(0, presentation.compact ? 6 : 8), 'language', 'codeLines', (value, item) => numberFormat(value) + ' 行 · ' + numberFormat(item.files) + ' 文件', '今日暂无语言数据') + '</div></div>' +
          '<div class="panel"><h2>今日元信息</h2><div class="section-note">本模块只在视图可见时刷新，避免长期常驻分析。</div><div class="todo-summary">' +
            '<div class="todo-item"><span>扫描范围</span><span class="muted">' + escapeHtml(todayStats.analysisMeta.scopeSummary) + '</span></div>' +
            '<div class="todo-item"><span>匹配文件</span><span class="muted">' + numberFormat(todayStats.analysisMeta.matchedFiles) + '</span></div>' +
            '<div class="todo-item"><span>今日触达</span><span class="muted">' + numberFormat(todayStats.analysisMeta.analyzedFiles) + '</span></div>' +
            '<div class="todo-item"><span>耗时</span><span class="muted">' + escapeHtml(durationFormat(todayStats.analysisMeta.durationMs)) + '</span></div>' +
          '</div></div>' +
        '</section>' +
        '<section class="panel"><h2>今日新增文件</h2><div class="section-note">今天首次创建的文件。</div>' + renderTodayFiles(todayStats.newFiles, '今天还没有检测到新增文件。') + '</section>' +
        '<section class="panel"><h2>今日触达文件</h2><div class="section-note">今天修改过的文件清单，点击文件名可直接打开源码。</div>' + renderTodayFiles(todayStats.touchedFiles, '今天还没有检测到修改过的文件。') + '</section>';
    } else {
      html += '<section class="panel"><h2>今日统计分析</h2><div class="empty-note">当前还没有今日统计数据。切到插件时会自动刷新，也可以手动点击“刷新今日统计”。</div></section>';
    }

    if (!presentation.compact && projectStats) {
      html += '' +
        '<section class="panel"><h2>项目分析模块</h2><div class="section-note">手动触发的全量项目分析，适合看整体代码规模、目录结构和 Git 活动。</div></section>' +
        '<section class="cards">' +
          metricCard('总文件数', numberFormat(projectStats.totals.files), '参与统计的文本文件') +
          metricCard('代码行', numberFormat(projectStats.totals.codeLines), '有效代码规模') +
          metricCard('注释密度', ratio(projectStats.insights.commentRatio), '注释行 / 代码行') +
          metricCard('平均代码行', numberFormat(Math.round(projectStats.insights.averageCodeLinesPerFile)), '每个文件的平均代码行') +
          metricCard('待办总数', numberFormat(projectStats.insights.totalTodoCount), 'TODO / FIXME / HACK') +
          metricCard('待办密度', densityFormat(projectStats.insights.todoDensity), '每千行代码的待办数') +
          metricCard('主力语言', projectStats.insights.topLanguage, percent(projectStats.insights.topLanguageShare, 1) + ' 代码占比') +
          metricCard('核心模块', projectStats.insights.topDirectory, '当前代码量最高的模块') +
        '</section>' +
        '<section class="grid">' +
          '<div class="panel"><h2>语言代码量排行</h2><div class="section-note">按有效代码行数倒序。</div><div class="bars">' + renderBarList(projectStats.languages.slice(0, presentation.compact ? 6 : 8), 'language', 'codeLines', (value, item) => numberFormat(value) + ' 行 · ' + numberFormat(item.files) + ' 文件', '暂无语言数据') + '</div></div>' +
          '<div class="panel"><h2>代码组成</h2><div class="section-note">区分代码、注释与空白占比。</div>' + renderComposition(projectStats) + '</div>' +
        '</section>' +
        '<section class="grid">' +
          '<div class="panel"><h2>模块代码量排行</h2><div class="section-note">按目录深度聚合，可配合 codeInfo.analysis.moduleDepth 调整。</div><div class="bars">' + renderBarList(projectStats.directories.slice(0, presentation.compact ? 6 : 8), 'path', 'codeLines', (value, item) => numberFormat(value) + ' 行 · ' + numberFormat(item.files) + ' 文件', '暂无模块数据') + '</div></div>' +
          '<div class="panel"><h2>待办摘要</h2><div class="section-note">仅统计注释中的 TODO / FIXME / HACK 标记。</div>' + renderTodoSummary(projectStats.todoSummary) + '</div>' +
        '</section>' +
        '<section class="panel"><h2>模块目录树</h2><div class="section-note">新增目录树展开视图，帮助你在层级结构中定位代码量集中区域。</div>' + renderTreeNodes(projectStats.directoryTree, 0) + '</section>' +
        '<section class="panel"><h2>Git 提交趋势</h2><div class="section-note">基于当前工作区首个目录的 Git 历史。</div>' + renderGitStats(projectStats) + '</section>' +
        '<section class="panel"><h2>待办热点文件</h2><div class="section-note">点击文件名可直接打开源码定位待办。</div>' + renderTodoHotspots(projectStats.todoHotspots) + '</section>' +
        '<section class="panel"><h2>语言统计明细</h2><div class="table-wrap"><table><thead><tr><th>语言</th><th>文件数</th><th>代码行</th><th>体积</th><th>待办数</th></tr></thead><tbody>' + renderLanguageTable(projectStats.languages) + '</tbody></table></div></section>' +
        '<section class="panel"><h2>最大文件排行</h2><div class="section-note">点击文件名可直接打开源码。</div><div class="table-wrap"><table><thead><tr><th>文件</th><th>语言</th><th>总行数</th><th>代码行</th><th>待办数</th></tr></thead><tbody>' + renderLargestFiles(projectStats.largestFiles) + '</tbody></table></div></section>';
    } else if (!presentation.compact) {
      html += '<section class="panel"><h2>项目分析模块</h2><div class="empty-note">当前还没有项目分析结果。点击“开始项目分析”后，会执行全量扫描并展示完整的项目级数据。</div></section>';
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
