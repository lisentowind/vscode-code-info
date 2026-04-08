import type { TodayAnalysisSources } from '../types';

export function createGeneratedAt(now: Date = new Date()): {
  generatedAt: string;
  generatedAtMs: number;
} {
  return {
    generatedAt: now.toISOString(),
    generatedAtMs: now.getTime()
  };
}

export function createTodayAnalysisSources(gitAvailable: boolean): TodayAnalysisSources {
  return {
    touchedFiles: 'filesystem-mtime',
    newFiles: 'filesystem-birthtime',
    deletedFiles: gitAvailable ? 'git-log' : 'unavailable',
    lineDeltas: gitAvailable ? 'git-log' : 'unavailable'
  };
}
