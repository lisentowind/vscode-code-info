import * as vscode from 'vscode';

export async function openResource(resource?: string, line?: number, character?: number): Promise<void> {
  if (!resource) {
    return;
  }

  try {
    const uri = vscode.Uri.parse(resource);
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document, { preview: false });

    if (typeof line === 'number' && Number.isFinite(line) && line > 0) {
      const resolvedCharacter = typeof character === 'number' && Number.isFinite(character) && character > 0 ? character : 1;
      const position = new vscode.Position(Math.max(line - 1, 0), Math.max(resolvedCharacter - 1, 0));
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }
  } catch {
    void vscode.window.showWarningMessage('Code Info: 无法打开所选文件。');
  }
}
