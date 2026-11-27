import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from '../scripts/lib/data-io.mjs';

// Политика безопасности страницы запрещает атрибут style в разметке: такой стиль молча не применяется.
async function jsFiles(dir) {
  const out = [];
  for (const e of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await jsFiles(rel)));
    else if (e.name.endsWith('.js')) out.push(rel);
  }
  return out;
}

test('в js и index.html нет атрибута style в разметке', async () => {
  for (const file of [...(await jsFiles('js')), 'index.html']) {
    const text = await readFile(path.join(ROOT, file), 'utf8');
    assert.ok(!/<[a-z][^>]*\sstyle\s*=/i.test(text), `${file}: найден атрибут style, он блокируется CSP`);
  }
});
test('index.html не разрешает внешние скрипты и картинки', async () => {
  const html = await readFile(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /script-src 'self'/);
  assert.match(html, /img-src 'self' data:;/);
});
