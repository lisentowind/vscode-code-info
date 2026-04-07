import type * as vscode from 'vscode';
import type { CompareOpenTarget } from '../types';
import type { ComparePanelState } from '../ui/comparePanel';

export function getCompareHtml(
  webview: vscode.Webview,
  state: ComparePanelState,
  resources?: { cssUri?: string; gsapUri?: string }
): string {
  const cssLink = resources?.cssUri ? `<link rel="stylesheet" href="${resources.cssUri}" />` : '';
  const gsapScript = resources?.gsapUri ? `<script src="${resources.gsapUri}"></script>` : '';
  const modeLabel = state.mode === 'branch' ? '当前分支 vs main/master' : '两个 Commit 对比';
  const result = state.latestResult;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline';" />
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
        ${state.mode === 'branch'
          ? renderBranchSelectors(state.branchOptions, state.baseRef, state.headRef)
          : renderCommitInputs(state.baseRef, state.headRef)}
        <button class="compare-run" data-command="compare:run">开始对比</button>
      </div>
      ${state.status === 'loading' ? '<div class="compare-banner">正在计算这次对比</div>' : ''}
      ${state.latestError ? `<div class="compare-banner compare-banner-error">${escapeHtml(state.latestError)}</div>` : ''}
    </section>

    ${result ? renderSummarySection(result.summary) : '<section class="compare-panel"><div class="compare-empty">还没有对比结果，先选择模式并运行一次。</div></section>'}
    ${result ? renderFilesSection(result.files) : ''}
    ${result ? renderDeltaSection('语言变化', result.languages.map((item) => ({
      label: item.language,
      meta: `${item.beforeFiles} -> ${item.afterFiles} 文件`,
      value: signedNumber(item.deltaCodeLines),
      extra: `TODO ${signedNumber(item.deltaTodo)}`
    })), '暂无语言变化。') : ''}
    ${result ? renderDeltaSection('目录变化', result.directories.map((item) => ({
      label: item.path,
      meta: `${item.beforeFiles} -> ${item.afterFiles} 文件`,
      value: signedNumber(item.deltaCodeLines),
      extra: `TODO ${signedNumber(item.deltaTodo)}`
    })), '暂无目录变化。') : ''}
    ${result ? renderDeltaSection('热点文件', result.hotspots.map((item) => ({
      label: item.oldPath ? `${item.oldPath} -> ${item.path}` : item.path,
      meta: item.status,
      value: `${item.changedLines}`,
      extra: `+${item.addedLines} / -${item.deletedLines}`
    })), '暂无热点文件。') : ''}
  </main>
  ${gsapScript}
  <script>
    const vscode = acquireVsCodeApi();
    const motionState = vscode.getState() || {};
    const shouldPlayIntro = !motionState.compareIntroPlayed;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (typeof gsap !== 'undefined' && !prefersReducedMotion && shouldPlayIntro) {
      const animateWhenVisible = (selector, vars, options = {}) => {
        const nodes = Array.from(document.querySelectorAll(selector));
        if (!nodes.length) return;
        gsap.set(nodes, { autoAlpha: 0, y: 20 });
        if (typeof IntersectionObserver === 'undefined') {
          gsap.to(nodes, vars);
          return;
        }
        const observer = new IntersectionObserver((entries, currentObserver) => {
          const visible = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target);
          if (!visible.length) return;
          gsap.to(visible, vars);
          visible.forEach((node) => currentObserver.unobserve(node));
        }, { threshold: options.threshold || 0.18, rootMargin: options.rootMargin || '0px 0px -10% 0px' });
        nodes.forEach((node) => observer.observe(node));
      };

      gsap.fromTo('.compare-header', { autoAlpha: 0, y: 20 }, {
        autoAlpha: 1,
        y: 0,
        duration: 0.72,
        ease: 'power3.out'
      });
      animateWhenVisible('.compare-panel', { autoAlpha: 1, y: 0, duration: 0.68, ease: 'power3.out' });
      animateWhenVisible('.compare-summary-grid', { autoAlpha: 1, y: 0, duration: 0.66, ease: 'power3.out' });
      animateWhenVisible('.compare-file-row', { autoAlpha: 1, y: 0, duration: 0.58, ease: 'power3.out', stagger: 0.03 });
      animateWhenVisible('.compare-delta-row', { autoAlpha: 1, y: 0, duration: 0.56, ease: 'power3.out', stagger: 0.02 });
      gsap.utils.toArray('.compare-card-value').forEach((node) => {
        const original = (node.textContent || '').trim();
        const numberMatch = original.match(/-?\\d+/);
        if (!numberMatch) return;
        const target = Number.parseInt(numberMatch[0], 10);
        if (!Number.isFinite(target)) return;
        const state = { value: 0 };
        gsap.to(state, {
          value: target,
          duration: 1,
          ease: 'power2.out',
          onUpdate: () => {
            node.textContent = original.replace(numberMatch[0], String(Math.round(state.value)));
          },
          onComplete: () => {
            node.textContent = original;
          }
        });
      });
      vscode.setState({ ...motionState, compareIntroPlayed: true });
    }

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
    bindValueChange('baseRef', 'input', 'compare:updateBaseRef');
    bindValueChange('headRef', 'input', 'compare:updateHeadRef');
    bindValueChange('branchBaseRef', 'change', 'compare:updateBaseRef');
    bindValueChange('branchHeadRef', 'change', 'compare:updateHeadRef');

    function bindValueChange(id, eventName, command) {
      document.getElementById(id)?.addEventListener(eventName, (event) => {
        vscode.postMessage({ command, value: event.target.value });
      });
    }
  </script>
