import * as assert from 'assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as vscode from 'vscode';
import {
  mergeCompareDiffRows,
  parseCompareNumstatOutput,
  parseCompareRawOutput,
  readCompareTextSnapshot,
  resolveCompareTargets,
  resolveDefaultCompareBase
} from '../git/compare';
import { analyzeCompareSnapshots } from '../analysis/compareSnapshots';
import { buildCompareSummaries } from '../analysis/compareSummaries';
import { analyzeCompare } from '../analysis/compareAnalyzer';
import {
  applyCompareModeChange,
  buildCompareRequestFromPanelState,
  createInitialComparePanelState,
  reduceComparePanelState,
  resetComparePanel
} from '../ui/comparePanel';
import { getCompareHtml } from '../webview/compareTemplates';
import type { CompareDiffRow, CompareFileSnapshot, CompareHotspot, CompareRequest } from '../types';

suite('Compare Primitives Test Suite', () => {
  vscode.window.showInformationMessage('Start compare primitive tests.');

  test('resolveCompareTargets resolves branch mode with main as default base', async () => {
    const repoPath = createFixtureRepository('main');

    try {
      const resolved = await resolveCompareTargets(repoPath, { mode: 'branch' });
      assert.strictEqual(resolved.baseRef, 'main');
      assert.strictEqual(resolved.headRef, 'feature/test');
      assert.strictEqual(resolved.source, 'current-branch');
    } finally {
      rmSync(repoPath, { recursive: true, force: true });
    }
  });

  test('resolveDefaultCompareBase falls back to master when main is unavailable', async () => {
    const repoPath = createFixtureRepository('master');

    try {
      const baseRef = await resolveDefaultCompareBase(repoPath);
      assert.strictEqual(baseRef, 'master');
    } finally {
      rmSync(repoPath, { recursive: true, force: true });
    }
  });

  test('parseCompareRawOutput classifies statuses including renamed and submodule', () => {
    const output = [
      ':000000 100644 0000000 1111111 A',
      'src/new.ts',
      ':100644 100644 1111111 2222222 M',
      'src/changed.ts',
      ':100644 000000 3333333 0000000 D',
      'src/removed.ts',
      ':100644 100644 4444444 5555555 R087',
      'src/old-name.ts',
      'src/new-name.ts',
      ':160000 160000 aaaaaaa bbbbbbb M',
      'modules/lib'
    ].join('\0') + '\0';

    const rows = parseCompareRawOutput(output);

    assert.deepStrictEqual(rows, [
      { status: 'added', path: 'src/new.ts', isSubmodule: false },
      { status: 'modified', path: 'src/changed.ts', isSubmodule: false },
      { status: 'deleted', path: 'src/removed.ts', isSubmodule: false },
      { status: 'renamed', oldPath: 'src/old-name.ts', path: 'src/new-name.ts', isSubmodule: false },
      { status: 'submodule', path: 'modules/lib', isSubmodule: true }
    ]);
  });

  test('parseCompareNumstatOutput parses line deltas, rename paths, and binary marker', () => {
    const output = [
      '10\t0\tsrc/new.ts',
      '8\t3\tsrc/changed.ts',
      '0\t5\tsrc/removed.ts',
      '12\t4\t',
      'src/old-name.ts',
      'src/new-name.ts',
      '-\t-\tmodules/lib'
    ].join('\0') + '\0';

    const rows = parseCompareNumstatOutput(output);

    assert.deepStrictEqual(rows, [
      { path: 'src/new.ts', addedLines: 10, deletedLines: 0, isBinary: false },
      { path: 'src/changed.ts', addedLines: 8, deletedLines: 3, isBinary: false },
      { path: 'src/removed.ts', addedLines: 0, deletedLines: 5, isBinary: false },
      { oldPath: 'src/old-name.ts', path: 'src/new-name.ts', addedLines: 12, deletedLines: 4, isBinary: false },
      { path: 'modules/lib', addedLines: 0, deletedLines: 0, isBinary: true }
    ]);
  });

  test('mergeCompareDiffRows combines raw status with numstat deltas', () => {
    const rawRows = parseCompareRawOutput(
      [
        ':100644 100644 1111111 2222222 M',
        'src/changed.ts',
        ':100644 100644 4444444 5555555 R087',
        'src/old-name.ts',
        'src/new-name.ts',
        ':160000 160000 aaaaaaa bbbbbbb M',
        'modules/lib'
      ].join('\0') + '\0'
    );
    const numstatRows = parseCompareNumstatOutput(
      [
        '8\t3\tsrc/changed.ts',
        '12\t4\t',
        'src/old-name.ts',
        'src/new-name.ts',
        '-\t-\tmodules/lib'
      ].join('\0') + '\0'
    );

    const merged = mergeCompareDiffRows(rawRows, numstatRows);

    assert.deepStrictEqual(merged, [
      { status: 'modified', path: 'src/changed.ts', isSubmodule: false, isBinary: false, addedLines: 8, deletedLines: 3 },
      {
        status: 'renamed',
        oldPath: 'src/old-name.ts',
        path: 'src/new-name.ts',
        isSubmodule: false,
        isBinary: false,
        addedLines: 12,
        deletedLines: 4
      },
      { status: 'submodule', path: 'modules/lib', isSubmodule: true, isBinary: true, addedLines: 0, deletedLines: 0 }
    ]);
  });

  test('analyzeCompareSnapshots builds before and after snapshots for text files', async () => {
    const fixture = createSnapshotFixtureRepository();

    try {
      const rows: CompareDiffRow[] = [
        { status: 'modified', path: 'modified.ts', isSubmodule: false, isBinary: false, addedLines: 1, deletedLines: 1 }
      ];

      const results = await analyzeCompareSnapshots(
        fixture.repoPath,
        { source: 'commits', baseRef: fixture.baseRef, headRef: fixture.headRef },
        rows
      );

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0]?.snapshotAvailability, 'both');
      assert.strictEqual(results[0]?.before?.path, 'modified.ts');
      assert.strictEqual(results[0]?.after?.path, 'modified.ts');
      assert.strictEqual(results[0]?.textComparable, true);
    } finally {
      rmSync(fixture.repoPath, { recursive: true, force: true });
    }
  });

  test('analyzeCompareSnapshots returns before-only snapshot and snapshot open target for deleted files', async () => {
    const fixture = createSnapshotFixtureRepository();

    try {
      const rows: CompareDiffRow[] = [
        { status: 'deleted', path: 'deleted.ts', isSubmodule: false, isBinary: false, addedLines: 0, deletedLines: 5 }
      ];

      const results = await analyzeCompareSnapshots(
        fixture.repoPath,
        { source: 'commits', baseRef: fixture.baseRef, headRef: fixture.headRef },
        rows
      );

      assert.strictEqual(results[0]?.snapshotAvailability, 'before-only');
      assert.strictEqual(results[0]?.before?.path, 'deleted.ts');
      assert.strictEqual(results[0]?.after, undefined);
      assert.strictEqual(results[0]?.openTargets.path.kind, 'snapshot');
    } finally {
      rmSync(fixture.repoPath, { recursive: true, force: true });
    }
  });

  test('analyzeCompareSnapshots returns after-only snapshot and snapshot open target for commit compare added files', async () => {
    const fixture = createSnapshotFixtureRepository();

    try {
      const rows: CompareDiffRow[] = [
        { status: 'added', path: 'added.ts', isSubmodule: false, isBinary: false, addedLines: 3, deletedLines: 0 }
      ];

      const results = await analyzeCompareSnapshots(
        fixture.repoPath,
        { source: 'commits', baseRef: fixture.baseRef, headRef: fixture.headRef },
        rows
      );

      assert.strictEqual(results[0]?.snapshotAvailability, 'after-only');
      assert.strictEqual(results[0]?.before, undefined);
      assert.strictEqual(results[0]?.after?.path, 'added.ts');
      assert.strictEqual(results[0]?.openTargets.path.kind, 'snapshot');
    } finally {
      rmSync(fixture.repoPath, { recursive: true, force: true });
    }
  });

  test('analyzeCompareSnapshots keeps oldPath and snapshot open targets for commit compare renamed text files', async () => {
    const fixture = createSnapshotFixtureRepository();

    try {
      const rows: CompareDiffRow[] = [
        {
          status: 'renamed',
          oldPath: 'rename-old.ts',
          path: 'rename-new.ts',
          isSubmodule: false,
          isBinary: false,
          addedLines: 1,
          deletedLines: 1
        }
      ];

      const results = await analyzeCompareSnapshots(
        fixture.repoPath,
        { source: 'commits', baseRef: fixture.baseRef, headRef: fixture.headRef },
        rows
      );

      assert.strictEqual(results[0]?.oldPath, 'rename-old.ts');
      assert.strictEqual(results[0]?.path, 'rename-new.ts');
      assert.strictEqual(results[0]?.snapshotAvailability, 'both');
      assert.strictEqual(results[0]?.before?.path, 'rename-old.ts');
      assert.strictEqual(results[0]?.after?.path, 'rename-new.ts');
      assert.strictEqual(results[0]?.openTargets.oldPath?.kind, 'snapshot');
      assert.strictEqual(results[0]?.openTargets.path.kind, 'snapshot');
    } finally {
      rmSync(fixture.repoPath, { recursive: true, force: true });
    }
  });

  test('analyzeCompareSnapshots uses workspace open targets for current-branch compare', async () => {
    const fixture = createSnapshotFixtureRepository();

    try {
      const rows: CompareDiffRow[] = [
        { status: 'modified', path: 'modified.ts', isSubmodule: false, isBinary: false, addedLines: 1, deletedLines: 1 }
      ];

      const results = await analyzeCompareSnapshots(
        fixture.repoPath,
        { source: 'current-branch', baseRef: fixture.baseRef, headRef: fixture.headRef },
        rows
      );

      assert.strictEqual(results[0]?.openTargets.path.kind, 'workspace');
    } finally {
      rmSync(fixture.repoPath, { recursive: true, force: true });
    }
  });

  test('analyzeCompareSnapshots skips text snapshots for binary and submodule rows', async () => {
    const fixture = createSnapshotFixtureRepository();
    const calls: Array<{ ref: string; path: string }> = [];

    try {
      const rows: CompareDiffRow[] = [
        { status: 'binary', path: 'bin/data.bin', isSubmodule: false, isBinary: true, addedLines: 0, deletedLines: 0 },
        { status: 'submodule', path: 'modules/lib', isSubmodule: true, isBinary: true, addedLines: 0, deletedLines: 0 },
        { status: 'modified', path: 'modified.ts', isSubmodule: false, isBinary: false, addedLines: 1, deletedLines: 1 }
      ];

      const results = await analyzeCompareSnapshots(
        fixture.repoPath,
        { source: 'commits', baseRef: fixture.baseRef, headRef: fixture.headRef },
        rows,
        async (_rootPath, ref, path) => {
          calls.push({ ref, path });
          return readCompareTextSnapshot(fixture.repoPath, ref, path);
        }
      );

      assert.strictEqual(results[0]?.textComparable, false);
      assert.strictEqual(results[0]?.notTextComparableReason, 'binary');
      assert.strictEqual(results[0]?.snapshotAvailability, 'none');

      assert.strictEqual(results[1]?.textComparable, false);
      assert.strictEqual(results[1]?.notTextComparableReason, 'submodule');
      assert.strictEqual(results[1]?.snapshotAvailability, 'none');

      assert.strictEqual(results[2]?.textComparable, true);
      assert.deepStrictEqual(calls, [
        { ref: fixture.baseRef, path: 'modified.ts' },
        { ref: fixture.headRef, path: 'modified.ts' }
      ]);
    } finally {
      rmSync(fixture.repoPath, { recursive: true, force: true });
    }
  });

  test('buildCompareSummaries calculates summary cards, language and directory deltas, and hotspot ordering', () => {
    const files: CompareFileSnapshot[] = [
      createCompareFileSnapshot({
        status: 'modified',
        path: 'src/alpha.ts',
        addedLines: 10,
        deletedLines: 4,
        before: { path: 'src/alpha.ts', language: 'typescript', codeLines: 10, todoTotal: 1 },
        after: { path: 'src/alpha.ts', language: 'typescript', codeLines: 14, todoTotal: 3 }
      }),
      createCompareFileSnapshot({
        status: 'added',
        path: 'src/new.ts',
        addedLines: 6,
        deletedLines: 0,
        after: { path: 'src/new.ts', language: 'typescript', codeLines: 6, todoTotal: 2 }
      }),
      createCompareFileSnapshot({
        status: 'deleted',
        path: 'docs/old.md',
        addedLines: 0,
        deletedLines: 5,
        before: { path: 'docs/old.md', language: 'markdown', codeLines: 5, todoTotal: 1 }
      }),
      createCompareFileSnapshot({
        status: 'renamed',
        oldPath: 'legacy/rename-old.ts',
        path: 'src/rename-new.ts',
        addedLines: 2,
        deletedLines: 3,
        before: { path: 'legacy/rename-old.ts', language: 'typescript', codeLines: 3, todoTotal: 1 },
        after: { path: 'src/rename-new.ts', language: 'typescript', codeLines: 7, todoTotal: 0 }
      }),
      createCompareFileSnapshot({
        status: 'binary',
        path: 'assets/logo.png',
        addedLines: 30,
        deletedLines: 10
      }),
      createCompareFileSnapshot({
        status: 'submodule',
        path: 'vendor/lib',
        addedLines: 11,
        deletedLines: 9,
        isSubmodule: true
      })
    ];

    const summaries = buildCompareSummaries(files, { workspaceFolderNames: [], moduleDepth: 1 });

    assert.deepStrictEqual(summaries.summary, {
      changedFiles: 4,
      newFiles: 1,
      deletedFiles: 1,
      addedLines: 59,
      deletedLines: 31,
      netCodeLines: 9,
      todoDelta: 2
    });

    assert.deepStrictEqual(summaries.languages, [
      { language: 'typescript', beforeFiles: 2, afterFiles: 3, beforeCodeLines: 13, afterCodeLines: 27, deltaCodeLines: 14, deltaTodo: 3 },
      { language: 'markdown', beforeFiles: 1, afterFiles: 0, beforeCodeLines: 5, afterCodeLines: 0, deltaCodeLines: -5, deltaTodo: -1 }
    ]);

    assert.deepStrictEqual(summaries.directories, [
      { path: 'src', beforeFiles: 1, afterFiles: 3, beforeCodeLines: 10, afterCodeLines: 27, deltaCodeLines: 17, deltaTodo: 4 },
      { path: 'legacy', beforeFiles: 1, afterFiles: 0, beforeCodeLines: 3, afterCodeLines: 0, deltaCodeLines: -3, deltaTodo: -1 },
      { path: 'docs', beforeFiles: 1, afterFiles: 0, beforeCodeLines: 5, afterCodeLines: 0, deltaCodeLines: -5, deltaTodo: -1 }
    ]);

    assert.deepStrictEqual(summaries.hotspots.map((item: CompareHotspot) => ({ path: item.path, changedLines: item.changedLines })), [
      { path: 'assets/logo.png', changedLines: 40 },
      { path: 'vendor/lib', changedLines: 20 },
      { path: 'src/alpha.ts', changedLines: 14 },
      { path: 'src/new.ts', changedLines: 6 },
      { path: 'docs/old.md', changedLines: 5 },
      { path: 'src/rename-new.ts', changedLines: 5 }
    ]);
  });

  test('analyzeCompare returns compare stats with required fields', async () => {
    const fixture = createSnapshotFixtureRepository();
    try {
      const request: CompareRequest = { mode: 'commit', baseRef: fixture.baseRef, headRef: fixture.headRef };
      const stats = await analyzeCompare(request, undefined, {
        rootPath: fixture.repoPath,
        workspaceFolderNames: [],
        moduleDepth: 1
      });

      assert.strictEqual(stats.compareSource, 'commits');
      assert.strictEqual(stats.resolvedTargets.baseRef, fixture.baseRef);
      assert.strictEqual(stats.resolvedTargets.headRef, fixture.headRef);
      assert.ok(Array.isArray(stats.files));
      assert.ok(Array.isArray(stats.languages));
      assert.ok(Array.isArray(stats.directories));
      assert.ok(Array.isArray(stats.hotspots));
      assert.ok(stats.analysisMeta.durationMs >= 0);
    } finally {
      rmSync(fixture.repoPath, { recursive: true, force: true });
    }
  });

  test('createInitialComparePanelState starts in branch mode', () => {
    const state = createInitialComparePanelState();

    assert.strictEqual(state.mode, 'branch');
    assert.strictEqual(state.status, 'idle');
    assert.strictEqual(state.baseRef, '');
    assert.strictEqual(state.headRef, '');
  });

  test('applyCompareModeChange resets inputs and error state when switching mode', () => {
    const state = applyCompareModeChange(
      {
        ...createInitialComparePanelState(),
        mode: 'branch',
        baseRef: 'main',
        headRef: 'feature/test',
        status: 'error',
        latestError: 'bad ref',
        latestResult: {
          compareSource: 'commits',
          resolvedTargets: { source: 'commits', baseRef: 'base', headRef: 'head' },
          summary: { changedFiles: 1, newFiles: 0, deletedFiles: 0, addedLines: 1, deletedLines: 0, netCodeLines: 1, todoDelta: 0 },
          files: [],
          languages: [],
          directories: [],
          hotspots: [],
          analysisMeta: { durationMs: 10, totalFiles: 1, textComparableFiles: 1, skippedBinaryFiles: 0, skippedSubmoduleFiles: 0 }
        }
      },
      'commit'
    );

    assert.strictEqual(state.mode, 'commit');
    assert.strictEqual(state.baseRef, '');
    assert.strictEqual(state.headRef, '');
    assert.strictEqual(state.status, 'idle');
    assert.strictEqual(state.latestError, undefined);
    assert.strictEqual(state.latestResult, undefined);
  });

  test('buildCompareRequestFromPanelState requires both refs for commit mode', () => {
    assert.strictEqual(
      buildCompareRequestFromPanelState({
        ...createInitialComparePanelState(),
        mode: 'commit',
        baseRef: 'abc123',
        headRef: ''
      }),
      undefined
    );

    assert.deepStrictEqual(
      buildCompareRequestFromPanelState({
        ...createInitialComparePanelState(),
        mode: 'commit',
        baseRef: 'abc123',
        headRef: 'def456'
      }),
      { mode: 'commit', baseRef: 'abc123', headRef: 'def456' }
    );
  });

  test('buildCompareRequestFromPanelState allows branch mode with optional refs', () => {
    assert.deepStrictEqual(
      buildCompareRequestFromPanelState(createInitialComparePanelState()),
      { mode: 'branch', baseRef: undefined, headRef: undefined }
    );
  });

  test('reduceComparePanelState tracks loading success and error transitions', () => {
    const loading = reduceComparePanelState(createInitialComparePanelState(), { type: 'run:start' });
    assert.strictEqual(loading.status, 'loading');

    const success = reduceComparePanelState(loading, {
      type: 'run:success',
      result: {
        compareSource: 'commits',
        resolvedTargets: { source: 'commits', baseRef: 'base', headRef: 'head' },
        summary: { changedFiles: 1, newFiles: 0, deletedFiles: 0, addedLines: 1, deletedLines: 0, netCodeLines: 1, todoDelta: 0 },
        files: [],
        languages: [],
        directories: [],
        hotspots: [],
        analysisMeta: { durationMs: 10, totalFiles: 1, textComparableFiles: 1, skippedBinaryFiles: 0, skippedSubmoduleFiles: 0 }
      }
    });
    assert.strictEqual(success.status, 'success');
    assert.strictEqual(success.latestError, undefined);
    assert.strictEqual(success.latestResult?.compareSource, 'commits');

    const error = reduceComparePanelState(success, { type: 'run:error', error: 'bad commit' });
    assert.strictEqual(error.status, 'error');
    assert.strictEqual(error.latestError, 'bad commit');
    assert.strictEqual(error.latestResult, undefined);
  });

  test('getCompareHtml renders branch and commit controls plus compare summary', () => {
    const state = reduceComparePanelState(
      {
        ...createInitialComparePanelState(),
        mode: 'commit',
        baseRef: 'abc123',
        headRef: 'def456'
      },
      {
        type: 'run:success',
        result: {
          compareSource: 'commits',
          resolvedTargets: { source: 'commits', baseRef: 'abc123', headRef: 'def456' },
          summary: { changedFiles: 2, newFiles: 1, deletedFiles: 0, addedLines: 8, deletedLines: 3, netCodeLines: 5, todoDelta: 1 },
          files: [
            createCompareFileSnapshot({
              status: 'deleted',
              path: 'src/old.ts',
              addedLines: 0,
              deletedLines: 3,
              before: { path: 'src/old.ts', language: 'typescript', codeLines: 3, todoTotal: 0 }
            }),
            createCompareFileSnapshot({
              status: 'renamed',
              oldPath: 'src/legacy.ts',
              path: 'src/new.ts',
              addedLines: 8,
              deletedLines: 0,
              before: { path: 'src/legacy.ts', language: 'typescript', codeLines: 1, todoTotal: 0 },
              after: { path: 'src/new.ts', language: 'typescript', codeLines: 6, todoTotal: 1 }
            })
          ],
          languages: [
            {
              language: 'typescript',
              beforeFiles: 1,
              afterFiles: 2,
              beforeCodeLines: 1,
              afterCodeLines: 6,
              deltaCodeLines: 5,
              deltaTodo: 1
            }
          ],
          directories: [
            {
              path: 'src',
              beforeFiles: 1,
              afterFiles: 2,
              beforeCodeLines: 1,
              afterCodeLines: 6,
              deltaCodeLines: 5,
              deltaTodo: 1
            }
          ],
          hotspots: [
            {
              path: 'src/new.ts',
              oldPath: 'src/legacy.ts',
              status: 'renamed',
              addedLines: 8,
              deletedLines: 0,
              changedLines: 8
            }
          ],
          analysisMeta: { durationMs: 10, totalFiles: 2, textComparableFiles: 2, skippedBinaryFiles: 0, skippedSubmoduleFiles: 0 }
        }
      }
    );

    const html = getCompareHtml({ cspSource: 'vscode-webview:' } as vscode.Webview, state);

    assert.ok(html.includes('当前分支 vs main/master'));
    assert.ok(html.includes('两个 Commit 对比'));
    assert.ok(html.includes('placeholder="base commit"'));
    assert.ok(html.includes('placeholder="head commit"'));
    assert.ok(html.includes('变更文件'));
    assert.ok(html.includes('代码净变化'));
    assert.ok(html.includes('status-badge status-deleted'));
    assert.ok(html.includes('status-badge status-renamed'));
    assert.ok(html.includes('打开 base'));
    assert.ok(html.includes('打开旧路径'));
    assert.ok(html.includes('语言变化'));
    assert.ok(html.includes('目录变化'));
    assert.ok(html.includes('热点文件'));
    assert.ok(html.includes('src/legacy.ts'));
    assert.ok(html.includes('src/new.ts'));
  });

  test('getCompareHtml renders loading and error states distinctly', () => {
    const loadingHtml = getCompareHtml(
      { cspSource: 'vscode-webview:' } as vscode.Webview,
      reduceComparePanelState(createInitialComparePanelState(), { type: 'run:start' })
    );
    const errorHtml = getCompareHtml(
      { cspSource: 'vscode-webview:' } as vscode.Webview,
      reduceComparePanelState(createInitialComparePanelState(), { type: 'run:error', error: 'invalid sha' })
    );

    assert.ok(loadingHtml.includes('正在计算这次对比'));
    assert.ok(errorHtml.includes('invalid sha'));
  });

  test('getCompareHtml renders local branch dropdowns in branch mode', () => {
    const state = {
      ...createInitialComparePanelState(),
      mode: 'branch' as const,
      baseRef: 'main',
      headRef: 'feature/demo',
      branchOptions: ['main', 'master', 'feature/demo']
    };

    const html = getCompareHtml({ cspSource: 'vscode-webview:' } as vscode.Webview, state as never);

    assert.ok(html.includes('id="branchBaseRef"'));
    assert.ok(html.includes('id="branchHeadRef"'));
    assert.ok(html.includes('<select'));
    assert.ok(!html.includes('placeholder="base commit"'));
    assert.ok(!html.includes('placeholder="head commit"'));
  });

  test('getCompareHtml keeps manual commit inputs in commit mode', () => {
    const state = {
      ...createInitialComparePanelState(),
      mode: 'commit' as const,
      baseRef: 'abc123',
      headRef: 'def456',
      branchOptions: ['main', 'master', 'feature/demo']
    };

    const html = getCompareHtml({ cspSource: 'vscode-webview:' } as vscode.Webview, state as never);

    assert.ok(html.includes('placeholder="base commit"'));
    assert.ok(html.includes('placeholder="head commit"'));
    assert.ok(!html.includes('id="branchBaseRef"'));
    assert.ok(!html.includes('id="branchHeadRef"'));
  });

  test('resetComparePanel clears stale result and rerenders open panel', () => {
    const controller = {
      extensionUri: undefined,
      state: reduceComparePanelState(createInitialComparePanelState(), {
        type: 'run:success',
        result: {
          compareSource: 'commits',
          resolvedTargets: { source: 'commits', baseRef: 'base', headRef: 'head' },
          summary: { changedFiles: 1, newFiles: 0, deletedFiles: 0, addedLines: 1, deletedLines: 0, netCodeLines: 1, todoDelta: 0 },
          files: [],
          languages: [],
          directories: [],
          hotspots: [],
          analysisMeta: { durationMs: 10, totalFiles: 1, textComparableFiles: 1, skippedBinaryFiles: 0, skippedSubmoduleFiles: 0 }
        }
      }),
      panel: {
        title: '',
        webview: {
          cspSource: 'vscode-webview:',
          html: ''
        }
      }
    } as unknown as {
      state: ReturnType<typeof createInitialComparePanelState>;
      extensionUri?: vscode.Uri;
      panel: vscode.WebviewPanel;
    };

    resetComparePanel(controller);

    assert.strictEqual(controller.state.mode, 'branch');
    assert.strictEqual(controller.state.status, 'idle');
    assert.strictEqual(controller.state.latestResult, undefined);
    assert.ok(controller.panel.webview.html.includes('还没有对比结果'));
  });
});

