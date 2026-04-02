import * as vscode from 'vscode';
import { getAnalysisModuleDepthSetting } from '../config/settings';
import { runGit } from '../git/common';
import {
  mergeCompareDiffRows,
  parseCompareNumstatOutput,
  parseCompareRawOutput,
  resolveCompareTargets
} from '../git/compare';
import type { CompareRequest, CompareStats, Logger } from '../types';
import { analyzeCompareSnapshots } from './compareSnapshots';
import { buildCompareSummaries } from './compareSummaries';

export async function analyzeCompare(
  request: CompareRequest,
  logger?: Logger,
  options?: { rootPath?: string; workspaceFolderNames?: readonly string[]; moduleDepth?: number }
): Promise<CompareStats> {
  const startTime = Date.now();
  const folders = vscode.workspace.workspaceFolders;

  if ((!folders || folders.length === 0) && !options?.rootPath) {
    throw new Error('No workspace folder found.');
  }

  const rootPath = options?.rootPath ?? folders?.[0]?.uri.fsPath;
  if (!rootPath) {
    throw new Error('No workspace folder found.');
  }
  const resolvedTargets = await resolveCompareTargets(rootPath, request);
  const [rawOutput, numstatOutput] = await Promise.all([
    runGit(['diff', '--raw', '-z', '--find-renames', resolvedTargets.baseRef, resolvedTargets.headRef], rootPath),
    runGit(['diff', '--numstat', '-z', '--find-renames', resolvedTargets.baseRef, resolvedTargets.headRef], rootPath)
  ]);

  const rawRows = parseCompareRawOutput(rawOutput);
  const numstatRows = parseCompareNumstatOutput(numstatOutput);
  const diffRows = mergeCompareDiffRows(rawRows, numstatRows);
  const files = await analyzeCompareSnapshots(rootPath, resolvedTargets, diffRows);
  const moduleDepth = options?.moduleDepth ?? getAnalysisModuleDepthSetting();
  const summaryResult = buildCompareSummaries(files, {
    workspaceFolderNames: options?.workspaceFolderNames ?? folders?.map((folder) => folder.name) ?? [],
    moduleDepth
  });
  const analysisMeta = {
    durationMs: Date.now() - startTime,
    totalFiles: files.length,
    textComparableFiles: files.filter((file) => file.textComparable).length,
    skippedBinaryFiles: files.filter((file) => file.notTextComparableReason === 'binary').length,
    skippedSubmoduleFiles: files.filter((file) => file.notTextComparableReason === 'submodule').length
  };

  logger?.appendLine(
    `Compare done: ${resolvedTargets.baseRef}..${resolvedTargets.headRef} (files: ${files.length}, duration: ${analysisMeta.durationMs}ms)`
  );

  return {
    compareSource: resolvedTargets.source,
    resolvedTargets,
    summary: summaryResult.summary,
    files,
    languages: summaryResult.languages,
    directories: summaryResult.directories,
    hotspots: summaryResult.hotspots,
    analysisMeta
  };
}
