import * as vscode from 'vscode';
import type { DashboardData, PresentationMode } from '../types';
import { getDashboardHtml, getEmptyStateHtml } from '../webview/templates';
import type { WebviewCommandMessage } from './webviewCommands';

export class CodeInfoSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codeInfo.sidebar';
  private view: vscode.WebviewView | undefined;
  private latest: DashboardData | undefined;

  public constructor(
    private readonly onCommand: (message?: WebviewCommandMessage) => void | Promise<void>,
    private readonly onVisible?: () => void | Promise<void>
  ) { }

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
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

    if (!data?.projectStats && !data?.todayStats) {
      this.view.webview.html = getEmptyStateHtml(this.view.webview, true);
      return;
    }

    const presentation: PresentationMode = {
      compact: true,
      title: 'Code Info · 今日统计',
      subtitle: '这里只展示今日新增/修改文件；点“详情分析”打开大面板看今日 + 项目详情。'
    };
    this.view.webview.html = getDashboardHtml(this.view.webview, data, presentation);
  }
}
