import { availableParallelism } from 'node:os';
import * as vscode from 'vscode';
import { BINARY_EXTENSIONS, DEFAULT_EXCLUDES } from '../constants';
import { getAnalysisDirectoriesSetting } from '../config/settings';
import type { Logger } from '../types';
import { parseAnalysisDirectories } from './scope';

export async function findWorkspaceFilesForAnalysis(
  folders: readonly vscode.WorkspaceFolder[],
  logger?: Logger
): Promise<{ uris: vscode.Uri[]; gitRoot: string; scopeSummary: string }> {
  const configured = getAnalysisDirectoriesSetting();
  const folderNames = new Set(folders.map((folder) => folder.name));

  if (configured.length === 0) {
    const uris = await vscode.workspace.findFiles('**/*', DEFAULT_EXCLUDES);
    return { uris, gitRoot: folders[0].uri.fsPath, scopeSummary: '全工作区' };
  }

  const parsed = parseAnalysisDirectories(configured, folderNames);
  const requests: Thenable<vscode.Uri[]>[] = [];
  const consideredRoots: string[] = [];

  for (const folder of folders) {
    const directories = [
      ...parsed.globalDirectories,
      ...(parsed.scopedDirectories.get(folder.name) ?? [])
    ];

    if (directories.length === 0) {
      continue;
    }

    consideredRoots.push(folder.uri.fsPath);

    for (const directory of directories) {
      const pattern = `${directory.replace(/\\/g, '/').replace(/\/+$/, '')}/**/*`;
      requests.push(vscode.workspace.findFiles(new vscode.RelativePattern(folder, pattern), DEFAULT_EXCLUDES));
    }
  }

  if (requests.length === 0) {
    const uris = await vscode.workspace.findFiles('**/*', DEFAULT_EXCLUDES);
    return { uris, gitRoot: folders[0].uri.fsPath, scopeSummary: '全工作区' };
  }

  const results = await Promise.all(requests);
  const seen = new Map<string, vscode.Uri>();

  for (const group of results) {
    for (const uri of group) {
      seen.set(uri.fsPath, uri);
    }
  }

  const uris = [...seen.values()];
  const gitRoot = consideredRoots[0] ?? folders[0].uri.fsPath;
  const scopeSummary = configured.join(', ');

  logger?.appendLine(`Analysis scope: ${scopeSummary} (files: ${uris.length})`);
  return { uris, gitRoot, scopeSummary };
}

export function getWorkerCount(): number {
  return Math.min(24, Math.max(8, availableParallelism() * 2));
}

export function isBinaryLike(uri: vscode.Uri): boolean {
  const extension = uri.path.split('.').pop()?.toLowerCase() ?? '';
  return BINARY_EXTENSIONS.has(extension);
}
