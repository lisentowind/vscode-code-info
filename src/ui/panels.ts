import * as vscode from 'vscode';
import type { DashboardData, PresentationMode } from '../types';
import { getDashboardHtml, getEmptyStateHtml } from '../webview/templates';
import type { WebviewCommandMessage } from './webviewCommands';

export type DashboardPanelState = {
  panel: vscode.WebviewPanel | undefined;
};

export function updatePanelIfOpen(
  state: DashboardPanelState,
  data: DashboardData,
  options: { reveal: boolean }
): void {
  if (!state.panel) {
    return;
  }

  renderPanel(state.panel, data);
  if (options.reveal) {
    state.panel.reveal(vscode.ViewColumn.One, false);
  }
}

export function showStatsPanel(
  state: DashboardPanelState,
  data: DashboardData,
  onCommand: (message?: WebviewCommandMessage) => void | Promise<void>,
  onVisible?: () => void | Promise<void>
): void {
  const workspaceName = data.projectStats?.workspaceName ?? data.todayStats?.workspaceName ?? 'Dashboard';
  if (!state.panel) {
    state.panel = vscode.window.createWebviewPanel('codeInfoStats', `Code Info · ${workspaceName}`, vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true
    });

    state.panel.onDidDispose(() => {
      state.panel = undefined;
    });
    state.panel.onDidChangeViewState((event) => {
      if (event.webviewPanel.visible) {
        void onVisible?.();
      }
    });

    state.panel.webview.onDidReceiveMessage((message: WebviewCommandMessage) => {
      void onCommand(message);
    });
  }

  state.panel.title = `Code Info · ${workspaceName}`;
  renderPanel(state.panel, data);
  state.panel.reveal(vscode.ViewColumn.One, false);
}

export function showDashboardEmptyPanel(
  state: DashboardPanelState,
  onCommand: (message?: WebviewCommandMessage) => void | Promise<void>,
  onVisible?: () => void | Promise<void>
): void {
  if (!state.panel) {
    state.panel = vscode.window.createWebviewPanel('codeInfoStats', 'Code Info · Dashboard', vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true
    });

    state.panel.onDidDispose(() => {
      state.panel = undefined;
    });
    state.panel.onDidChangeViewState((event) => {
      if (event.webviewPanel.visible) {
        void onVisible?.();
      }
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

function renderPanel(panel: vscode.WebviewPanel, data: DashboardData): void {
  const workspaceName = data.projectStats?.workspaceName ?? data.todayStats?.workspaceName ?? '当前工作区';
  const presentation: PresentationMode = {
    compact: false,
    title: `${workspaceName} 代码统计看板`,
    subtitle: '包含今日统计分析、项目分析、模块目录树和近期 Git 活动。'
  };

  panel.webview.html = getDashboardHtml(panel.webview, data, presentation);
}
