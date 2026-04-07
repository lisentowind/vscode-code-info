import * as vscode from 'vscode';
import type { AnalysisDateRangePreset } from '../analysis/dateRange';
import { exportStatsFile } from '../export/exporter';
import { DashboardController } from './dashboardController';
import { resetComparePanel, showComparePanel, type ComparePanelControllerState } from '../ui/comparePanel';
import { selectAnalysisDirectories } from '../ui/scopePicker';
import { showDashboardEmptyPanel, showStatsPanel, type DashboardPanelState } from '../ui/panels';
import { handleWebviewCommand } from '../ui/webviewCommands';

export function registerCodeInfoCommands(
  context: vscode.ExtensionContext,
  controller: DashboardController,
  dashboardPanelState: DashboardPanelState,
  comparePanelState: ComparePanelControllerState,
  refreshToday: (preset?: AnalysisDateRangePreset) => Promise<void>,
  logger?: vscode.OutputChannel
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('codeInfo.openCompare', async () => {
      showComparePanel(comparePanelState, context.extensionUri);
    }),
    vscode.commands.registerCommand('codeInfo.showStats', async () => {
      const stats = await controller.analyzeProject({ revealPanel: true });
      if (!controller.hasTodayStats()) {
        await controller.refreshToday({ revealPanel: false, silent: true, force: false });
      }
      if (stats || controller.hasTodayStats()) {
        showStatsPanel(dashboardPanelState, controller.getDashboardData(), handleWebviewCommand, refreshToday, context.extensionUri);
      }
    }),
    vscode.commands.registerCommand('codeInfo.selectAnalysisDirectories', async () => {
      await selectAnalysisDirectories(logger);
      controller.clearProjectStats();
      await controller.refreshToday({ revealPanel: false, silent: true, force: true });
      controller.renderLatest();
      showDashboardEmptyPanel(dashboardPanelState, handleWebviewCommand, refreshToday, context.extensionUri);
    }),
    vscode.commands.registerCommand('codeInfo.openPanel', async () => {
      if (!controller.hasTodayStats()) {
        await controller.refreshToday({ revealPanel: false, silent: true, force: false });
      }

      if (controller.hasProjectStats() || controller.hasTodayStats()) {
        showStatsPanel(dashboardPanelState, controller.getDashboardData(), handleWebviewCommand, refreshToday, context.extensionUri);
        return;
      }

      showDashboardEmptyPanel(dashboardPanelState, handleWebviewCommand, refreshToday, context.extensionUri);
    }),
    vscode.commands.registerCommand('codeInfo.refreshStats', async () => {
      await controller.analyzeProject({ revealPanel: false });
      await controller.refreshToday({ revealPanel: false, silent: true, force: true });
    }),
    vscode.commands.registerCommand('codeInfo.refreshTodayStats', async () => {
      await controller.refreshToday({ revealPanel: false, silent: true, preset: 'today', force: true });
    }),
    vscode.commands.registerCommand('codeInfo.refreshLast7DaysStats', async () => {
      await controller.refreshToday({ revealPanel: false, silent: true, preset: 'last7Days', force: true });
    }),
    vscode.commands.registerCommand('codeInfo.refreshLast30DaysStats', async () => {
      await controller.refreshToday({ revealPanel: false, silent: true, preset: 'last30Days', force: true });
    }),
    vscode.commands.registerCommand('codeInfo.export', async () => {
      const stats = await controller.ensureStats();
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
      const stats = await controller.ensureStats();
      if (stats) {
        await exportStatsFile(stats, 'json');
      }
    }),
    vscode.commands.registerCommand('codeInfo.exportCsv', async () => {
      const stats = await controller.ensureStats();
      if (stats) {
        await exportStatsFile(stats, 'csv');
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      controller.resetWorkspaceState();
      resetComparePanel(comparePanelState);
    })
  ];
}
