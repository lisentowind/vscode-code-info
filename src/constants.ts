export const DEFAULT_EXCLUDES =
  '{**/node_modules/**,**/.git/**,**/out/**,**/dist/**,**/.next/**,**/coverage/**,**/.turbo/**,**/.nuxt/**,**/target/**,**/vendor/**}';

export const GIT_WEEKS = 12;

export const COMMENT_PREFIXES: Record<string, string[]> = {
  javascript: ['//'],
  typescript: ['//'],
  javascriptreact: ['//'],
  typescriptreact: ['//'],
  java: ['//'],
  c: ['//'],
  cpp: ['//'],
  csharp: ['//'],
  go: ['//'],
  rust: ['//'],
  swift: ['//'],
  kotlin: ['//'],
  scala: ['//'],
  dart: ['//'],
  php: ['//', '#'],
  python: ['#'],
  ruby: ['#'],
  shellscript: ['#'],
  makefile: ['#'],
  yaml: ['#'],
  dockerfile: ['#'],
  perl: ['#'],
  r: ['#'],
  powershell: ['#'],
  lua: ['--'],
  sql: ['--'],
  haskell: ['--'],
  html: [],
  xml: [],
  css: [],
  scss: [],
  less: [],
  vue: [],
  svelte: []
};

export const BLOCK_COMMENT_TOKENS: Record<string, { start: string; end: string }[]> = {
  javascript: [{ start: '/*', end: '*/' }],
  typescript: [{ start: '/*', end: '*/' }],
  javascriptreact: [{ start: '/*', end: '*/' }],
  typescriptreact: [{ start: '/*', end: '*/' }],
  java: [{ start: '/*', end: '*/' }],
  c: [{ start: '/*', end: '*/' }],
  cpp: [{ start: '/*', end: '*/' }],
  csharp: [{ start: '/*', end: '*/' }],
  go: [{ start: '/*', end: '*/' }],
  rust: [{ start: '/*', end: '*/' }],
  swift: [{ start: '/*', end: '*/' }],
  kotlin: [{ start: '/*', end: '*/' }],
  scala: [{ start: '/*', end: '*/' }],
  dart: [{ start: '/*', end: '*/' }],
  php: [{ start: '/*', end: '*/' }],
  css: [{ start: '/*', end: '*/' }],
  scss: [{ start: '/*', end: '*/' }],
  less: [{ start: '/*', end: '*/' }],
  html: [{ start: '<!--', end: '-->' }],
  xml: [{ start: '<!--', end: '-->' }],
  vue: [{ start: '<!--', end: '-->' }, { start: '/*', end: '*/' }],
  svelte: [{ start: '<!--', end: '-->' }, { start: '/*', end: '*/' }],
  sql: [{ start: '/*', end: '*/' }],
  lua: [{ start: '--[[', end: ']]' }],
  powershell: [{ start: '<#', end: '#>' }]
};

export const STRING_DELIMITERS: Record<string, string[]> = {
  javascript: ['`', '"', "'"],
  typescript: ['`', '"', "'"],
  javascriptreact: ['`', '"', "'"],
  typescriptreact: ['`', '"', "'"],
  go: ['`', '"', "'"],
  python: ['"""', "'''", '"', "'"]
};

