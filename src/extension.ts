import * as vscode from 'vscode';
import { analyzeWorkspace } from './analysis/workspaceAnalyzer';
import { exportStatsFile } from './export/exporter';
import { showDashboardEmptyPanel, showEmptyIfOpen, showStatsPanel, updatePanelIfOpen, type DashboardPanelState } from './ui/panels';
import { CodeInfoSidebarProvider } from './ui/sidebar';
import { selectAnalysisDirectories } from './ui/scopePicker';
import { handleWebviewCommand } from './ui/webviewCommands';
import type { WorkspaceStats } from './types';

let latestStats: WorkspaceStats | undefined;
let outputChannel: vscode.OutputChannel | undefined;
const dashboardPanelState: DashboardPanelState = { panel: undefined };

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('Code Info');
  context.subscriptions.push(outputChannel);
  outputChannel.appendLine(`Activated: ${new Date().toISOString()}`);

  const sidebarProvider = new CodeInfoSidebarProvider(handleWebviewCommand);
  sidebarProvider.render(latestStats);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(CodeInfoSidebarProvider.viewType, sidebarProvider),
    vscode.commands.registerCommand('codeInfo.showStats', async () => {
      const stats = await analyzeAndSync(sidebarProvider, { revealPanel: true });
      if (stats) {
        showStatsPanel(dashboardPanelState, stats, handleWebviewCommand);
      }
    }),
    vscode.commands.registerCommand('codeInfo.selectAnalysisDirectories', async () => {
      await selectAnalysisDirectories(outputChannel);
    }),
    vscode.commands.registerCommand('codeInfo.openPanel', async () => {
      if (latestStats) {
        showStatsPanel(dashboardPanelState, latestStats, handleWebviewCommand);
        return;
      }

      showDashboardEmptyPanel(dashboardPanelState, handleWebviewCommand);
    }),
    vscode.commands.registerCommand('codeInfo.refreshStats', async () => {
      await analyzeAndSync(sidebarProvider, { revealPanel: false });
    }),
    vscode.commands.registerCommand('codeInfo.export', async () => {
      const stats = await ensureStats(sidebarProvider);
      if (!stats) {
        return;
      }

      const picked = await vscode.window.showQuickPick(
        [
          { label: 'JSON', format: 'json' as const },
          { label: 'CSV', format: 'csv' as const }
        ],
        { placeHolder: '选择导出格式' }
      );

      if (!picked) {
        return;
      }

      await exportStatsFile(stats, picked.format);
    }),
    vscode.commands.registerCommand('codeInfo.exportJson', async () => {
      const stats = await ensureStats(sidebarProvider);
      if (stats) {
        await exportStatsFile(stats, 'json');
      }
    }),
    vscode.commands.registerCommand('codeInfo.exportCsv', async () => {
      const stats = await ensureStats(sidebarProvider);
      if (stats) {
        await exportStatsFile(stats, 'csv');
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      latestStats = undefined;
      sidebarProvider.render(undefined);
      showEmptyIfOpen(dashboardPanelState);
    })
  );
}

export function deactivate(): void { }

async function ensureStats(sidebarProvider: CodeInfoSidebarProvider): Promise<WorkspaceStats | undefined> {
  if (latestStats) {
    return latestStats;
  }

  return analyzeAndSync(sidebarProvider, { revealPanel: false });
}

async function analyzeAndSync(
  sidebarProvider: CodeInfoSidebarProvider,
  options: { revealPanel: boolean }
): Promise<WorkspaceStats | undefined> {
  const folders = vscode.workspace.workspaceFolders;

  if (!folders || folders.length === 0) {
    void vscode.window.showWarningMessage('Code Info: 请先打开一个工作区再执行统计。');
    return undefined;
  }

  try {
    const stats = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Code Info 正在分析工作区...',
        cancellable: false
      },
      async () => analyzeWorkspace(outputChannel)
    );

    latestStats = stats;
    sidebarProvider.render(stats);
    updatePanelIfOpen(dashboardPanelState, stats, { reveal: options.revealPanel });
    return stats;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(`Code Info 分析失败：${message}`);
    return undefined;
  }
}

