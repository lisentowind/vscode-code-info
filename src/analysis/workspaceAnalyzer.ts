import * as vscode from 'vscode';
import { BLOCK_COMMENT_TOKENS, COMMENT_PREFIXES, DEFAULT_EXCLUDES, STRING_DELIMITERS } from '../constants';
import { getAnalysisDirectoriesSetting } from '../config/settings';
import { parseAnalysisDirectories } from './scope';
import { analyzeGitHistory } from '../git/history';
import type { FileStat, LanguageSummary, Logger, WorkspaceStats, WorkspaceTotals } from '../types';

export async function analyzeWorkspace(logger?: Logger): Promise<WorkspaceStats> {
  const folders = vscode.workspace.workspaceFolders;

  if (!folders || folders.length === 0) {
    throw new Error('No workspace folder found.');
  }

  const { uris, gitRoot, scopeSummary } = await findWorkspaceFilesForAnalysis(folders, logger);
  const textUris = uris.filter((uri) => !isBinaryLike(uri));
  const fileStats = await analyzeFiles(textUris, 16);
  const languageMap = new Map<string, LanguageSummary>();

  for (const file of fileStats) {
    const current = languageMap.get(file.language) ?? {
      language: file.language,
      files: 0,
      lines: 0,
      codeLines: 0,
      commentLines: 0,
      blankLines: 0,
      bytes: 0
    };

    current.files += 1;
    current.lines += file.lines;
    current.codeLines += file.codeLines;
    current.commentLines += file.commentLines;
    current.blankLines += file.blankLines;
    current.bytes += file.bytes;
    languageMap.set(file.language, current);
  }

  const totals = fileStats.reduce<WorkspaceTotals>(
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

  const git = await analyzeGitHistory(gitRoot);

  logger?.appendLine(`Analysis done: ${scopeSummary} (files: ${fileStats.length})`);

  return {
    workspaceName: folders.length === 1 ? folders[0].name : 'Multi-root Workspace',
    generatedAt: new Date().toLocaleString(),
    totals,
    languages: [...languageMap.values()].sort((left, right) => right.codeLines - left.codeLines),
    largestFiles: [...fileStats].sort((left, right) => right.lines - left.lines).slice(0, 10),
    files: [...fileStats].sort((left, right) => right.codeLines - left.codeLines),
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
    const dirs = [
      ...parsed.globalDirectories,
      ...(parsed.scopedDirectories.get(folder.name) ?? [])
    ];

    if (dirs.length === 0) {
      continue;
    }

    consideredRoots.push(folder.uri.fsPath);

    for (const dir of dirs) {
      const pattern = `${dir.replace(/\\/g, '/').replace(/\/+$/, '')}/**/*`;
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
  const summary = configured.join(', ');

  logger?.appendLine(`Analysis scope: ${summary} (files: ${uris.length})`);
  return { uris, gitRoot, scopeSummary: summary };
}

async function analyzeFiles(uris: vscode.Uri[], concurrency: number): Promise<FileStat[]> {
  const results: FileStat[] = [];
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, Math.max(uris.length, 1)) }, async () => {
    while (currentIndex < uris.length) {
      const index = currentIndex;
      currentIndex += 1;
      const stat = await analyzeFile(uris[index]);
      if (stat) {
        results.push(stat);
      }
    }
  });

  await Promise.all(workers);
  return results;
}

async function analyzeFile(uri: vscode.Uri): Promise<FileStat | undefined> {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(bytes).toString('utf8');

    if (text.includes('\u0000')) {
      return undefined;
    }

    const language = detectLanguage(uri);
    const counters = countLines(text, language);
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    const path = workspaceFolder ? vscode.workspace.asRelativePath(uri, false) : uri.fsPath;

    return {
      path,
      language,
      lines: counters.lines,
      codeLines: counters.codeLines,
      commentLines: counters.commentLines,
      blankLines: counters.blankLines,
      bytes: bytes.byteLength
    };
  } catch {
    return undefined;
  }
}

function detectLanguage(uri: vscode.Uri): string {
  const filename = uri.path.split('/').pop() ?? '';
  const extension = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() ?? '' : '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescriptreact',
    js: 'javascript',
    jsx: 'javascriptreact',
    py: 'python',
    java: 'java',
    go: 'go',
    rs: 'rust',
    c: 'c',
    h: 'c',
    cc: 'cpp',
    cpp: 'cpp',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    rb: 'ruby',
    sh: 'shellscript',
    zsh: 'shellscript',
    bash: 'shellscript',
    yml: 'yaml',
    yaml: 'yaml',
    json: 'json',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    md: 'markdown',
    xml: 'xml',
    sql: 'sql',
    kt: 'kotlin',
    swift: 'swift',
    dart: 'dart',
    vue: 'vue',
    svelte: 'svelte',
    lua: 'lua',
    r: 'r',
    ps1: 'powershell'
  };

  if (filename === 'Dockerfile') {
    return 'dockerfile';
  }

  if (filename === 'Makefile') {
    return 'makefile';
  }

  return map[extension] ?? (extension || 'plaintext');
}

