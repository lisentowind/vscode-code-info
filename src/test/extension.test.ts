import * as assert from 'assert';
import * as vscode from 'vscode';
import { countTextMetrics } from '../analysis/lineMetrics';
import { buildDirectorySummaries } from '../analysis/summaries';
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
});
