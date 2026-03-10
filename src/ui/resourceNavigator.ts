import * as vscode from 'vscode';

export async function openResource(resource?: string): Promise<void> {
  if (!resource) {
    return;
  }

  try {
    const uri = vscode.Uri.parse(resource);
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document, { preview: false });
  } catch {
    void vscode.window.showWarningMessage('Code Info: 无法打开所选文件。');
  }
}
