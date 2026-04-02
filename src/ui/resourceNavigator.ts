import * as vscode from 'vscode';
import type { CompareOpenTarget } from '../types';

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

export async function openTextContent(
  title: string,
  content: string,
  language?: string,
  line?: number,
  character?: number
): Promise<void> {
  try {
    const document = await vscode.workspace.openTextDocument({
      content,
      language
    });
    const editor = await vscode.window.showTextDocument(document, { preview: false });
    await setEditorSelection(editor, line, character);
  } catch {
    void vscode.window.showWarningMessage(`Code Info: 无法打开 ${title} 快照。`);
  }
}

export async function openCompareTarget(target: CompareOpenTarget, line?: number, character?: number): Promise<void> {
  if (target.kind === 'workspace') {
    await openResource(target.resource, line, character);
    return;
  }

  if (target.kind === 'snapshot') {
    await openTextContent(target.title, target.content, target.language, line, character);
  }
}

async function setEditorSelection(editor: vscode.TextEditor, line?: number, character?: number): Promise<void> {
  if (typeof line !== 'number' || !Number.isFinite(line) || line <= 0) {
    return;
  }

  const resolvedCharacter = typeof character === 'number' && Number.isFinite(character) && character > 0 ? character : 1;
  const position = new vscode.Position(Math.max(line - 1, 0), Math.max(resolvedCharacter - 1, 0));
  editor.selection = new vscode.Selection(position, position);
  editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}
