import * as vscode from 'vscode';
import { analyzeCompare } from '../analysis/compareAnalyzer';
import { getCurrentBranchName, listLocalBranches, resolveDefaultCompareBase } from '../git/compare';
import type { CompareOpenTarget, CompareRequest, CompareStats, GitRootOption, GitRootSelection } from '../types';
import { openCompareTarget } from './resourceNavigator';
import { getCompareHtml } from '../webview/compareTemplates';
import { getSingleRootPathOrError } from '../workspace/rootSupport';
import type { GitRootContextController } from '../workspace/gitRootContext';

export type ComparePanelRunStatus = 'idle' | 'loading' | 'success' | 'error';

export type ComparePanelState = {
  mode: CompareRequest['mode'];
  baseRef: string;
  headRef: string;
  branchOptions: string[];
  gitRootOptions: GitRootOption[];
  selectedGitRootPath: string;
  status: ComparePanelRunStatus;
  latestResult?: CompareStats;
  latestError?: string;
};

export type ComparePanelControllerState = {
  panel: vscode.WebviewPanel | undefined;
  extensionUri?: vscode.Uri;
  state: ComparePanelState;
  gitRootContext?: GitRootContextController;
  gitRootSubscription?: vscode.Disposable;
};

type ComparePanelAction =
  | { type: 'run:start' }
  | { type: 'run:success'; result: CompareStats }
  | { type: 'run:error'; error: string };

type ComparePanelMessage = {
  command?: string;
  mode?: CompareRequest['mode'];
  value?: string;
  target?: CompareOpenTarget;
  line?: number;
  character?: number;
};

export function createInitialComparePanelState(): ComparePanelState {
  return {
    mode: 'branch',
    baseRef: '',
    headRef: '',
    branchOptions: [],
    gitRootOptions: [],
    selectedGitRootPath: '',
    status: 'idle'
  };
}

export function applyCompareModeChange(
  state: ComparePanelState,
  mode: CompareRequest['mode']
): ComparePanelState {
  return {
    ...state,
    mode,
    baseRef: '',
    headRef: '',
    branchOptions: [],
    selectedGitRootPath: state.selectedGitRootPath,
    gitRootOptions: state.gitRootOptions,
    status: 'idle',
    latestResult: undefined,
    latestError: undefined
  };
}

export function applyCompareGitRootChange(
  state: ComparePanelState,
  rootPath: string
): ComparePanelState {
  return {
    ...state,
    baseRef: '',
    headRef: '',
    branchOptions: [],
    selectedGitRootPath: rootPath,
    status: 'idle',
    latestResult: undefined,
    latestError: undefined
  };
}

export function buildCompareRequestFromPanelState(state: ComparePanelState): CompareRequest | undefined {
  const baseRef = state.baseRef.trim() || undefined;
  const headRef = state.headRef.trim() || undefined;

  if (state.mode === 'branch') {
    return {
      mode: 'branch',
      baseRef,
      headRef
    };
  }

  if (!baseRef || !headRef) {
    return undefined;
  }

  return {
    mode: 'commit',
    baseRef,
    headRef
  };
}

export function reduceComparePanelState(state: ComparePanelState, action: ComparePanelAction): ComparePanelState {
  switch (action.type) {
    case 'run:start':
      return {
        ...state,
        status: 'loading',
        latestError: undefined
      };
    case 'run:success':
      return {
        ...state,
        status: 'success',
        latestResult: action.result,
        latestError: undefined
      };
    case 'run:error':
      return {
        ...state,
        status: 'error',
        latestResult: undefined,
        latestError: action.error
      };
  }
}

export function showComparePanel(
  controller: ComparePanelControllerState,
  extensionUri?: vscode.Uri
): void {
  if (controller.gitRootContext) {
    controller.state = syncCompareStateWithGitRootSelection(controller.state, controller.gitRootContext.getSnapshot());
  }
  const panel = ensureComparePanel(controller, extensionUri);
  renderComparePanel(panel, controller.state, controller.extensionUri);
  panel.reveal(vscode.ViewColumn.One, false);

  void ensureBranchModeReady(controller);
}

