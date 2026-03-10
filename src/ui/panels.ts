import * as vscode from 'vscode';
import type { PresentationMode, WorkspaceStats } from '../types';
import { getDashboardHtml, getEmptyStateHtml } from '../webview/templates';
import type { WebviewCommandMessage } from './webviewCommands';

export type DashboardPanelState = {
  panel: vscode.WebviewPanel | undefined;
};

export function updatePanelIfOpen(
  state: DashboardPanelState,
  stats: WorkspaceStats,
  options: { reveal: boolean }
): void {
  if (!state.panel) {
    return;
  }

  renderPanel(state.panel, stats);
  if (options.reveal) {
    state.panel.reveal(vscode.ViewColumn.One, false);
  }
}

export function showStatsPanel(
  state: DashboardPanelState,
  stats: WorkspaceStats,
  onCommand: (message?: WebviewCommandMessage) => void | Promise<void>
): void {
  if (!state.panel) {
    state.panel = vscode.window.createWebviewPanel('codeInfoStats', `Code Info · ${stats.workspaceName}`, vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true
    });

    state.panel.onDidDispose(() => {
      state.panel = undefined;
    });

    state.panel.webview.onDidReceiveMessage((message: WebviewCommandMessage) => {
      void onCommand(message);
    });
  }

  state.panel.title = `Code Info · ${stats.workspaceName}`;
  renderPanel(state.panel, stats);
  state.panel.reveal(vscode.ViewColumn.One, false);
}

export function showDashboardEmptyPanel(
  state: DashboardPanelState,
  onCommand: (message?: WebviewCommandMessage) => void | Promise<void>
): void {
  if (!state.panel) {
    state.panel = vscode.window.createWebviewPanel('codeInfoStats', 'Code Info · Dashboard', vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true
    });

    state.panel.onDidDispose(() => {
      state.panel = undefined;
    });

    state.panel.webview.onDidReceiveMessage((message: WebviewCommandMessage) => {
      void onCommand(message);
    });
  }

  state.panel.title = 'Code Info · Dashboard';
  state.panel.webview.html = getEmptyStateHtml(state.panel.webview, false, { showOpenPanel: false });
  state.panel.reveal(vscode.ViewColumn.One, false);
}

export function showEmptyIfOpen(state: DashboardPanelState): void {
  if (!state.panel) {
    return;
  }
  state.panel.webview.html = getEmptyStateHtml(state.panel.webview, false, { showOpenPanel: false });
}

function renderPanel(panel: vscode.WebviewPanel, stats: WorkspaceStats): void {
  const presentation: PresentationMode = {
    compact: false,
    title: `${stats.workspaceName} 代码统计看板`,
    subtitle: '统计当前工作区的代码规模、语言分布、文件明细和近期 Git 活动。'
  };

  panel.webview.html = getDashboardHtml(panel.webview, stats, presentation);
}
