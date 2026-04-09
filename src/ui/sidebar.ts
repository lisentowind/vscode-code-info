import * as vscode from 'vscode';
import type { DashboardData, PresentationMode } from '../types';
import { getDashboardHtml, getEmptyStateHtml } from '../webview/templates';
import { buildDashboardWebviewResources } from '../webview/dashboardShell';
import type { WebviewCommandMessage } from './webviewCommands';

export class CodeInfoSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codeInfo.sidebar';
  private view: vscode.WebviewView | undefined;
  private latest: DashboardData | undefined;

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly onCommand: (message?: WebviewCommandMessage) => void | Promise<void>,
    private readonly onVisible?: () => void | Promise<void>
  ) { }

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')]
    };
    webviewView.webview.onDidReceiveMessage((message: WebviewCommandMessage) => {
      void this.onCommand(message);
    });
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        void this.onVisible?.();
      }
    });

    this.render(this.latest);
    if (webviewView.visible) {
      void this.onVisible?.();
    }
  }

  public render(data: DashboardData | undefined): void {
    this.latest = data;
    if (!this.view) {
      return;
    }

    const resources = buildDashboardWebviewResources(this.view.webview, this.extensionUri);

    if (!data?.projectStats && !data?.todayStats) {
      this.view.webview.html = getEmptyStateHtml(this.view.webview, true, {
        cssUri: resources.cssUri,
        gsapUri: resources.gsapUri
      });
      return;
    }

    const rangeLabel = data.todayStats?.rangeLabel ?? '今天';
    const presentation: PresentationMode = {
      compact: true,
      title: `Code Info · 开发工作台`,
      subtitle: `${rangeLabel}范围内的关键变化、热点和高频操作入口。`
    };
    this.view.webview.html = getDashboardHtml(this.view.webview, data, presentation, {
      echartsUri: resources.echartsUri,
      cssUri: resources.cssUri,
      gsapUri: resources.gsapUri,
      scriptUri: resources.scriptUri
    });
  }
}
