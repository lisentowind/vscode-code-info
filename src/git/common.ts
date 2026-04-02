import { execFile } from 'node:child_process';
import type { GitWeek } from '../types';

export function runGit(args: string[], cwd: string): Promise<string> {
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

export async function isGitRepository(rootPath: string): Promise<boolean> {
  try {
    await runGit(['rev-parse', '--is-inside-work-tree'], rootPath);
    return true;
  } catch {
    return false;
  }
}

export function parseDeletedFilesOutput(output: string): string[] {
  const deletedFiles: string[] = [];

  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const [status, filePath] = trimmed.split('\t');
    if (status === 'D' && filePath) {
      deletedFiles.push(filePath);
    }
  }

  return deletedFiles;
}

export function parseNumstatOutput(output: string): { addedLines: number; deletedLines: number } {
  let addedLines = 0;
  let deletedLines = 0;

  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const [addedText, deletedText] = trimmed.split('\t');
    const added = Number.parseInt(addedText, 10);
    const deleted = Number.parseInt(deletedText, 10);
    if (Number.isFinite(added)) {
      addedLines += added;
    }
    if (Number.isFinite(deleted)) {
      deletedLines += deleted;
    }
  }

  return { addedLines, deletedLines };
}

export function buildWeeklyBuckets(weeks: number, now: Date = new Date()): Map<string, GitWeek> {
  const buckets = new Map<string, GitWeek>();
  const currentWeekStart = getWeekStart(now);

  for (let index = weeks - 1; index >= 0; index -= 1) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setUTCDate(weekStart.getUTCDate() - index * 7);
    const key = getWeekBucketKey(weekStart);
    buckets.set(key, { label: formatMonthDay(weekStart), commits: 0 });
  }

  return buckets;
}

export function getWeekBucketKey(date: Date): string {
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
