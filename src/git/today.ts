import { execFile } from 'node:child_process';

export type GitTodayChangeSummary = {
  available: boolean;
  addedLines: number;
  deletedLines: number;
  deletedFiles: string[];
};

export async function analyzeGitTodayChanges(gitRoot: string, since: Date): Promise<GitTodayChangeSummary> {
  const sinceText = formatLocalSince(since);

  try {
    await runGit(['rev-parse', '--is-inside-work-tree'], gitRoot);

    const deletedOutput = await runGit(
      ['log', `--since=${sinceText}`, '--pretty=format:', '--name-status', '--diff-filter=D', '--no-renames'],
      gitRoot
    );

    const deletedFiles = new Set<string>();
    for (const line of deletedOutput.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      const [status, filePath] = trimmed.split('\t');
      if (status === 'D' && filePath) {
        deletedFiles.add(filePath);
      }
    }

    const numstatOutput = await runGit(['log', `--since=${sinceText}`, '--pretty=format:', '--numstat', '--no-renames'], gitRoot);
    let addedLines = 0;
    let deletedLines = 0;

    for (const line of numstatOutput.split(/\r?\n/)) {
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

function formatLocalSince(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  const hour = `${value.getHours()}`.padStart(2, '0');
  const minute = `${value.getMinutes()}`.padStart(2, '0');
  const second = `${value.getSeconds()}`.padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}
