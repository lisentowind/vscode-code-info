import { availableParallelism } from 'node:os';
import * as vscode from 'vscode';
import { BINARY_EXTENSIONS, DEFAULT_EXCLUDES } from '../constants';
import { getAnalysisDirectoriesSetting, getAnalysisModuleDepthSetting } from '../config/settings';
import { analyzeGitHistory } from '../git/history';
import type { FileStat, Logger, WorkspaceStats } from '../types';
import { detectLanguage } from './languageDetector';
import { countTextMetrics } from './lineMetrics';
import { parseAnalysisDirectories } from './scope';
import {
  buildDirectorySummaries,
  buildLanguageSummaries,
  buildTodoHotspots,
  buildTodoSummary,
  buildWorkspaceInsights,
  buildWorkspaceTotals
} from './summaries';

const textDecoder = new TextDecoder('utf-8');

type FileAnalysisResult =
  | { kind: 'file'; file: FileStat }
  | { kind: 'skipped-binary-content' }
  | { kind: 'skipped-unreadable' };

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

async function findWorkspaceFilesForAnalysis(
  folders: readonly vscode.WorkspaceFolder[],
  logger?: Logger
): Promise<{ uris: vscode.Uri[]; gitRoot: string; scopeSummary: string }> {
  const configured = getAnalysisDirectoriesSetting();
  const folderNames = new Set(folders.map((folder) => folder.name));

  if (configured.length === 0) {
    const uris = await vscode.workspace.findFiles('**/*', DEFAULT_EXCLUDES);
    return { uris, gitRoot: folders[0].uri.fsPath, scopeSummary: '全工作区' };
  }

  const parsed = parseAnalysisDirectories(configured, folderNames);
  const requests: Thenable<vscode.Uri[]>[] = [];
  const consideredRoots: string[] = [];

  for (const folder of folders) {
    const directories = [
      ...parsed.globalDirectories,
      ...(parsed.scopedDirectories.get(folder.name) ?? [])
    ];

    if (directories.length === 0) {
      continue;
    }

    consideredRoots.push(folder.uri.fsPath);

    for (const directory of directories) {
      const pattern = `${directory.replace(/\\/g, '/').replace(/\/+$/, '')}/**/*`;
      requests.push(vscode.workspace.findFiles(new vscode.RelativePattern(folder, pattern), DEFAULT_EXCLUDES));
    }
  }

  if (requests.length === 0) {
    const uris = await vscode.workspace.findFiles('**/*', DEFAULT_EXCLUDES);
    return { uris, gitRoot: folders[0].uri.fsPath, scopeSummary: '全工作区' };
  }

  const results = await Promise.all(requests);
  const seen = new Map<string, vscode.Uri>();

  for (const group of results) {
    for (const uri of group) {
      seen.set(uri.fsPath, uri);
    }
  }

  const uris = [...seen.values()];
  const gitRoot = consideredRoots[0] ?? folders[0].uri.fsPath;
  const scopeSummary = configured.join(', ');

  logger?.appendLine(`Analysis scope: ${scopeSummary} (files: ${uris.length})`);
  return { uris, gitRoot, scopeSummary };
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

      const result = await analyzeFile(uris[index]);
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

async function analyzeFile(uri: vscode.Uri): Promise<FileAnalysisResult> {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    if (bytes.includes(0)) {
      return { kind: 'skipped-binary-content' };
    }

    const language = detectLanguage(uri);
    const text = textDecoder.decode(bytes);
    const metrics = countTextMetrics(text, language);
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    const path = workspaceFolder ? vscode.workspace.asRelativePath(uri, false) : uri.fsPath;

    return {
      kind: 'file',
      file: {
        resource: uri.toString(),
        path,
        language,
        lines: metrics.lines,
        codeLines: metrics.codeLines,
        commentLines: metrics.commentLines,
        blankLines: metrics.blankLines,
        bytes: bytes.byteLength,
        todoCounts: metrics.todoCounts
      }
    };
  } catch {
    return { kind: 'skipped-unreadable' };
  }
}

function getWorkerCount(): number {
  return Math.min(24, Math.max(8, availableParallelism() * 2));
}

function isBinaryLike(uri: vscode.Uri): boolean {
  const extension = uri.path.split('.').pop()?.toLowerCase() ?? '';
  return BINARY_EXTENSIONS.has(extension);
}
