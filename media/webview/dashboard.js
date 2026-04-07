const vscode = acquireVsCodeApi();
const motionState = vscode.getState() || {};
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
const compactMenuClass = presentation.compact ? ' menu-compact' : '';
const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let app = document.getElementById('app');
if (!app) {
  app = document.createElement('div');
  app.id = 'app';
  document.body.appendChild(app);
}
app.className = 'shell';

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
    menu: '<svg' + attrs + ' viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5h10"/><path d="M3 8h10"/><path d="M3 11.5h10"/></svg>',
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
function locationButton(label, resource, line, character, title) {
  const resolvedTitle = title || label;
  return '<button class="link-button" title="' + escapeHtml(resolvedTitle) + '" data-command="openLocation" data-resource="' + escapeHtml(resource) + '" data-line="' + escapeHtml(line) + '" data-character="' + escapeHtml(character) + '">' + escapeHtml(label) + '</button>';
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
  const commitsChart = '<div class="chart" id="chart-git-weekly"></div><div class="git-bars chart-fallback">' + bars + '</div>';
  return '<div class="git-grid"><div><div class="section-note">' + escapeHtml(stats.git.rangeLabel) + ' · 共 ' + numberFormat(stats.git.totalCommits) + ' 次提交</div>' + commitsChart + '</div><div><div class="section-note">贡献者 Top 5</div><div class="authors">' + authors + '</div></div></div>';
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
function renderTodoLocations(items, emptyText) {
  if (!items || !items.length) return '<div class="empty-note">' + escapeHtml(emptyText) + '</div>';
  const max = presentation.compact ? 10 : 40;
  return '<div class="table-wrap"><table><thead><tr><th>位置</th><th>标记</th><th>预览</th></tr></thead><tbody>' +
    items.slice(0, max).map((item) => {
      const label = item.path + ':' + item.line;
      const title = label + (item.preview ? (' — ' + item.preview) : '');
      return '<tr><td class="mono">' + locationButton(label, item.resource, String(item.line), String(item.character || 1), title) + '</td><td>' + escapeHtml(item.keyword) + '</td><td class="muted" title="' + escapeHtml(item.preview || '') + '">' + escapeHtml(item.preview || '') + '</td></tr>';
    }).join('') +
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
    return '<details class="tree-node"><summary>' + content + '</summary>' + children + files + '</details>';
  }).join('') + moreHint + '</div>';
}

