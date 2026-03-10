import * as vscode from 'vscode';
import { analyzeTodayWorkspace } from './analysis/todayAnalyzer';
import { analyzeWorkspace } from './analysis/workspaceAnalyzer';
import { exportStatsFile } from './export/exporter';
import { showDashboardEmptyPanel, showEmptyIfOpen, showStatsPanel, updatePanelIfOpen, type DashboardPanelState } from './ui/panels';
import { CodeInfoSidebarProvider } from './ui/sidebar';
import { selectAnalysisDirectories } from './ui/scopePicker';
import { handleWebviewCommand } from './ui/webviewCommands';
import type { DashboardData, TodayStats, WorkspaceStats } from './types';

let latestProjectStats: WorkspaceStats | undefined;
let latestTodayStats: TodayStats | undefined;
let refreshTodayTask: Promise<TodayStats | undefined> | undefined;
let outputChannel: vscode.OutputChannel | undefined;
const dashboardPanelState: DashboardPanelState = { panel: undefined };

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('Code Info');
  context.subscriptions.push(outputChannel);
  outputChannel.appendLine(`Activated: ${new Date().toISOString()}`);

  let sidebarProvider: CodeInfoSidebarProvider;
  const refreshToday = async (): Promise<void> => {
    await refreshTodayAndRender(sidebarProvider, { revealPanel: false, silent: true });
  };
  sidebarProvider = new CodeInfoSidebarProvider(handleWebviewCommand, refreshToday);
  sidebarProvider.render(getDashboardData());

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(CodeInfoSidebarProvider.viewType, sidebarProvider),
    vscode.commands.registerCommand('codeInfo.showStats', async () => {
      const stats = await analyzeAndSync(sidebarProvider, { revealPanel: true });
      if (!latestTodayStats) {
        await refreshTodayAndRender(sidebarProvider, { revealPanel: false, silent: true });
      }
      if (stats || latestTodayStats) {
        showStatsPanel(dashboardPanelState, getDashboardData(), handleWebviewCommand, refreshToday);
      }
    }),
    vscode.commands.registerCommand('codeInfo.selectAnalysisDirectories', async () => {
      await selectAnalysisDirectories(outputChannel);
      latestProjectStats = undefined;
      await refreshTodayAndRender(sidebarProvider, { revealPanel: false, silent: true });
      sidebarProvider.render(getDashboardData());
      showEmptyIfOpen(dashboardPanelState);
    }),
    vscode.commands.registerCommand('codeInfo.openPanel', async () => {
      if (!latestTodayStats) {
        await refreshTodayAndRender(sidebarProvider, { revealPanel: false, silent: true });
      }

      if (latestProjectStats || latestTodayStats) {
        showStatsPanel(dashboardPanelState, getDashboardData(), handleWebviewCommand, refreshToday);
        return;
      }

      showDashboardEmptyPanel(dashboardPanelState, handleWebviewCommand, refreshToday);
    }),
    vscode.commands.registerCommand('codeInfo.refreshStats', async () => {
      await analyzeAndSync(sidebarProvider, { revealPanel: false });
      await refreshTodayAndRender(sidebarProvider, { revealPanel: false, silent: true });
    }),
    vscode.commands.registerCommand('codeInfo.refreshTodayStats', async () => {
      await refreshTodayAndRender(sidebarProvider, { revealPanel: false, silent: true });
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
      latestProjectStats = undefined;
      latestTodayStats = undefined;
      sidebarProvider.render(getDashboardData());
      showEmptyIfOpen(dashboardPanelState);
    })
  );
}

export function deactivate(): void { }

async function ensureStats(sidebarProvider: CodeInfoSidebarProvider): Promise<WorkspaceStats | undefined> {
  if (latestProjectStats) {
    return latestProjectStats;
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

    latestProjectStats = stats;
    sidebarProvider.render(getDashboardData());
    updatePanelIfOpen(dashboardPanelState, getDashboardData(), { reveal: options.revealPanel });
    return stats;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(`Code Info 分析失败：${message}`);
    return undefined;
  }
}

function getDashboardData(): DashboardData {
  return {
    projectStats: latestProjectStats,
    todayStats: latestTodayStats
  };
}

async function refreshTodayAndRender(
  sidebarProvider: CodeInfoSidebarProvider,
  options: { revealPanel: boolean; silent: boolean }
): Promise<TodayStats | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }

  if (refreshTodayTask) {
    return refreshTodayTask;
  }

  refreshTodayTask = (async () => {
    try {
      const stats = await analyzeTodayWorkspace(outputChannel);
      latestTodayStats = stats;
      sidebarProvider.render(getDashboardData());
      updatePanelIfOpen(dashboardPanelState, getDashboardData(), { reveal: options.revealPanel });
      return stats;
    } catch (error) {
      if (!options.silent) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`Code Info 今日统计失败：${message}`);
      }
      return undefined;
    } finally {
      refreshTodayTask = undefined;
    }
  })();

  return refreshTodayTask;
}
