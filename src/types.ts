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
  unavailableReason?: GitUnavailableReason;
  rangeLabel: string;
  totalCommits: number;
  weeklyCommits: GitWeek[];
  topAuthors: GitAuthor[];
};

export type GitUnavailableReason =
  | 'multi-root-workspace'
  | 'no-workspace-folder'
  | 'not-git-repository'
  | 'git-error';

export type TodayAnalysisSources = {
  touchedFiles: 'filesystem-mtime';
  newFiles: 'filesystem-birthtime';
  deletedFiles: 'git-log' | 'unavailable';
  lineDeltas: 'git-log' | 'unavailable';
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
  generatedAtMs?: number;
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
  modifiedAtTimestamp: number;
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
  generatedAtMs?: number;
  rangePreset: 'today' | 'last7Days' | 'last30Days';
  rangeLabel: string;
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
  gitUnavailableReason?: GitUnavailableReason;
  gitSince?: string;
  sources?: TodayAnalysisSources;
};

export type PresentationMode = {
  compact: boolean;
  title: string;
  subtitle: string;
};

export type Logger = {
  appendLine(message: string): void;
};

export type CompareSource = 'current-branch' | 'commits';

export type CompareRequest =
  | {
      mode: 'branch';
      baseRef?: string;
      headRef?: string;
    }
  | {
      mode: 'commit';
      baseRef: string;
      headRef: string;
    };

export type CompareResolvedTargets = {
  source: CompareSource;
  baseRef: string;
  headRef: string;
};

export type CompareFileStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'binary' | 'submodule';

export type CompareRawDiffRow = {
  status: CompareFileStatus;
  path: string;
  oldPath?: string;
  isSubmodule: boolean;
};

export type CompareNumstatRow = {
  path: string;
  oldPath?: string;
  addedLines: number;
  deletedLines: number;
  isBinary: boolean;
};

export type CompareDiffRow = CompareRawDiffRow & {
  addedLines: number;
  deletedLines: number;
  isBinary: boolean;
};

export type CompareTextSnapshot = {
  ref: string;
  path: string;
  content: string;
  file: FileStat;
};

export type CompareSnapshotAvailability = 'none' | 'before-only' | 'after-only' | 'both';

export type CompareNotTextComparableReason = 'binary' | 'submodule';

export type CompareOpenTarget =
  | {
      kind: 'workspace';
      resource: string;
    }
  | {
      kind: 'snapshot';
      title: string;
      content: string;
      language?: string;
    }
  | {
      kind: 'none';
    };

export type CompareFileOpenTargets = {
  path: CompareOpenTarget;
  oldPath?: CompareOpenTarget;
};

export type CompareFileSnapshot = CompareDiffRow & {
  before?: CompareTextSnapshot;
  after?: CompareTextSnapshot;
  snapshotAvailability: CompareSnapshotAvailability;
  textComparable: boolean;
  notTextComparableReason?: CompareNotTextComparableReason;
  openTargets: CompareFileOpenTargets;
};

export type CompareSummary = {
  changedFiles: number;
  newFiles: number;
  deletedFiles: number;
  addedLines: number;
  deletedLines: number;
  netCodeLines: number;
  todoDelta: number;
};

export type CompareLanguageDelta = {
  language: string;
  beforeFiles: number;
  afterFiles: number;
  beforeCodeLines: number;
  afterCodeLines: number;
  deltaCodeLines: number;
  deltaTodo: number;
};

export type CompareDirectoryDelta = {
  path: string;
  beforeFiles: number;
  afterFiles: number;
  beforeCodeLines: number;
  afterCodeLines: number;
  deltaCodeLines: number;
  deltaTodo: number;
};

export type CompareHotspot = {
  path: string;
  oldPath?: string;
  status: CompareFileStatus;
  addedLines: number;
  deletedLines: number;
  changedLines: number;
};

export type CompareAnalysisMeta = {
  durationMs: number;
  totalFiles: number;
  textComparableFiles: number;
  skippedBinaryFiles: number;
  skippedSubmoduleFiles: number;
};

export type CompareSummaryResult = {
  summary: CompareSummary;
  languages: CompareLanguageDelta[];
  directories: CompareDirectoryDelta[];
  hotspots: CompareHotspot[];
};

export type CompareStats = {
  compareSource: CompareSource;
  resolvedTargets: CompareResolvedTargets;
  summary: CompareSummary;
  files: CompareFileSnapshot[];
  languages: CompareLanguageDelta[];
  directories: CompareDirectoryDelta[];
  hotspots: CompareHotspot[];
  analysisMeta: CompareAnalysisMeta;
};
