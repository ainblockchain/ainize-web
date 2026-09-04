/**
 * Syntax highlighting for the four languages these docs actually contain — shell, JSON, TypeScript/JavaScript and
 * plain text — in about a hundred lines and with no dependency.
 *
 * The honest limit, stated rather than hidden: a language this module does not know renders as plain text with no
 * colour. It never guesses. `highlight()` returns tokens, not HTML, so `CodeBlock.tsx` renders them as React elements
 * and there is nothing to sanitize.
 *
 * Pure — no React, no DOM — so `packages/web/test/docs-shell.test.ts` runs it under plain node.
 */

export type TokenKind = 'plain' | 'comment' | 'string' | 'number' | 'keyword' | 'command' | 'flag' | 'punct' | 'key';
export interface Token { k: TokenKind; v: string }

/** Languages with real rules. Everything else falls through to a single plain token. */
export const HIGHLIGHTED = ['bash', 'sh', 'shell', 'console', 'json', 'jsonc', 'ts', 'tsx', 'js', 'jsx', 'typescript', 'javascript'] as const;

const TS_KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'of', 'in', 'new', 'class', 'extends',
  'import', 'from', 'export', 'default', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'typeof', 'interface',
  'type', 'as', 'true', 'false', 'null', 'undefined', 'void', 'this',
]);

/** shell words that lead a line but are not the command being taught */
const SH_LEADERS = new Set(['sudo', 'npx', 'env', 'time', 'exec']);

export function highlight(code: string, lang: string): Token[] {
  const l = lang.toLowerCase();
  if (l === 'json' || l === 'jsonc') return json(code);
  if (l === 'bash' || l === 'sh' || l === 'shell' || l === 'console') return shell(code);
  if (l === 'ts' || l === 'tsx' || l === 'js' || l === 'jsx' || l === 'typescript' || l === 'javascript') return ts(code);
  return [{ k: 'plain', v: code }];
}

function push(out: Token[], k: TokenKind, v: string) { if (v) out.push({ k, v }); }

/** shell: `#` comments, quoted strings, `--flags`, and the command word that opens a line or a pipe */
function shell(code: string): Token[] {
  const out: Token[] = [];
  for (const [n, line] of code.split('\n').entries()) {
    if (n > 0) push(out, 'plain', '\n');
    let i = 0;
    let atCommand = true;
    while (i < line.length) {
      const ch = line[i];
      if (ch === '#' && (i === 0 || /\s/.test(line[i - 1]))) { push(out, 'comment', line.slice(i)); break; }
      if (ch === '"' || ch === "'") {
        let j = i + 1;
        while (j < line.length && line[j] !== ch) { if (line[j] === '\\') j++; j++; }
        push(out, 'string', line.slice(i, Math.min(j + 1, line.length)));
        i = j + 1; atCommand = false; continue;
      }
      if (ch === '-' && (i === 0 || /\s/.test(line[i - 1]))) {
        let j = i;
        while (j < line.length && !/\s/.test(line[j])) j++;
        push(out, 'flag', line.slice(i, j)); i = j; atCommand = false; continue;
      }
      if (/\s/.test(ch)) { push(out, 'plain', ch); i++; continue; }
      if (ch === '|' || ch === '&' || ch === ';') { push(out, 'punct', ch); i++; atCommand = true; continue; }
      let j = i;
      while (j < line.length && !/[\s|&;'"]/.test(line[j])) j++;
      const word = line.slice(i, j);
      if (atCommand && /^[\w./$-]+$/.test(word)) { push(out, 'command', word); if (!SH_LEADERS.has(word)) atCommand = false; }
      else push(out, 'plain', word);
      i = j;
    }
  }
  return out;
}

function json(code: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < code.length && code[j] !== '"') { if (code[j] === '\\') j++; j++; }
      const str = code.slice(i, Math.min(j + 1, code.length));
      // a string immediately followed by `:` is an object key
      let k = j + 1;
      while (k < code.length && /\s/.test(code[k])) k++;
      push(out, code[k] === ':' ? 'key' : 'string', str);
      i = j + 1; continue;
    }
    if (ch === '/' && code[i + 1] === '/') { const end = code.indexOf('\n', i); const stop = end === -1 ? code.length : end; push(out, 'comment', code.slice(i, stop)); i = stop; continue; }
    if (/[0-9]/.test(ch) && !/[\w]/.test(code[i - 1] ?? '')) {
      let j = i;
      while (j < code.length && /[0-9.eE+-]/.test(code[j])) j++;
      push(out, 'number', code.slice(i, j)); i = j; continue;
    }
    if (/[tfn]/.test(ch)) {
      const m = /^(true|false|null)/.exec(code.slice(i));
      if (m) { push(out, 'keyword', m[1]); i += m[1].length; continue; }
    }
    if ('{}[]:,'.includes(ch)) { push(out, 'punct', ch); i++; continue; }
    push(out, 'plain', ch); i++;
  }
  return out;
}

function ts(code: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    if (ch === '/' && code[i + 1] === '/') { const end = code.indexOf('\n', i); const stop = end === -1 ? code.length : end; push(out, 'comment', code.slice(i, stop)); i = stop; continue; }
    if (ch === '/' && code[i + 1] === '*') { const end = code.indexOf('*/', i); const stop = end === -1 ? code.length : end + 2; push(out, 'comment', code.slice(i, stop)); i = stop; continue; }
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < code.length && code[j] !== ch) { if (code[j] === '\\') j++; j++; }
      push(out, 'string', code.slice(i, Math.min(j + 1, code.length))); i = j + 1; continue;
    }
    if (/[0-9]/.test(ch) && !/[\w$]/.test(code[i - 1] ?? '')) {
      let j = i;
      while (j < code.length && /[0-9._a-fxA-FX]/.test(code[j])) j++;
      push(out, 'number', code.slice(i, j)); i = j; continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < code.length && /[\w$]/.test(code[j])) j++;
      const word = code.slice(i, j);
      push(out, TS_KEYWORDS.has(word) ? 'keyword' : 'plain', word); i = j; continue;
    }
    if ('{}[]();:,.=><+-*/%!?&|'.includes(ch)) { push(out, 'punct', ch); i++; continue; }
    push(out, 'plain', ch); i++;
  }
  return out;
}
