import * as vscode from 'vscode';
import { analyzeTextFile, type TextFileAnalysisResult } from './fileAnalyzer';
import type { FileStat, TodoLocation } from '../types';

export type CollectAnalyzedFilesOptions<TEntry, TPrepared = undefined> = {
  prepare?: (uri: vscode.Uri) => Promise<TPrepared | undefined>;
  analyzeFile?: (uri: vscode.Uri) => Promise<TextFileAnalysisResult>;
  mapFile: (input: {
    uri: vscode.Uri;
    file: FileStat;
    todoLocations: TodoLocation[];
    prepared: TPrepared;
  }) => Promise<TEntry | undefined> | TEntry | undefined;
  workerCount: number;
  maxTodoLocations?: number;
};

export type CollectAnalyzedFilesResult<TEntry> = {
  entries: TEntry[];
  todoLocations: TodoLocation[];
  skippedBinaryContent: number;
  skippedUnreadableFiles: number;
};

export async function collectAnalyzedFiles<TEntry, TPrepared = undefined>(
  uris: vscode.Uri[],
  options: CollectAnalyzedFilesOptions<TEntry, TPrepared>
): Promise<CollectAnalyzedFilesResult<TEntry>> {
  const entries: TEntry[] = [];
  const todoLocations: TodoLocation[] = [];
  const maxTodoLocations = Math.max(options.maxTodoLocations ?? 200, 0);
  const analyzeFile = options.analyzeFile ?? analyzeTextFile;
  let skippedBinaryContent = 0;
  let skippedUnreadableFiles = 0;
  let currentIndex = 0;

  const workers = Array.from({ length: Math.max(options.workerCount, 1) }, async () => {
    while (currentIndex < uris.length) {
      const index = currentIndex;
      currentIndex += 1;
      const uri = uris[index];
      const prepared = options.prepare ? await options.prepare(uri) : (undefined as TPrepared);

      if (options.prepare && prepared === undefined) {
        continue;
      }

      const analyzed = await analyzeFile(uri);
      switch (analyzed.kind) {
        case 'file': {
          const entry = await options.mapFile({
            uri,
            file: analyzed.file,
            todoLocations: analyzed.todoLocations,
            prepared: prepared as TPrepared
          });

          if (entry !== undefined) {
            entries.push(entry);
          }

          if (analyzed.todoLocations.length && todoLocations.length < maxTodoLocations) {
            todoLocations.push(...analyzed.todoLocations.slice(0, maxTodoLocations - todoLocations.length));
          }
          break;
        }
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
  sortTodoLocations(todoLocations);

  return {
    entries,
    todoLocations,
    skippedBinaryContent,
    skippedUnreadableFiles
  };
}

export function sortTodoLocations(todoLocations: TodoLocation[]): void {
  todoLocations.sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.line - right.line ||
      left.keyword.localeCompare(right.keyword)
  );
}
