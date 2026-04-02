import * as vscode from 'vscode';
import type { TodayStats } from '../types';

export class CodeInfoStatusBarController implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private todayStats: TodayStats | undefined;
  private loading = false;

  public constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.name = '代码信息范围统计';
    this.item.command = 'codeInfo.openPanel';
    this.render();
  }

  public update(todayStats: TodayStats | undefined): void {
    this.todayStats = todayStats;
    this.render();
  }

  public setLoading(loading: boolean): void {
    this.loading = loading;
    this.render();
  }

  public dispose(): void {
    this.item.dispose();
  }

  private render(): void {
    const hasWorkspace = Boolean(vscode.workspace.workspaceFolders?.length);
    if (!hasWorkspace) {
      this.item.hide();
      return;
    }

    this.item.text = this.loading ? '$(sync~spin) 统' : createStatusBarText(this.todayStats);
    this.item.tooltip = this.loading ? createLoadingTooltip() : createTooltip(this.todayStats);
    this.item.show();
  }
}

function createLoadingTooltip(): vscode.MarkdownString {
  const tooltip = new vscode.MarkdownString(undefined, true);
  tooltip.supportThemeIcons = true;
  tooltip.appendMarkdown('$(sync~spin) **范围统计加载中**  \n正在刷新当前时间范围内有变更的文件。  \n\n单击打开看板。');
  return tooltip;
}

function createTooltip(todayStats: TodayStats | undefined): vscode.MarkdownString {
  const tooltip = new vscode.MarkdownString(undefined, true);
  tooltip.supportThemeIcons = true;
  const rangeLabel = todayStats?.rangeLabel ?? '今天';

  if (!todayStats) {
    tooltip.appendMarkdown('$(graph) **范围统计**  \n当前还没有检测到范围内的变更文件。  \n\n单击打开看板。');
    return tooltip;
  }

  const modifiedFiles = Math.max(todayStats.totals.touchedFiles - todayStats.totals.newFiles, 0);
  const topLanguage = todayStats.insights.topLanguage
    ? `${escapeMarkdown(todayStats.insights.topLanguage)} ${formatPercent(todayStats.insights.topLanguageShare)}`
    : '暂无';
  const latestFile = todayStats.insights.topPath ? trimText(todayStats.insights.topPath, 28) : '暂无';
  const updatedAt = formatTime(todayStats.generatedAt);
  const gitLine = todayStats.analysisMeta.gitAvailable
    ? `Git（${escapeMarkdown(todayStats.analysisMeta.gitSince || rangeLabel)} 起）：+${todayStats.totals.addedLines} / -${todayStats.totals.deletedLines} 行，删除 ${todayStats.totals.deletedFiles} 文件`
    : 'Git：不可用（无法统计删行/删文件）';

  tooltip.appendMarkdown(
    [
      `$(graph) **${escapeMarkdown(rangeLabel)}统计**`,
      `${escapeMarkdown(rangeLabel)}变更 **${todayStats.totals.touchedFiles}** 个文件，其中新增 **${todayStats.totals.newFiles}** 个，修改 **${modifiedFiles}** 个`,
      `变更 **${todayStats.analysisMeta.gitAvailable ? todayStats.totals.changedLines : 0}** 行（Git 范围提交），待办 **${todayStats.totals.todoCount}** 个，主语言 ${topLanguage}`,
      gitLine,
      `最近文件：${escapeMarkdown(latestFile)}，更新 ${escapeMarkdown(updatedAt)}`,
      '',
      '单击打开看板。'
    ].join('  \n')
  );

  return tooltip;
}

function createStatusBarText(todayStats: TodayStats | undefined): string {
  if (!todayStats) {
    return '$(graph) 范围 0';
  }

  const modifiedFiles = Math.max(todayStats.totals.touchedFiles - todayStats.totals.newFiles, 0);
  const deletedFiles = todayStats.totals.deletedFiles || 0;
  return deletedFiles > 0
    ? `$(graph) 改${modifiedFiles} 新${todayStats.totals.newFiles} 删${deletedFiles}`
    : `$(graph) 改${modifiedFiles} 新${todayStats.totals.newFiles}`;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '';
  }

  return `(${Math.round(value * 100)}%)`;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function trimText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+\-.!|>]/g, '\\$&');
}
