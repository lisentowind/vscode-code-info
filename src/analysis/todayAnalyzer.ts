import { stat } from 'node:fs/promises';
import path from 'node:path';
import * as vscode from 'vscode';
import { analyzeGitTodayChanges, createUnavailableGitTodayChangeSummary } from '../git/today';
import type { Logger, TodayDeletedFile, TodayFileStat, TodayStats } from '../types';
import { createPresetDateRange, formatDateRangeLabel, type AnalysisDateRangePreset } from './dateRange';
import { createGeneratedAt, createTodayAnalysisSources } from './metadata';
import { collectAnalyzedFiles } from './shared';
import { findWorkspaceFilesForAnalysis, getWorkerCount, isBinaryLike } from './targets';
import { buildLanguageSummaries } from './summaries';
import { resolveWorkspaceGitSupport } from '../workspace/rootSupport';

type FileTimestampStatus =
  | { kind: 'skip' }
  | { kind: 'touch'; status: 'new' | 'modified'; modifiedAt: string; modifiedAtTimestamp: number };

export async function analyzeTodayWorkspace(logger?: Logger): Promise<TodayStats> {
  return analyzeRangeWorkspace('today', logger);
}

export async function analyzeRangeWorkspace(
  preset: AnalysisDateRangePreset,
  logger?: Logger
): Promise<TodayStats> {
  const startTime = Date.now();
  const folders = vscode.workspace.workspaceFolders;

  if (!folders || folders.length === 0) {
    throw new Error('No workspace folder found.');
  }

  const { uris, gitRoot, scopeSummary } = await findWorkspaceFilesForAnalysis(folders, logger);
  const textUris = uris.filter((uri) => !isBinaryLike(uri));
  const initialBinarySkips = uris.length - textUris.length;
  const range = createPresetDateRange(preset);
  const gitSinceLabel = formatDateRangeLabel(range.start, range.end);
  const gitSupport = resolveWorkspaceGitSupport(folders);
  const gitChanges = gitSupport.supported
    ? await analyzeGitTodayChanges(gitRoot, range.start)
    : createUnavailableGitTodayChangeSummary(gitSupport.reason);
  const deletedFiles: TodayDeletedFile[] = gitChanges.available
    ? gitChanges.deletedFiles
      .map((filePath) => {
        const absolutePath = path.join(gitRoot, filePath);
        const relativePath = vscode.workspace.asRelativePath(absolutePath, false);
        return { path: relativePath };
      })
      .sort((left, right) => left.path.localeCompare(right.path))
    : [];

  const workerCount = Math.min(Math.max(getWorkerCount(), 1), Math.max(textUris.length, 1));
  const {
    entries: touchedFiles,
    todoLocations,
    skippedBinaryContent,
    skippedUnreadableFiles
  } = await collectAnalyzedFiles<TodayFileStat, Extract<FileTimestampStatus, { kind: 'touch' }>>(textUris, {
    prepare: async (uri) => {
      const timestampStatus = await getTodayStatus(uri, range.start, preset);
      return timestampStatus.kind === 'touch' ? timestampStatus : undefined;
    },
    mapFile: ({ file, prepared }) => ({
      ...file,
      status: prepared.status,
      modifiedAt: prepared.modifiedAt,
      modifiedAtTimestamp: prepared.modifiedAtTimestamp
    }),
    workerCount
  });
  const skippedBinaryFiles = initialBinarySkips + skippedBinaryContent;

  const sortedTouchedFiles = sortTouchedFiles(touchedFiles);
  const newFiles = sortedTouchedFiles.filter((file) => file.status === 'new');
  const languages = buildLanguageSummaries(touchedFiles);
  const totals = touchedFiles.reduce(
    (accumulator, file) => {
      accumulator.touchedFiles += 1;
      accumulator.newFiles += file.status === 'new' ? 1 : 0;
      accumulator.lines += file.lines;
      accumulator.codeLines += file.codeLines;
      accumulator.commentLines += file.commentLines;
      accumulator.blankLines += file.blankLines;
      accumulator.bytes += file.bytes;
      accumulator.todoCount += file.todoCounts.total;
      return accumulator;
    },
    {
      touchedFiles: 0,
      newFiles: 0,
      deletedFiles: 0,
      lines: 0,
      codeLines: 0,
      commentLines: 0,
      blankLines: 0,
      bytes: 0,
      todoCount: 0,
      addedLines: 0,
      deletedLines: 0,
      changedLines: 0
    }
  );
  totals.deletedFiles = deletedFiles.length;
  totals.addedLines = gitChanges.addedLines;
  totals.deletedLines = gitChanges.deletedLines;
  totals.changedLines = gitChanges.addedLines + gitChanges.deletedLines;

  const topLanguage = languages[0];
  const topTouchedFile = sortedTouchedFiles[0];
  const durationMs = Date.now() - startTime;
  const generatedAt = createGeneratedAt();
  const sources = createTodayAnalysisSources(gitChanges.available);

  logger?.appendLine(
    `Today analysis done: ${scopeSummary} (touched: ${touchedFiles.length}, deleted: ${deletedFiles.length}, duration: ${durationMs}ms)`
  );

  return {
    workspaceName: folders.length === 1 ? folders[0].name : 'Multi-root Workspace',
    generatedAt: generatedAt.generatedAt,
    generatedAtMs: generatedAt.generatedAtMs,
    rangePreset: preset,
    rangeLabel: range.label,
    totals,
    languages,
    touchedFiles: sortedTouchedFiles.slice(0, 20),
    newFiles: newFiles.slice(0, 20),
    deletedFiles: deletedFiles.slice(0, 20),
    todoLocations,
    insights: {
      topLanguage: topLanguage?.language ?? '—',
      topLanguageShare: totals.codeLines === 0 ? 0 : (topLanguage?.codeLines ?? 0) / totals.codeLines,
      topPath: topTouchedFile?.path ?? '—',
      todoTouchedCount: totals.todoCount
    },
    analysisMeta: {
      durationMs,
      matchedFiles: uris.length,
      analyzedFiles: touchedFiles.length,
      skippedBinaryFiles,
      skippedUnreadableFiles,
      scopeSummary,
      gitAvailable: gitChanges.available,
      gitUnavailableReason: gitChanges.unavailableReason,
      gitSince: gitSinceLabel,
      sources
    }
  };
}

