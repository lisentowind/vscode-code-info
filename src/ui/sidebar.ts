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
      title: `Code Info · ${rangeLabel}统计`,
      subtitle: `展示 ${rangeLabel} 新增/修改文件；若工作区是 Git 仓库，也会补充删除文件与增删行统计。点“详情分析”打开大面板看范围 + 项目详情。`
    };
    this.view.webview.html = getDashboardHtml(this.view.webview, data, presentation, {
      echartsUri: resources.echartsUri,
      cssUri: resources.cssUri,
      gsapUri: resources.gsapUri,
      scriptUri: resources.scriptUri
    });
  }
}