function initCharts() {
  if (typeof echarts === 'undefined') {
    return;
  }

  const computed = getComputedStyle(document.body);
  const textColor = computed.getPropertyValue('--text').trim() || '#e6e6e6';
  const mutedColor = computed.getPropertyValue('--muted').trim() || '#9aa0a6';
  const borderColor = computed.getPropertyValue('--border-soft').trim() || 'rgba(127,127,127,0.25)';
  const panelColor = computed.getPropertyValue('--panel').trim() || '#1e1e1e';
  const surfaceColor = computed.getPropertyValue('--surface').trim() || panelColor;
  const tooltipBg = computed.getPropertyValue('--surface-hover').trim() || surfaceColor;
  const accent = computed.getPropertyValue('--accent').trim() || palette[0];
  const accentSoft = computed.getPropertyValue('--accent-soft').trim() || 'rgba(91, 143, 249, 0.16)';

  const charts = [];
  const resizeTargets = [];

  function initChart(element, option) {
    const chart = echarts.init(element, null, { renderer: 'canvas' });
    chart.setOption(option, { notMerge: true, lazyUpdate: true });
    charts.push(chart);
    resizeTargets.push(element);
    element.closest('.panel')?.classList.add('chart-ready');
  }

  function truncateLabel(value, max) {
    const str = String(value || '');
    if (str.length <= max) return str;
    return str.slice(0, Math.max(max - 1, 1)) + '…';
  }

  function buildTooltip(formatter) {
    return {
      trigger: 'axis',
      confine: true,
      backgroundColor: tooltipBg,
      borderColor: borderColor,
      borderWidth: 1,
      padding: [8, 10],
      textStyle: { color: textColor, fontSize: 12 },
      extraCssText: 'border-radius:10px;box-shadow:0 10px 24px rgba(0,0,0,0.18);backdrop-filter:saturate(120%) blur(6px);',
      axisPointer: { type: 'shadow' },
      formatter
    };
  }

  const languageEl = document.getElementById('chart-language');
  if (languageEl && projectStats && projectStats.languages && projectStats.languages.length) {
    const items = projectStats.languages.slice(0, presentation.compact ? 6 : 8);
    initChart(languageEl, {
      animation: false,
      tooltip: buildTooltip((params) => {
        const point = Array.isArray(params) ? params[0] : params;
        const item = items[point.dataIndex];
        if (!item) return '';
        return escapeHtml(item.language) + '<br/>' + numberFormat(item.codeLines) + ' 行 · ' + numberFormat(item.files) + ' 文件';
      }),
      grid: { left: 4, right: 10, top: 8, bottom: 4, containLabel: true },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'category',
        data: items.map((item) => item.language),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: mutedColor, formatter: (value) => truncateLabel(value, 16) }
      },
      series: [
        {
          type: 'bar',
          data: items.map((item) => item.codeLines),
          barWidth: 10,
          itemStyle: { color: palette[0], borderRadius: [0, 7, 7, 0] }
        }
      ]
    });
  }

  const todayLanguageEl = document.getElementById('chart-today-language');
  if (todayLanguageEl && todayStats && todayStats.languages && todayStats.languages.length) {
    const items = todayStats.languages.slice(0, presentation.compact ? 6 : 8);
    initChart(todayLanguageEl, {
      animation: false,
      tooltip: buildTooltip((params) => {
        const point = Array.isArray(params) ? params[0] : params;
        const item = items[point.dataIndex];
        if (!item) return '';
        return escapeHtml(item.language) + '<br/>' + numberFormat(item.codeLines) + ' 行 · ' + numberFormat(item.files) + ' 文件';
      }),
      grid: { left: 4, right: 10, top: 8, bottom: 4, containLabel: true },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'category',
        data: items.map((item) => item.language),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: mutedColor, formatter: (value) => truncateLabel(value, 16) }
      },
      series: [
        {
          type: 'bar',
          data: items.map((item) => item.codeLines),
          barWidth: 10,
          itemStyle: { color: palette[5], borderRadius: [0, 7, 7, 0] }
        }
      ]
    });
  }

  const moduleEl = document.getElementById('chart-module');
  if (moduleEl && projectStats && projectStats.directories && projectStats.directories.length) {
    const items = projectStats.directories.slice(0, presentation.compact ? 6 : 8);
    initChart(moduleEl, {
      animation: false,
      tooltip: buildTooltip((params) => {
        const point = Array.isArray(params) ? params[0] : params;
        const item = items[point.dataIndex];
        if (!item) return '';
        return escapeHtml(item.path) + '<br/>' + numberFormat(item.codeLines) + ' 行 · ' + numberFormat(item.files) + ' 文件';
      }),
      grid: { left: 4, right: 10, top: 8, bottom: 4, containLabel: true },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'category',
        data: items.map((item) => item.path),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: mutedColor,
          formatter: (value) => {
            const str = String(value || '');
            const parts = str.split('/').filter(Boolean);
            const short = parts.length > 2 ? (parts[0] + '/…/' + parts[parts.length - 1]) : str;
            return truncateLabel(short, 18);
          }
        }
      },
      series: [
        {
          type: 'bar',
          data: items.map((item) => item.codeLines),
          barWidth: 10,
          itemStyle: { color: palette[3], borderRadius: [0, 7, 7, 0] }
        }
      ]
    });
  }

  const gitEl = document.getElementById('chart-git-weekly');
  if (gitEl && projectStats && projectStats.git && projectStats.git.available && projectStats.git.weeklyCommits && projectStats.git.weeklyCommits.length) {
    const items = projectStats.git.weeklyCommits;
    initChart(gitEl, {
      animation: false,
      tooltip: buildTooltip((params) => {
        const point = Array.isArray(params) ? params[0] : params;
        const item = items[point.dataIndex];
        if (!item) return '';
        return escapeHtml(item.label) + '<br/>' + numberFormat(item.commits) + ' commits';
      }),
      grid: { left: 6, right: 12, top: 10, bottom: 22, containLabel: true },
      xAxis: {
        type: 'category',
        data: items.map((item) => item.label),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: borderColor } },
        axisLabel: { color: mutedColor }
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: mutedColor },
        splitLine: { lineStyle: { color: borderColor } }
      },
      series: [
        {
          type: 'line',
          data: items.map((item) => item.commits),
          smooth: true,
          symbol: 'circle',
          symbolSize: 7,
          lineStyle: { width: 2, color: accent },
          itemStyle: { color: accent },
          areaStyle: { color: accentSoft }
        }
      ]
    });
  }

  const resizeAll = () => {
    for (const chart of charts) {
      chart.resize();
    }
  };

  window.addEventListener('resize', resizeAll, { passive: true });
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => resizeAll());
    for (const target of resizeTargets) {
      observer.observe(target);
    }
  }
}

const workspaceName = projectStats?.workspaceName || todayStats?.workspaceName || '当前工作区';
const rangeLabel = todayStats?.rangeLabel || '今天';
const rangeHeading = rangeLabel === '今天' ? '今日' : rangeLabel;
const refreshRangeCommand = !todayStats
  ? 'refreshToday'
  : todayStats.rangePreset === 'last7Days'
    ? 'refreshLast7Days'
    : todayStats.rangePreset === 'last30Days'
      ? 'refreshLast30Days'
      : 'refreshToday';
const refreshRangeLabel = !todayStats || rangeLabel === '今天' ? '刷新今天' : ('刷新' + rangeLabel);
const generatedAt = todayStats?.generatedAt || projectStats?.generatedAt;
const generatedLabel = generatedAt ? new Date(generatedAt).toLocaleString() : '';
const heroBadges = [];
if (todayStats) heroBadges.push('<span class="badge">' + escapeHtml(rangeHeading) + '变更 ' + numberFormat(todayStats.totals.touchedFiles) + ' 文件</span>');
if (todayStats) heroBadges.push('<span class="badge">' + escapeHtml(rangeHeading) + '新增 ' + numberFormat(todayStats.totals.newFiles) + ' 文件</span>');
if (todayStats && todayStats.totals.deletedFiles) heroBadges.push('<span class="badge">' + escapeHtml(rangeHeading) + '删除 ' + numberFormat(todayStats.totals.deletedFiles) + ' 文件</span>');
if (projectStats) heroBadges.push('<span class="badge">项目分析 ' + numberFormat(projectStats.totals.files) + ' 文件</span>');
if (projectStats) heroBadges.push('<span class="badge">项目耗时 ' + escapeHtml(durationFormat(projectStats.analysisMeta.durationMs)) + '</span>');
const metaParts = [];
metaParts.push('<span class="meta-item">工作区<strong>' + escapeHtml(workspaceName) + '</strong></span>');
if (generatedLabel) metaParts.push('<span class="meta-dot" aria-hidden="true"></span><span class="meta-item">更新<strong>' + escapeHtml(generatedLabel) + '</strong></span>');
if (projectStats) metaParts.push('<span class="meta-dot" aria-hidden="true"></span><span class="meta-item">耗时<strong>' + escapeHtml(durationFormat(projectStats.analysisMeta.durationMs)) + '</strong></span>');
const metaHtml = metaParts.join('');

