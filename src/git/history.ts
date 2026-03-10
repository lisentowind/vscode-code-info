import { execFile } from 'node:child_process';
import { GIT_WEEKS } from '../constants';
import type { GitAuthor, GitStats, GitWeek } from '../types';

export async function analyzeGitHistory(rootPath: string): Promise<GitStats> {
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
