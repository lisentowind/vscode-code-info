import * as vscode from 'vscode';
import { analyzeRangeWorkspace } from '../analysis/todayAnalyzer';
import type { AnalysisDateRangePreset } from '../analysis/dateRange';
import { analyzeWorkspaceWithOptions } from '../analysis/workspaceAnalyzer';
import { decideRangeRefresh } from './refreshPolicy';
import { clearCodeInfoAppState, createCodeInfoAppState, getDashboardData, type CodeInfoAppState } from './state';
import { showEmptyIfOpen, type DashboardPanelState, updatePanelIfOpen } from '../ui/panels';
import { CodeInfoSidebarProvider } from '../ui/sidebar';
import { CodeInfoStatusBarController } from '../ui/statusBar';
import type { GitRootSelection, Logger, TodayStats, WorkspaceStats } from '../types';
import { GitRootContextController } from '../workspace/gitRootContext';

const RANGE_REFRESH_CACHE_MAX_AGE_MS = 60_000;

export class DashboardController {
  private readonly state: CodeInfoAppState = createCodeInfoAppState();

  public constructor(
    private readonly sidebarProvider: CodeInfoSidebarProvider,
    private readonly statusBar: CodeInfoStatusBarController,
    private readonly panelState: DashboardPanelState,
    private readonly gitRootContext: GitRootContextController,
    private readonly logger?: Logger
  ) { }

  public getDashboardData() {
    return getDashboardData(this.state, this.gitRootContext.getSnapshot());
  }

  public getLatestTodayStats(): TodayStats | undefined {
    return this.state.latestTodayStats;
  }

  public hasProjectStats(): boolean {
    return Boolean(this.state.latestProjectStats);
  }

  public hasTodayStats(): boolean {
    return Boolean(this.state.latestTodayStats);
  }

  public clearProjectStats(): void {
    this.state.latestProjectStats = undefined;
  }

  public resetWorkspaceState(): void {
    clearCodeInfoAppState(this.state);
    this.sidebarProvider.render(this.getDashboardData());
    this.statusBar.update(undefined);
    showEmptyIfOpen(this.panelState);
  }

  public renderLatest(): void {
    this.sidebarProvider.render(this.getDashboardData());
    this.statusBar.update(this.state.latestTodayStats);
  }

  public async handleGitRootSelectionChanged(): Promise<void> {
    this.renderLatest();
    updatePanelIfOpen(this.panelState, this.getDashboardData(), { reveal: false });

    if (this.state.latestProjectStats) {
      await this.analyzeProject({ revealPanel: false });
    }

    if (this.state.latestTodayStats) {
      await this.refreshToday({
        revealPanel: false,
        silent: true,
        preset: this.state.latestTodayStats.rangePreset,
        force: true
      });
    }
  }

  public async ensureStats(): Promise<WorkspaceStats | undefined> {
    if (this.state.latestProjectStats) {
      return this.state.latestProjectStats;
    }

    return this.analyzeProject({ revealPanel: false });
  }

  public async analyzeProject(options: { revealPanel: boolean }): Promise<WorkspaceStats | undefined> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      void vscode.window.showWarningMessage('Code Info: 请先打开一个工作区再执行统计。');
      return undefined;
    }

    try {
      const gitRootSelection = this.gitRootContext.getSnapshot();
      const stats = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Code Info 正在分析工作区...',
          cancellable: false
        },
        async () => analyzeWorkspaceWithOptions(this.logger, this.getGitRootAnalysisOptions(gitRootSelection))
      );

      this.state.latestProjectStats = stats;
      this.sidebarProvider.render(this.getDashboardData());
      updatePanelIfOpen(this.panelState, this.getDashboardData(), { reveal: options.revealPanel });
      return stats;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void vscode.window.showErrorMessage(`Code Info 分析失败：${message}`);
      return undefined;
    }
  }

  public async refreshToday(options: {
    revealPanel: boolean;
    silent: boolean;
    preset?: AnalysisDateRangePreset;
    force: boolean;
  }): Promise<TodayStats | undefined> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      this.statusBar.update(undefined);
      return undefined;
    }

    const decision = decideRangeRefresh({
      requestedPreset: options.preset,
      latestPreset: this.state.latestRangePreset,
      latestStats: this.state.latestTodayStats
        ? { generatedAt: this.state.latestTodayStats.generatedAt, rangePreset: this.state.latestTodayStats.rangePreset }
        : undefined,
      inFlightPreset: this.state.refreshTodayTaskPreset,
      maxAgeMs: RANGE_REFRESH_CACHE_MAX_AGE_MS,
      force: options.force
    });
    const requestedPreset = decision.preset;
    this.state.latestRangePreset = requestedPreset;

    if (decision.useCached) {
      this.sidebarProvider.render(this.getDashboardData());
      this.statusBar.update(this.state.latestTodayStats);
      updatePanelIfOpen(this.panelState, this.getDashboardData(), { reveal: options.revealPanel });
      return this.state.latestTodayStats;
    }

    if (decision.waitForInFlight && this.state.refreshTodayTask) {
      await this.state.refreshTodayTask;
      if (!decision.rerunAfterInFlight && this.state.latestTodayStats?.rangePreset === requestedPreset) {
        return this.state.latestTodayStats;
      }

      return this.refreshToday({ ...options, preset: requestedPreset });
    }

    this.statusBar.setLoading(true);
    this.state.refreshTodayTaskPreset = requestedPreset;
    this.state.refreshTodayTask = (async () => {
      try {
        const gitRootSelection = this.gitRootContext.getSnapshot();
        const stats = await analyzeRangeWorkspace(
          requestedPreset,
          this.logger,
          this.getGitRootAnalysisOptions(gitRootSelection)
        );
        this.state.latestTodayStats = stats;
        this.sidebarProvider.render(this.getDashboardData());
        this.statusBar.update(this.state.latestTodayStats);
        updatePanelIfOpen(this.panelState, this.getDashboardData(), { reveal: options.revealPanel });
        return stats;
      } catch (error) {
        if (!options.silent) {
          const message = error instanceof Error ? error.message : String(error);
          void vscode.window.showErrorMessage(`Code Info 范围统计失败：${message}`);
        }
        return undefined;
      } finally {
        this.statusBar.setLoading(false);
        this.state.refreshTodayTask = undefined;
        this.state.refreshTodayTaskPreset = undefined;
      }
    })();

    return this.state.refreshTodayTask;
  }

  public async selectGitRoot(): Promise<void> {
    const snapshot = this.gitRootContext.getSnapshot();
    if (!snapshot.isMultiRoot || snapshot.options.length < 2) {
      return;
    }

    const picked = await vscode.window.showQuickPick(
      snapshot.options.map((option) => ({
        label: option.label,
        description: option.rootPath,
        rootPath: option.rootPath
      })),
      {
        placeHolder: '选择当前 Git 仓库',
        title: 'Code Info · Git 仓库'
      }
    );

    if (!picked || picked.rootPath === snapshot.selected?.rootPath) {
      return;
    }

    await this.gitRootContext.setSelectedRootPath(picked.rootPath);
  }

  private getGitRootAnalysisOptions(selection: GitRootSelection): { gitRootPath?: string; gitRootLabel?: string } | undefined {
    const selected = selection.selected;
    if (!selected) {
      return undefined;
    }

    return {
      gitRootPath: selected.rootPath,
      gitRootLabel: selected.label
    };
  }
}
