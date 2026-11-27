import test from 'node:test';
import assert from 'node:assert/strict';
import { readAll } from '../scripts/lib/data-io.mjs';
import { validate } from '../scripts/lib/validate.mjs';

test('реальные данные проходят проверку', async () => {
  assert.deepEqual(validate(await readAll()), []);
});

test('валидатор ловит типичные ошибки', async () => {
  const d = structuredClone(await readAll());
  d.spots[0].water = 'нет-такого';
  d.spots[1].coord = '12-34';
  d.spots[2].id = d.spots[3].id;
  d.reels[0].ratio = 99;
  d.rods[0].testMinG = d.rods[0].testMaxG + 1;
  d.meta.updatedAt = '29.10.2026';
  d.builds[0].sources = ['nope'];
  d.spots[4].photos = ['http://insecure/x.jpg'];
  d.spots[5].post = 'https://example.com/p';
  const text = validate(d).join('\n');
  for (const part of ['не найден', 'не в формате X:Y', 'повторяющийся id', 'ratio', 'testMinG', 'updatedAt', 'неизвестный источник', 'photos', 'post должен']) {
    assert.ok(text.includes(part), `ожидалась ошибка «${part}»`);
  }
});

test('все катушки из справочника прочности есть в таблице катушек', async () => {
  const d = await readAll();
  const norm = (s) => s.toLowerCase().replace(/[^a-zа-я0-9]/g, '');
  const have = new Set(d.reels.map((r) => norm(r.name)));
  const missing = d.gears.filter((g) => g.kind === 'reel' && !have.has(norm(g.name)));
  assert.deepEqual(missing.map((g) => g.name), []);
});

test('расчётные сборки актуальны и подходят по тесту, уровню и цене', async () => {
  const { generateBuilds } = await import('../scripts/lib/gen-builds.mjs');
  const d = await readAll();
  const fresh = generateBuilds(d);
  const saved = d.builds.filter((b) => b.calculated);
  assert.ok(fresh.length >= 4);
  assert.deepEqual(saved, fresh, 'запустите npm run builds');
  for (const b of fresh) assert.ok(b.totalSilver > 0 && b.level > 0);
});
