import * as vscode from 'vscode';
import { openResource } from './resourceNavigator';

export type WebviewCommandMessage = {
  command?: string;
  resource?: string;
  line?: number;
  character?: number;
};

export async function handleWebviewCommand(message?: WebviewCommandMessage): Promise<void> {
  switch (message?.command) {
    case 'refresh':
      await vscode.commands.executeCommand('codeInfo.refreshStats');
      return;
    case 'refreshToday':
      await vscode.commands.executeCommand('codeInfo.refreshTodayStats');
      return;
    case 'refreshLast7Days':
      await vscode.commands.executeCommand('codeInfo.refreshLast7DaysStats');
      return;
    case 'refreshLast30Days':
      await vscode.commands.executeCommand('codeInfo.refreshLast30DaysStats');
      return;
    case 'selectScope':
      await vscode.commands.executeCommand('codeInfo.selectAnalysisDirectories');
      return;
    case 'showStats':
      await vscode.commands.executeCommand('codeInfo.showStats');
      return;
    case 'openPanel':
      await vscode.commands.executeCommand('codeInfo.openPanel');
      return;
    case 'openCompare':
      await vscode.commands.executeCommand('codeInfo.openCompare');
      return;
    case 'exportJson':
      await vscode.commands.executeCommand('codeInfo.exportJson');
      return;
    case 'exportCsv':
      await vscode.commands.executeCommand('codeInfo.exportCsv');
      return;
    case 'openFile':
      await openResource(message.resource);
      return;
    case 'openLocation':
      await openResource(message.resource, message.line, message.character);
      return;
    default:
      return;
  }
}
