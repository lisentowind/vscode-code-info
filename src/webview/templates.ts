import type * as vscode from 'vscode';
import type { DashboardData, PresentationMode } from '../types';
import { buildDashboardShellHtml } from './dashboardShell';

export function getEmptyStateHtml(
  webview: vscode.Webview,
  compact: boolean,
  options?: { showOpenPanel?: boolean; cssUri?: string; gsapUri?: string }
): string {
  const nonce = getNonce();
  const showOpenPanel = options?.showOpenPanel ?? true;
  const cssUri = options?.cssUri;
  const gsapUri = options?.gsapUri;
  const title = compact ? 'Code Info 侧边栏' : 'Code Info';
  const subtitle = compact ? '先切到插件加载今日统计，再按需执行项目分析。' : '先切到插件加载今日统计，再打开完整项目分析看板。';
  const openPanelButton = showOpenPanel ? '<button class="action secondary" data-command="openPanel">打开看板</button>' : '';
  const openCompareButton = '<button class="action secondary" data-command="openCompare">变更对比</button>';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${cssUri ? `<link rel="stylesheet" href="${cssUri}" />` : ''}
</head>
<body class="${compact ? 'compact' : ''}">
  <div class="shell">
    <div class="sticky-sentinel" aria-hidden="true"></div>
    <header class="topbar">
      <div class="topbar-inner">
        <div class="brand">
          <span class="ui-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 11.5V4.5h10v7"/><path d="M5 13.5h6"/><path d="M6 11.5v2"/><path d="M10 11.5v2"/>
            </svg>
          </span>
          <div>
            <div class="brand-title">${title}</div>
            <div class="brand-sub">${subtitle}</div>
          </div>
        </div>
        <div class="toolbar">
          <button class="action" data-command="refreshToday">刷新今日统计</button>
          <button class="action" data-command="showStats">开始项目分析</button>
          ${openCompareButton}
          ${openPanelButton}
        </div>
      </div>
    </header>
    <main class="page">
      <section class="panel">
        <div class="empty-hero">
          <div class="empty-art" aria-hidden="true"></div>
          <div class="empty-body">
            <div class="empty-title">
              <span class="ui-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M8 2.5v3"/><path d="M8 10.5v3"/><path d="M3 8h3"/><path d="M10 8h3"/><circle cx="8" cy="8" r="2.5"/>
                </svg>
              </span>
              <h1>还没有可展示的数据</h1>
            </div>
            <p>建议按下面 4 步走一遍：先拿到“今日统计”，再按需做“项目分析”，最后根据需要打开详细看板或变更对比。</p>
            <div class="steps">
              <div class="step">
                <div class="step-text">
                  <div class="step-title">1) 刷新今日统计</div>
                  <div class="step-desc">快速获取今天新增/修改文件与语言分布。</div>
                </div>
                <button class="action secondary" data-command="refreshToday">执行</button>
              </div>
              <div class="step">
                <div class="step-text">
                  <div class="step-title">2) 开始项目分析</div>
                  <div class="step-desc">全量扫描，生成模块/语言/待办等项目级数据。</div>
                </div>
                <button class="action secondary" data-command="showStats">执行</button>
              </div>
              <div class="step">
                <div class="step-text">
                  <div class="step-title">3) 打开详细看板</div>
                  <div class="step-desc">更大空间展示今日 + 项目统计（适合长列表）。</div>
                </div>
                ${showOpenPanel ? '<button class="action secondary" data-command="openPanel">执行</button>' : '<button class="action secondary" disabled>不可用</button>'}
              </div>
              <div class="step">
                <div class="step-text">
                  <div class="step-title">4) 打开变更对比</div>
                  <div class="step-desc">查看当前分支或两个 commit 之间的文件变化和结构化统计。</div>
                </div>
                <button class="action secondary" data-command="openCompare">执行</button>
              </div>
            </div>
            <p class="hint">提示：如果你只想分析某些目录，可先点“选择目录”（在看板顶部操作栏）。</p>
          </div>
        </div>
      </section>
    </main>
  </div>
  ${gsapUri ? `<script nonce="${nonce}" src="${gsapUri}"></script>` : ''}
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const motionState = vscode.getState() || {};
    const shouldPlayIntro = !motionState.emptyIntroPlayed;
    const topbar = document.querySelector('.topbar');
    const sentinel = document.querySelector('.sticky-sentinel');
    if (topbar && sentinel && typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(([entry]) => {
        topbar.classList.toggle('floating', !entry.isIntersecting);
      }, { threshold: [0, 1] });
      observer.observe(sentinel);
    }
    document.addEventListener('click', (event) => {
      const element = event.target.closest('[data-command]');
      if (!element) return;
      if (element.hasAttribute('disabled')) return;
      vscode.postMessage({ command: element.getAttribute('data-command') });
    });
    if (typeof gsap !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && shouldPlayIntro) {
      const animateGroupWhenVisible = (selector, vars, options = {}) => {
        const nodes = Array.from(document.querySelectorAll(selector));
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
        }, { threshold: options.threshold || 0.18, rootMargin: options.rootMargin || '0px 0px -8% 0px' });
        nodes.forEach((node) => observer.observe(node));
      };

      gsap.fromTo('.topbar-inner', { autoAlpha: 0, y: 18 }, {
        autoAlpha: 1,
        y: 0,
        duration: 0.72,
        ease: 'power3.out'
      });
      animateGroupWhenVisible('.panel', { autoAlpha: 1, y: 0, duration: 0.72, ease: 'power3.out' });
      animateGroupWhenVisible('.step', { autoAlpha: 1, y: 0, duration: 0.64, ease: 'power3.out', stagger: 0.08 });
      animateGroupWhenVisible('.hint', { autoAlpha: 1, y: 0, duration: 0.56, ease: 'power3.out' });
      gsap.to('.empty-art', {
        y: -10,
        rotate: 4,
        duration: 2.8,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true
      });
      vscode.setState({ ...motionState, emptyIntroPlayed: true });
    }
  </script>
