export type FileStat = {
  resource: string;
  path: string;
  language: string;
  lines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  bytes: number;
  todoCounts: TodoCounts;
};

export type LanguageSummary = {
  language: string;
  files: number;
  lines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  bytes: number;
  todoCount: number;
};

export type TodoCounts = {
  total: number;
  todo: number;
  fixme: number;
  hack: number;
};

export type TodoLocation = {
  resource: string;
  path: string;
  language: string;
  line: number;
  character: number;
  keyword: string;
  preview: string;
};

export type DirectorySummary = {
  path: string;
  files: number;
  lines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  bytes: number;
  todoCount: number;
};

export type DirectoryTreeNode = {
  path: string;
  name: string;
  files: number;
  lines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  bytes: number;
  todoCount: number;
  children: DirectoryTreeNode[];
};

export type TodoKeywordSummary = {
  keyword: string;
  count: number;
};

export type TodoHotspot = {
  resource: string;
  path: string;
  language: string;
  total: number;
  todo: number;
  fixme: number;
  hack: number;
};

export type GitWeek = {
  label: string;
  commits: number;
};

export type GitAuthor = {
  name: string;
  commits: number;
};

export type GitStats = {
  available: boolean;
  rangeLabel: string;
  totalCommits: number;
  weeklyCommits: GitWeek[];
  topAuthors: GitAuthor[];
};

export type WorkspaceTotals = {
  files: number;
  lines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  bytes: number;
};

export type WorkspaceStats = {
  workspaceName: string;
  generatedAt: string;
  totals: WorkspaceTotals;
  languages: LanguageSummary[];
  directories: DirectorySummary[];
  directoryTree: DirectoryTreeNode[];
  largestFiles: FileStat[];
  files: FileStat[];
  todoSummary: TodoKeywordSummary[];
  todoHotspots: TodoHotspot[];
  todoLocations: TodoLocation[];
  insights: WorkspaceInsights;
  analysisMeta: AnalysisMeta;
  git: GitStats;
};

export type TodayFileStat = FileStat & {
  status: 'new' | 'modified';
  modifiedAt: string;
};

export type TodayDeletedFile = {
  path: string;
};

export type TodayTotals = {
  touchedFiles: number;
  newFiles: number;
  deletedFiles: number;
  lines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  bytes: number;
  todoCount: number;
  addedLines: number;
  deletedLines: number;
  changedLines: number;
};

export type TodayInsights = {
  topLanguage: string;
  topLanguageShare: number;
  topPath: string;
  todoTouchedCount: number;
};

export type TodayStats = {
  workspaceName: string;
  generatedAt: string;
  totals: TodayTotals;
  languages: LanguageSummary[];
  touchedFiles: TodayFileStat[];
  newFiles: TodayFileStat[];
  deletedFiles: TodayDeletedFile[];
  todoLocations: TodoLocation[];
  insights: TodayInsights;
  analysisMeta: AnalysisMeta;
};

export type DashboardData = {
  projectStats?: WorkspaceStats;
  todayStats?: TodayStats;
};

export type WorkspaceInsights = {
  averageLinesPerFile: number;
  averageCodeLinesPerFile: number;
  commentRatio: number;
  topLanguage: string;
  topLanguageShare: number;
  topDirectory: string;
  totalTodoCount: number;
  todoDensity: number;
};

export type AnalysisMeta = {
  durationMs: number;
  matchedFiles: number;
  analyzedFiles: number;
  skippedBinaryFiles: number;
  skippedUnreadableFiles: number;
  scopeSummary: string;
  gitAvailable?: boolean;
  gitSince?: string;
};

export type PresentationMode = {
  compact: boolean;
  title: string;
  subtitle: string;
};

export type Logger = {
  appendLine(message: string): void;
};
