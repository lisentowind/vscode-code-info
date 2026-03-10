import * as vscode from 'vscode';
import { execFile } from 'node:child_process';

const DEFAULT_EXCLUDES = '{**/node_modules/**,**/.git/**,**/out/**,**/dist/**,**/.next/**,**/coverage/**,**/.turbo/**,**/.nuxt/**,**/target/**,**/vendor/**}';
const GIT_WEEKS = 12;

const COMMENT_PREFIXES: Record<string, string[]> = {
  javascript: ['//'],
  typescript: ['//'],
  javascriptreact: ['//'],
  typescriptreact: ['//'],
  java: ['//'],
  c: ['//'],
  cpp: ['//'],
  csharp: ['//'],
  go: ['//'],
  rust: ['//'],
  swift: ['//'],
  kotlin: ['//'],
  scala: ['//'],
  dart: ['//'],
  php: ['//', '#'],
  python: ['#'],
  ruby: ['#'],
  shellscript: ['#'],
  makefile: ['#'],
  yaml: ['#'],
  dockerfile: ['#'],
  perl: ['#'],
  r: ['#'],
  powershell: ['#'],
  lua: ['--'],
  sql: ['--'],
  haskell: ['--'],
  html: [],
  xml: [],
  css: [],
  scss: [],
  less: [],
  vue: [],
  svelte: []
};

const BLOCK_COMMENT_TOKENS: Record<string, { start: string; end: string }[]> = {
  javascript: [{ start: '/*', end: '*/' }],
  typescript: [{ start: '/*', end: '*/' }],
  javascriptreact: [{ start: '/*', end: '*/' }],
  typescriptreact: [{ start: '/*', end: '*/' }],
  java: [{ start: '/*', end: '*/' }],
  c: [{ start: '/*', end: '*/' }],
  cpp: [{ start: '/*', end: '*/' }],
  csharp: [{ start: '/*', end: '*/' }],
  go: [{ start: '/*', end: '*/' }],
  rust: [{ start: '/*', end: '*/' }],
  swift: [{ start: '/*', end: '*/' }],
  kotlin: [{ start: '/*', end: '*/' }],
  scala: [{ start: '/*', end: '*/' }],
  dart: [{ start: '/*', end: '*/' }],
  php: [{ start: '/*', end: '*/' }],
  css: [{ start: '/*', end: '*/' }],
  scss: [{ start: '/*', end: '*/' }],
  less: [{ start: '/*', end: '*/' }],
  html: [{ start: '<!--', end: '-->' }],
  xml: [{ start: '<!--', end: '-->' }],
  vue: [{ start: '<!--', end: '-->' }, { start: '/*', end: '*/' }],
  svelte: [{ start: '<!--', end: '-->' }, { start: '/*', end: '*/' }],
  sql: [{ start: '/*', end: '*/' }],
  lua: [{ start: '--[[', end: ']]' }],
  powershell: [{ start: '<#', end: '#>' }]
};

const STRING_DELIMITERS: Record<string, string[]> = {
  javascript: ['`', '"', "'"],
  typescript: ['`', '"', "'"],
  javascriptreact: ['`', '"', "'"],
  typescriptreact: ['`', '"', "'"],
  go: ['`', '"', "'"],
  python: ['"""', "'''", '"', "'"]
};

type FileStat = {
  path: string;
  language: string;
  lines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  bytes: number;
};

type LanguageSummary = {
  language: string;
  files: number;
  lines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  bytes: number;
};

type GitWeek = {
  label: string;
  commits: number;
};

type GitAuthor = {
  name: string;
  commits: number;
};

type GitStats = {
  available: boolean;
  rangeLabel: string;
  totalCommits: number;
  weeklyCommits: GitWeek[];
  topAuthors: GitAuthor[];
};

type WorkspaceTotals = {
  files: number;
  lines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  bytes: number;
};