const chipsHtml = heroBadges.slice(0, presentation.compact ? 2 : 4).join('');
const rangeMenuLabel = todayStats ? ('切换范围 · ' + rangeLabel) : '切换范围';
const summaryPills = [];
if (todayStats) summaryPills.push('<span class="summary-pill">变更 ' + numberFormat(todayStats.totals.touchedFiles) + '</span>');
if (todayStats) summaryPills.push('<span class="summary-pill">新增 ' + numberFormat(todayStats.totals.newFiles) + '</span>');
if (todayStats && todayStats.totals.deletedFiles) summaryPills.push('<span class="summary-pill">删除 ' + numberFormat(todayStats.totals.deletedFiles) + '</span>');
if (projectStats) summaryPills.push('<span class="summary-pill">项目 ' + numberFormat(projectStats.totals.files) + '</span>');
const summaryPillsHtml = summaryPills.join('');

const quickActionsHtml = presentation.compact
  ? '<button class="action" data-command="' + refreshRangeCommand + '">' + icon('refresh') + escapeHtml(refreshRangeLabel) + '</button>' +
    '<button class="action secondary" data-command="openCompare">' + icon('git') + '变更对比</button>' +
    '<button class="action secondary" data-command="openPanel">' + icon('detail') + '详情分析</button>'
  : '<button class="action action-compact secondary" data-command="' + refreshRangeCommand + '">' + icon('refresh') + '刷新</button>' +
    '<button class="action action-compact" data-command="showStats">' + icon('project') + '分析</button>' +
    '<button class="action action-compact secondary" data-command="openCompare">' + icon('git') + '对比</button>';

const rangeMenuHtml =
  '<details class="menu menu-toolbar menu-range' + compactMenuClass + '" id="__codeInfoRangeMenu">' +
    '<summary class="action ' + (presentation.compact ? 'secondary' : 'action-compact secondary') + '" aria-label="切换统计范围">' + icon('today') + (presentation.compact ? escapeHtml(rangeMenuLabel) : '范围') + '</summary>' +
    '<div class="menu-popover" role="menu">' +
      '<div class="menu-group">' +
        '<div class="menu-title">范围</div>' +
        '<button class="menu-item" data-command="refreshToday" role="menuitem">' + icon('refresh') + '<span class="menu-label">今天</span><span class="menu-hint">' + escapeHtml(rangeLabel === '今天' ? '当前' : 'Today') + '</span></button>' +
        '<button class="menu-item" data-command="refreshLast7Days" role="menuitem">' + icon('today') + '<span class="menu-label">最近 7 天</span><span class="menu-hint">' + escapeHtml(todayStats?.rangePreset === 'last7Days' ? '当前' : '7d') + '</span></button>' +
        '<button class="menu-item" data-command="refreshLast30Days" role="menuitem">' + icon('today') + '<span class="menu-label">最近 30 天</span><span class="menu-hint">' + escapeHtml(todayStats?.rangePreset === 'last30Days' ? '当前' : '30d') + '</span></button>' +
      '</div>' +
    '</div>' +
  '</details>';

const menuHtml =
  '<details class="menu menu-toolbar' + compactMenuClass + '" id="__codeInfoMenu">' +
    '<summary class="action ' + (presentation.compact ? 'secondary' : 'action-compact secondary') + '" aria-label="打开操作菜单">' + icon('menu') + '更多</summary>' +
    '<div class="menu-popover" role="menu">' +
      '<div class="menu-group">' +
        '<div class="menu-title">分析</div>' +
        '<button class="menu-item" data-command="showStats" role="menuitem">' + icon('project') + '<span class="menu-label">开始项目分析</span><span class="menu-hint">Scan</span></button>' +
        '<button class="menu-item" data-command="refresh" role="menuitem">' + icon('refresh') + '<span class="menu-label">重新分析项目</span><span class="menu-hint">Re-run</span></button>' +
        '<button class="menu-item" data-command="selectScope" role="menuitem">' + icon('scope') + '<span class="menu-label">选择目录</span><span class="menu-hint">Scope</span></button>' +
      '</div>' +
      '<div class="menu-group">' +
        '<div class="menu-title">视图</div>' +
        '<button class="menu-item" data-command="openPanel" role="menuitem">' + icon('detail') + '<span class="menu-label">打开详细看板</span><span class="menu-hint">Panel</span></button>' +
        '<button class="menu-item" data-command="openCompare" role="menuitem">' + icon('git') + '<span class="menu-label">打开变更对比</span><span class="menu-hint">Compare</span></button>' +
      '</div>' +
      '<div class="menu-group">' +
        '<div class="menu-title">导出</div>' +
        '<button class="menu-item" data-command="exportJson" role="menuitem"' + (projectStats ? '' : ' disabled') + '>' + icon('json') + '<span class="menu-label">导出 JSON</span><span class="menu-hint">.json</span></button>' +
        '<button class="menu-item" data-command="exportCsv" role="menuitem"' + (projectStats ? '' : ' disabled') + '>' + icon('csv') + '<span class="menu-label">导出 CSV</span><span class="menu-hint">.csv</span></button>' +
      '</div>' +
    '</div>' +
  '</details>';

