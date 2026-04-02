import { isGitRepository, parseDeletedFilesOutput, parseNumstatOutput, runGit } from './common';

export type GitTodayChangeSummary = {
  available: boolean;
  addedLines: number;
  deletedLines: number;
  deletedFiles: string[];
};

export async function analyzeGitTodayChanges(gitRoot: string, since: Date): Promise<GitTodayChangeSummary> {
  const sinceText = formatLocalSince(since);

  try {
    if (!(await isGitRepository(gitRoot))) {
      throw new Error('Not a git repository');
    }

    const deletedOutput = await runGit(
      ['log', `--since=${sinceText}`, '--pretty=format:', '--name-status', '--diff-filter=D', '--no-renames'],
      gitRoot
    );
    const deletedFiles = new Set(parseDeletedFilesOutput(deletedOutput));

    const numstatOutput = await runGit(['log', `--since=${sinceText}`, '--pretty=format:', '--numstat', '--no-renames'], gitRoot);
    const { addedLines, deletedLines } = parseNumstatOutput(numstatOutput);

    return {
      available: true,
      addedLines,
      deletedLines,
      deletedFiles: [...deletedFiles.values()]
    };
  } catch {
    return {
      available: false,
      addedLines: 0,
      deletedLines: 0,
      deletedFiles: []
    };
  }
}

function formatLocalSince(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  const hour = `${value.getHours()}`.padStart(2, '0');
  const minute = `${value.getMinutes()}`.padStart(2, '0');
  const second = `${value.getSeconds()}`.padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}