type WorkspaceStats = {
  workspaceName: string;
  generatedAt: string;
  totals: WorkspaceTotals;
  languages: LanguageSummary[];
  largestFiles: FileStat[];
  files: FileStat[];
  git: GitStats;
};

type PresentationMode = {
  compact: boolean;
  title: string;
  subtitle: string;
};

let latestStats: WorkspaceStats | undefined;
let dashboardPanel: vscode.WebviewPanel | undefined;
let outputChannel: vscode.OutputChannel | undefined;

class codeInfoSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codeInfo.sidebar';
  private view: vscode.WebviewView | undefined;

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    outputChannel?.appendLine('Sidebar resolved.');
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.onDidReceiveMessage((message: { command?: string }) => {
      void handleWebviewCommand(message.command);
    });
    this.render(latestStats);
  }

  public render(stats: WorkspaceStats | undefined): void {
    if (!this.view) {
      return;
    }

    this.view.webview.html = stats
      ? getDashboardHtml(this.view.webview, stats, {
        compact: true,
        title: 'Code Info 侧边栏',
        subtitle: '快速浏览代码规模、语言分布和近期 Git 活动。'
      })
      : getEmptyStateHtml(this.view.webview, true);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('Code Info');
  context.subscriptions.push(outputChannel);
  outputChannel.appendLine(`Activated: ${new Date().toISOString()}`);

  const sidebarProvider = new codeInfoSidebarProvider();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(codeInfoSidebarProvider.viewType, sidebarProvider),
    vscode.commands.registerCommand('codeInfo.showStats', async () => {
      const stats = await analyzeAndSync(context, sidebarProvider, { revealPanel: true });
      if (stats) {
        showStatsPanel(context, stats);
      }
    }),
    vscode.commands.registerCommand('codeInfo.openPanel', async () => {
      if (latestStats) {
        showStatsPanel(context, latestStats);
        return;
      }

      showDashboardEmptyPanel(context);
    }),
    vscode.commands.registerCommand('codeInfo.refreshStats', async () => {
      await analyzeAndSync(context, sidebarProvider, { revealPanel: false });
    }),
    vscode.commands.registerCommand('codeInfo.export', async () => {
      const stats = await ensureStats(context, sidebarProvider);
      if (!stats) {
        return;
      }

      const picked = await vscode.window.showQuickPick(
        [
          { label: 'JSON', format: 'json' as const },
          { label: 'CSV', format: 'csv' as const }
        ],
        { placeHolder: '选择导出格式' }
      );

      if (!picked) {
        return;
      }

      await exportStatsFile(stats, picked.format);
    }),
    vscode.commands.registerCommand('codeInfo.exportJson', async () => {
      const stats = await ensureStats(context, sidebarProvider);
      if (stats) {
        await exportStatsFile(stats, 'json');
      }
    }),
    vscode.commands.registerCommand('codeInfo.exportCsv', async () => {
      const stats = await ensureStats(context, sidebarProvider);
      if (stats) {
        await exportStatsFile(stats, 'csv');
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      latestStats = undefined;
      sidebarProvider.render(undefined);
      if (dashboardPanel) {
        dashboardPanel.webview.html = getEmptyStateHtml(dashboardPanel.webview, false, { showOpenPanel: false });
      }
    })
  );
}

export function deactivate(): void { }

async function handleWebviewCommand(command?: string): Promise<void> {
  switch (command) {
    case 'refresh':
      await vscode.commands.executeCommand('codeInfo.refreshStats');
      return;
    case 'showStats':
      await vscode.commands.executeCommand('codeInfo.showStats');
      return;
    case 'openPanel':
      await vscode.commands.executeCommand('codeInfo.openPanel');
      return;
    case 'exportJson':
      await vscode.commands.executeCommand('codeInfo.exportJson');
      return;
    case 'exportCsv':
      await vscode.commands.executeCommand('codeInfo.exportCsv');
      return;
    default:
      return;
  }
}