const navItems = [];
navItems.push('<button class="nav-item active" data-nav="ci-section-today" data-label="范围统计" aria-label="范围统计">' + icon('today') + '<span class="nav-text">范围统计</span></button>');
navItems.push('<button class="nav-item" data-nav="ci-section-project" data-label="项目分析" aria-label="项目分析">' + icon('project') + '<span class="nav-text">项目分析</span></button>');
if (projectStats) {
  navItems.push('<button class="nav-item" data-nav="ci-section-tree" data-label="目录树" aria-label="目录树">' + icon('tree') + '<span class="nav-text">目录树</span></button>');
  navItems.push('<button class="nav-item" data-nav="ci-section-git" data-label="Git 趋势" aria-label="Git 趋势">' + icon('git') + '<span class="nav-text">Git 趋势</span></button>');
  navItems.push('<button class="nav-item" data-nav="ci-section-todo" data-label="待办热点" aria-label="待办热点">' + icon('todo') + '<span class="nav-text">待办热点</span></button>');
  navItems.push('<button class="nav-item" data-nav="ci-section-tables" data-label="统计明细" aria-label="统计明细">' + icon('language') + '<span class="nav-text">统计明细</span></button>');
}

const sidebarSummaryItems = [];
if (todayStats) {
  sidebarSummaryItems.push(
    '<div class="rail-chip" aria-label="' + escapeHtml(rangeHeading) + '变更 ' + numberFormat(todayStats.totals.touchedFiles) + ' 文件，新增 ' + numberFormat(todayStats.totals.newFiles) + '，删除 ' + numberFormat(todayStats.totals.deletedFiles) + '">' +
      icon('files') +
      '<div class="rail-value">' + numberFormat(todayStats.totals.touchedFiles) + '</div>' +
      '<div class="rail-text">' + escapeHtml(rangeHeading) + '变更</div>' +
    '</div>'
  );
}
if (projectStats) {
  sidebarSummaryItems.push(
    '<div class="rail-chip" aria-label="项目文件 ' + numberFormat(projectStats.totals.files) + '，耗时 ' + escapeHtml(durationFormat(projectStats.analysisMeta.durationMs)) + '">' +
      icon('project') +
      '<div class="rail-value">' + numberFormat(projectStats.totals.files) + '</div>' +
      '<div class="rail-text">项目文件</div>' +
    '</div>'
  );
}

const projectActionCommand = projectStats ? 'refresh' : 'showStats';
const projectActionLabel = projectStats ? '重新分析项目' : '开始项目分析';
const floatingBarHtml = !presentation.compact
  ? '' +
    '<div class="floatbar" aria-label="快捷操作">' +
      '<button class="fab-button" style="--i:0" data-command="' + refreshRangeCommand + '" aria-label="' + escapeHtml(refreshRangeLabel) + '">' +
        icon('refresh', 'fab-icon') +
        '<span class="fab-label">' + escapeHtml(refreshRangeLabel) + '</span>' +
      '</button>' +
      '<button class="fab-button" style="--i:1" data-command="' + projectActionCommand + '" aria-label="' + escapeHtml(projectActionLabel) + '">' +
        icon('project', 'fab-icon') +
        '<span class="fab-label">' + escapeHtml(projectActionLabel) + '</span>' +
      '</button>' +
      '<button class="fab-button" style="--i:2" data-command="selectScope" aria-label="选择目录">' +
        icon('scope', 'fab-icon') +
        '<span class="fab-label">选择目录</span>' +
      '</button>' +
      '<button class="fab-button" style="--i:3" data-command="openCompare" aria-label="变更对比">' +
        icon('git', 'fab-icon') +
        '<span class="fab-label">变更对比</span>' +
      '</button>' +
      '<button class="fab-button" style="--i:4" data-command="exportJson" aria-label="导出 JSON"' + (projectStats ? '' : ' disabled') + '>' +
        icon('json', 'fab-icon') +
        '<span class="fab-label">导出 JSON</span>' +
      '</button>' +
      '<button class="fab-button" style="--i:5" data-command="exportCsv" aria-label="导出 CSV"' + (projectStats ? '' : ' disabled') + '>' +
        icon('csv', 'fab-icon') +
        '<span class="fab-label">导出 CSV</span>' +
      '</button>' +
    '</div>'
  : '';

const sidebarHtml = !presentation.compact
  ? '<aside class="sidebar sidebar-simple">' +
      '<div class="sidebar-header"><div class="sidebar-title">Code Info</div></div>' +
      (sidebarSummaryItems.length ? ('<div class="rail-summary" aria-label="Summary">' + sidebarSummaryItems.join('') + '</div>') : '') +
      '<div class="rail-divider" aria-hidden="true"></div>' +
      '<div class="rail-nav" aria-label="Navigation">' + navItems.join('') + '</div>' +
    '</aside>'
  : '';