</body>
</html>`;
}

export function getDashboardHtml(
  webview: vscode.Webview,
  data: DashboardData,
  presentation: PresentationMode,
  resources?: { echartsUri?: string; cssUri?: string; gsapUri?: string; scriptUri?: string }
): string {
  const payload = JSON.stringify({ data, presentation })
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  return buildDashboardShellHtml(webview, {
    compact: presentation.compact,
    payloadJson: payload,
    bodyHtml: resources?.scriptUri ? '' : getDashboardFallbackHtml(data, presentation),
    cssUri: resources?.cssUri,
    echartsUri: resources?.echartsUri,
    gsapUri: resources?.gsapUri,
    scriptUri: resources?.scriptUri
  });
}

function getDashboardFallbackHtml(data: DashboardData, presentation: PresentationMode): string {
  const todayStats = data.todayStats;
  const projectStats = data.projectStats;
  const workspaceName = projectStats?.workspaceName ?? todayStats?.workspaceName ?? presentation.subtitle ?? '当前工作区';
  const rangeLabel = todayStats?.rangeLabel ?? '今天';
  const updatedAt = todayStats?.generatedAt ?? projectStats?.generatedAt;
  const summaryItems = [];

  if (todayStats) {
    summaryItems.push(
      renderFallbackMetric(`${rangeLabel}变更文件`, String(todayStats.totals.touchedFiles)),
      renderFallbackMetric(`${rangeLabel}新增文件`, String(todayStats.totals.newFiles)),
      renderFallbackMetric(`${rangeLabel}删除文件`, String(todayStats.totals.deletedFiles)),
      renderFallbackMetric(`${rangeLabel}待办数`, String(todayStats.totals.todoCount))
    );
  }

  if (projectStats && !presentation.compact) {
    summaryItems.push(
      renderFallbackMetric('项目文件数', String(projectStats.totals.files)),
      renderFallbackMetric('项目代码行', String(projectStats.totals.codeLines))
    );
  }

  const summaryHtml = summaryItems.length
    ? `<div class="cards">${summaryItems.join('')}</div>`
    : '<div class="empty-note">当前没有可展示的统计摘要，请稍后重试。</div>';

  return `<header class="topbar">
    <div class="topbar-inner">
      <div class="brand">
        <div class="brand-text">
          <div class="brand-title">${escapeHtml(presentation.title)}</div>
          <div class="brand-sub">${escapeHtml(workspaceName)}</div>
        </div>
      </div>
    </div>
  </header>
  <main class="page">
    <section class="panel">
      <div class="section-title"><h2>看板脚本未成功加载</h2></div>
      <div class="section-note">当前先展示静态摘要，建议关闭后重新打开面板，或执行“Developer: Reload Window”重试。</div>
      <div class="todo-summary">
        <div class="todo-item"><span>工作区</span><span class="muted">${escapeHtml(workspaceName)}</span></div>
        <div class="todo-item"><span>范围</span><span class="muted">${escapeHtml(rangeLabel)}</span></div>
        <div class="todo-item"><span>更新时间</span><span class="muted">${escapeHtml(updatedAt ?? '未知')}</span></div>
      </div>
    </section>
    ${summaryHtml}
  </main>`;
}

function renderFallbackMetric(label: string, value: string): string {
  return `<div class="card"><div class="metric-head"><div class="metric-label">${escapeHtml(label)}</div></div><div class="metric-value">${escapeHtml(value)}</div></div>`;
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getNonce(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  for (let index = 0; index < 32; index += 1) {
    value += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return value;
}