async function ensureStats(
  context: vscode.ExtensionContext,
  sidebarProvider: codeInfoSidebarProvider
): Promise<WorkspaceStats | undefined> {
  if (latestStats) {
    return latestStats;
  }

  return analyzeAndSync(context, sidebarProvider, { revealPanel: false });
}

async function analyzeAndSync(
  context: vscode.ExtensionContext,
  sidebarProvider: codeInfoSidebarProvider,
  options: { revealPanel: boolean }
): Promise<WorkspaceStats | undefined> {
  const folders = vscode.workspace.workspaceFolders;

  if (!folders || folders.length === 0) {
    void vscode.window.showWarningMessage('Code Info: 请先打开一个工作区再执行统计。');
    return undefined;
  }

  try {
    const stats = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Code Info 正在分析工作区...',
        cancellable: false
      },
      async () => analyzeWorkspace()
    );

    latestStats = stats;
    sidebarProvider.render(stats);

    if (dashboardPanel) {
      dashboardPanel.webview.html = getDashboardHtml(dashboardPanel.webview, stats, {
        compact: false,
        title: `${stats.workspaceName} 代码统计看板`,
        subtitle: '统计当前工作区的代码规模、语言分布、文件明细和近期 Git 活动。'
      });

      if (options.revealPanel) {
        dashboardPanel.reveal(vscode.ViewColumn.One, false);
      }
    }

    return stats;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(`Code Info 分析失败：${message}`);
    return undefined;
  }
}

async function analyzeWorkspace(): Promise<WorkspaceStats> {
  const folders = vscode.workspace.workspaceFolders;

  if (!folders || folders.length === 0) {
    throw new Error('No workspace folder found.');
  }

  const uris = await vscode.workspace.findFiles('**/*', DEFAULT_EXCLUDES);
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

  const git = await analyzeGitHistory(folders[0].uri.fsPath);

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

async function analyzeGitHistory(rootPath: string): Promise<GitStats> {
  const emptyWeeks = buildWeeklyBuckets(GIT_WEEKS);

  try {
    await runGit(['rev-parse', '--is-inside-work-tree'], rootPath);
    const logOutput = await runGit(
      ['log', '--date=short', '--pretty=format:%ad%x09%an', `--since=${GIT_WEEKS * 7}.days`],
      rootPath
    );

    if (!logOutput.trim()) {
      return {
        available: true,
        rangeLabel: `最近 ${GIT_WEEKS} 周`,
        totalCommits: 0,
        weeklyCommits: [...emptyWeeks.values()],
        topAuthors: []
      };
    }

    const authors = new Map<string, number>();
    let totalCommits = 0;

    for (const line of logOutput.split(/\r?\n/)) {
      if (!line.trim()) {
        continue;
      }

      const [dateText, authorName] = line.split('\t');
      const bucketKey = getWeekBucketKey(new Date(`${dateText}T00:00:00Z`));
      const bucket = emptyWeeks.get(bucketKey);

      if (bucket) {
        bucket.commits += 1;
      }

      authors.set(authorName, (authors.get(authorName) ?? 0) + 1);
      totalCommits += 1;
    }

    return {
      available: true,
      rangeLabel: `最近 ${GIT_WEEKS} 周`,
      totalCommits,
      weeklyCommits: [...emptyWeeks.values()],
      topAuthors: [...authors.entries()]
        .map(([name, commits]) => ({ name, commits }))
        .sort((left, right) => right.commits - left.commits)
        .slice(0, 5)
    };
  } catch {
    return {
      available: false,
      rangeLabel: `最近 ${GIT_WEEKS} 周`,
      totalCommits: 0,
      weeklyCommits: [...emptyWeeks.values()],
      topAuthors: []
    };
  }
}

function runGit(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, encoding: 'utf8', maxBuffer: 1024 * 1024 * 8 }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(stdout);
    });
  });
}

