import type {
  DirectorySummary,
  DirectoryTreeNode,
  FileStat,
  LanguageSummary,
  TodoHotspot,
  TodoKeywordSummary,
  WorkspaceInsights,
  WorkspaceTotals
} from '../types';

export function buildWorkspaceTotals(files: FileStat[]): WorkspaceTotals {
  return files.reduce<WorkspaceTotals>(
    (accumulator, file) => {
      accumulator.files += 1;
      accumulator.lines += file.lines;
      accumulator.codeLines += file.codeLines;
      accumulator.commentLines += file.commentLines;
      accumulator.blankLines += file.blankLines;
      accumulator.bytes += file.bytes;
      return accumulator;
    },
    { files: 0, lines: 0, codeLines: 0, commentLines: 0, blankLines: 0, bytes: 0 }
  );
}

export function buildLanguageSummaries(files: FileStat[]): LanguageSummary[] {
  const languageMap = new Map<string, LanguageSummary>();

  for (const file of files) {
    const current = languageMap.get(file.language) ?? {
      language: file.language,
      files: 0,
      lines: 0,
      codeLines: 0,
      commentLines: 0,
      blankLines: 0,
      bytes: 0,
      todoCount: 0
    };

    current.files += 1;
    current.lines += file.lines;
    current.codeLines += file.codeLines;
    current.commentLines += file.commentLines;
    current.blankLines += file.blankLines;
    current.bytes += file.bytes;
    current.todoCount += file.todoCounts.total;
    languageMap.set(file.language, current);
  }

  return [...languageMap.values()].sort((left, right) => right.codeLines - left.codeLines);
}

export function buildDirectorySummaries(
  files: FileStat[],
  workspaceFolderNames: readonly string[],
  moduleDepth: number
): DirectorySummary[] {
  const folderNames = new Set(workspaceFolderNames);
  const directoryMap = new Map<string, DirectorySummary>();

  for (const file of files) {
    const modulePath = toModulePath(file.path, folderNames, moduleDepth);
    const current = directoryMap.get(modulePath) ?? {
      path: modulePath,
      files: 0,
      lines: 0,
      codeLines: 0,
      commentLines: 0,
      blankLines: 0,
      bytes: 0,
      todoCount: 0
    };

    current.files += 1;
    current.lines += file.lines;
    current.codeLines += file.codeLines;
    current.commentLines += file.commentLines;
    current.blankLines += file.blankLines;
    current.bytes += file.bytes;
    current.todoCount += file.todoCounts.total;
    directoryMap.set(modulePath, current);
  }

  return [...directoryMap.values()]
    .sort((left, right) => right.codeLines - left.codeLines || right.files - left.files)
    .slice(0, 12);
}

export function buildDirectoryTree(files: FileStat[], workspaceFolderNames: readonly string[]): DirectoryTreeNode[] {
  const folderNames = new Set(workspaceFolderNames);
  const roots = new Map<string, MutableDirectoryTreeNode>();

  for (const file of files) {
    const segments = toTreeSegments(file.path, folderNames);
    if (segments.length === 0) {
      accumulateNode(getOrCreateNode(roots, '(root)', '(root)'), file);
      continue;
    }

    let currentMap = roots;
    let currentPath = '';

    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const node = getOrCreateNode(currentMap, segment, currentPath);
      accumulateNode(node, file);
      currentMap = node.children;
    }
  }

  return sortTreeNodes(roots);
}

export function buildTodoSummary(files: FileStat[]): TodoKeywordSummary[] {
  const totals = files.reduce(
    (accumulator, file) => {
      accumulator.todo += file.todoCounts.todo;
      accumulator.fixme += file.todoCounts.fixme;
      accumulator.hack += file.todoCounts.hack;
      return accumulator;
    },
    { todo: 0, fixme: 0, hack: 0 }
  );

  return [
    { keyword: 'TODO', count: totals.todo },
    { keyword: 'FIXME', count: totals.fixme },
    { keyword: 'HACK', count: totals.hack }
  ].filter((item) => item.count > 0);
}

