import * as vscode from 'vscode';
import type { GitRootOption, GitRootSelection } from '../types';

const GIT_ROOT_WORKSPACE_STATE_KEY = 'codeInfo.gitRootPath';

export function buildGitRootOptions(
  folders: readonly vscode.WorkspaceFolder[] | undefined
): GitRootOption[] {
  if (!folders?.length) {
    return [];
  }

  return folders.map((folder) => ({
    label: folder.name,
    rootPath: folder.uri.fsPath
  }));
}

export function resolveSelectedGitRootOption(
  options: GitRootOption[],
  selectedRootPath: string | undefined
): GitRootOption | undefined {
  if (!options.length) {
    return undefined;
  }

  return options.find((option) => option.rootPath === selectedRootPath) ?? options[0];
}

export class GitRootContextController implements vscode.Disposable {
  private readonly onDidChangeEmitter = new vscode.EventEmitter<GitRootSelection>();

  public readonly onDidChange = this.onDidChangeEmitter.event;

  public constructor(private readonly workspaceState: vscode.Memento) { }

  public dispose(): void {
    this.onDidChangeEmitter.dispose();
  }

  public getSnapshot(
    folders: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders
  ): GitRootSelection {
    const options = buildGitRootOptions(folders);
    const selected = resolveSelectedGitRootOption(options, this.workspaceState.get<string>(GIT_ROOT_WORKSPACE_STATE_KEY));
    return {
      isMultiRoot: options.length > 1,
      options,
      selected
    };
  }

  public async setSelectedRootPath(rootPath: string): Promise<void> {
    await this.workspaceState.update(GIT_ROOT_WORKSPACE_STATE_KEY, rootPath);
    this.onDidChangeEmitter.fire(this.getSnapshot());
  }

  public async refresh(): Promise<void> {
    const snapshot = this.getSnapshot();
    const nextRootPath = snapshot.selected?.rootPath;
    const currentRootPath = this.workspaceState.get<string | undefined>(GIT_ROOT_WORKSPACE_STATE_KEY);
    if (currentRootPath !== nextRootPath) {
      await this.workspaceState.update(GIT_ROOT_WORKSPACE_STATE_KEY, nextRootPath);
    }
    this.onDidChangeEmitter.fire(snapshot);
  }
}