function buildWeeklyBuckets(weeks: number): Map<string, GitWeek> {
  const buckets = new Map<string, GitWeek>();
  const currentWeekStart = getWeekStart(new Date());

  for (let index = weeks - 1; index >= 0; index -= 1) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setUTCDate(weekStart.getUTCDate() - index * 7);
    const key = getWeekBucketKey(weekStart);
    buckets.set(key, { label: formatMonthDay(weekStart), commits: 0 });
  }

  return buckets;
}

function getWeekBucketKey(date: Date): string {
  const weekStart = getWeekStart(date);
  return weekStart.toISOString().slice(0, 10);
}

function getWeekStart(date: Date): Date {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = value.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setUTCDate(value.getUTCDate() + diff);
  return value;
}

function formatMonthDay(date: Date): string {
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${month}/${day}`;
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

function showStatsPanel(context: vscode.ExtensionContext, stats: WorkspaceStats): void {
  if (!dashboardPanel) {
    dashboardPanel = vscode.window.createWebviewPanel('codeInfoStats', `Code Info · ${stats.workspaceName}`, vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true
    });

    dashboardPanel.onDidDispose(() => {
      dashboardPanel = undefined;
    });

    dashboardPanel.webview.onDidReceiveMessage((message: { command?: string }) => {
      void handleWebviewCommand(message.command);
    });
  }

  dashboardPanel.title = `Code Info · ${stats.workspaceName}`;
  dashboardPanel.webview.html = getDashboardHtml(dashboardPanel.webview, stats, {
    compact: false,
    title: `${stats.workspaceName} 代码统计看板`,
    subtitle: '统计当前工作区的代码规模、语言分布、文件明细和近期 Git 活动。'
  });
  dashboardPanel.reveal(vscode.ViewColumn.One, false);

  void context;
}

function showDashboardEmptyPanel(context: vscode.ExtensionContext): void {
  if (!dashboardPanel) {
    dashboardPanel = vscode.window.createWebviewPanel('codeInfoStats', 'Code Info · Dashboard', vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true
    });

    dashboardPanel.onDidDispose(() => {
      dashboardPanel = undefined;
    });

    dashboardPanel.webview.onDidReceiveMessage((message: { command?: string }) => {
      void handleWebviewCommand(message.command);
    });
  }

  dashboardPanel.title = 'Code Info · Dashboard';
  dashboardPanel.webview.html = getEmptyStateHtml(dashboardPanel.webview, false, { showOpenPanel: false });
  dashboardPanel.reveal(vscode.ViewColumn.One, false);

  void context;
}

async function exportStatsFile(stats: WorkspaceStats, format: 'json' | 'csv'): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  const baseFolder = folders?.[0]?.uri;
  const filename = `${sanitizeFilename(stats.workspaceName)}-code-info.${format}`;
  const defaultUri = baseFolder ? vscode.Uri.joinPath(baseFolder, filename) : undefined;
  const uri = await vscode.window.showSaveDialog({
    defaultUri,
    saveLabel: format === 'json' ? '导出 JSON' : '导出 CSV',
    filters: format === 'json' ? { JSON: ['json'] } : { CSV: ['csv'] }
  });

  if (!uri) {
    return;
  }

  const content = format === 'json' ? JSON.stringify(stats, null, 2) : toCsv(stats);
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
  void vscode.window.showInformationMessage(`Code Info: 已导出到 ${uri.fsPath}`);
}

function toCsv(stats: WorkspaceStats): string {
  const rows = [
    ['path', 'language', 'lines', 'codeLines', 'commentLines', 'blankLines', 'bytes'],
    ...stats.files.map((file) => [
      file.path,
      file.language,
      `${file.lines}`,
      `${file.codeLines}`,
      `${file.commentLines}`,
      `${file.blankLines}`,
      `${file.bytes}`
    ])
  ];

  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function sanitizeFilename(value: string): string {
  return value.trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'workspace';
}

function getEmptyStateHtml(
  webview: vscode.Webview,
  compact: boolean,
  options?: { showOpenPanel?: boolean }
): string {
  const nonce = getNonce();
  const showOpenPanel = options?.showOpenPanel ?? true;
  const title = compact ? 'Code Info 侧边栏' : 'Code Info';
  const subtitle = compact ? '先运行一次分析，再在这里查看概览。' : '先运行一次分析，再查看详细统计面板。';
  const openPanelButton = showOpenPanel ? '<button class="secondary" data-command="openPanel">打开看板</button>' : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin: 0; padding: 20px; color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); }
    .card { border: 1px solid var(--vscode-panel-border); border-radius: 14px; padding: 18px; background: var(--vscode-sideBar-background); }
    h1 { font-size: 18px; margin: 0 0 10px; }
    p { color: var(--vscode-descriptionForeground); line-height: 1.5; margin: 0 0 16px; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    button { border: 1px solid var(--vscode-button-border, transparent); border-radius: 8px; padding: 8px 12px; cursor: pointer; background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    button.secondary { background: transparent; color: var(--vscode-textLink-foreground); border-color: var(--vscode-panel-border); }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${subtitle}</p>
    <div class="actions">
      <button data-command="showStats">开始分析</button>
      ${openPanelButton}
    </div>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.addEventListener('click', (event) => {
      const element = event.target.closest('[data-command]');
      if (!element) {
        return;
      }
      vscode.postMessage({ command: element.getAttribute('data-command') });
    });
  </script>
</body>
</html>`;
}

