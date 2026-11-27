// Плоская сборка без зависимостей: три файла (index.html, app.js, styles.css) без папок, данные вшиты в app.js.
// Нужна, чтобы сайт можно было выложить загрузкой трёх файлов на любой хостинг.
//   npm run build:flat  ->  site/
// Бандлер понимает только то, что используется в js/: `import {a, b} from './x.js'` и
// `export function|async function|const name`. Каждый модуль оборачивается в функцию, поэтому имена не конфликтуют.
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, readAll } from './lib/data-io.mjs';
import { validate } from './lib/validate.mjs';

const IMPORT = /^import\s*\{([^}]*)\}\s*from\s*'([^']+)';?[ \t]*$/gm;
const EXPORT_DECL = /^export\s+((?:async\s+)?function\s+([\w$]+)|const\s+([\w$]+))/gm;

export function bundle(entry, files, dataModule) {
  const order = [];
  const seen = new Set();
  const compiled = new Map();

  function visit(file) {
    if (seen.has(file)) return;
    seen.add(file);
    let src = files[file];
    if (src === undefined) throw new Error(`Нет модуля ${file}`);
    const base = path.posix.dirname(file);
    const deps = [];
    src = src.replace(IMPORT, (_, names, spec) => {
      let dep = path.posix.normalize(path.posix.join(base, spec));
      if (dep === 'js/data.js') dep = 'js/data.js';
      deps.push(dep);
      for (const n of names.split(',').map((x) => x.trim()).filter(Boolean)) {
        if (/\s+as\s+/.test(n)) throw new Error(`alias в import не поддерживается: ${n}`);
      }
      return `const {${names.trim()}} = __m[${JSON.stringify(dep)}];`;
    });
    deps.forEach(visit);
    const exported = [];
    src = src.replace(EXPORT_DECL, (_, decl, fn, c) => { exported.push(fn ?? c); return decl; });
    if (/^export\s/m.test(src)) throw new Error(`Неподдерживаемый export в ${file}`);
    compiled.set(file, `__m[${JSON.stringify(file)}] = (() => {\n${src}\nreturn {${exported.join(', ')}};\n})();`);
    order.push(file);
  }

  visit(entry);
  return `'use strict';\nconst __m = {};\n${order.map((f) => compiled.get(f)).join('\n')}\n`;
}

async function collect(dir, out = {}) {
  const { readdir } = await import('node:fs/promises');
  for (const e of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) await collect(rel, out);
    else if (e.name.endsWith('.js')) out[rel] = await readFile(path.join(ROOT, rel), 'utf8');
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const data = await readAll();
  const errors = validate(data);
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }

  const files = await collect('js');
  files['js/data.js'] = `const DATA = ${JSON.stringify(data)};
export async function loadData() {
  const data = structuredClone(DATA);
  data.waterById = new Map(data.waters.map((w) => [w.id, w]));
  return data;
}`;
  // В плоской сборке main.js не должен получать <script type="module"> с import: бандл один, но остаётся модулем.
  const code = bundle('js/main.js', files);

  const out = path.join(ROOT, 'site');
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, 'app.js'), code);
  await copyFile(path.join(ROOT, 'css/styles.css'), path.join(out, 'styles.css'));
  const version = data.meta.updatedAt.replaceAll('-', '');
  const html = (await readFile(path.join(ROOT, 'index.html'), 'utf8'))
    .replace('css/styles.css?v=dev', `styles.css?v=${version}`)
    .replace('js/main.js?v=dev', `app.js?v=${version}`);
  await writeFile(path.join(out, 'index.html'), html);
  console.log(`site/ готов: index.html, app.js (${Math.round(code.length / 1024)} КБ), styles.css`);
}
