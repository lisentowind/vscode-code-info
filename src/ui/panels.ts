import * as vscode from 'vscode';
import type { DashboardData, PresentationMode } from '../types';
import { getDashboardHtml, getEmptyStateHtml } from '../webview/templates';
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
	  const workspaceName = data.projectStats?.workspaceName ?? data.todayStats?.workspaceName ?? 'Dashboard';
	  state.extensionUri = extensionUri;
	  if (!state.panel) {
	    const webviewOptions: vscode.WebviewOptions & vscode.WebviewPanelOptions = {
	      enableScripts: true,
	      retainContextWhenHidden: true,
	      ...(extensionUri ? { localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')] } : {})
	    };
	    state.panel = vscode.window.createWebviewPanel('codeInfoStats', `Code Info · ${workspaceName}`, vscode.ViewColumn.One, webviewOptions);
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

  state.panel.title = `Code Info · ${workspaceName}`;
  applyPanelIcon(state.panel, extensionUri);
  renderPanel(state.panel, data, extensionUri);
  state.panel.reveal(vscode.ViewColumn.One, false);
}

export function showDashboardEmptyPanel(
  state: DashboardPanelState,
  onCommand: (message?: WebviewCommandMessage) => void | Promise<void>,
  onVisible?: () => void | Promise<void>,
  extensionUri?: vscode.Uri
	): void {
	  state.extensionUri = extensionUri;
	  if (!state.panel) {
	    const webviewOptions: vscode.WebviewOptions & vscode.WebviewPanelOptions = {
	      enableScripts: true,
	      retainContextWhenHidden: true,
	      ...(extensionUri ? { localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')] } : {})
	    };
	    state.panel = vscode.window.createWebviewPanel('codeInfoStats', 'Code Info · Dashboard', vscode.ViewColumn.One, webviewOptions);
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

  state.panel.title = 'Code Info · Dashboard';
  applyPanelIcon(state.panel, extensionUri);
  state.panel.webview.html = getEmptyStateHtml(state.panel.webview, false, { showOpenPanel: false });
  state.panel.reveal(vscode.ViewColumn.One, false);
}

export function showEmptyIfOpen(state: DashboardPanelState): void {
  if (!state.panel) {
    return;
  }
  state.panel.webview.html = getEmptyStateHtml(state.panel.webview, false, { showOpenPanel: false });
}

function renderPanel(panel: vscode.WebviewPanel, data: DashboardData, extensionUri?: vscode.Uri): void {
  const workspaceName = data.projectStats?.workspaceName ?? data.todayStats?.workspaceName ?? '当前工作区';
  const presentation: PresentationMode = {
    compact: false,
    title: `${workspaceName} 代码统计看板`,
    subtitle: '包含今日统计分析、项目分析、模块目录树和近期 Git 活动。'
  };

  const echartsUri = getEchartsUri(panel.webview, extensionUri);
  panel.webview.html = getDashboardHtml(panel.webview, data, presentation, { echartsUri });
}

function applyPanelIcon(panel: vscode.WebviewPanel, extensionUri?: vscode.Uri): void {
  if (!extensionUri) {
    return;
  }

  const icon = vscode.Uri.joinPath(extensionUri, 'resources', 'icon.png');
  panel.iconPath = { light: icon, dark: icon };
}

function getEchartsUri(webview: vscode.Webview, extensionUri?: vscode.Uri): string | undefined {
  if (!extensionUri) {
    return undefined;
  }
  return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'vendor', 'echarts.min.js')).toString();
}
