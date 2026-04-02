import type * as vscode from 'vscode';
import type { CompareOpenTarget } from '../types';
import type { ComparePanelState } from '../ui/comparePanel';

export function getCompareHtml(
  webview: vscode.Webview,
  state: ComparePanelState,
  resources?: { cssUri?: string }
): string {
  const cssLink = resources?.cssUri ? `<link rel="stylesheet" href="${resources.cssUri}" />` : '';
  const modeLabel = state.mode === 'branch' ? '当前分支 vs main/master' : '两个 Commit 对比';
  const result = state.latestResult;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'unsafe-inline';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Code Info Compare</title>
  ${cssLink}
</head>
<body class="compare-shell">
  <main class="compare-page">
    <header class="compare-header">
      <div>
        <div class="compare-eyebrow">Code Info</div>
        <h1>变更对比</h1>
        <p class="compare-subtitle">独立查看当前分支或两个提交之间的文件变化与结构化统计。</p>
      </div>
      <div class="compare-status compare-status-${escapeHtml(state.status)}">${escapeHtml(modeLabel)}</div>
    </header>

    <section class="compare-panel">
      <div class="compare-mode-switch">
        <button class="compare-mode ${state.mode === 'branch' ? 'active' : ''}" data-command="compare:setMode" data-mode="branch">当前分支 vs main/master</button>
        <button class="compare-mode ${state.mode === 'commit' ? 'active' : ''}" data-command="compare:setMode" data-mode="commit">两个 Commit 对比</button>
      </div>
      <div class="compare-input-row">
        <input id="baseRef" class="compare-input" placeholder="base commit" value="${escapeHtml(state.baseRef)}" />
        <input id="headRef" class="compare-input" placeholder="head commit" value="${escapeHtml(state.headRef)}" />
        <button class="compare-run" data-command="compare:run">开始对比</button>
      </div>
      ${state.status === 'loading' ? '<div class="compare-banner">正在计算这次对比</div>' : ''}
      ${state.latestError ? `<div class="compare-banner compare-banner-error">${escapeHtml(state.latestError)}</div>` : ''}
    </section>

    ${result ? renderSummarySection(result.summary) : '<section class="compare-panel"><div class="compare-empty">还没有对比结果，先选择模式并运行一次。</div></section>'}
    ${result ? renderFilesSection(result.files) : ''}
  </main>
  <script>
    const vscode = acquireVsCodeApi();
    document.addEventListener('click', (event) => {
      const element = event.target.closest('[data-command]');
      if (!element) return;
      const command = element.getAttribute('data-command');
      if (command === 'compare:setMode') {
        vscode.postMessage({ command, mode: element.getAttribute('data-mode') });
        return;
      }
      if (command === 'compare:openFile') {
        const target = element.getAttribute('data-open-target');
        vscode.postMessage({ command, target: target ? JSON.parse(target) : undefined });
        return;
      }
      vscode.postMessage({ command });
    });
    document.getElementById('baseRef')?.addEventListener('input', (event) => {
      vscode.postMessage({ command: 'compare:updateBaseRef', value: event.target.value });
    });
    document.getElementById('headRef')?.addEventListener('input', (event) => {
      vscode.postMessage({ command: 'compare:updateHeadRef', value: event.target.value });
    });
  </script>
</body>
</html>`;
}

function renderSummarySection(summary: NonNullable<ComparePanelState['latestResult']>['summary']): string {
  const cards = [
    ['变更文件', `${summary.changedFiles}`],
    ['新增文件', `${summary.newFiles}`],
    ['删除文件', `${summary.deletedFiles}`],
    ['新增行', `${summary.addedLines}`],
    ['删除行', `${summary.deletedLines}`],
    ['代码净变化', `${summary.netCodeLines}`],
    ['TODO 净变化', `${summary.todoDelta}`]
  ];

  return `<section class="compare-summary-grid">${cards
    .map(
      ([label, value]) =>
        `<div class="compare-card"><div class="compare-card-label">${escapeHtml(label)}</div><div class="compare-card-value">${escapeHtml(value)}</div></div>`
    )
    .join('')}</section>`;
}

function renderFilesSection(files: NonNullable<ComparePanelState['latestResult']>['files']): string {
  return `<section class="compare-panel">
    <div class="compare-section-title">文件变化</div>
    <div class="compare-file-list">
      ${files
        .map((file) => {
          const primaryTarget = resolvePrimaryOpenTarget(file);
          const primaryAction = primaryTarget.kind !== 'none'
            ? `<button class="compare-open" data-command="compare:openFile" data-open-target="${escapeAttribute(
                JSON.stringify(primaryTarget)
              )}">${file.status === 'deleted' ? '打开 base' : '打开文件'}</button>`
            : '';
          const oldPath = file.oldPath
            ? `<div class="compare-file-old">${escapeHtml(file.oldPath)}</div>`
            : '';
          return `<div class="compare-file-row">
            <div class="status-badge status-${escapeHtml(file.status)}">${escapeHtml(file.status)}</div>
            <div class="compare-file-body">
              ${oldPath}
              <div class="compare-file-path">${escapeHtml(file.path)}</div>
            </div>
            ${primaryAction}
          </div>`;
        })
        .join('')}
    </div>
  </section>`;
}

function resolvePrimaryOpenTarget(file: NonNullable<ComparePanelState['latestResult']>['files'][number]): CompareOpenTarget {
  if (file.openTargets.path.kind !== 'none') {
    return file.openTargets.path;
  }

  if (file.status === 'deleted' && file.before) {
    return {
      kind: 'snapshot',
      title: `${file.before.path} (${file.before.ref.slice(0, 8)})`,
      content: file.before.content,
      language: file.before.file.language
    };
  }

  if (file.after) {
    return {
      kind: 'snapshot',
      title: `${file.after.path} (${file.after.ref.slice(0, 8)})`,
      content: file.after.content,
      language: file.after.file.language
    };
  }

  return { kind: 'none' };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
