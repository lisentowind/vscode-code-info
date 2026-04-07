import * as vscode from 'vscode';
import type { AnalysisDateRangePreset } from './analysis/dateRange';
import { registerCodeInfoCommands } from './app/commandRegistry';
import { DashboardController } from './app/dashboardController';
import { type DashboardPanelState } from './ui/panels';
import { createInitialComparePanelState, type ComparePanelControllerState } from './ui/comparePanel';
import { CodeInfoSidebarProvider } from './ui/sidebar';
import { CodeInfoStatusBarController } from './ui/statusBar';
import { handleWebviewCommand } from './ui/webviewCommands';

let outputChannel: vscode.OutputChannel | undefined;
const dashboardPanelState: DashboardPanelState = { panel: undefined };
const comparePanelState: ComparePanelControllerState = {
  panel: undefined,
  state: createInitialComparePanelState()
};

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('Code Info');
  context.subscriptions.push(outputChannel);
  outputChannel.appendLine(`Activated: ${new Date().toISOString()}`);

  const statusBar = new CodeInfoStatusBarController();
  context.subscriptions.push(statusBar);

  let sidebarProvider: CodeInfoSidebarProvider;
  let controller: DashboardController;
  const refreshToday = async (preset?: AnalysisDateRangePreset): Promise<void> => {
    await controller.refreshToday({ revealPanel: false, silent: true, preset, force: false });
  };
  sidebarProvider = new CodeInfoSidebarProvider(context.extensionUri, handleWebviewCommand, refreshToday);
  controller = new DashboardController(sidebarProvider, statusBar, dashboardPanelState, outputChannel);
  sidebarProvider.render(controller.getDashboardData());
  statusBar.update(controller.getLatestTodayStats());

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(CodeInfoSidebarProvider.viewType, sidebarProvider),
    ...registerCodeInfoCommands(context, controller, dashboardPanelState, comparePanelState, refreshToday, outputChannel)
  );
}

export function deactivate(): void { }
