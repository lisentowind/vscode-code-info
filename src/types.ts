export type FileStat = {
  path: string;
  language: string;
  lines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  bytes: number;
};

export type LanguageSummary = {
  language: string;
  files: number;
  lines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  bytes: number;
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
  largestFiles: FileStat[];
  files: FileStat[];
  git: GitStats;
};

export type PresentationMode = {
  compact: boolean;
  title: string;
  subtitle: string;
};

export type Logger = {
  appendLine(message: string): void;
};