function getDashboardHtml(webview: vscode.Webview, stats: WorkspaceStats, presentation: PresentationMode): string {
  const nonce = getNonce();
  const payload = JSON.stringify({ stats, presentation })
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Code Info</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: var(--vscode-editor-background);
      --panel: var(--vscode-sideBar-background);
      --panel-2: color-mix(in srgb, var(--panel) 88%, white 12%);
      --border: var(--vscode-panel-border);
      --text: var(--vscode-editor-foreground);
      --muted: var(--vscode-descriptionForeground);
      --accent: var(--vscode-textLink-foreground);
      --accent-soft: color-mix(in srgb, var(--accent) 15%, transparent);
      font-family: var(--vscode-font-family);
    }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 20px; background: var(--bg); color: var(--text); }
    body.compact { padding: 12px; }
    .page { display: grid; gap: 16px; }
    .hero, .card, .panel {
      border: 1px solid var(--border);
      border-radius: 12px; /* 稍微减小圆角显得更干练 */
      background: var(--panel);
    }
    .hero {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      padding: 18px;
      background: linear-gradient(135deg, var(--panel), var(--panel-2));
    }
    .hero h1 { margin: 0 0 8px; font-size: 20px; }
    .hero p { margin: 0; color: var(--muted); line-height: 1.5; font-size: 13px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .action {
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 6px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      padding: 6px 12px;
      cursor: pointer;
      font: inherit;
      font-size: 13px;
    }
    .action.secondary {
      background: transparent;
      color: var(--accent);
      border-color: var(--border);
    }
    .badge {
      border-radius: 999px;
      padding: 6px 12px;
      background: var(--accent-soft);
      color: var(--accent);
      white-space: nowrap;
      font-size: 12px;
    }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; }
    .card, .panel { padding: 16px; }
    .metric-label { font-size: 12px; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 8px; }
    .metric-value { font-size: 26px; font-weight: 600; }
    .metric-sub { margin-top: 8px; font-size: 12px; color: var(--muted); }
    .grid { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 16px; }
    .panel h2 { margin: 0 0 6px; font-size: 15px; }
    .section-note { color: var(--muted); font-size: 12px; margin: 0 0 14px; }
    .bars, .legend, .git-bars, .authors { display: grid; gap: 12px; }
    .bar-row, .git-block { display: grid; gap: 6px; }
    .bar-head, .legend-item, .author-item { display: flex; justify-content: space-between; gap: 12px; align-items: center; font-size: 13px; }
    .bar-track, .mini-track {
      height: 8px;
      border-radius: 999px;
      overflow: hidden;
      background: color-mix(in srgb, var(--text) 8%, transparent);
    }
    /* 移除紫蓝色渐变，使用主题色和透明度，更加严谨 */
    .bar-fill, .mini-fill { height: 100%; border-radius: inherit; background: var(--accent); opacity: 0.85; }
    .stack {
      display: flex;
      height: 14px;
      overflow: hidden;
      border-radius: 999px;
      background: color-mix(in srgb, var(--text) 8%, transparent);
      margin-bottom: 14px;
    }
    .legend-left, .author-left { display: flex; align-items: center; gap: 8px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .git-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .git-note {
      padding: 12px;
      border-radius: 8px;
      border: 1px dashed var(--border);
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }
    .table-wrap { overflow-x: auto; width: 100%; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; white-space: nowrap; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent); vertical-align: top; }
    th { color: var(--muted); font-weight: 600; }
    /* 路径列放宽并允许换行，避免太宽撑破容器 */
    td.mono { font-family: var(--vscode-editor-font-family); white-space: normal; word-break: break-all; min-width: 150px; }
    .muted { color: var(--muted); }

    /* 侧边栏/紧凑模式响应式调整 */
    body.compact .page { gap: 12px; }
    body.compact .hero { flex-direction: column; padding: 14px; gap: 12px; }
    body.compact .grid, body.compact .git-grid { grid-template-columns: 1fr; }
    body.compact .metric-value { font-size: 22px; }
    body.compact .card, body.compact .panel { padding: 14px; }

    @media (max-width: 960px) {
      .grid, .git-grid { grid-template-columns: 1fr; }
      .hero { flex-direction: column; }
    }
  </style>