export function resetComparePanel(controller: ComparePanelControllerState): void {
  controller.state = controller.gitRootContext
    ? syncCompareStateWithGitRootSelection(createInitialComparePanelState(), controller.gitRootContext.getSnapshot())
    : createInitialComparePanelState();
  if (controller.panel) {
    renderComparePanel(controller.panel, controller.state, controller.extensionUri);
  }
}

async function ensureBranchModeReady(controller: ComparePanelControllerState): Promise<void> {
  if (controller.state.mode !== 'branch') {
    return;
  }

  if (!controller.state.branchOptions.length) {
    try {
      controller.state = await hydrateBranchState(controller.state);
      if (controller.panel) {
        renderComparePanel(controller.panel, controller.state, controller.extensionUri);
      }
    } catch (error) {
      controller.state = reduceComparePanelState(controller.state, {
        type: 'run:error',
        error: error instanceof Error ? error.message : String(error)
      });
      if (controller.panel) {
        renderComparePanel(controller.panel, controller.state, controller.extensionUri);
      }
      return;
    }
  }

  if (controller.state.status === 'idle') {
    await runCompare(controller);
  }
}

async function hydrateBranchState(state: ComparePanelState): Promise<ComparePanelState> {
  const rootPath = getCompareRootPath(state);
  const [branchOptions, currentBranch] = await Promise.all([
    listLocalBranches(rootPath),
    getCurrentBranchName(rootPath)
  ]);
  const baseRef = state.baseRef || (await resolveFallbackBaseRef(rootPath, branchOptions, currentBranch));

  return {
    ...state,
    branchOptions,
    baseRef,
    headRef: state.headRef || currentBranch,
    latestError: undefined
  };
}

async function resolveFallbackBaseRef(rootPath: string, branchOptions: string[], currentBranch: string): Promise<string> {
  try {
    return await resolveDefaultCompareBase(rootPath);
  } catch {
    return branchOptions.find((branch) => branch !== currentBranch) ?? currentBranch;
  }
}

function getWorkspaceRootPath(): string {
  return getSingleRootPathOrError(vscode.workspace.workspaceFolders, '变更对比');
}

function getCompareRootPath(state: ComparePanelState): string {
  return state.selectedGitRootPath || getWorkspaceRootPath();
}