function createCompareFileSnapshot(input: {
  status: CompareFileSnapshot['status'];
  path: string;
  oldPath?: string;
  addedLines: number;
  deletedLines: number;
  isSubmodule?: boolean;
  before?: { path: string; language: string; codeLines: number; todoTotal: number };
  after?: { path: string; language: string; codeLines: number; todoTotal: number };
}): CompareFileSnapshot {
  const before = input.before
    ? {
        ref: 'base',
        path: input.before.path,
        content: '',
        file: {
          resource: `compare:base:${input.before.path}`,
          path: input.before.path,
          language: input.before.language,
          lines: input.before.codeLines,
          codeLines: input.before.codeLines,
          commentLines: 0,
          blankLines: 0,
          bytes: 0,
          todoCounts: { total: input.before.todoTotal, todo: input.before.todoTotal, fixme: 0, hack: 0 }
        }
      }
    : undefined;
  const after = input.after
    ? {
        ref: 'head',
        path: input.after.path,
        content: '',
        file: {
          resource: `compare:head:${input.after.path}`,
          path: input.after.path,
          language: input.after.language,
          lines: input.after.codeLines,
          codeLines: input.after.codeLines,
          commentLines: 0,
          blankLines: 0,
          bytes: 0,
          todoCounts: { total: input.after.todoTotal, todo: input.after.todoTotal, fixme: 0, hack: 0 }
        }
      }
    : undefined;

  return {
    status: input.status,
    path: input.path,
    oldPath: input.oldPath,
    isSubmodule: input.isSubmodule ?? false,
    isBinary: input.status === 'binary',
    addedLines: input.addedLines,
    deletedLines: input.deletedLines,
    before,
    after,
    snapshotAvailability: before && after ? 'both' : before ? 'before-only' : after ? 'after-only' : 'none',
    textComparable: Boolean(before || after),
    notTextComparableReason:
      before || after ? undefined : input.status === 'submodule' || input.isSubmodule ? 'submodule' : 'binary',
    openTargets: {
      path: { kind: 'none' },
      oldPath: input.oldPath ? { kind: 'none' } : undefined
    }
  };
}

