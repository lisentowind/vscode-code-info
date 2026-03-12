import { stat } from 'node:fs/promises';
import path from 'node:path';
import * as vscode from 'vscode';
import { analyzeGitTodayChanges } from '../git/today';
import type { Logger, TodayDeletedFile, TodayFileStat, TodayStats } from '../types';
import { analyzeTextFile } from './fileAnalyzer';
import { findWorkspaceFilesForAnalysis, getWorkerCount, isBinaryLike } from './targets';
import { buildLanguageSummaries } from './summaries';

type FileTimestampStatus =
  | { kind: 'skip' }
  | { kind: 'touch'; status: 'new' | 'modified'; modifiedAt: string };

export async function analyzeTodayWorkspace(logger?: Logger): Promise<TodayStats> {
  const startTime = Date.now();
  const folders = vscode.workspace.workspaceFolders;

  if (!folders || folders.length === 0) {
    throw new Error('No workspace folder found.');
  }

  const { uris, gitRoot, scopeSummary } = await findWorkspaceFilesForAnalysis(folders, logger);
  const textUris = uris.filter((uri) => !isBinaryLike(uri));
  const initialBinarySkips = uris.length - textUris.length;
  const todayStart = getStartOfToday();
  const gitSinceLabel = formatLocalSinceLabel(todayStart);
  const gitChanges = await analyzeGitTodayChanges(gitRoot, todayStart);
  const deletedFiles: TodayDeletedFile[] = gitChanges.available
    ? gitChanges.deletedFiles
      .map((filePath) => {
        const absolutePath = path.join(gitRoot, filePath);
        const relativePath = vscode.workspace.asRelativePath(absolutePath, false);
        return { path: relativePath };
      })
      .sort((left, right) => left.path.localeCompare(right.path))
    : [];

  const touchedFiles: TodayFileStat[] = [];
  const todoLocations: TodayStats['todoLocations'] = [];
  const maxTodoLocations = 200;
  let skippedUnreadableFiles = 0;
  let skippedBinaryFiles = initialBinarySkips;
  let currentIndex = 0;
  const workerCount = Math.min(Math.max(getWorkerCount(), 1), Math.max(textUris.length, 1));

  const workers = Array.from({ length: workerCount }, async () => {
    while (currentIndex < textUris.length) {
      const index = currentIndex;
      currentIndex += 1;
      const uri = textUris[index];
      const timestampStatus = await getTodayStatus(uri, todayStart);

      if (timestampStatus.kind === 'skip') {
        continue;
      }

      const analyzed = await analyzeTextFile(uri);
      switch (analyzed.kind) {
        case 'file':
          touchedFiles.push({
            ...analyzed.file,
            status: timestampStatus.status,
            modifiedAt: timestampStatus.modifiedAt
          });
          if (analyzed.todoLocations.length && todoLocations.length < maxTodoLocations) {
            todoLocations.push(...analyzed.todoLocations.slice(0, maxTodoLocations - todoLocations.length));
          }
          break;
        case 'skipped-binary-content':
          skippedBinaryFiles += 1;
          break;
        case 'skipped-unreadable':
          skippedUnreadableFiles += 1;
          break;
      }
    }
  });

  await Promise.all(workers);

  const sortedTouchedFiles = [...touchedFiles].sort((left, right) =>
    right.modifiedAt.localeCompare(left.modifiedAt) || right.codeLines - left.codeLines
  );
  const newFiles = sortedTouchedFiles.filter((file) => file.status === 'new');
  const languages = buildLanguageSummaries(touchedFiles);
  todoLocations.sort((left, right) => left.path.localeCompare(right.path) || left.line - right.line || left.keyword.localeCompare(right.keyword));
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
      deletedLines: 0
    }
  );
  totals.deletedFiles = deletedFiles.length;
  totals.addedLines = gitChanges.addedLines;
  totals.deletedLines = gitChanges.deletedLines;

  const topLanguage = languages[0];
  const topTouchedFile = sortedTouchedFiles[0];
  const durationMs = Date.now() - startTime;

  logger?.appendLine(
    `Today analysis done: ${scopeSummary} (touched: ${touchedFiles.length}, deleted: ${deletedFiles.length}, duration: ${durationMs}ms)`
  );

  return {
    workspaceName: folders.length === 1 ? folders[0].name : 'Multi-root Workspace',
    generatedAt: new Date().toLocaleString(),
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
      gitSince: gitSinceLabel
    }
  };
}

async function getTodayStatus(uri: vscode.Uri, todayStart: Date): Promise<FileTimestampStatus> {
  try {
    const info = await stat(uri.fsPath);
    const modifiedAt = new Date(info.mtimeMs);
    if (modifiedAt < todayStart) {
      return { kind: 'skip' };
    }

    const createdAtMs = Number.isFinite(info.birthtimeMs) && info.birthtimeMs > 0 ? info.birthtimeMs : info.ctimeMs;
    const createdToday = createdAtMs >= todayStart.getTime();

    return {
      kind: 'touch',
      status: createdToday ? 'new' : 'modified',
      modifiedAt: modifiedAt.toLocaleTimeString()
    };
  } catch {
    return { kind: 'skip' };
  }
}

function getStartOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function formatLocalSinceLabel(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day} 00:00`;
}
