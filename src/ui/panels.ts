import * as vscode from 'vscode';
import type { DashboardData, PresentationMode } from '../types';
import { getDashboardHtml, getEmptyStateHtml } from '../webview/templates';
import { buildDashboardWebviewResources } from '../webview/dashboardShell';
import type { WebviewCommandMessage } from './webviewCommands';

export type DashboardPanelState = {
  panel: vscode.WebviewPanel | undefined;
  extensionUri?: vscode.Uri;
};

export function updatePanelIfOpen(
  state: DashboardPanelState,
  data: DashboardData,
  options: { reveal: boolean }
): void {
  if (!state.panel) {
    return;
  }

  renderPanel(state.panel, data, state.extensionUri);
  if (options.reveal) {
    state.panel.reveal(vscode.ViewColumn.One, false);
  }
}

export function showStatsPanel(
  state: DashboardPanelState,
  data: DashboardData,
  onCommand: (message?: WebviewCommandMessage) => void | Promise<void>,
  onVisible?: () => void | Promise<void>,
  extensionUri?: vscode.Uri
): void {
  const workspaceName = getDashboardPanelTitle(data);
  const panel = ensurePanel(state, `Code Info · ${workspaceName}`, onCommand, onVisible, extensionUri);

  panel.title = `Code Info · ${workspaceName}`;
  applyPanelIcon(panel, extensionUri);
  renderPanel(panel, data, extensionUri);
  panel.reveal(vscode.ViewColumn.One, false);
}

export function showDashboardEmptyPanel(
  state: DashboardPanelState,
  onCommand: (message?: WebviewCommandMessage) => void | Promise<void>,
  onVisible?: () => void | Promise<void>,
  extensionUri?: vscode.Uri
): void {
  const panel = ensurePanel(state, 'Code Info · Dashboard', onCommand, onVisible, extensionUri);

  panel.title = 'Code Info · Dashboard';
  applyPanelIcon(panel, extensionUri);
  panel.webview.html = getEmptyStateHtml(panel.webview, false, {
    showOpenPanel: false,
    cssUri: buildDashboardWebviewResources(panel.webview, extensionUri).cssUri,
    gsapUri: buildDashboardWebviewResources(panel.webview, extensionUri).gsapUri
  });
  panel.reveal(vscode.ViewColumn.One, false);
}

export function showEmptyIfOpen(state: DashboardPanelState): void {
  if (!state.panel) {
    return;
  }
  state.panel.webview.html = getEmptyStateHtml(state.panel.webview, false, {
    showOpenPanel: false,
    cssUri: buildDashboardWebviewResources(state.panel.webview, state.extensionUri).cssUri,
    gsapUri: buildDashboardWebviewResources(state.panel.webview, state.extensionUri).gsapUri
  });
}

function renderPanel(panel: vscode.WebviewPanel, data: DashboardData, extensionUri?: vscode.Uri): void {
  const workspaceName = data.projectStats?.workspaceName ?? data.todayStats?.workspaceName ?? '当前工作区';
  const presentation: PresentationMode = {
    compact: false,
    title: `${workspaceName} 代码统计看板`,
    subtitle: '包含今日统计分析、项目分析、模块目录树和近期 Git 活动。'
  };

  const resources = buildDashboardWebviewResources(panel.webview, extensionUri);
  panel.webview.html = getDashboardHtml(panel.webview, data, presentation, {
    echartsUri: resources.echartsUri,
    cssUri: resources.cssUri,
    gsapUri: resources.gsapUri,
    scriptUri: resources.scriptUri
  });
}

export function getDashboardPanelTitle(data: DashboardData, fallback = 'Dashboard'): string {
  return data.projectStats?.workspaceName ?? data.todayStats?.workspaceName ?? fallback;
}

export function createDashboardPanelOptions(
  extensionUri?: vscode.Uri
): vscode.WebviewOptions & vscode.WebviewPanelOptions {
  return {
    enableScripts: true,
    retainContextWhenHidden: true,
    ...(extensionUri ? { localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')] } : {})
  };
}

function ensurePanel(
  state: DashboardPanelState,
  initialTitle: string,
  onCommand: (message?: WebviewCommandMessage) => void | Promise<void>,
  onVisible?: () => void | Promise<void>,
  extensionUri?: vscode.Uri
): vscode.WebviewPanel {
  state.extensionUri = extensionUri;

  if (!state.panel) {
    state.panel = vscode.window.createWebviewPanel(
      'codeInfoStats',
      initialTitle,
      vscode.ViewColumn.One,
      createDashboardPanelOptions(extensionUri)
    );
    applyPanelIcon(state.panel, extensionUri);

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

  return state.panel;
}

function applyPanelIcon(panel: vscode.WebviewPanel, extensionUri?: vscode.Uri): void {
  if (!extensionUri) {
    return;
  }

  const icon = vscode.Uri.joinPath(extensionUri, 'resources', 'icon.png');
  panel.iconPath = { light: icon, dark: icon };
}
