import * as vscode from 'vscode';
import { getAnalysisModuleDepthSetting } from '../config/settings';
import { analyzeGitHistory } from '../git/history';
import type { FileStat, Logger, WorkspaceStats } from '../types';
import { analyzeTextFile } from './fileAnalyzer';
import {
  buildDirectoryTree,
  buildDirectorySummaries,
  buildLanguageSummaries,
  buildTodoHotspots,
  buildTodoSummary,
  buildWorkspaceInsights,
  buildWorkspaceTotals
} from './summaries';
import { findWorkspaceFilesForAnalysis, getWorkerCount, isBinaryLike } from './targets';

export async function analyzeWorkspace(logger?: Logger): Promise<WorkspaceStats> {
  const startTime = Date.now();
  const folders = vscode.workspace.workspaceFolders;

  if (!folders || folders.length === 0) {
    throw new Error('No workspace folder found.');
  }

  const { uris, gitRoot, scopeSummary } = await findWorkspaceFilesForAnalysis(folders, logger);
  const textUris = uris.filter((uri) => !isBinaryLike(uri));
  const initialBinarySkips = uris.length - textUris.length;
  const { fileStats, skippedBinaryContent, skippedUnreadableFiles } = await analyzeFiles(textUris);

  const totals = buildWorkspaceTotals(fileStats);
  const languages = buildLanguageSummaries(fileStats);
  const moduleDepth = getAnalysisModuleDepthSetting();
  const directories = buildDirectorySummaries(fileStats, folders.map((folder) => folder.name), moduleDepth);
  const directoryTree = buildDirectoryTree(fileStats, folders.map((folder) => folder.name));
  const todoSummary = buildTodoSummary(fileStats);
  const todoHotspots = buildTodoHotspots(fileStats);
  const insights = buildWorkspaceInsights(totals, languages, directories, todoSummary);
  const git = await analyzeGitHistory(gitRoot);
  const durationMs = Date.now() - startTime;

  logger?.appendLine(
    `Analysis done: ${scopeSummary} (matched: ${uris.length}, analyzed: ${fileStats.length}, duration: ${durationMs}ms)`
  );

  return {
    workspaceName: folders.length === 1 ? folders[0].name : 'Multi-root Workspace',
    generatedAt: new Date().toLocaleString(),
    totals,
    languages,
    directories,
    directoryTree,
    largestFiles: [...fileStats].sort((left, right) => right.lines - left.lines).slice(0, 10),
    files: [...fileStats].sort((left, right) => right.codeLines - left.codeLines),
    todoSummary,
    todoHotspots,
    insights,
    analysisMeta: {
      durationMs,
      matchedFiles: uris.length,
      analyzedFiles: fileStats.length,
      skippedBinaryFiles: initialBinarySkips + skippedBinaryContent,
      skippedUnreadableFiles,
      scopeSummary
    },
    git
  };
}

async function analyzeFiles(
  uris: vscode.Uri[]
): Promise<{ fileStats: FileStat[]; skippedBinaryContent: number; skippedUnreadableFiles: number }> {
  const fileStats: FileStat[] = [];
  let skippedBinaryContent = 0;
  let skippedUnreadableFiles = 0;
  let currentIndex = 0;
  const workerCount = Math.min(Math.max(getWorkerCount(), 1), Math.max(uris.length, 1));

  const workers = Array.from({ length: workerCount }, async () => {
    while (currentIndex < uris.length) {
      const index = currentIndex;
      currentIndex += 1;

      const result = await analyzeTextFile(uris[index]);
      switch (result.kind) {
        case 'file':
          fileStats.push(result.file);
          break;
        case 'skipped-binary-content':
          skippedBinaryContent += 1;
          break;
        case 'skipped-unreadable':
          skippedUnreadableFiles += 1;
          break;
      }
    }
  });

  await Promise.all(workers);
  return { fileStats, skippedBinaryContent, skippedUnreadableFiles };
}
