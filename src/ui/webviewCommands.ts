import * as vscode from 'vscode';

export async function handleWebviewCommand(command?: string): Promise<void> {
  switch (command) {
    case 'refresh':
      await vscode.commands.executeCommand('codeInfo.refreshStats');
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
    case 'exportJson':
      await vscode.commands.executeCommand('codeInfo.exportJson');
      return;
    case 'exportCsv':
      await vscode.commands.executeCommand('codeInfo.exportCsv');
      return;
    default:
      return;
  }
}
