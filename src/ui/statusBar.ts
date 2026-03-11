import * as vscode from 'vscode';
import type { TodayStats } from '../types';

export class CodeInfoStatusBarController implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private todayStats: TodayStats | undefined;
  private loading = false;

  public constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.name = '代码信息今日统计';
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

    this.item.text = this.loading ? '$(sync~spin)' : '$(graph)';
    this.item.tooltip = this.loading ? createLoadingTooltip() : createTooltip(this.todayStats);
    this.item.show();
  }
}

function createLoadingTooltip(): vscode.MarkdownString {
  const tooltip = new vscode.MarkdownString(undefined, true);
  tooltip.supportThemeIcons = true;
  tooltip.appendMarkdown('$(sync~spin) **今日统计加载中**  \n正在刷新今天新增和修改过的文件。  \n\n单击打开看板。');
  return tooltip;
}

function createTooltip(todayStats: TodayStats | undefined): vscode.MarkdownString {
  const tooltip = new vscode.MarkdownString(undefined, true);
  tooltip.supportThemeIcons = true;

  if (!todayStats) {
    tooltip.appendMarkdown('$(graph) **今日统计**  \n暂无数据，稍后会自动刷新。  \n\n单击打开看板。');
    return tooltip;
  }

  const topLanguage = todayStats.insights.topLanguage
    ? `${escapeMarkdown(todayStats.insights.topLanguage)} ${formatPercent(todayStats.insights.topLanguageShare)}`
    : '暂无';
  const topPath = todayStats.insights.topPath ? trimText(todayStats.insights.topPath, 28) : '整个工作区';
  const updatedAt = formatTime(todayStats.generatedAt);

  tooltip.appendMarkdown(
    [
      '$(graph) **今日统计**',
      `触达 **${todayStats.totals.touchedFiles}** 个，新增 **${todayStats.totals.newFiles}** 个，代码 **${todayStats.totals.codeLines}** 行`,
      `待办 **${todayStats.totals.todoCount}** 个，主语言 ${topLanguage}`,
      `热点目录：${escapeMarkdown(topPath)}，更新 ${escapeMarkdown(updatedAt)}`,
      '',
      '单击打开看板。'
    ].join('  \n')
  );

  return tooltip;
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
