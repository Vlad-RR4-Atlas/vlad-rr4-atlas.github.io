// Сборка для публикации в dist/: один app.js со вшитыми данными, styles.css, index.html и картинки постов.
// Адреса файлов содержат хеш содержимого, поэтому браузер никогда не смешает старые и новые файлы.
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT, readAll } from './lib/data-io.mjs';
import { validate } from './lib/validate.mjs';
import { bundle } from './build-flat.mjs';

async function collect(dir, out = {}) {
  for (const e of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) await collect(rel, out);
    else if (e.name.endsWith('.js')) out[rel] = await readFile(path.join(ROOT, rel), 'utf8');
  }
  return out;
}

const data = await readAll();
const errors = validate(data);
for (const spot of data.spots) {
  for (const photo of spot.photos ?? []) {
    if (photo.startsWith('data/') && !existsSync(path.join(ROOT, photo))) errors.push(`spots[${spot.id}]: нет файла ${photo}`);
  }
}
if (errors.length) { console.error('Сборка остановлена, данные не прошли проверку:\n - ' + errors.join('\n - ')); process.exit(1); }

const files = await collect('js');
files['js/data.js'] = `const DATA = ${JSON.stringify(data)};
export async function loadData() {
  const data = structuredClone(DATA);
  data.waterById = new Map(data.waters.map((w) => [w.id, w]));
  return data;
}`;
const code = bundle('js/main.js', files);
const css = await readFile(path.join(ROOT, 'css/styles.css'), 'utf8');
const hash = (text) => createHash('sha1').update(text).digest('hex').slice(0, 10);
const version = hash(code + css + JSON.stringify(data.meta));

const dist = path.join(ROOT, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, 'data'), { recursive: true });
await writeFile(path.join(dist, 'app.js'), code);
await writeFile(path.join(dist, 'styles.css'), css);
if (existsSync(path.join(ROOT, 'data/photos'))) await cp(path.join(ROOT, 'data/photos'), path.join(dist, 'data/photos'), { recursive: true });
const html = (await readFile(path.join(ROOT, 'index.html'), 'utf8'))
  .replace('css/styles.css?v=dev', `styles.css?v=${version}`)
  .replace('js/main.js?v=dev', `app.js?v=${version}`);
if (html.includes('?v=dev')) throw new Error('В index.html остались неподменённые адреса ?v=dev');
await writeFile(path.join(dist, 'index.html'), html);
await writeFile(path.join(dist, '.nojekyll'), '');
console.log(`dist/ готов: app.js ${Math.round(code.length / 1024)} КБ, версия ${version}`);