export function buildTodoHotspots(files: FileStat[]): TodoHotspot[] {
  return files
    .filter((file) => file.todoCounts.total > 0)
    .sort((left, right) => right.todoCounts.total - left.todoCounts.total || right.codeLines - left.codeLines)
    .slice(0, 10)
    .map((file) => ({
      resource: file.resource,
      path: file.path,
      language: file.language,
      total: file.todoCounts.total,
      todo: file.todoCounts.todo,
      fixme: file.todoCounts.fixme,
      hack: file.todoCounts.hack
    }));
}

export function buildWorkspaceInsights(
  totals: WorkspaceTotals,
  languages: LanguageSummary[],
  directories: DirectorySummary[],
  todoSummary: TodoKeywordSummary[]
): WorkspaceInsights {
  const fileCount = Math.max(totals.files, 1);
  const codeLines = Math.max(totals.codeLines, 1);
  const totalTodoCount = todoSummary.reduce((sum, item) => sum + item.count, 0);
  const topLanguage = languages[0];
  const topDirectory = directories[0];

  return {
    averageLinesPerFile: totals.lines / fileCount,
    averageCodeLinesPerFile: totals.codeLines / fileCount,
    commentRatio: totals.commentLines / codeLines,
    topLanguage: topLanguage?.language ?? '—',
    topLanguageShare: (topLanguage?.codeLines ?? 0) / codeLines,
    topDirectory: topDirectory?.path ?? '—',
    totalTodoCount,
    todoDensity: totalTodoCount / codeLines
  };
}

function toModulePath(filePath: string, folderNames: Set<string>, moduleDepth: number): string {
  const segments = filePath.split('/').filter(Boolean);
  if (segments.length <= 1) {
    return '(root)';
  }

  const startsWithWorkspaceFolder = folderNames.has(segments[0]);
  const startIndex = startsWithWorkspaceFolder ? 1 : 0;
  const remaining = segments.slice(startIndex, startIndex + moduleDepth);

  if (remaining.length === 0) {
    return startsWithWorkspaceFolder ? `${segments[0]}/(root)` : '(root)';
  }

  const prefix = startsWithWorkspaceFolder ? [segments[0], ...remaining] : remaining;
  return prefix.join('/');
}

function toTreeSegments(filePath: string, folderNames: Set<string>): string[] {
  const segments = filePath.split('/').filter(Boolean);
  if (segments.length <= 1) {
    return [];
  }

  const directorySegments = segments.slice(0, -1);
  if (directorySegments.length === 0) {
    return [];
  }

  const startsWithWorkspaceFolder = folderNames.has(directorySegments[0]);
  if (startsWithWorkspaceFolder) {
    return directorySegments;
  }

  return directorySegments;
}

type MutableDirectoryTreeNode = Omit<DirectoryTreeNode, 'children'> & {
  children: Map<string, MutableDirectoryTreeNode>;
};

function getOrCreateNode(
  nodes: Map<string, MutableDirectoryTreeNode>,
  name: string,
  path: string
): MutableDirectoryTreeNode {
  const existing = nodes.get(name);
  if (existing) {
    return existing;
  }

  const created: MutableDirectoryTreeNode = {
    name,
    path,
    files: 0,
    lines: 0,
    codeLines: 0,
    commentLines: 0,
    blankLines: 0,
    bytes: 0,
    todoCount: 0,
    children: new Map()
  };
  nodes.set(name, created);
  return created;
}

function accumulateNode(node: MutableDirectoryTreeNode, file: FileStat): void {
  node.files += 1;
  node.lines += file.lines;
  node.codeLines += file.codeLines;
  node.commentLines += file.commentLines;
  node.blankLines += file.blankLines;
  node.bytes += file.bytes;
  node.todoCount += file.todoCounts.total;
}

function sortTreeNodes(nodes: Map<string, MutableDirectoryTreeNode>): DirectoryTreeNode[] {
  return [...nodes.values()]
    .sort((left, right) => right.codeLines - left.codeLines || right.files - left.files)
    .map((node) => ({
      path: node.path,
      name: node.name,
      files: node.files,
      lines: node.lines,
      codeLines: node.codeLines,
      commentLines: node.commentLines,
      blankLines: node.blankLines,
      bytes: node.bytes,
      todoCount: node.todoCount,
      children: sortTreeNodes(node.children)
    }));
}
