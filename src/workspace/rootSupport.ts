import type * as vscode from 'vscode';
import type { GitUnavailableReason } from '../types';

export function resolveWorkspaceGitSupport(
  folders: readonly vscode.WorkspaceFolder[] | undefined
):
  | { supported: true; rootPath: string }
  | { supported: false; reason: GitUnavailableReason } {
  if (!folders || folders.length === 0) {
    return { supported: false, reason: 'no-workspace-folder' };
  }

  if (folders.length > 1) {
    return { supported: false, reason: 'multi-root-workspace' };
  }

  return {
    supported: true,
    rootPath: folders[0].uri.fsPath
  };
}

export function getSingleRootPathOrError(
  folders: readonly vscode.WorkspaceFolder[] | undefined,
  featureName: string
): string {
  const support = resolveWorkspaceGitSupport(folders);
  if (support.supported) {
    return support.rootPath;
  }

  if (support.reason === 'multi-root-workspace') {
    throw new Error(`Code Info ${featureName}暂不支持多根工作区，请切换到单根工作区后再使用。`);
  }

  throw new Error('No workspace folder found.');
}
