// Подбор катушки под бюджет. Чистая функция: данные на вход, рекомендации на выход.

/** Диапазоны фрикциона (кг) по классам рыбы. Это ориентир из практики игроков. */
export const TARGETS = {
  s: [0, 9],
  m: [9, 17],
  l: [17, 26],
  x: [26, Infinity],
};

/** Диаметр лески, который в игре идёт с катушкой данного размера. */
export function lineDiameter(size) {
  if (size <= 2000) return '0,18';
  if (size <= 4000) return '0,24';
  if (size <= 8000) return '0,32';
  return '0,56';
}

const withPrice = (r) => r.priceSilver != null && !r.partial && r.mechKg != null;

/**
 * Катушка под бюджет. Подбор идёт по прочности механизма (mechKg), а не по фрикциону.
 * @returns {{status: 'empty'|'ok', picks: {reel: object, label: string}[]}}
 */
export function recommend(reels, { budget, level, type }) {
  const pool = reels.filter((r) => r.type === type && withPrice(r) && r.priceSilver <= budget && (r.level ?? 0) <= level);
  if (!pool.length) return { status: 'empty', picks: [] };
  const best = [...pool].sort((a, b) => b.mechKg - a.mechKg || a.priceSilver - b.priceSilver)[0];
  const value = [...pool].sort((a, b) => b.mechKg / b.priceSilver - a.mechKg / a.priceSilver || b.mechKg - a.mechKg)[0];
  const cheap = [...pool].sort((a, b) => a.priceSilver - b.priceSilver || b.mechKg - a.mechKg)[0];
  const picks = [];
  for (const [reel, label] of [[best, 'Самый прочный механизм'], [value, 'Больше механизма за серебро'], [cheap, 'Самый дешёвый']]) {
    if (!picks.some((p) => p.reel.id === reel.id)) picks.push({ reel, label });
  }
  return { status: 'ok', picks };
}

/** Стили, для которых в таблицах есть и удилища с тестом, и катушки. */
export const KIT_STYLES = {
  bolo: { rodType: 'bolognese', reelType: 'spin' },
  jerk: { rodType: 'jerk', reelType: 'multi' },
};

/**
 * Удилище и катушка вместе под бюджет. Удилище подбирается под механизм катушки:
 * пара оценивается по слабому звену, то есть меньшему из прочности удилища и механизма катушки.
 * Тест катушки (г) должен лежать в диапазоне теста удилища. Бюджет это цена удилища и катушки вместе.
 * @returns {{status: 'empty'|'ok', picks: {rod: object, reel: object, label: string}[]}}
 */
export function recommendKit(rods, reels, { budget, level, style }) {
  const st = KIT_STYLES[style];
  if (!st) return { status: 'empty', picks: [] };
  const okRods = rods.filter((r) => r.type === st.rodType && r.priceSilver != null && r.strengthKg != null && (r.level ?? 0) <= level);
  const okReels = reels.filter((r) => r.type === st.reelType && withPrice(r) && r.testG != null && (r.level ?? 0) <= level);
  const pairs = [];
  for (const rod of okRods) {
    for (const reel of okReels) {
      const total = rod.priceSilver + reel.priceSilver;
      if (total <= budget && reel.testG >= rod.testMinG && reel.testG <= rod.testMaxG) {
        pairs.push({ rod, reel, total, weak: Math.min(rod.strengthKg, reel.mechKg) });
      }
    }
  }
  if (!pairs.length) return { status: 'empty', picks: [] };
  const name = (p) => p.rod.name + p.reel.name;
  const sorted = (cmp) => [...pairs].sort((a, b) => cmp(a, b) || name(a).localeCompare(name(b)))[0];
  const best = sorted((a, b) => b.weak - a.weak || b.reel.mechKg - a.reel.mechKg || a.total - b.total);
  const mech = sorted((a, b) => b.reel.mechKg - a.reel.mechKg || b.weak - a.weak || a.total - b.total);
  const cheap = sorted((a, b) => a.total - b.total || b.weak - a.weak);
  const picks = [];
  for (const [p, label] of [[best, 'Сбалансировано по прочности'], [mech, 'Самый прочный механизм'], [cheap, 'Самая дешёвая']]) {
    if (!picks.some((x) => x.rod.id === p.rod.id && x.reel.id === p.reel.id)) picks.push({ ...p, label });
  }
  return { status: 'ok', picks };
}
