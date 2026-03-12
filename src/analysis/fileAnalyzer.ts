import * as vscode from 'vscode';
import { detectLanguage } from './languageDetector';
import { analyzeText } from './lineMetrics';
import type { FileStat, TodoLocation } from '../types';

const textDecoder = new TextDecoder('utf-8');
const MAX_TODO_LOCATIONS_PER_FILE = 12;

export type TextFileAnalysisResult =
  | { kind: 'file'; file: FileStat; todoLocations: TodoLocation[] }
  | { kind: 'skipped-binary-content' }
  | { kind: 'skipped-unreadable' };

export async function analyzeTextFile(uri: vscode.Uri): Promise<TextFileAnalysisResult> {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    if (bytes.includes(0)) {
      return { kind: 'skipped-binary-content' };
    }

    const language = detectLanguage(uri);
    const text = textDecoder.decode(bytes);
    const analyzed = analyzeText(text, language, { maxTodoLocations: MAX_TODO_LOCATIONS_PER_FILE });
    const metrics = analyzed.metrics;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    const path = workspaceFolder ? vscode.workspace.asRelativePath(uri, false) : uri.fsPath;
    const todoLocations: TodoLocation[] = analyzed.todoMarkers.map((marker) => ({
      resource: uri.toString(),
      path,
      language,
      line: marker.line,
      character: marker.character,
      keyword: marker.keyword,
      preview: marker.preview
    }));

    return {
      kind: 'file',
      file: {
        resource: uri.toString(),
        path,
        language,
        lines: metrics.lines,
        codeLines: metrics.codeLines,
        commentLines: metrics.commentLines,
        blankLines: metrics.blankLines,
        bytes: bytes.byteLength,
        todoCounts: metrics.todoCounts
      },
      todoLocations
    };
  } catch {
    return { kind: 'skipped-unreadable' };
  }
}