const topbarHtml = presentation.compact
  ? '' +
    '<header class="topbar">' +
      '<div class="topbar-inner">' +
        '<div class="brand">' +
          icon('today') +
          '<div class="brand-text">' +
            '<div class="brand-title">' + escapeHtml(presentation.title) + '</div>' +
            '<div class="brand-sub">' + escapeHtml(presentation.subtitle) + '</div>' +
            '<div class="brand-meta">' + metaHtml + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="topbar-right">' +
          '<div class="chips">' + chipsHtml + '</div>' +
          '<div class="toolbar">' + rangeMenuHtml + quickActionsHtml + menuHtml + '</div>' +
        '</div>' +
      '</div>' +
    '</header>'
  : '' +
    '<header class="topbar topbar-panel">' +
      '<div class="topbar-inner topbar-inner-panel">' +
        '<div class="topbar-main topbar-main-row">' +
          '<div class="brand brand-panel">' +
            icon('dashboard') +
            '<div class="brand-text">' +
              '<div class="brand-title">' + escapeHtml(presentation.title) + '</div>' +
              '<div class="brand-meta">' + metaHtml + '</div>' +
            '</div>' +
          '</div>' +
          (summaryPillsHtml ? '<div class="topbar-summary">' + summaryPillsHtml + '</div>' : '') +
          '<div class="topbar-actions topbar-actions-row">' +
            '<div class="toolbar toolbar-panel toolbar-panel-row">' + rangeMenuHtml + quickActionsHtml + menuHtml + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</header>';

let html = '' +
  (presentation.compact
    ? (topbarHtml + '<main class="page">')
    : ('<div class="app-layout">' + sidebarHtml + '<div class="content">' + topbarHtml + '<main class="page">'));

if (todayStats) {
  html += '' +
    '<section class="section-intro" id="ci-section-today"><div class="section-title">' + icon('today') + '<h2>' + escapeHtml(rangeHeading) + '统计分析</h2></div><div class="section-note section-note-tight">新增/修改基于文件时间戳；删除文件与增删行基于当前时间范围内的 Git 提交。</div></section>' +
    '<section class="cards">' +
      metricCard(rangeHeading + '变更文件', numberFormat(todayStats.totals.touchedFiles), '当前范围内被修改或新增的文本文件', 'files') +
      metricCard(rangeHeading + '新增文件', numberFormat(todayStats.totals.newFiles), '通过文件创建时间判断的新文件', 'newFile') +
      metricCard(rangeHeading + '删除文件', numberFormat(todayStats.totals.deletedFiles), '基于当前范围内的 Git 提交（如可用）', 'deletedFile') +
      metricCard(rangeHeading + '代码变更', '+' + numberFormat(todayStats.totals.addedLines) + ' / -' + numberFormat(todayStats.totals.deletedLines), '基于当前范围内的 Git 提交（如可用）', 'diff') +
      metricCard(rangeHeading + '变更行', todayStats.analysisMeta.gitAvailable ? numberFormat(todayStats.totals.changedLines) : '—', 'added + deleted（仅统计当前范围提交）', 'lines') +
      metricCard(rangeHeading + '待办数', numberFormat(todayStats.totals.todoCount), '变更文件中的 TODO / FIXME / HACK', 'todo') +
      metricCard('主力语言', todayStats.insights.topLanguage, percent(todayStats.insights.topLanguageShare, 1) + ' 占比', 'language') +
      metricCard('最近活跃文件', todayStats.insights.topPath, '按更新时间和代码量排序', 'detail') +
    '</section>' +
    '<section class="grid">' +
      '<div class="panel"><div class="section-title">' + icon('language') + '<h2>' + escapeHtml(rangeHeading) + '语言分布</h2></div><div class="section-note">按当前范围内变更文件的代码行统计（支持 hover 查看详情）。</div><div class="chart" id="chart-today-language"></div><div class="bars chart-fallback">' + renderBarList(todayStats.languages.slice(0, presentation.compact ? 6 : 8), 'language', 'codeLines', (value, item) => numberFormat(value) + ' 行 · ' + numberFormat(item.files) + ' 文件', '当前范围暂无语言数据') + '</div></div>' +
      '<div class="panel"><div class="section-title">' + icon('meta') + '<h2>统计说明</h2></div><div class="section-note">说明这组范围统计是怎么得出来的，以及这次分析覆盖了什么。</div><div class="todo-summary">' +
        '<div class="todo-item"><span>扫描范围</span><span class="muted">' + escapeHtml(todayStats.analysisMeta.scopeSummary) + '</span></div>' +
        '<div class="todo-item"><span>纳入统计的文件</span><span class="muted">' + numberFormat(todayStats.analysisMeta.matchedFiles) + '</span></div>' +
        '<div class="todo-item"><span>检测到的变更文件</span><span class="muted">' + numberFormat(todayStats.analysisMeta.analyzedFiles) + '</span></div>' +
        '<div class="todo-item"><span>Git 统计起点</span><span class="muted">' + (todayStats.analysisMeta.gitAvailable ? ('从 ' + escapeHtml(todayStats.analysisMeta.gitSince || rangeLabel) + ' 起') : '不可用') + '</span></div>' +
        '<div class="todo-item"><span>分析耗时</span><span class="muted">' + escapeHtml(durationFormat(todayStats.analysisMeta.durationMs)) + '</span></div>' +
      '</div></div>' +
    '</section>' +
    '<section class="panel"><div class="section-title">' + icon('newFile') + '<h2>' + escapeHtml(rangeHeading) + '新增文件</h2></div><div class="section-note">当前范围内首次创建的文件。</div>' + renderTodayFiles(todayStats.newFiles, '当前范围内还没有检测到新增文件。') + '</section>' +
    '<section class="panel"><div class="section-title">' + icon('files') + '<h2>' + escapeHtml(rangeHeading) + '变更文件</h2></div><div class="section-note">当前范围内新增或修改过的文件清单，点击文件名可直接打开源码。</div>' + renderTodayFiles(todayStats.touchedFiles, '当前范围内还没有检测到新增或修改过的文件。') + '</section>' +
    (todayStats.totals.todoCount > 0 ? ('<section class="panel"><div class="section-title">' + icon('todo') + '<h2>' + escapeHtml(rangeHeading) + '待办清单</h2></div><div class="section-note">展示部分 TODO / FIXME / HACK 位置，点击可跳转到对应行。</div>' + renderTodoLocations(todayStats.todoLocations, '当前范围变更文件中未发现待办标记。') + '</section>') : '') +
    '<section class="panel"><div class="section-title">' + icon('deletedFile') + '<h2>' + escapeHtml(rangeHeading) + '删除文件</h2></div><div class="section-note">' + (todayStats.analysisMeta.gitAvailable ? '基于当前时间范围内的 Git 提交，仅展示文件路径。' : '当前工作区没有可用的 Git 数据，无法统计删除文件。') + '</div>' + renderDeletedFiles(todayStats.deletedFiles, '当前范围内还没有检测到删除文件。') + '</section>';
} else {
  html += '<section class="section-intro" id="ci-section-today"><div class="section-title">' + icon('today') + '<h2>范围统计分析</h2></div><div class="section-note section-note-tight">当前还没有范围统计数据。切到插件时会自动刷新，也可以手动点击“刷新今天”。</div></section>';
}

