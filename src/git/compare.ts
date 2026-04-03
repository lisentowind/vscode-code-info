import { runGit } from './common';
import type { CompareDiffRow, CompareNumstatRow, CompareRawDiffRow, CompareRequest, CompareResolvedTargets } from '../types';

export async function resolveDefaultCompareBase(rootPath: string): Promise<string> {
  if (await refExists(rootPath, 'main')) {
    return 'main';
  }
  if (await refExists(rootPath, 'master')) {
    return 'master';
  }

  throw new Error('Cannot resolve default compare base. Neither main nor master exists.');
}

export async function resolveCompareTargets(rootPath: string, request: CompareRequest): Promise<CompareResolvedTargets> {
  if (request.mode === 'commit') {
    const baseRef = request.baseRef.trim();
    const headRef = request.headRef.trim();
    await Promise.all([assertCommitExists(rootPath, baseRef), assertCommitExists(rootPath, headRef)]);
    return {
      source: 'commits',
      baseRef,
      headRef
    };
  }

  const baseRef = request.baseRef?.trim() || (await resolveDefaultCompareBase(rootPath));
  const headRef = request.headRef?.trim() || (await getCurrentBranchName(rootPath));

  await Promise.all([assertCommitExists(rootPath, baseRef), assertCommitExists(rootPath, headRef)]);

  return {
    source: 'current-branch',
    baseRef,
    headRef
  };
}

export async function listLocalBranches(rootPath: string): Promise<string[]> {
  const output = await runGit(['for-each-ref', '--format=%(refname:short)', 'refs/heads'], rootPath);
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

export async function getCurrentBranchName(rootPath: string): Promise<string> {
  return (await runGit(['symbolic-ref', '--short', 'HEAD'], rootPath)).trim();
}

export function parseCompareRawOutput(output: string): CompareRawDiffRow[] {
  const rows: CompareRawDiffRow[] = [];
  const tokens = output.split('\0');
  let index = 0;

  while (index < tokens.length) {
    const meta = tokens[index];
    index += 1;
    if (!meta || !meta.startsWith(':')) {
      continue;
    }

    const parts = meta.slice(1).split(' ');
    if (parts.length < 5) {
      continue;
    }

    const oldMode = parts[0];
    const newMode = parts[1];
    const statusToken = parts[4];
    const statusCode = statusToken[0] ?? '';
    const isSubmodule = oldMode === '160000' || newMode === '160000';

    if (statusCode === 'R' || statusCode === 'C') {
      const oldPath = tokens[index];
      const path = tokens[index + 1];
      index += 2;
      if (!oldPath || !path) {
        continue;
      }

      rows.push({
        status: isSubmodule ? 'submodule' : 'renamed',
        oldPath,
        path,
        isSubmodule
      });
      continue;
    }

    const path = tokens[index];
    index += 1;
    if (!path) {
      continue;
    }

    rows.push({
      status: isSubmodule ? 'submodule' : mapRawStatus(statusCode),
      path,
      isSubmodule
    });
  }

  return rows;
}

export function parseCompareNumstatOutput(output: string): CompareNumstatRow[] {
  const rows: CompareNumstatRow[] = [];
  const tokens = output.split('\0');
  let index = 0;

  while (index < tokens.length) {
    const entry = tokens[index];
    index += 1;
    if (!entry) {
      continue;
    }

    const parts = entry.split('\t');
    if (parts.length < 3) {
      continue;
    }

    const addedText = parts[0] ?? '';
    const deletedText = parts[1] ?? '';
    const rawPath = parts[2] ?? '';

    const isBinary = addedText === '-' || deletedText === '-';
    const addedLines = parseNumstatNumber(addedText);
    const deletedLines = parseNumstatNumber(deletedText);

    if (rawPath === '') {
      const oldPath = tokens[index];
      const path = tokens[index + 1];
      index += 2;
      if (!oldPath || !path) {
        continue;
      }
      rows.push({ oldPath, path, addedLines, deletedLines, isBinary });
      continue;
    }

    rows.push({
      path: rawPath,
      addedLines,
      deletedLines,
      isBinary
    });
  }

  return rows;
}

export function mergeCompareDiffRows(rawRows: CompareRawDiffRow[], numstatRows: CompareNumstatRow[]): CompareDiffRow[] {
  const numstatByPath = new Map<string, CompareNumstatRow>();

  for (const row of numstatRows) {
    numstatByPath.set(toDiffKey(row.path, row.oldPath), row);
  }

  return rawRows.map((row) => {
    const matched = numstatByPath.get(toDiffKey(row.path, row.oldPath));
    const isBinary = matched?.isBinary ?? false;
    return {
      ...row,
      status: row.isSubmodule ? 'submodule' : isBinary ? 'binary' : row.status,
      addedLines: matched?.addedLines ?? 0,
      deletedLines: matched?.deletedLines ?? 0,
      isBinary
    };
  });
}

export async function readCompareTextSnapshot(rootPath: string, ref: string, path: string): Promise<string | undefined> {
  try {
    const output = await runGit(['show', `${ref}:${path}`], rootPath);
    return output.includes('\u0000') ? undefined : output;
  } catch {
    return undefined;
  }
}

async function refExists(rootPath: string, ref: string): Promise<boolean> {
  try {
    await runGit(['rev-parse', '--verify', ref], rootPath);
    return true;
  } catch {
    return false;
  }
}

async function assertCommitExists(rootPath: string, ref: string): Promise<void> {
  await runGit(['rev-parse', '--verify', `${ref}^{commit}`], rootPath);
}

function mapRawStatus(statusCode: string): CompareRawDiffRow['status'] {
  if (statusCode === 'A') {
    return 'added';
  }
  if (statusCode === 'D') {
    return 'deleted';
  }
  if (statusCode === 'R' || statusCode === 'C') {
    return 'renamed';
  }
  return 'modified';
}

function parseNumstatNumber(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDiffKey(path: string, oldPath?: string): string {
  return oldPath ? `${oldPath}\0${path}` : path;
}
