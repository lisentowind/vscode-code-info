import * as vscode from 'vscode';
import { detectLanguage } from './languageDetector';
import { countTextMetrics } from './lineMetrics';
import type { FileStat } from '../types';

const textDecoder = new TextDecoder('utf-8');

export type TextFileAnalysisResult =
  | { kind: 'file'; file: FileStat }
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
    const metrics = countTextMetrics(text, language);
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    const path = workspaceFolder ? vscode.workspace.asRelativePath(uri, false) : uri.fsPath;

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
      }
    };
  } catch {
    return { kind: 'skipped-unreadable' };
  }
}