</body>
</html>`;
}

function renderBranchSelectors(branchOptions: string[], baseRef: string, headRef: string): string {
  const options = branchOptions.length ? branchOptions : [baseRef, headRef].filter(Boolean);
  return `
    <select id="branchBaseRef" class="compare-input">
      ${options.map((branch) => renderBranchOption(branch, branch === baseRef)).join('')}
    </select>
    <select id="branchHeadRef" class="compare-input">
      ${options.map((branch) => renderBranchOption(branch, branch === headRef)).join('')}
    </select>
  `;
}

function renderCommitInputs(baseRef: string, headRef: string): string {
  return `
    <input id="baseRef" class="compare-input" placeholder="base commit" value="${escapeHtml(baseRef)}" />
    <input id="headRef" class="compare-input" placeholder="head commit" value="${escapeHtml(headRef)}" />
  `;
}

function renderBranchOption(branch: string, selected: boolean): string {
  return `<option value="${escapeAttribute(branch)}"${selected ? ' selected' : ''}>${escapeHtml(branch)}</option>`;
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
          const actions = [];
          const primaryTarget = resolvePrimaryOpenTarget(file);
          if (primaryTarget.kind !== 'none') {
            actions.push(renderOpenButton(primaryTarget, file.status === 'deleted' ? '打开 base' : '打开文件'));
          }
          const oldPathTarget = resolveOldPathOpenTarget(file);
          if (oldPathTarget.kind !== 'none') {
            actions.push(renderOpenButton(oldPathTarget, '打开旧路径'));
          }
          const oldPath = file.oldPath
            ? `<div class="compare-file-old">${escapeHtml(file.oldPath)}</div>`
            : '';
          return `<div class="compare-file-row">
            <div class="status-badge status-${escapeHtml(file.status)}">${escapeHtml(file.status)}</div>
            <div class="compare-file-body">
              ${oldPath}
              <div class="compare-file-path">${escapeHtml(file.path)}</div>
            </div>
            <div class="compare-file-actions">${actions.join('')}</div>
          </div>`;
        })
        .join('')}
    </div>
  </section>`;
}

function renderDeltaSection(
  title: string,
  rows: Array<{ label: string; meta: string; value: string; extra: string }>,
  emptyText: string
): string {
  return `<section class="compare-panel">
    <div class="compare-section-title">${escapeHtml(title)}</div>
    ${rows.length
      ? `<div class="compare-delta-list">
          ${rows
            .map(
              (row) => `<div class="compare-delta-row">
                <div class="compare-delta-body">
                  <div class="compare-delta-label">${escapeHtml(row.label)}</div>
                  <div class="compare-delta-meta">${escapeHtml(row.meta)} · ${escapeHtml(row.extra)}</div>
                </div>
                <div class="compare-delta-value">${escapeHtml(row.value)}</div>
              </div>`
            )
            .join('')}
        </div>`
      : `<div class="compare-empty">${escapeHtml(emptyText)}</div>`}
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

function resolveOldPathOpenTarget(file: NonNullable<ComparePanelState['latestResult']>['files'][number]): CompareOpenTarget {
  if (file.openTargets.oldPath && file.openTargets.oldPath.kind !== 'none') {
    return file.openTargets.oldPath;
  }

  if (file.oldPath && file.before) {
    return {
      kind: 'snapshot',
      title: `${file.before.path} (${file.before.ref.slice(0, 8)})`,
      content: file.before.content,
      language: file.before.file.language
    };
  }

  return { kind: 'none' };
}

function renderOpenButton(target: CompareOpenTarget, label: string): string {
  return `<button class="compare-open" data-command="compare:openFile" data-open-target="${escapeAttribute(
    JSON.stringify(target)
  )}">${escapeHtml(label)}</button>`;
}

function signedNumber(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
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
