import { buildDirectorySummaries, buildLanguageSummaries } from './summaries';
import type {
  CompareDirectoryDelta,
  CompareFileSnapshot,
  CompareHotspot,
  CompareLanguageDelta,
  CompareSummary,
  CompareSummaryResult,
  FileStat
} from '../types';

export function buildCompareSummaries(
  files: CompareFileSnapshot[],
  options: { workspaceFolderNames: readonly string[]; moduleDepth: number }
): CompareSummaryResult {
  const textComparableFiles = files.filter((file) => file.textComparable);
  const beforeFiles = textComparableFiles.flatMap((file) => (file.before ? [file.before.file] : []));
  const afterFiles = textComparableFiles.flatMap((file) => (file.after ? [file.after.file] : []));

  return {
    summary: buildCompareSummary(files, textComparableFiles, beforeFiles, afterFiles),
    languages: buildCompareLanguageDeltas(beforeFiles, afterFiles),
    directories: buildCompareDirectoryDeltas(beforeFiles, afterFiles, options.workspaceFolderNames, options.moduleDepth),
    hotspots: buildCompareHotspots(files)
  };
}

function buildCompareSummary(
  files: CompareFileSnapshot[],
  textComparableFiles: CompareFileSnapshot[],
  beforeFiles: FileStat[],
  afterFiles: FileStat[]
): CompareSummary {
  const beforeCodeLines = beforeFiles.reduce((sum, file) => sum + file.codeLines, 0);
  const afterCodeLines = afterFiles.reduce((sum, file) => sum + file.codeLines, 0);
  const beforeTodo = beforeFiles.reduce((sum, file) => sum + file.todoCounts.total, 0);
  const afterTodo = afterFiles.reduce((sum, file) => sum + file.todoCounts.total, 0);
  return {
    changedFiles: textComparableFiles.length,
    newFiles: textComparableFiles.filter((file) => file.status === 'added').length,
    deletedFiles: textComparableFiles.filter((file) => file.status === 'deleted').length,
    addedLines: files.reduce((sum, file) => sum + file.addedLines, 0),
    deletedLines: files.reduce((sum, file) => sum + file.deletedLines, 0),
    netCodeLines: afterCodeLines - beforeCodeLines,
    todoDelta: afterTodo - beforeTodo
  };
}

function buildCompareLanguageDeltas(beforeFiles: FileStat[], afterFiles: FileStat[]): CompareLanguageDelta[] {
  const before = buildLanguageSummaries(beforeFiles);
  const after = buildLanguageSummaries(afterFiles);
  const beforeMap = new Map(before.map((item) => [item.language, item] as const));
  const afterMap = new Map(after.map((item) => [item.language, item] as const));
  const languages = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  return [...languages]
    .map((language) => {
      const beforeItem = beforeMap.get(language);
      const afterItem = afterMap.get(language);
      return {
        language,
        beforeFiles: beforeItem?.files ?? 0,
        afterFiles: afterItem?.files ?? 0,
        beforeCodeLines: beforeItem?.codeLines ?? 0,
        afterCodeLines: afterItem?.codeLines ?? 0,
        deltaCodeLines: (afterItem?.codeLines ?? 0) - (beforeItem?.codeLines ?? 0),
        deltaTodo: (afterItem?.todoCount ?? 0) - (beforeItem?.todoCount ?? 0)
      };
    })
    .filter((item) => item.beforeFiles > 0 || item.afterFiles > 0)
    .sort((left, right) => right.deltaCodeLines - left.deltaCodeLines || left.language.localeCompare(right.language));
}

function buildCompareDirectoryDeltas(
  beforeFiles: FileStat[],
  afterFiles: FileStat[],
  workspaceFolderNames: readonly string[],
  moduleDepth: number
): CompareDirectoryDelta[] {
  const before = buildDirectorySummaries(beforeFiles, workspaceFolderNames, moduleDepth);
  const after = buildDirectorySummaries(afterFiles, workspaceFolderNames, moduleDepth);
  const beforeMap = new Map(before.map((item) => [item.path, item] as const));
  const afterMap = new Map(after.map((item) => [item.path, item] as const));
  const directories = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  return [...directories]
    .map((path) => {
      const beforeItem = beforeMap.get(path);
      const afterItem = afterMap.get(path);
      return {
        path,
        beforeFiles: beforeItem?.files ?? 0,
        afterFiles: afterItem?.files ?? 0,
        beforeCodeLines: beforeItem?.codeLines ?? 0,
        afterCodeLines: afterItem?.codeLines ?? 0,
        deltaCodeLines: (afterItem?.codeLines ?? 0) - (beforeItem?.codeLines ?? 0),
        deltaTodo: (afterItem?.todoCount ?? 0) - (beforeItem?.todoCount ?? 0)
      };
    })
    .filter((item) => item.beforeFiles > 0 || item.afterFiles > 0)
    .sort((left, right) => right.deltaCodeLines - left.deltaCodeLines || left.path.localeCompare(right.path));
}

function buildCompareHotspots(files: CompareFileSnapshot[]): CompareHotspot[] {
  return [...files]
    .map((file) => ({
      path: file.path,
      oldPath: file.oldPath,
      status: file.status,
      addedLines: file.addedLines,
      deletedLines: file.deletedLines,
      changedLines: file.addedLines + file.deletedLines
    }))
    .sort((left, right) => right.changedLines - left.changedLines || left.path.localeCompare(right.path));
}
