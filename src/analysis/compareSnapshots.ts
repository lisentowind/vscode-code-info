import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { analyzeText } from './lineMetrics';
import { detectLanguage } from './languageDetector';
import { readCompareTextSnapshot } from '../git/compare';
import type { CompareDiffRow, CompareFileSnapshot, CompareResolvedTargets, CompareTextSnapshot } from '../types';

type SnapshotReader = (rootPath: string, ref: string, path: string) => Promise<string | undefined>;

export async function analyzeCompareSnapshots(
  rootPath: string,
  targets: CompareResolvedTargets,
  rows: CompareDiffRow[],
  readSnapshot: SnapshotReader = readCompareTextSnapshot
): Promise<CompareFileSnapshot[]> {
  const output: CompareFileSnapshot[] = [];

  for (const row of rows) {
    if (row.isSubmodule || row.status === 'submodule') {
      output.push({
        ...row,
        before: undefined,
        after: undefined,
        snapshotAvailability: 'none',
        textComparable: false,
        notTextComparableReason: 'submodule',
        openTargets: { path: { kind: 'none' }, oldPath: row.oldPath ? { kind: 'none' } : undefined }
      });
      continue;
    }

    if (row.isBinary || row.status === 'binary') {
      output.push({
        ...row,
        before: undefined,
        after: undefined,
        snapshotAvailability: 'none',
        textComparable: false,
        notTextComparableReason: 'binary',
        openTargets: { path: { kind: 'none' }, oldPath: row.oldPath ? { kind: 'none' } : undefined }
      });
      continue;
    }

    const beforeRequest = resolveBeforeSnapshotRequest(row, targets.baseRef);
    const afterRequest = resolveAfterSnapshotRequest(row, targets.headRef);

    const [beforeContent, afterContent] = await Promise.all([
      beforeRequest ? readSnapshot(rootPath, beforeRequest.ref, beforeRequest.path) : Promise.resolve(undefined),
      afterRequest ? readSnapshot(rootPath, afterRequest.ref, afterRequest.path) : Promise.resolve(undefined)
    ]);

    const before = beforeRequest && beforeContent !== undefined ? createCompareTextSnapshot(beforeRequest.ref, beforeRequest.path, beforeContent) : undefined;
    const after = afterRequest && afterContent !== undefined ? createCompareTextSnapshot(afterRequest.ref, afterRequest.path, afterContent) : undefined;

    const snapshotAvailability = before && after ? 'both' : before ? 'before-only' : after ? 'after-only' : 'none';
    const textComparable = before !== undefined || after !== undefined;
    const workspaceResource = toWorkspaceResource(rootPath, row.path);

    output.push({
      ...row,
      before,
      after,
      snapshotAvailability,
      textComparable,
      openTargets: {
        path: resolvePathOpenTarget(targets.source, row.status, before, after, workspaceResource),
        oldPath: row.oldPath ? (before ? toSnapshotOpenTarget(before) : { kind: 'none' }) : undefined
      }
    });
  }

  return output;
}

function resolveBeforeSnapshotRequest(row: CompareDiffRow, baseRef: string): { ref: string; path: string } | undefined {
  if (row.status === 'added') {
    return undefined;
  }
  if (row.status === 'renamed' && row.oldPath) {
    return { ref: baseRef, path: row.oldPath };
  }
  return { ref: baseRef, path: row.path };
}

function resolveAfterSnapshotRequest(row: CompareDiffRow, headRef: string): { ref: string; path: string } | undefined {
  if (row.status === 'deleted') {
    return undefined;
  }
  return { ref: headRef, path: row.path };
}

function createCompareTextSnapshot(ref: string, filePath: string, content: string): CompareTextSnapshot {
  const language = detectLanguage({ path: `/${filePath}` } as never);
  const metrics = analyzeText(content, language).metrics;

  return {
    ref,
    path: filePath,
    content,
    file: {
      resource: `compare-snapshot:${ref}:${filePath}`,
      path: filePath,
      language,
      lines: metrics.lines,
      codeLines: metrics.codeLines,
      commentLines: metrics.commentLines,
      blankLines: metrics.blankLines,
      bytes: Buffer.byteLength(content, 'utf8'),
      todoCounts: metrics.todoCounts
    }
  };
}

function resolvePathOpenTarget(
  source: CompareResolvedTargets['source'],
  status: CompareDiffRow['status'],
  before: CompareTextSnapshot | undefined,
  after: CompareTextSnapshot | undefined,
  workspaceResource: string
): CompareFileSnapshot['openTargets']['path'] {
  if (status === 'deleted') {
    return before ? toSnapshotOpenTarget(before) : { kind: 'none' };
  }

  if (status === 'added' || status === 'modified' || status === 'renamed') {
    if (after) {
      if (source === 'commits') {
        return toSnapshotOpenTarget(after);
      }
      return { kind: 'workspace', resource: workspaceResource };
    }
    return { kind: 'none' };
  }

  return { kind: 'none' };
}

function toSnapshotOpenTarget(snapshot: CompareTextSnapshot): CompareFileSnapshot['openTargets']['path'] {
  return {
    kind: 'snapshot',
    title: `${snapshot.path} (${snapshot.ref.slice(0, 8)})`,
    content: snapshot.content,
    language: snapshot.file.language
  };
}

function toWorkspaceResource(rootPath: string, relativePath: string): string {
  return pathToFileURL(resolve(rootPath, relativePath)).toString();
}