function createFixtureRepository(defaultBranch: 'main' | 'master'): string {
  const repoPath = mkdtempSync(join(tmpdir(), 'code-info-compare-'));

  execFileSync('git', ['init', '--initial-branch', defaultBranch], { cwd: repoPath });
  execFileSync('git', ['config', 'user.name', 'Code Info Tests'], { cwd: repoPath });
  execFileSync('git', ['config', 'user.email', 'code-info-tests@example.com'], { cwd: repoPath });

  writeFileSync(join(repoPath, 'README.md'), '# fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repoPath });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: repoPath });

  execFileSync('git', ['checkout', '-b', 'feature/test'], { cwd: repoPath });
  writeFileSync(join(repoPath, 'feature.txt'), 'feature work\n');
  execFileSync('git', ['add', 'feature.txt'], { cwd: repoPath });
  execFileSync('git', ['commit', '-m', 'feature'], { cwd: repoPath });

  return repoPath;
}

function createSnapshotFixtureRepository(): { repoPath: string; baseRef: string; headRef: string } {
  const repoPath = mkdtempSync(join(tmpdir(), 'code-info-compare-snapshot-'));

  execFileSync('git', ['init', '--initial-branch', 'main'], { cwd: repoPath });
  execFileSync('git', ['config', 'user.name', 'Code Info Tests'], { cwd: repoPath });
  execFileSync('git', ['config', 'user.email', 'code-info-tests@example.com'], { cwd: repoPath });

  writeFileSync(join(repoPath, 'modified.ts'), 'const base = 1;\n');
  writeFileSync(join(repoPath, 'deleted.ts'), 'const deleted = true;\n');
  writeFileSync(join(repoPath, 'rename-old.ts'), 'const rename = "old";\n');
  execFileSync('git', ['add', '.'], { cwd: repoPath });
  execFileSync('git', ['commit', '-m', 'base snapshot'], { cwd: repoPath });

  execFileSync('git', ['checkout', '-b', 'feature/compare-snapshots'], { cwd: repoPath });
  writeFileSync(join(repoPath, 'modified.ts'), 'const base = 2; // TODO changed\n');
  writeFileSync(join(repoPath, 'added.ts'), 'const added = true;\n');
  execFileSync('git', ['rm', 'deleted.ts'], { cwd: repoPath });
  execFileSync('git', ['mv', 'rename-old.ts', 'rename-new.ts'], { cwd: repoPath });
  writeFileSync(join(repoPath, 'rename-new.ts'), 'const rename = "new";\n');
  execFileSync('git', ['add', '.'], { cwd: repoPath });
  execFileSync('git', ['commit', '-m', 'head snapshot'], { cwd: repoPath });

  const baseRef = execFileSync('git', ['rev-parse', 'main'], { cwd: repoPath, encoding: 'utf8' }).trim();
  const headRef = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoPath, encoding: 'utf8' }).trim();

  return { repoPath, baseRef, headRef };
}
