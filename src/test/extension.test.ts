import * as assert from 'assert';
import * as vscode from 'vscode';
import { collectAnalyzedFiles } from '../analysis/shared';
import { createPresetDateRange, formatDateRangeLabel } from '../analysis/dateRange';
import { countTextMetrics } from '../analysis/lineMetrics';
import { buildDirectorySummaries, buildDirectoryTree } from '../analysis/summaries';
import { sortTouchedFiles } from '../analysis/todayAnalyzer';
import { buildWeeklyBuckets, getWeekBucketKey, parseDeletedFilesOutput, parseNumstatOutput } from '../git/common';
import { createDashboardPanelOptions, getDashboardPanelTitle } from '../ui/panels';
import { getDashboardHtml, getEmptyStateHtml } from '../webview/templates';
import type { TextFileAnalysisResult } from '../analysis/fileAnalyzer';
import type { FileStat } from '../types';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('countTextMetrics tracks comments and TODO markers', () => {
    const metrics = countTextMetrics(
      [
        'const value = 1; // TODO: tighten type',
        '/* FIXME: refine parser */',
        'const text = "/* not comment */";',
        '// HACK keep legacy behavior',
        ''
      ].join('\n'),
      'typescript'
    );

    assert.strictEqual(metrics.lines, 5);
    assert.strictEqual(metrics.codeLines, 2);
    assert.strictEqual(metrics.commentLines, 2);
    assert.strictEqual(metrics.blankLines, 1);
    assert.deepStrictEqual(metrics.todoCounts, {
      total: 3,
      todo: 1,
      fixme: 1,
      hack: 1
    });
  });

  test('buildDirectorySummaries groups files by module depth', () => {
    const file = (path: string, codeLines: number, workspaceFolder = 'app'): FileStat => ({
      resource: `file:///workspace/${path}`,
      path,
      language: 'typescript',
      lines: codeLines,
      codeLines,
      commentLines: 0,
      blankLines: 0,
      bytes: codeLines * 10,
      todoCounts: { total: 0, todo: 0, fixme: 0, hack: 0 }
    });

    const summaries = buildDirectorySummaries(
      [
        file('app/src/feature/a.ts', 20),
        file('app/src/feature/b.ts', 10),
        file('app/tests/a.test.ts', 5),
        file('README.md', 2, '')
      ],
      ['app'],
      2
    );

    assert.strictEqual(summaries[0].path, 'app/src/feature');
    assert.strictEqual(summaries[0].codeLines, 30);
    assert.strictEqual(summaries.some((item) => item.path === '(root)'), true);
  });

  test('buildDirectoryTree keeps nested directory aggregation', () => {
    const files: FileStat[] = [
      {
        resource: 'file:///workspace/app/src/feature/a.ts',
        path: 'app/src/feature/a.ts',
        language: 'typescript',
        lines: 10,
        codeLines: 10,
        commentLines: 0,
        blankLines: 0,
        bytes: 100,
        todoCounts: { total: 1, todo: 1, fixme: 0, hack: 0 }
      },
      {
        resource: 'file:///workspace/app/src/utils/b.ts',
        path: 'app/src/utils/b.ts',
        language: 'typescript',
        lines: 6,
        codeLines: 6,
        commentLines: 0,
        blankLines: 0,
        bytes: 60,
        todoCounts: { total: 0, todo: 0, fixme: 0, hack: 0 }
      }
    ];

    const tree = buildDirectoryTree(files, ['app']);

    assert.strictEqual(tree[0].path, 'app');
    assert.strictEqual(tree[0].codeLines, 16);
    assert.strictEqual(tree[0].children[0].path, 'app/src');
    assert.strictEqual(tree[0].children[0].children.length, 2);
  });

  test('collectAnalyzedFiles aggregates entries, skipped files, and sorted TODO locations', async () => {
    const firstUri = vscode.Uri.file('/tmp/project/src/a.ts');
    const secondUri = vscode.Uri.file('/tmp/project/src/b.ts');
    const thirdUri = vscode.Uri.file('/tmp/project/src/c.ts');
    const fourthUri = vscode.Uri.file('/tmp/project/src/d.ts');

    const todoLocation = (path: string, line: number, keyword: string) => ({
      resource: `file://${path}`,
      path,
      language: 'typescript',
      line,
      character: 1,
      keyword,
      preview: `${keyword} marker`
    });

    const fileStat = (path: string, codeLines: number): FileStat => ({
      resource: `file://${path}`,
      path,
      language: 'typescript',
      lines: codeLines,
      codeLines,
      commentLines: 0,
      blankLines: 0,
      bytes: codeLines * 10,
      todoCounts: { total: 0, todo: 0, fixme: 0, hack: 0 }
    });

    const responses = new Map<string, TextFileAnalysisResult>([
      [
        firstUri.toString(),
        {
          kind: 'file',
          file: fileStat('src/a.ts', 10),
          todoLocations: [todoLocation('src/a.ts', 3, 'TODO')]
        }
      ],
      [
        secondUri.toString(),
        {
          kind: 'skipped-binary-content'
        }
      ],
      [
        thirdUri.toString(),
        {
          kind: 'skipped-unreadable'
        }
      ],
      [
        fourthUri.toString(),
        {
          kind: 'file',
          file: fileStat('src/d.ts', 4),
          todoLocations: [todoLocation('src/d.ts', 1, 'FIXME')]
        }
      ]
    ]);

    const result = await collectAnalyzedFiles([firstUri, secondUri, thirdUri, fourthUri], {
      analyzeFile: async (uri) => {
        const response = responses.get(uri.toString());
        if (!response) {
          throw new Error(`Missing fixture for ${uri.toString()}`);
        }
        return response;
      },
      mapFile: ({ file }) => file,
      workerCount: 2
    });

    assert.deepStrictEqual(
      result.entries.map((entry) => entry.path),
      ['src/a.ts', 'src/d.ts']
    );
    assert.strictEqual(result.skippedBinaryContent, 1);
    assert.strictEqual(result.skippedUnreadableFiles, 1);
    assert.deepStrictEqual(
      result.todoLocations.map((location) => `${location.path}:${location.line}:${location.keyword}`),
      ['src/a.ts:3:TODO', 'src/d.ts:1:FIXME']
    );
  });

  test('parseDeletedFilesOutput collects deleted paths from git name-status output', () => {
    const deletedFiles = parseDeletedFilesOutput([
      'D\tsrc/old.ts',
      'M\tsrc/current.ts',
      '',
      'D\tsrc/legacy.ts'
    ].join('\n'));

    assert.deepStrictEqual(deletedFiles, ['src/old.ts', 'src/legacy.ts']);
  });

  test('parseNumstatOutput sums added and deleted lines', () => {
    const totals = parseNumstatOutput([
      '12\t4\tsrc/a.ts',
      '8\t1\tsrc/b.ts',
      '-\t-\tbinary.png',
      ''
    ].join('\n'));

    assert.deepStrictEqual(totals, {
      addedLines: 20,
      deletedLines: 5
    });
  });

  test('weekly bucket helpers normalize dates into monday buckets', () => {
    const now = new Date('2026-04-02T10:00:00Z');
    const buckets = buildWeeklyBuckets(3, now);

    assert.deepStrictEqual([...buckets.keys()], ['2026-03-16', '2026-03-23', '2026-03-30']);
    assert.strictEqual(getWeekBucketKey(new Date('2026-04-02T01:00:00Z')), '2026-03-30');
    assert.strictEqual(getWeekBucketKey(new Date('2026-03-29T23:00:00Z')), '2026-03-23');
  });

  test('getDashboardPanelTitle prefers project stats, then today stats, then fallback', () => {
    assert.strictEqual(
      getDashboardPanelTitle({
        projectStats: { workspaceName: 'Project Workspace' } as never,
        todayStats: { workspaceName: 'Today Workspace' } as never
      }),
      'Project Workspace'
    );
    assert.strictEqual(
      getDashboardPanelTitle({
        todayStats: { workspaceName: 'Today Workspace' } as never
      }),
      'Today Workspace'
    );
    assert.strictEqual(getDashboardPanelTitle({}), 'Dashboard');
    assert.strictEqual(getDashboardPanelTitle({}, 'Empty'), 'Empty');
  });

  test('createDashboardPanelOptions adds local resource roots only when extension uri exists', () => {
    const withoutExtensionUri = createDashboardPanelOptions();
    assert.strictEqual(withoutExtensionUri.enableScripts, true);
    assert.strictEqual(withoutExtensionUri.retainContextWhenHidden, true);
    assert.strictEqual('localResourceRoots' in withoutExtensionUri, false);

    const extensionUri = vscode.Uri.file('/tmp/code-info-extension');
    const withExtensionUri = createDashboardPanelOptions(extensionUri);
    assert.strictEqual(withExtensionUri.enableScripts, true);
    assert.strictEqual(withExtensionUri.retainContextWhenHidden, true);
    assert.deepStrictEqual(withExtensionUri.localResourceRoots, [vscode.Uri.joinPath(extensionUri, 'media')]);
  });

  test('createPresetDateRange builds today and recent-day presets from a reference date', () => {
    const reference = new Date(2026, 3, 2, 10, 30, 0, 0);

    const today = createPresetDateRange('today', reference);
    assert.strictEqual(today.label, '今天');
    assert.strictEqual(today.start.getFullYear(), 2026);
    assert.strictEqual(today.start.getMonth(), 3);
    assert.strictEqual(today.start.getDate(), 2);
    assert.strictEqual(today.start.getHours(), 0);
    assert.strictEqual(today.start.getMinutes(), 0);
    assert.strictEqual(today.end.getHours(), 23);
    assert.strictEqual(today.end.getMinutes(), 59);
    assert.strictEqual(today.end.getSeconds(), 59);
    assert.strictEqual(today.end.getMilliseconds(), 999);

    const last7Days = createPresetDateRange('last7Days', reference);
    assert.strictEqual(last7Days.label, '最近 7 天');
    assert.strictEqual(last7Days.start.getFullYear(), 2026);
    assert.strictEqual(last7Days.start.getMonth(), 2);
    assert.strictEqual(last7Days.start.getDate(), 27);
    assert.strictEqual(last7Days.start.getHours(), 0);
    assert.strictEqual(last7Days.end.getFullYear(), 2026);
    assert.strictEqual(last7Days.end.getMonth(), 3);
    assert.strictEqual(last7Days.end.getDate(), 2);
    assert.strictEqual(last7Days.end.getHours(), 23);
  });

  test('formatDateRangeLabel renders single-day and multi-day labels', () => {
    assert.strictEqual(
      formatDateRangeLabel(new Date(2026, 3, 2, 0, 0, 0, 0), new Date(2026, 3, 2, 23, 59, 59, 999)),
      '2026-04-02'
    );
    assert.strictEqual(
      formatDateRangeLabel(new Date(2026, 2, 27, 0, 0, 0, 0), new Date(2026, 3, 2, 23, 59, 59, 999)),
      '2026-03-27 ~ 2026-04-02'
    );
  });

  test('sortTouchedFiles orders entries by full timestamp before code size', () => {
    const files = sortTouchedFiles([
      {
        resource: 'file:///workspace/a.ts',
        path: 'a.ts',
        language: 'typescript',
        lines: 10,
        codeLines: 10,
        commentLines: 0,
        blankLines: 0,
        bytes: 100,
        todoCounts: { total: 0, todo: 0, fixme: 0, hack: 0 },
        status: 'modified',
        modifiedAt: '04-01 23:58',
        modifiedAtTimestamp: new Date(2026, 3, 1, 23, 58).getTime()
      },
      {
        resource: 'file:///workspace/b.ts',
        path: 'b.ts',
        language: 'typescript',
        lines: 6,
        codeLines: 6,
        commentLines: 0,
        blankLines: 0,
        bytes: 60,
        todoCounts: { total: 0, todo: 0, fixme: 0, hack: 0 },
        status: 'modified',
        modifiedAt: '04-02 08:10',
        modifiedAtTimestamp: new Date(2026, 3, 2, 8, 10).getTime()
      }
    ]);

    assert.deepStrictEqual(files.map((file) => file.path), ['b.ts', 'a.ts']);
  });

  test('range dashboard uses clearer wording for stats notes', () => {
    const html = getDashboardHtml(
      { cspSource: 'vscode-webview:' } as vscode.Webview,
      {
        todayStats: {
          workspaceName: 'demo',
          generatedAt: new Date(2026, 3, 2, 10, 0, 0).toLocaleString(),
          rangePreset: 'today',
          rangeLabel: '今天',
          totals: {
            touchedFiles: 3,
            newFiles: 1,
            deletedFiles: 0,
            lines: 20,
            codeLines: 10,
            commentLines: 5,
            blankLines: 5,
            bytes: 200,
            todoCount: 2,
            addedLines: 5,
            deletedLines: 2,
            changedLines: 7
          },
          languages: [],
          touchedFiles: [],
          newFiles: [],
          deletedFiles: [],
          todoLocations: [],
          insights: {
            topLanguage: 'typescript',
            topLanguageShare: 1,
            topPath: 'src/a.ts',
            todoTouchedCount: 2
          },
          analysisMeta: {
            durationMs: 123,
            matchedFiles: 10,
            analyzedFiles: 3,
            skippedBinaryFiles: 0,
            skippedUnreadableFiles: 0,
            scopeSummary: '全工作区',
            gitAvailable: true,
            gitSince: '2026-04-02'
          }
        }
      },
      {
        compact: false,
        title: 'Code Info',
        subtitle: 'demo'
      }
    );

    assert.ok(html.includes('统计说明'));
    assert.ok(html.includes('纳入统计的文件'));
    assert.ok(html.includes('Git 统计起点'));
    assert.ok(html.includes('分析耗时'));
    assert.ok(!html.includes('今天元信息'));
  });

  test('non-compact dashboard renders visible range switch entry in topbar', () => {
    const html = getDashboardHtml(
      { cspSource: 'vscode-webview:' } as vscode.Webview,
      {
        todayStats: {
          workspaceName: 'demo',
          generatedAt: new Date(2026, 3, 2, 10, 0, 0).toLocaleString(),
          rangePreset: 'last30Days',
          rangeLabel: '最近 30 天',
          totals: {
            touchedFiles: 3,
            newFiles: 1,
            deletedFiles: 0,
            lines: 20,
            codeLines: 10,
            commentLines: 5,
            blankLines: 5,
            bytes: 200,
            todoCount: 2,
            addedLines: 5,
            deletedLines: 2,
            changedLines: 7
          },
          languages: [],
          touchedFiles: [],
          newFiles: [],
          deletedFiles: [],
          todoLocations: [],
          insights: {
            topLanguage: 'typescript',
            topLanguageShare: 1,
            topPath: 'src/a.ts',
            todoTouchedCount: 2
          },
          analysisMeta: {
            durationMs: 123,
            matchedFiles: 10,
            analyzedFiles: 3,
            skippedBinaryFiles: 0,
            skippedUnreadableFiles: 0,
            scopeSummary: '全工作区',
            gitAvailable: true,
            gitSince: '2026-03-04 ~ 2026-04-02'
          }
        },
        projectStats: {
          workspaceName: 'demo',
          generatedAt: new Date(2026, 3, 2, 10, 0, 0).toLocaleString(),
          totals: { files: 10, lines: 20, codeLines: 10, commentLines: 5, blankLines: 5, bytes: 200 },
          languages: [],
          directories: [],
          directoryTree: [],
          largestFiles: [],
          files: [],
          todoSummary: [],
          todoHotspots: [],
          todoLocations: [],
          insights: {
            averageLinesPerFile: 2,
            averageCodeLinesPerFile: 1,
            commentRatio: 0.5,
            topLanguage: 'typescript',
            topLanguageShare: 1,
            topDirectory: 'src',
            totalTodoCount: 0,
            todoDensity: 0
          },
          analysisMeta: {
            durationMs: 123,
            matchedFiles: 10,
            analyzedFiles: 10,
            skippedBinaryFiles: 0,
            skippedUnreadableFiles: 0,
            scopeSummary: '全工作区'
          },
          git: {
            available: true,
            rangeLabel: '最近 12 周',
            totalCommits: 2,
            weeklyCommits: [],
            topAuthors: []
          }
        }
      },
      {
        compact: false,
        title: 'Code Info',
        subtitle: 'demo'
      }
    );

    assert.ok(html.includes('<div class="topbar-right">'));
    assert.ok(html.includes('class="menu menu-toolbar menu-range"'));
    assert.ok(html.includes('切换范围'));
    assert.ok(html.includes('最近 30 天'));
  });

  test('toolbar menu renders with dedicated toolbar anchor class', () => {
    const html = getDashboardHtml(
      { cspSource: 'vscode-webview:' } as vscode.Webview,
      {},
      {
        compact: false,
        title: 'Code Info',
        subtitle: 'demo'
      }
    );

    assert.ok(html.includes('class="menu menu-toolbar"'));
  });

  test('compact dashboard uses dedicated compact menu classes for sidebar popovers', () => {
    const html = getDashboardHtml(
      { cspSource: 'vscode-webview:' } as vscode.Webview,
      {},
      {
        compact: true,
        title: 'Code Info',
        subtitle: 'demo'
      }
    );

    assert.ok(html.includes('class="menu menu-toolbar menu-range menu-compact"'));
    assert.ok(html.includes('class="menu menu-toolbar menu-compact"'));
  });

  test('empty state exposes compare entry', () => {
    const html = getEmptyStateHtml(
      { cspSource: 'vscode-webview:' } as vscode.Webview,
      false
    );

    assert.ok(html.includes('data-command="openCompare"'));
    assert.ok(html.includes('变更对比'));
  });

  test('dashboard exposes compare entry in compact and full layouts', () => {
    const compactHtml = getDashboardHtml(
      { cspSource: 'vscode-webview:' } as vscode.Webview,
      {},
      { compact: true, title: 'Code Info', subtitle: 'demo' }
    );
    const fullHtml = getDashboardHtml(
      { cspSource: 'vscode-webview:' } as vscode.Webview,
      {},
      { compact: false, title: 'Code Info', subtitle: 'demo' }
    );

    assert.ok(compactHtml.includes('data-command="openCompare"'));
    assert.ok(fullHtml.includes('data-command="openCompare"'));
  });
});
