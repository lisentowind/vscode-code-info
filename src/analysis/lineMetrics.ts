import { BLOCK_COMMENT_TOKENS, COMMENT_PREFIXES, STRING_DELIMITERS, TODO_KEYWORDS } from '../constants';
import type { TodoCounts } from '../types';

type CommentBlockToken = { start: string; end: string };

type LanguageSyntax = {
  lineCommentPrefixes: string[];
  blockTokens: CommentBlockToken[];
  stringDelimiters: string[];
};

export type TextMetrics = {
  lines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  todoCounts: TodoCounts;
};

const syntaxCache = new Map<string, LanguageSyntax>();

export function createEmptyTodoCounts(): TodoCounts {
  return { total: 0, todo: 0, fixme: 0, hack: 0 };
}

export function countTextMetrics(text: string, language: string): TextMetrics {
  const syntax = getLanguageSyntax(language);
  const totals: TextMetrics = {
    lines: 0,
    codeLines: 0,
    commentLines: 0,
    blankLines: 0,
    todoCounts: createEmptyTodoCounts()
  };

  let activeBlock: CommentBlockToken | undefined;
  let activeString: { delimiter: string } | undefined;

  forEachLine(text, (rawLine) => {
    totals.lines += 1;

    const trimmed = rawLine.trim();
    if (trimmed.length === 0) {
      totals.blankLines += 1;
      return;
    }

    let hasCode = false;
    let hasComment = false;
    let index = 0;
    const commentParts: string[] = [];

    while (index < rawLine.length) {
      if (activeBlock) {
        hasComment = true;
        const endIndex = rawLine.indexOf(activeBlock.end, index);
        if (endIndex === -1) {
          commentParts.push(rawLine.slice(index));
          index = rawLine.length;
          break;
        }

        commentParts.push(rawLine.slice(index, endIndex));
        index = endIndex + activeBlock.end.length;
        activeBlock = undefined;
        continue;
      }

      if (activeString) {
        hasCode = true;
        const endIndex = findStringEnd(rawLine, index, activeString.delimiter);
        if (endIndex === -1) {
          index = rawLine.length;
          break;
        }

        index = endIndex + activeString.delimiter.length;
        activeString = undefined;
        continue;
      }

      const ch = rawLine[index];
      if (ch === ' ' || ch === '\t') {
        index += 1;
        continue;
      }

      const blockStart = matchBlockStartAt(rawLine, index, syntax.blockTokens);
      if (blockStart) {
        hasComment = true;
        const contentStart = index + blockStart.start.length;
        const endIndex = rawLine.indexOf(blockStart.end, contentStart);
        if (endIndex === -1) {
          commentParts.push(rawLine.slice(contentStart));
          activeBlock = blockStart;
          index = rawLine.length;
          break;
        }

        commentParts.push(rawLine.slice(contentStart, endIndex));
        index = endIndex + blockStart.end.length;
        continue;
      }

      const lineComment = matchTokenAt(rawLine, index, syntax.lineCommentPrefixes);
      if (lineComment) {
        hasComment = true;
        commentParts.push(rawLine.slice(index + lineComment.length));
        break;
      }

      const stringDelimiter = matchTokenAt(rawLine, index, syntax.stringDelimiters);
      if (stringDelimiter) {
        hasCode = true;
        activeString = { delimiter: stringDelimiter };
        index += stringDelimiter.length;
        continue;
      }

      hasCode = true;
      index += 1;
    }

    accumulateTodoCounts(totals.todoCounts, commentParts.join(' '));

    if (hasCode) {
      totals.codeLines += 1;
      return;
    }

    if (hasComment) {
      totals.commentLines += 1;
      return;
    }

    totals.codeLines += 1;
  });

  return totals;
}

function getLanguageSyntax(language: string): LanguageSyntax {
  const cached = syntaxCache.get(language);
  if (cached) {
    return cached;
  }

  const syntax: LanguageSyntax = {
    lineCommentPrefixes: [...(COMMENT_PREFIXES[language] ?? [])].sort((left, right) => right.length - left.length),
    blockTokens: [...(BLOCK_COMMENT_TOKENS[language] ?? [])].sort((left, right) => right.start.length - left.start.length),
    stringDelimiters: [...(STRING_DELIMITERS[language] ?? ['"', "'"])].sort((left, right) => right.length - left.length)
  };

  syntaxCache.set(language, syntax);
  return syntax;
}

function accumulateTodoCounts(target: TodoCounts, commentText: string): void {
  if (!commentText.trim()) {
    return;
  }

  for (const keyword of TODO_KEYWORDS) {
    const count = countKeyword(commentText, keyword);
    if (count === 0) {
      continue;
    }

    switch (keyword) {
      case 'TODO':
        target.todo += count;
        break;
      case 'FIXME':
        target.fixme += count;
        break;
      case 'HACK':
        target.hack += count;
        break;
    }

    target.total += count;
  }
}

function countKeyword(commentText: string, keyword: string): number {
  const matcher = new RegExp(`\\b${keyword}\\b`, 'gi');
  return [...commentText.matchAll(matcher)].length;
}

function forEachLine(text: string, visitor: (line: string) => void): void {
  if (text.length === 0) {
    visitor('');
    return;
  }

  let start = 0;

  while (start <= text.length) {
    const nextNewLine = text.indexOf('\n', start);
    if (nextNewLine === -1) {
      visitor(trimLineEnding(text.slice(start)));
      return;
    }

    visitor(trimLineEnding(text.slice(start, nextNewLine)));
    start = nextNewLine + 1;

    if (start === text.length) {
      visitor('');
      return;
    }
  }
}

function trimLineEnding(line: string): string {
  return line.endsWith('\r') ? line.slice(0, -1) : line;
}

function matchTokenAt(line: string, index: number, tokens: string[]): string | undefined {
  for (const token of tokens) {
    if (line.startsWith(token, index)) {
      return token;
    }
  }

  return undefined;
}

function matchBlockStartAt(
  line: string,
  index: number,
  tokens: CommentBlockToken[]
): CommentBlockToken | undefined {
  for (const token of tokens) {
    if (line.startsWith(token.start, index)) {
      return token;
    }
  }

  return undefined;
}

function findStringEnd(line: string, fromIndex: number, delimiter: string): number {
  if (delimiter.length > 1) {
    return line.indexOf(delimiter, fromIndex);
  }

  let index = fromIndex;
  while (index < line.length) {
    const ch = line[index];
    if (ch === '\\') {
      index += 2;
      continue;
    }

    if (line.startsWith(delimiter, index)) {
      return index;
    }

    index += 1;
  }

  return -1;
}
