import * as vscode from 'vscode';
import type { PresentationMode, WorkspaceStats } from '../types';
import { getDashboardHtml, getEmptyStateHtml } from '../webview/templates';

export class CodeInfoSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codeInfo.sidebar';
  private view: vscode.WebviewView | undefined;
  private latest: WorkspaceStats | undefined;

  public constructor(private readonly onCommand: (command?: string) => void | Promise<void>) { }

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.onDidReceiveMessage((message: { command?: string }) => {
      void this.onCommand(message.command);
    });

    this.render(this.latest);
  }

  public render(stats: WorkspaceStats | undefined): void {
    this.latest = stats;
    if (!this.view) {
      return;
    }

    if (!stats) {
      this.view.webview.html = getEmptyStateHtml(this.view.webview, true);
      return;
    }

    const presentation: PresentationMode = {
      compact: true,
      title: 'Code Info 侧边栏',
      subtitle: '快速浏览代码规模、语言分布和近期 Git 活动。'
    };
    this.view.webview.html = getDashboardHtml(this.view.webview, stats, presentation);
  }
}