if (!presentation.compact && projectStats) {
  html += '' +
    '<section class="section-intro section-intro-project" id="ci-section-project"><div class="section-title">' + icon('project') + '<h2>项目分析模块</h2></div><div class="section-note section-note-tight">手动触发的全量项目分析，适合看整体代码规模、目录结构和 Git 活动。</div></section>' +
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
      '<div class="panel"><div class="section-title">' + icon('language') + '<h2>语言代码量排行</h2></div><div class="section-note">按有效代码行数倒序（支持 hover 查看详情）。</div><div class="chart" id="chart-language"></div><div class="bars chart-fallback">' + renderBarList(projectStats.languages.slice(0, presentation.compact ? 6 : 8), 'language', 'codeLines', (value, item) => numberFormat(value) + ' 行 · ' + numberFormat(item.files) + ' 文件', '暂无语言数据') + '</div></div>' +
      '<div class="panel"><div class="section-title">' + icon('composition') + '<h2>代码组成</h2></div><div class="section-note">区分代码、注释与空白占比。</div>' + renderComposition(projectStats) + '</div>' +
    '</section>' +
    '<section class="grid">' +
      '<div class="panel"><div class="section-title">' + icon('module') + '<h2>模块代码量排行</h2></div><div class="section-note">按目录深度聚合（支持 hover 查看详情）。</div><div class="chart" id="chart-module"></div><div class="bars chart-fallback">' + renderBarList(projectStats.directories.slice(0, presentation.compact ? 6 : 8), 'path', 'codeLines', (value, item) => numberFormat(value) + ' 行 · ' + numberFormat(item.files) + ' 文件', '暂无模块数据') + '</div></div>' +
      '<div class="panel"><div class="section-title">' + icon('todo') + '<h2>待办摘要</h2></div><div class="section-note">仅统计注释中的 TODO / FIXME / HACK 标记。</div>' + renderTodoSummary(projectStats.todoSummary) + '</div>' +
    '</section>' +
    '<section class="panel" id="ci-section-tree"><div class="section-title">' + icon('tree') + '<h2>模块目录树</h2></div><div class="section-note">支持逐层展开到最深目录，并展示当前目录下的文件（点击文件名可打开）。</div>' + renderTreeNodes(projectStats.directoryTree, 0) + '</section>' +
    '<section class="panel" id="ci-section-git"><div class="section-title">' + icon('git') + '<h2>Git 提交趋势</h2></div><div class="section-note">基于当前工作区首个目录的 Git 历史。</div>' + renderGitStats(projectStats) + '</section>' +
    '<section class="panel" id="ci-section-todo"><div class="section-title">' + icon('todo') + '<h2>待办热点文件</h2></div><div class="section-note">点击文件名可直接打开源码定位待办。</div>' + renderTodoHotspots(projectStats.todoHotspots) + '</section>' +
    (projectStats.insights.totalTodoCount > 0 ? ('<section class="panel"><div class="section-title">' + icon('todo') + '<h2>待办位置清单</h2></div><div class="section-note">展示部分 TODO / FIXME / HACK 位置，点击可跳转到对应行。</div>' + renderTodoLocations(projectStats.todoLocations, '未发现待办标记。') + '</section>') : '') +
    '<section class="panel" id="ci-section-tables"><div class="section-title">' + icon('language') + '<h2>语言统计明细</h2></div><div class="table-wrap"><table><thead><tr><th>语言</th><th>文件数</th><th>代码行</th><th>体积</th><th>待办数</th></tr></thead><tbody>' + renderLanguageTable(projectStats.languages) + '</tbody></table></div></section>' +
    '<section class="panel"><div class="section-title">' + icon('files') + '<h2>最大文件排行</h2></div><div class="section-note">点击文件名可直接打开源码。</div><div class="table-wrap"><table><thead><tr><th>文件</th><th>语言</th><th>总行数</th><th>代码行</th><th>待办数</th></tr></thead><tbody>' + renderLargestFiles(projectStats.largestFiles) + '</tbody></table></div></section>';
} else if (!presentation.compact) {
  html += '' +
    '<section class="section-intro section-intro-project" id="ci-section-project">' +
      '<div class="section-title">' + icon('project') + '<h2>项目分析模块</h2></div>' +
      '<div class="section-note section-note-tight">还没有项目分析结果。点击“开始项目分析”后，会执行全量扫描并展示完整的项目级数据。</div>' +
      '<div class="inline-actions">' +
        '<button class="action action-slim" data-command="showStats">' + icon('project') + '开始项目分析</button>' +
        '<button class="action action-slim secondary" data-command="selectScope">' + icon('scope') + '选择目录</button>' +
      '</div>' +
    '</section>';
}

