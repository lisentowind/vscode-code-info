import type { AnalysisDateRangePreset } from '../analysis/dateRange';
import type { DashboardData, GitRootSelection, TodayStats, WorkspaceStats } from '../types';

export type CodeInfoAppState = {
  latestProjectStats: WorkspaceStats | undefined;
  latestTodayStats: TodayStats | undefined;
  latestRangePreset: AnalysisDateRangePreset;
  refreshTodayTask: Promise<TodayStats | undefined> | undefined;
  refreshTodayTaskPreset: AnalysisDateRangePreset | undefined;
};

export function createCodeInfoAppState(): CodeInfoAppState {
  return {
    latestProjectStats: undefined,
    latestTodayStats: undefined,
    latestRangePreset: 'today',
    refreshTodayTask: undefined,
    refreshTodayTaskPreset: undefined
  };
}

export function clearCodeInfoAppState(state: CodeInfoAppState): void {
  state.latestProjectStats = undefined;
  state.latestTodayStats = undefined;
  state.latestRangePreset = 'today';
  state.refreshTodayTask = undefined;
  state.refreshTodayTaskPreset = undefined;
}

export function getDashboardData(state: CodeInfoAppState, gitRoot?: GitRootSelection): DashboardData {
  return {
    projectStats: state.latestProjectStats,
    todayStats: state.latestTodayStats,
    gitRoot
  };
}
