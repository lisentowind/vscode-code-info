import * as vscode from 'vscode';
import type { WorkspaceStats } from '../types';

export async function exportStatsFile(stats: WorkspaceStats, format: 'json' | 'csv'): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  const baseFolder = folders?.[0]?.uri;
  const filename = `${sanitizeFilename(stats.workspaceName)}-code-info.${format}`;
  const defaultUri = baseFolder ? vscode.Uri.joinPath(baseFolder, filename) : undefined;
  const uri = await vscode.window.showSaveDialog({
    defaultUri,
    saveLabel: format === 'json' ? '导出 JSON' : '导出 CSV',
    filters: format === 'json' ? { JSON: ['json'] } : { CSV: ['csv'] }
  });

  if (!uri) {
    return;
  }

  const content = format === 'json' ? JSON.stringify(stats, null, 2) : toCsv(stats);
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
  void vscode.window.showInformationMessage(`Code Info: 已导出到 ${uri.fsPath}`);
}

function toCsv(stats: WorkspaceStats): string {
  const rows = [
    ['path', 'language', 'lines', 'codeLines', 'commentLines', 'blankLines', 'bytes'],
    ...stats.files.map((file) => [
      file.path,
      file.language,
      `${file.lines}`,
      `${file.codeLines}`,
      `${file.commentLines}`,
      `${file.blankLines}`,
      `${file.bytes}`
    ])
  ];

  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function sanitizeFilename(value: string): string {
  return value.trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'workspace';
}

