import { GIT_WEEKS } from '../constants';
import type { GitAuthor, GitStats } from '../types';
import { buildWeeklyBuckets, getWeekBucketKey, isGitRepository, runGit } from './common';

export async function analyzeGitHistory(rootPath: string): Promise<GitStats> {
  const emptyWeeks = buildWeeklyBuckets(GIT_WEEKS);

  try {
    if (!(await isGitRepository(rootPath))) {
      throw new Error('Not a git repository');
    }
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
