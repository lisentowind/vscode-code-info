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
  const sections = [
    createSection('summary', [
      ['metric', 'value'],
      ['workspaceName', stats.workspaceName],
      ['generatedAt', stats.generatedAt],
      ['scopeSummary', stats.analysisMeta.scopeSummary],
      ['matchedFiles', `${stats.analysisMeta.matchedFiles}`],
      ['analyzedFiles', `${stats.analysisMeta.analyzedFiles}`],
      ['skippedBinaryFiles', `${stats.analysisMeta.skippedBinaryFiles}`],
      ['skippedUnreadableFiles', `${stats.analysisMeta.skippedUnreadableFiles}`],
      ['durationMs', `${stats.analysisMeta.durationMs}`],
      ['totalFiles', `${stats.totals.files}`],
      ['totalLines', `${stats.totals.lines}`],
      ['codeLines', `${stats.totals.codeLines}`],
      ['commentLines', `${stats.totals.commentLines}`],
      ['blankLines', `${stats.totals.blankLines}`],
      ['bytes', `${stats.totals.bytes}`],
      ['totalTodos', `${stats.insights.totalTodoCount}`]
    ]),
    createSection('languages', [
      ['language', 'files', 'lines', 'codeLines', 'commentLines', 'blankLines', 'bytes', 'todoCount'],
      ...stats.languages.map((language) => [
        language.language,
        `${language.files}`,
        `${language.lines}`,
        `${language.codeLines}`,
        `${language.commentLines}`,
        `${language.blankLines}`,
        `${language.bytes}`,
        `${language.todoCount}`
      ])
    ]),
    createSection('directories', [
      ['path', 'files', 'lines', 'codeLines', 'commentLines', 'blankLines', 'bytes', 'todoCount'],
      ...stats.directories.map((directory) => [
        directory.path,
        `${directory.files}`,
        `${directory.lines}`,
        `${directory.codeLines}`,
        `${directory.commentLines}`,
        `${directory.blankLines}`,
        `${directory.bytes}`,
        `${directory.todoCount}`
      ])
    ]),
    createSection('todoHotspots', [
      ['path', 'language', 'total', 'todo', 'fixme', 'hack'],
      ...stats.todoHotspots.map((file) => [
        file.path,
        file.language,
        `${file.total}`,
        `${file.todo}`,
        `${file.fixme}`,
        `${file.hack}`
      ])
    ]),
    createSection('files', [
      ['path', 'language', 'lines', 'codeLines', 'commentLines', 'blankLines', 'bytes', 'todoTotal', 'todo', 'fixme', 'hack'],
      ...stats.files.map((file) => [
        file.path,
        file.language,
        `${file.lines}`,
        `${file.codeLines}`,
        `${file.commentLines}`,
        `${file.blankLines}`,
        `${file.bytes}`,
        `${file.todoCounts.total}`,
        `${file.todoCounts.todo}`,
        `${file.todoCounts.fixme}`,
        `${file.todoCounts.hack}`
      ])
    ])
  ];

  return sections.join('\n\n');
}

function createSection(title: string, rows: string[][]): string {
  return [[`[${title}]`], ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
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