function ensureComparePanel(
  controller: ComparePanelControllerState,
  extensionUri?: vscode.Uri
): vscode.WebviewPanel {
  controller.extensionUri = extensionUri;
  bindCompareGitRootContext(controller);

  if (!controller.panel) {
    controller.panel = vscode.window.createWebviewPanel(
      'codeInfoCompare',
      'Code Info · 变更对比',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        ...(extensionUri ? { localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')] } : {})
      }
    );
    applyComparePanelIcon(controller.panel, extensionUri);

    controller.panel.onDidDispose(() => {
      controller.gitRootSubscription?.dispose();
      controller.gitRootSubscription = undefined;
      controller.panel = undefined;
    });
    controller.panel.webview.onDidReceiveMessage((message: ComparePanelMessage) => {
      void handleComparePanelMessage(controller, message);
    });
  }

  return controller.panel;
}

function bindCompareGitRootContext(controller: ComparePanelControllerState): void {
  if (!controller.gitRootContext || controller.gitRootSubscription) {
    return;
  }

  controller.gitRootSubscription = controller.gitRootContext.onDidChange((selection) => {
    const previousRootPath = controller.state.selectedGitRootPath;
    controller.state = syncCompareStateWithGitRootSelection(controller.state, selection);
    if (controller.panel) {
      renderComparePanel(controller.panel, controller.state, controller.extensionUri);
    }
    if (
      controller.state.mode === 'branch' &&
      controller.state.selectedGitRootPath &&
      (previousRootPath !== controller.state.selectedGitRootPath || !controller.state.branchOptions.length)
    ) {
      void ensureBranchModeReady(controller);
    }
  });
}

export function syncCompareStateWithGitRootSelection(
  state: ComparePanelState,
  selection: GitRootSelection
): ComparePanelState {
  const nextSelectedGitRootPath = selection.selected?.rootPath ?? '';
  const nextGitRootOptions = selection.isMultiRoot ? selection.options : [];
  const nextState = {
    ...state,
    gitRootOptions: nextGitRootOptions,
    selectedGitRootPath: nextSelectedGitRootPath
  };

  if (state.selectedGitRootPath && state.selectedGitRootPath !== nextSelectedGitRootPath) {
    return applyCompareGitRootChange(nextState, nextSelectedGitRootPath);
  }

  return nextState;
}

async function handleComparePanelMessage(
  controller: ComparePanelControllerState,
  message: ComparePanelMessage
): Promise<void> {
  switch (message.command) {
    case 'compare:setMode':
      controller.state = applyCompareModeChange(controller.state, message.mode === 'commit' ? 'commit' : 'branch');
      if (controller.panel) {
        renderComparePanel(controller.panel, controller.state, controller.extensionUri);
      }
      if (controller.state.mode === 'branch') {
        await ensureBranchModeReady(controller);
      }
      return;
    case 'compare:updateBaseRef':
      controller.state = { ...controller.state, baseRef: message.value ?? '', latestError: undefined };
      if (controller.panel) {
        renderComparePanel(controller.panel, controller.state, controller.extensionUri);
      }
      return;
    case 'compare:updateHeadRef':
      controller.state = { ...controller.state, headRef: message.value ?? '', latestError: undefined };
      if (controller.panel) {
        renderComparePanel(controller.panel, controller.state, controller.extensionUri);
      }
      return;
    case 'compare:updateGitRoot':
      if (!message.value) {
        return;
      }
      if (controller.gitRootContext) {
        await controller.gitRootContext.setSelectedRootPath(message.value);
        return;
      }
      controller.state = applyCompareGitRootChange(controller.state, message.value);
      if (controller.panel) {
        renderComparePanel(controller.panel, controller.state, controller.extensionUri);
      }
      if (controller.state.mode === 'branch') {
        await ensureBranchModeReady(controller);
      }
      return;
    case 'compare:run':
      await runCompare(controller);
      return;
    case 'compare:openFile':
      if (message.target) {
        await openCompareTarget(message.target, message.line, message.character);
      }
      return;
    default:
      return;
  }
}

async function runCompare(controller: ComparePanelControllerState): Promise<void> {
  const request = buildCompareRequestFromPanelState(controller.state);
  if (!request) {
    controller.state = reduceComparePanelState(controller.state, {
      type: 'run:error',
      error: 'Commit 对比需要同时填写 baseRef 和 headRef。'
    });
    if (controller.panel) {
      renderComparePanel(controller.panel, controller.state, controller.extensionUri);
    }
    return;
  }

  controller.state = reduceComparePanelState(controller.state, { type: 'run:start' });
  if (controller.panel) {
    renderComparePanel(controller.panel, controller.state, controller.extensionUri);
  }

  try {
    const result = await analyzeCompare(request, undefined, {
      rootPath: getCompareRootPath(controller.state),
      workspaceFolderNames: vscode.workspace.workspaceFolders?.map((folder) => folder.name) ?? []
    });
    controller.state = reduceComparePanelState(controller.state, { type: 'run:success', result });
  } catch (error) {
    controller.state = reduceComparePanelState(controller.state, {
      type: 'run:error',
      error: error instanceof Error ? error.message : String(error)
    });
  }

  if (controller.panel) {
    renderComparePanel(controller.panel, controller.state, controller.extensionUri);
  }
}

function renderComparePanel(panel: vscode.WebviewPanel, state: ComparePanelState, extensionUri?: vscode.Uri): void {
  panel.title = 'Code Info · 变更对比';
  applyComparePanelIcon(panel, extensionUri);
  panel.webview.html = getCompareHtml(panel.webview, state, {
    cssUri: getCssUri(panel.webview, extensionUri),
    gsapUri: getGsapUri(panel.webview, extensionUri)
  });
}

export function applyComparePanelIcon(panel: vscode.WebviewPanel, extensionUri?: vscode.Uri): void {
  if (!extensionUri) {
    return;
  }

  const icon = vscode.Uri.joinPath(extensionUri, 'resources', 'icon.png');
  panel.iconPath = { light: icon, dark: icon };
}

function getCssUri(webview: vscode.Webview, extensionUri?: vscode.Uri): string | undefined {
  if (!extensionUri) {
    return undefined;
  }
  return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'webview', 'macos26.css')).toString();
}

function getGsapUri(webview: vscode.Webview, extensionUri?: vscode.Uri): string | undefined {
  if (!extensionUri) {
    return undefined;
  }

  return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'vendor', 'gsap.min.js')).toString();
}