export function sortTouchedFiles(files: TodayFileStat[]): TodayFileStat[] {
  return [...files].sort(
    (left, right) => right.modifiedAtTimestamp - left.modifiedAtTimestamp || right.codeLines - left.codeLines
  );
}

async function getTodayStatus(
  uri: vscode.Uri,
  rangeStart: Date,
  preset: AnalysisDateRangePreset
): Promise<FileTimestampStatus> {
  try {
    const info = await stat(uri.fsPath);
    const modifiedAt = new Date(info.mtimeMs);
    if (modifiedAt < rangeStart) {
      return { kind: 'skip' };
    }

    const createdAtMs = Number.isFinite(info.birthtimeMs) && info.birthtimeMs > 0 ? info.birthtimeMs : info.ctimeMs;
    const createdToday = createdAtMs >= rangeStart.getTime();

    return {
      kind: 'touch',
      status: createdToday ? 'new' : 'modified',
      modifiedAt: formatModifiedAt(modifiedAt, preset),
      modifiedAtTimestamp: modifiedAt.getTime()
    };
  } catch {
    return { kind: 'skip' };
  }
}

function formatModifiedAt(value: Date, preset: AnalysisDateRangePreset): string {
  if (preset === 'today') {
    return value.toLocaleTimeString();
  }

  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  const hour = `${value.getHours()}`.padStart(2, '0');
  const minute = `${value.getMinutes()}`.padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
}