</head>
<body class="${presentation.compact ? 'compact' : ''}">
  <script nonce="${nonce}" id="__codeInfoPayload" type="application/json">${payload}</script>
  <div id="app" class="page"></div>
  <pre id="error" style="display:none;white-space:pre-wrap;padding:12px;border:1px solid var(--border);border-radius:12px;"></pre>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const errorBox = document.getElementById('error');
    function showError(err) {
      if (!errorBox) return;
      errorBox.style.display = 'block';
      errorBox.textContent = String(err && (err.stack || err.message) ? (err.stack || err.message) : err);
    }

    window.addEventListener('error', (event) => {
      showError(event.error || event.message || event);
    });

    let stats;
    let presentation;
    try {
      const raw = document.getElementById('__codeInfoPayload')?.textContent || '{}';
      const parsed = JSON.parse(raw);
      stats = parsed.stats;
      presentation = parsed.presentation;
    } catch (err) {
      showError(err);
      stats = undefined;
      presentation = { compact: false, title: 'Code Info', subtitle: '' };
    }
    const app = document.getElementById('app');

    // 替换为更加专业、克制的数据可视化色板 (类似 AntV 经典色调)
    const palette = ['#5B8FF9', '#5AD8A6', '#5D7092', '#F6BD16', '#E8684A', '#6DC8EC', '#9270CA', '#FF9D4D', '#269A99', '#FF99C3'];

    if (!stats || !app) {
      showError('No stats payload. Try running Analyze again.');
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function numberFormat(value) {
      return new Intl.NumberFormat('zh-CN').format(value);
    }

    function bytesFormat(value) {
      if (value < 1024) return value + ' B';
      if (value < 1024 * 1024) return (value / 1024).toFixed(1) + ' KB';
      return (value / 1024 / 1024).toFixed(2) + ' MB';
    }

    function percent(value, total) {
      if (!total) return '0%';
      return ((value / total) * 100).toFixed(1) + '%';
    }

    function metricCard(label, value, sub) {
      return '<div class="card">' +
        '<div class="metric-label">' + escapeHtml(label) + '</div>' +
        '<div class="metric-value">' + escapeHtml(value) + '</div>' +
        '<div class="metric-sub">' + escapeHtml(sub) + '</div>' +
      '</div>';
    }

    function renderLanguageBars(languages) {
      const max = languages[0]?.codeLines ?? 1;
      const items = languages.slice(0, presentation.compact ? 6 : 8);
      return items.map((item) => {
        const width = Math.max((item.codeLines / max) * 100, 2);
        return '<div class="bar-row">' +
          '<div class="bar-head"><span>' + escapeHtml(item.language) + '</span><span class="muted">' + numberFormat(item.codeLines) + ' 行</span></div>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + width + '%"></div></div>' +
        '</div>';
      }).join('');
    }

    function renderComposition() {
      // 匹配新的专业色板：蓝(代码)、绿(注释)、灰蓝(空行)
      const items = [
        { label: '代码行', value: stats.totals.codeLines, color: '#5B8FF9' },
        { label: '注释行', value: stats.totals.commentLines, color: '#5AD8A6' },
        { label: '空行', value: stats.totals.blankLines, color: '#5D7092' }
      ];
      const total = Math.max(stats.totals.lines, 1);
      const stack = items.map((item) => '<div style="width:' + (item.value / total * 100) + '%;background:' + item.color + '"></div>').join('');
      const legend = items.map((item) => {
        return '<div class="legend-item">' +
          '<div class="legend-left"><span class="dot" style="background:' + item.color + '"></span><span>' + escapeHtml(item.label) + '</span></div>' +
          '<span class="muted">' + numberFormat(item.value) + ' (' + percent(item.value, total) + ')</span>' +
        '</div>';
      }).join('');

      return '<div class="stack">' + stack + '</div><div class="legend">' + legend + '</div>';
    }

    function renderGitStats() {
      if (!stats.git.available) {
        return '<div class="git-note">当前工作区没有可读取的 Git 历史，或 Git 命令不可用。</div>';
      }

      const maxCommits = Math.max(...stats.git.weeklyCommits.map((item) => item.commits), 1);
      const bars = stats.git.weeklyCommits.map((item) => {
        const width = item.commits === 0 ? 2 : (item.commits / maxCommits) * 100;
        return '<div class="git-block">' +
          '<div class="bar-head"><span>' + escapeHtml(item.label) + '</span><span class="muted">' + numberFormat(item.commits) + ' commits</span></div>' +
          '<div class="mini-track"><div class="mini-fill" style="width:' + width + '%"></div></div>' +
        '</div>';
      }).join('');

      const authors = stats.git.topAuthors.length
        ? stats.git.topAuthors.map((item, index) => '<div class="author-item">' +
            '<div class="author-left"><span class="dot" style="background:' + palette[index % palette.length] + '"></span><span>' + escapeHtml(item.name) + '</span></div>' +
            '<span class="muted">' + numberFormat(item.commits) + ' 次</span>' +
          '</div>').join('')
        : '<div class="muted">最近没有提交记录。</div>';

      return '<div class="git-grid">' +
        '<div><div class="section-note">' + escapeHtml(stats.git.rangeLabel) + ' · 共 ' + numberFormat(stats.git.totalCommits) + ' 次提交</div><div class="git-bars">' + bars + '</div></div>' +
        '<div><div class="section-note">贡献者 Top 5</div><div class="authors">' + authors + '</div></div>' +
      '</div>';
    }

    function renderLargestFiles(files) {
      const items = files.slice(0, presentation.compact ? 5 : 10);
      return items.map((file) => '<tr>' +
        '<td class="mono">' + escapeHtml(file.path) + '</td>' +
        '<td>' + escapeHtml(file.language) + '</td>' +
        '<td>' + numberFormat(file.lines) + '</td>' +
        '<td>' + numberFormat(file.codeLines) + '</td>' +
        '<td>' + bytesFormat(file.bytes) + '</td>' +
      '</tr>').join('');
    }

    function renderLanguageTable(languages) {
      return languages.slice(0, presentation.compact ? 8 : 12).map((language, index) => '<tr>' +
        '<td><span class="dot" style="background:' + palette[index % palette.length] + '"></span> ' + escapeHtml(language.language) + '</td>' +
        '<td>' + numberFormat(language.files) + '</td>' +
        '<td>' + numberFormat(language.lines) + '</td>' +
        '<td>' + numberFormat(language.codeLines) + '</td>' +
        '<td>' + bytesFormat(language.bytes) + '</td>' +
      '</tr>').join('');
    }

    // 增加了 .table-wrap 容器包裹 table
    app.innerHTML = '' +
      '<section class="hero">' +
        '<div>' +
          '<h1>' + escapeHtml(presentation.title) + '</h1>' +
          '<p>' + escapeHtml(presentation.subtitle) + '<br>生成时间：' + escapeHtml(stats.generatedAt) + '</p>' +
        '</div>' +
        '<div class="actions">' +
          '<button class="action" data-command="refresh">重新分析</button>' +
          '<button class="action secondary" data-command="openPanel">详细看板</button>' +
          '<button class="action secondary" data-command="exportJson">导出 JSON</button>' +
          '<button class="action secondary" data-command="exportCsv">导出 CSV</button>' +
          '<span class="badge">共 ' + numberFormat(stats.totals.files) + ' 个文件</span>' +
        '</div>' +
      '</section>' +
      '<section class="cards">' +
        metricCard('总文件数', numberFormat(stats.totals.files), '参与统计的文本文件') +
        metricCard('总行数', numberFormat(stats.totals.lines), '代码 / 注释 / 空行') +
        metricCard('代码行', numberFormat(stats.totals.codeLines), '有效代码规模') +
        metricCard('注释行', numberFormat(stats.totals.commentLines), '单行与块注释') +
        metricCard('空行', numberFormat(stats.totals.blankLines), '格式与分段空白') +
        metricCard('代码体积', bytesFormat(stats.totals.bytes), '按 UTF-8 统计') +
      '</section>' +
      '<section class="grid">' +
        '<div class="panel">' +
          '<h2>语言代码量排行</h2>' +
          '<div class="section-note">按有效代码行数倒序，快速判断主要技术栈。</div>' +
          '<div class="bars">' + renderLanguageBars(stats.languages) + '</div>' +
        '</div>' +
        '<div class="panel">' +
          '<h2>代码组成</h2>' +
          '<div class="section-note">快速区分有效代码、注释与空白占比。</div>' +
          renderComposition() +
        '</div>' +
      '</section>' +
      '<section class="panel">' +
        '<h2>Git 提交趋势</h2>' +
        '<div class="section-note">基于当前工作区首个目录的 Git 历史。</div>' +
        renderGitStats() +
      '</section>' +
      '<section class="panel">' +
        '<h2>语言统计明细</h2>' +
        '<div class="table-wrap">' +
          '<table>' +
            '<thead><tr><th>语言</th><th>文件数</th><th>总行数</th><th>代码行</th><th>体积</th></tr></thead>' +
            '<tbody>' + renderLanguageTable(stats.languages) + '</tbody>' +
          '</table>' +
        '</div>' +
      '</section>' +
      '<section class="panel">' +
        '<h2>最大文件排行</h2>' +
        '<div class="table-wrap">' +
          '<table>' +
            '<thead><tr><th>文件</th><th>语言</th><th>总行数</th><th>代码行</th><th>体积</th></tr></thead>' +
            '<tbody>' + renderLargestFiles(stats.largestFiles) + '</tbody>' +
          '</table>' +
        '</div>' +
      '</section>';

    document.addEventListener('click', (event) => {
      const element = event.target.closest('[data-command]');
      if (!element) {
        return;
      }
      vscode.postMessage({ command: element.getAttribute('data-command') });
    });
  </script>
</body>
</html>`;
}

function getNonce(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';

  for (let index = 0; index < 32; index += 1) {
    value += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return value;
}
