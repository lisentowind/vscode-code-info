import type * as vscode from 'vscode';

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescriptreact',
  js: 'javascript',
  jsx: 'javascriptreact',
  py: 'python',
  java: 'java',
  go: 'go',
  rs: 'rust',
  c: 'c',
  h: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  rb: 'ruby',
  sh: 'shellscript',
  zsh: 'shellscript',
  bash: 'shellscript',
  yml: 'yaml',
  yaml: 'yaml',
  json: 'json',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  md: 'markdown',
  xml: 'xml',
  sql: 'sql',
  kt: 'kotlin',
  swift: 'swift',
  dart: 'dart',
  vue: 'vue',
  svelte: 'svelte',
  lua: 'lua',
  r: 'r',
  ps1: 'powershell'
};

export function detectLanguage(uri: vscode.Uri): string {
  const filename = uri.path.split('/').pop() ?? '';
  const extension = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() ?? '' : '';

  if (filename === 'Dockerfile') {
    return 'dockerfile';
  }

  if (filename === 'Makefile') {
    return 'makefile';
  }

  return EXTENSION_LANGUAGE_MAP[extension] ?? (extension || 'plaintext');
}