html += (presentation.compact ? '</main>' : '</main></div></div>' + floatingBarHtml);
const updateStickyTop = () => {
  const bar = document.querySelector('.topbar-inner') || document.querySelector('.topbar');
  if (!(bar instanceof HTMLElement)) return;
  const rect = bar.getBoundingClientRect();
  const height = bar.offsetHeight || rect.height || 0;
  const bottom = Math.max(rect.top + height, rect.bottom, height);
  document.body.style.setProperty('--stickyTop', Math.max(0, Math.round(bottom)) + 'px');
};
const scheduleStickyTop = () => {
  requestAnimationFrame(() => requestAnimationFrame(() => updateStickyTop()));
};
function animateCount(node) {
  if (!(node instanceof HTMLElement)) return;
  if (node.dataset.countAnimated === 'true') return;
  const originalText = (node.dataset.originalText || node.textContent || '').trim();
  if (!originalText) return;
  node.dataset.originalText = originalText;

  const numberMatch = originalText.match(/-?\d[\d,.]*/);
  if (!numberMatch) return;
  const parsedValue = Number.parseFloat(numberMatch[0].replace(/,/g, ''));
  if (!Number.isFinite(parsedValue)) return;

  node.dataset.countAnimated = 'true';
  const state = { value: 0 };
  gsap.to(state, {
    value: parsedValue,
    duration: 1.1,
    ease: 'power2.out',
    onUpdate: () => {
      const formatted = Math.round(state.value).toLocaleString('zh-CN');
      node.textContent = originalText.replace(numberMatch[0], formatted);
    },
    onComplete: () => {
      node.textContent = originalText;
    }
  });
}
function initAnimations() {
  if (typeof gsap === 'undefined' || prefersReducedMotion || motionState.dashboardIntroPlayed) {
    return;
  }

  gsap.defaults({ ease: 'power3.out' });
  const animateWhenVisible = (selector, vars, options) => {
    const nodes = gsap.utils.toArray(selector);
    if (!nodes.length) return;
    gsap.set(nodes, { autoAlpha: 0, y: 18 });
    if (typeof IntersectionObserver === 'undefined') {
      gsap.to(nodes, vars);
      return;
    }

    const observer = new IntersectionObserver((entries, currentObserver) => {
      const visible = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target);
      if (!visible.length) return;
      gsap.to(visible, vars);
      visible.forEach((node) => currentObserver.unobserve(node));
    }, {
      threshold: options?.threshold ?? 0.16,
      rootMargin: options?.rootMargin ?? '0px 0px -8% 0px'
    });

    nodes.forEach((node) => observer.observe(node));
  };

  gsap.fromTo('.topbar-inner', { autoAlpha: 0, y: 18 }, {
    autoAlpha: 1,
    y: 0,
    duration: 0.72
  });
  if (!presentation.compact) {
    animateWhenVisible('.rail-chip', { autoAlpha: 1, y: 0, duration: 0.64, stagger: 0.06 });
    animateWhenVisible('.nav-item', { autoAlpha: 1, y: 0, duration: 0.62, stagger: 0.05 });
  }
  animateWhenVisible('.card', { autoAlpha: 1, y: 0, duration: 0.62, stagger: 0.04 });
  animateWhenVisible('.panel', { autoAlpha: 1, y: 0, duration: 0.68, stagger: 0.05 });
  animateWhenVisible('.fab-button', { autoAlpha: 1, y: 0, scale: 1, duration: 0.42, stagger: 0.04 });
  animateWhenVisible('.bar-row, .git-block, .author-item, .tree-node, .tree-file-row, tbody tr', {
    autoAlpha: 1,
    y: 0,
    duration: 0.5,
    stagger: 0.018
  });

  gsap.utils.toArray('.metric-value, .rail-value').forEach((node) => animateCount(node));
  gsap.utils.toArray('.badge').forEach((node, index) => {
    gsap.fromTo(node, { autoAlpha: 0, y: -10, scale: 0.96 }, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: 0.48,
      delay: 0.16 + index * 0.04
    });
  });
  gsap.utils.toArray('.bar-fill, .mini-fill').forEach((node, index) => {
    const width = node.style.width;
    gsap.fromTo(node, { width: '0%' }, {
      width,
      duration: 0.9,
      delay: 0.22 + index * 0.02,
      ease: 'power2.out'
    });
  });
  gsap.utils.toArray('.stack > div').forEach((node, index) => {
    const width = node.style.width;
    gsap.fromTo(node, { width: '0%' }, {
      width,
      duration: 0.75,
      delay: 0.26 + index * 0.06,
      ease: 'power2.out'
    });
  });
  vscode.setState({ ...motionState, dashboardIntroPlayed: true });
}
app.innerHTML = '<div class="sticky-sentinel" aria-hidden="true"></div>' + html;
const topbar = document.querySelector('.topbar');
const sentinel = document.querySelector('.sticky-sentinel');
if (topbar && sentinel && typeof IntersectionObserver !== 'undefined') {
  const observer = new IntersectionObserver(([entry]) => {
    topbar.classList.toggle('floating', !entry.isIntersecting);
    scheduleStickyTop();
  }, { threshold: [0, 1] });
  observer.observe(sentinel);
}
const topbarInner = document.querySelector('.topbar-inner');
if (topbarInner && typeof ResizeObserver !== 'undefined') {
  const ro = new ResizeObserver(() => scheduleStickyTop());
  ro.observe(topbarInner);
}
const menus = Array.from(document.querySelectorAll('details.menu')).filter((menu) => menu instanceof HTMLDetailsElement);
const syncCompactMenuPopover = (menu) => {
  if (!(menu instanceof HTMLDetailsElement) || !menu.classList.contains('menu-compact')) return;
  const popover = menu.querySelector('.menu-popover');
  const summary = menu.querySelector('summary');
  if (!(popover instanceof HTMLElement) || !(summary instanceof HTMLElement)) return;

  const viewportWidth = document.documentElement.clientWidth || window.innerWidth || 0;
  const gutter = 12;
  const preferredWidth = Math.max(220, Math.min(320, viewportWidth - gutter * 2));
  const menuRect = menu.getBoundingClientRect();
  const summaryRect = summary.getBoundingClientRect();
  const maxLeft = Math.max(gutter, viewportWidth - gutter - preferredWidth);
  const alignLeft = menu.classList.contains('menu-range');
  const desiredLeft = alignLeft
    ? Math.min(Math.max(summaryRect.left, gutter), maxLeft)
    : Math.min(Math.max(summaryRect.right - preferredWidth, gutter), maxLeft);

  popover.style.setProperty('--menu-inline-start', String(desiredLeft - menuRect.left) + 'px');
  popover.style.setProperty('--menu-width', String(preferredWidth) + 'px');
};
const closeOpenMenus = (exceptMenu) => {
  let didClose = false;
  for (const menu of menus) {
    if (!(menu instanceof HTMLDetailsElement)) continue;
    if (exceptMenu && menu === exceptMenu) continue;
    if (!menu.open) continue;
    menu.open = false;
    didClose = true;
  }
  if (didClose) scheduleStickyTop();
};
for (const menu of menus) {
  if (!(menu instanceof HTMLDetailsElement)) continue;
  menu.addEventListener('toggle', () => {
    if (menu.open) {
      closeOpenMenus(menu);
      syncCompactMenuPopover(menu);
      if (typeof gsap !== 'undefined' && !prefersReducedMotion) {
        const popover = menu.querySelector('.menu-popover');
        if (popover) {
          gsap.fromTo(popover, { autoAlpha: 0, y: -10, scale: 0.96 }, {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.24,
            ease: 'power2.out'
          });
        }
      }
    }
    scheduleStickyTop();
  });
}
document.addEventListener('pointerdown', (event) => {
  const hasOpenMenu = menus.some((menu) => menu instanceof HTMLDetailsElement && menu.open);
  if (!hasOpenMenu) return;
  if (event.target instanceof Node && menus.some((menu) => menu instanceof HTMLDetailsElement && menu.contains(event.target))) return;
  closeOpenMenus();
}, { capture: true });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeOpenMenus();
});
window.addEventListener('scroll', () => {
  if (!menus.some((menu) => menu instanceof HTMLDetailsElement && menu.open)) return;
  closeOpenMenus();
}, { passive: true });
scheduleStickyTop();
for (const menu of menus) {
  syncCompactMenuPopover(menu);
}
if (document.fonts?.ready) {
  document.fonts.ready.then(() => {
    scheduleStickyTop();
    for (const menu of menus) syncCompactMenuPopover(menu);
  }).catch(() => {});
}
window.addEventListener('load', () => scheduleStickyTop(), { once: true });
window.addEventListener('load', () => {
  for (const menu of menus) syncCompactMenuPopover(menu);
}, { once: true });
window.addEventListener('resize', () => {
  scheduleStickyTop();
  for (const menu of menus) syncCompactMenuPopover(menu);
}, { passive: true });
initCharts();
initAnimations();
document.addEventListener('click', (event) => {
  const navElement = event.target.closest('[data-nav]');
  if (navElement) {
    const targetId = navElement.getAttribute('data-nav');
    const target = targetId ? document.getElementById(targetId) : null;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (typeof gsap !== 'undefined' && !prefersReducedMotion) {
        gsap.fromTo(target, { y: 12 }, { y: 0, duration: 0.42, ease: 'power2.out' });
        gsap.fromTo(target, {
          boxShadow: '0 0 0 0 color-mix(in srgb, var(--accent) 0%, transparent)'
        }, {
          boxShadow: '0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent), 0 22px 44px color-mix(in srgb, black 14%, transparent)',
          duration: 0.34,
          yoyo: true,
          repeat: 1
        });
      }
      for (const item of document.querySelectorAll('[data-nav].active')) {
        item.classList.remove('active');
      }
      navElement.classList.add('active');
    }
    return;
  }

  const element = event.target.closest('[data-command]');
  if (!element) return;
  if (element.hasAttribute('disabled')) return;
  const lineAttr = element.getAttribute('data-line');
  const characterAttr = element.getAttribute('data-character');
  const line = lineAttr ? Number.parseInt(lineAttr, 10) : undefined;
  const character = characterAttr ? Number.parseInt(characterAttr, 10) : undefined;
  vscode.postMessage({
    command: element.getAttribute('data-command'),
    resource: element.getAttribute('data-resource') || undefined,
    line: Number.isFinite(line) ? line : undefined,
    character: Number.isFinite(character) ? character : undefined
  });
  if (element.closest('details.menu')) {
    closeOpenMenus();
  }
});