function countLines(text: string, language: string): Omit<FileStat, 'path' | 'language' | 'bytes'> {
  const lines = text.split(/\r?\n/);
  const lineCommentPrefixes = [...(COMMENT_PREFIXES[language] ?? [])].sort((left, right) => right.length - left.length);
  const blockTokens = [...(BLOCK_COMMENT_TOKENS[language] ?? [])].sort((left, right) => right.start.length - left.start.length);
  const stringDelimiters = [...(STRING_DELIMITERS[language] ?? ['"', "'"])].sort((left, right) => right.length - left.length);

  let codeLines = 0;
  let commentLines = 0;
  let blankLines = 0;

  let activeBlock: { start: string; end: string } | undefined;
  let activeString: { delimiter: string } | undefined;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (trimmed.length === 0) {
      blankLines += 1;
      continue;
    }

    let hasCode = false;
    let hasComment = false;
    let index = 0;

    while (index < rawLine.length) {
      if (activeBlock) {
        hasComment = true;
        const endIndex = rawLine.indexOf(activeBlock.end, index);
        if (endIndex === -1) {
          index = rawLine.length;
          break;
        }
        index = endIndex + activeBlock.end.length;
        activeBlock = undefined;
        continue;
      }

      if (activeString) {
        hasCode = true;
        const endIndex = findStringEnd(rawLine, index, activeString.delimiter);
        if (endIndex === -1) {
          index = rawLine.length;
          break;
        }
        index = endIndex + activeString.delimiter.length;
        activeString = undefined;
        continue;
      }

      const ch = rawLine[index];
      if (ch === ' ' || ch === '\t') {
        index += 1;
        continue;
      }

      const blockStart = matchBlockStartAt(rawLine, index, blockTokens);
      if (blockStart) {
        hasComment = true;
        const endIndex = rawLine.indexOf(blockStart.end, index + blockStart.start.length);
        if (endIndex === -1) {
          activeBlock = blockStart;
          break;
        }

        index = endIndex + blockStart.end.length;
        continue;
      }

      const lineComment = matchTokenAt(rawLine, index, lineCommentPrefixes);
      if (lineComment) {
        hasComment = true;
        break;
      }

      const stringDelimiter = matchTokenAt(rawLine, index, stringDelimiters);
      if (stringDelimiter) {
        hasCode = true;
        activeString = { delimiter: stringDelimiter };
        index += stringDelimiter.length;
        continue;
      }

      hasCode = true;
      index += 1;
    }

    if (hasCode) {
      codeLines += 1;
      continue;
    }

    if (hasComment) {
      commentLines += 1;
      continue;
    }

    codeLines += 1;
  }

  return {
    lines: lines.length,
    codeLines,
    commentLines,
    blankLines
  };
}

function matchTokenAt(line: string, index: number, tokens: string[]): string | undefined {
  for (const token of tokens) {
    if (line.startsWith(token, index)) {
      return token;
    }
  }
  return undefined;
}

function matchBlockStartAt(
  line: string,
  index: number,
  tokens: { start: string; end: string }[]
): { start: string; end: string } | undefined {
  for (const token of tokens) {
    if (line.startsWith(token.start, index)) {
      return token;
    }
  }
  return undefined;
}

function findStringEnd(line: string, fromIndex: number, delimiter: string): number {
  if (delimiter.length > 1) {
    return line.indexOf(delimiter, fromIndex);
  }

  let index = fromIndex;
  while (index < line.length) {
    const ch = line[index];
    if (ch === '\\') {
      index += 2;
      continue;
    }

    if (line.startsWith(delimiter, index)) {
      return index;
    }

    index += 1;
  }

  return -1;
}

function isBinaryLike(uri: vscode.Uri): boolean {
  const extension = uri.path.split('.').pop()?.toLowerCase() ?? '';
  return new Set([
    'png',
    'jpg',
    'jpeg',
    'gif',
    'webp',
    'ico',
    'pdf',
    'zip',
    'gz',
    'tar',
    'jar',
    'class',
    'exe',
    'dll',
    'so',
    'dylib',
    'mp3',
    'mp4',
    'mov',
    'avi',
    'woff',
    'woff2',
    'ttf',
    'eot',
    'lock'
  ]).has(extension);
}
