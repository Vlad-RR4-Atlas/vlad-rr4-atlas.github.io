// Добавляет в таблицу катушек все модели из gears.json (Potryasov Game), которых там ещё нет.
// У таких строк известна только прочность механизма (и передаточное число, если оно есть в названии):
// остальные поля пустые, строка помечена partial. Повторный запуск ничего не дублирует.
import { readAll, writeJson } from './lib/data-io.mjs';

const TYPE = { spin: 'spin', baitcast: 'multi', power: 'power', lp: 'lp' };
const norm = (s) => s.toLowerCase().replace(/[^a-zа-я0-9]/g, '');

const data = await readAll();
const reels = data.reels;
const gears = data.gears.filter((g) => g.kind === 'reel');
const have = new Set(reels.map((r) => norm(r.name)));
const ids = new Set(reels.map((r) => r.id));

let added = 0;
for (const g of gears) {
  if (have.has(norm(g.name))) continue;
  const id = ids.has(g.id) ? `${g.id}-g` : g.id;
  const ratio = /(\d+[.,]\d+):1/.exec(g.name);
  reels.push({
    id, name: g.name, type: TYPE[g.category], size: null, testG: null,
    ratio: ratio ? Number(ratio[1].replace(',', '.')) : null,
    speed: null, dragKg: null, mechKg: g.strengthKg, level: null,
    priceSilver: null, priceGold: null, waterproof: false, partial: true, sources: ['potryasov'],
  });
  ids.add(id); have.add(norm(g.name)); added++;
}
await writeJson('reels', reels);
console.log(`Добавлено катушек: ${added}, всего ${reels.length}`);
