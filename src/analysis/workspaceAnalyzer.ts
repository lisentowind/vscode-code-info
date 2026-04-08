import * as vscode from 'vscode';
import { getAnalysisModuleDepthSetting } from '../config/settings';
import { analyzeGitHistory, createUnavailableGitStats } from '../git/history';
import type { Logger, WorkspaceStats } from '../types';
import { createGeneratedAt } from './metadata';
import {
  buildDirectoryTree,
  buildDirectorySummaries,
  buildLanguageSummaries,
  buildTodoHotspots,
  buildTodoSummary,
  buildWorkspaceInsights,
  buildWorkspaceTotals
} from './summaries';
import { collectAnalyzedFiles } from './shared';
import { findWorkspaceFilesForAnalysis, getWorkerCount, isBinaryLike } from './targets';
import { resolveWorkspaceGitSupport } from '../workspace/rootSupport';

export async function analyzeWorkspace(logger?: Logger): Promise<WorkspaceStats> {
  const startTime = Date.now();
  const folders = vscode.workspace.workspaceFolders;

  if (!folders || folders.length === 0) {
    throw new Error('No workspace folder found.');
  }

  const { uris, gitRoot, scopeSummary } = await findWorkspaceFilesForAnalysis(folders, logger);
  const textUris = uris.filter((uri) => !isBinaryLike(uri));
  const initialBinarySkips = uris.length - textUris.length;
  const { entries: fileStats, todoLocations, skippedBinaryContent, skippedUnreadableFiles } = await collectAnalyzedFiles(textUris, {
    mapFile: ({ file }) => file,
    workerCount: Math.min(Math.max(getWorkerCount(), 1), Math.max(textUris.length, 1))
  });

  const totals = buildWorkspaceTotals(fileStats);
  const languages = buildLanguageSummaries(fileStats);
  const moduleDepth = getAnalysisModuleDepthSetting();
  const directories = buildDirectorySummaries(fileStats, folders.map((folder) => folder.name), moduleDepth);
  const directoryTree = buildDirectoryTree(fileStats, folders.map((folder) => folder.name));
  const todoSummary = buildTodoSummary(fileStats);
  const todoHotspots = buildTodoHotspots(fileStats);
  const insights = buildWorkspaceInsights(totals, languages, directories, todoSummary);
  const gitSupport = resolveWorkspaceGitSupport(folders);
  const git = gitSupport.supported
    ? await analyzeGitHistory(gitRoot)
    : createUnavailableGitStats(gitSupport.reason);
  const durationMs = Date.now() - startTime;
  const generatedAt = createGeneratedAt();

  logger?.appendLine(
    `Analysis done: ${scopeSummary} (matched: ${uris.length}, analyzed: ${fileStats.length}, duration: ${durationMs}ms)`
  );

  return {
    workspaceName: folders.length === 1 ? folders[0].name : 'Multi-root Workspace',
    generatedAt: generatedAt.generatedAt,
    generatedAtMs: generatedAt.generatedAtMs,
    totals,
    languages,
    directories,
    directoryTree,
    largestFiles: [...fileStats].sort((left, right) => right.lines - left.lines).slice(0, 10),
    files: [...fileStats].sort((left, right) => right.codeLines - left.codeLines),
    todoSummary,
    todoHotspots,
    todoLocations,
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
