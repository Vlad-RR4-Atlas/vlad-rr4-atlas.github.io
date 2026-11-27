// Расчётные сборки. Всё берётся из таблиц сайта (удилища и катушки), ничего не выдумывается:
//  - удилище и катушка подходят друг другу, если тест катушки (г) лежит в диапазоне теста удилища;
//  - катушка подбирается по классу рыбы через те же диапазоны фрикциона, что и в подборе по бюджету;
//  - леска не прочнее фрикциона катушки, поводок 70-80% от лески;
//  - «прочная» сборка: наибольшая сумма прочности удилища и механизма катушки в пределах уровня.
// Строки без цены, уровня или фрикциона (partial) в расчёт не входят.
import { TARGETS, lineDiameter } from '../../js/lib/builder.js';
import { fmt } from '../../js/lib/format.js';

const STYLES = [
  {
    key: 'bolo', name: 'Болонка', rodType: 'bolognese', reelType: 'spin', drag: TARGETS.s, caps: [10, 20, Infinity],
    purpose: 'Поплавочная ловля мелкой и некрупной рыбы (фрикцион до 9 кг)',
    leader: 'флюорокарбон', rig: (r) => `Поплавок с грузом ${r.testMinG}-${r.testMaxG} г`,
  },
  {
    key: 'jerk', name: 'Джерк', rodType: 'jerk', reelType: 'multi', drag: [TARGETS.l[0], Infinity], caps: [22, 26, Infinity],
    purpose: 'Щука и другие хищники на крупные приманки',
    leader: 'металл или толстый флюорокарбон', rig: (r) => `Джерки и крупные воблеры ${r.testMinG}-${r.testMaxG} г`,
  },
];
const TIER_NAMES = ['старт', 'середина', 'максимум'];
const TIER_IDS = ['start', 'middle', 'max'];

function pairs(style, rods, reels, cap) {
  const okRods = rods.filter((r) => r.type === style.rodType && r.level != null && r.priceSilver != null && r.level <= cap);
  const okReels = reels.filter((r) => r.type === style.reelType && !r.partial && r.level != null && r.priceSilver != null
    && r.level <= cap && r.testG != null && r.dragKg >= style.drag[0] && r.dragKg < style.drag[1]);
  const out = [];
  for (const rod of okRods) {
    for (const reel of okReels) {
      if (reel.testG >= rod.testMinG && reel.testG <= rod.testMaxG) out.push({ rod, reel });
    }
  }
  return out;
}

const total = (p) => p.rod.priceSilver + p.reel.priceSilver;
const power = (p) => p.rod.strengthKg + p.reel.mechKg;
const byStrong = (a, b) => power(b) - power(a) || total(a) - total(b) || a.rod.name.localeCompare(b.rod.name) || a.reel.name.localeCompare(b.reel.name);
const byCheap = (a, b) => total(a) - total(b) || power(b) - power(a) || a.rod.name.localeCompare(b.rod.name) || a.reel.name.localeCompare(b.reel.name);

function make(style, p, id, title) {
  const { rod, reel } = p;
  const drag = reel.dragKg;
  return {
    id: `build-calc-${id}`,
    title,
    purpose: style.purpose,
    rod: `${rod.name} (${rod.lengthM} м, ур. ${rod.level}, ${fmt(rod.priceSilver, 0)} серебра)`,
    reel: `${reel.name} (ур. ${reel.level}, ${fmt(reel.priceSilver, 0)} серебра)`,
    line: `До ${fmt(drag)} кг, не прочнее фрикциона катушки; в комплекте ${lineDiameter(reel.size)} мм`,
    leader: `${fmt(drag * 0.7)}-${fmt(drag * 0.8)} кг, ${style.leader}`,
    lures: style.rig(rod),
    totalSilver: total(p),
    level: Math.max(rod.level, reel.level),
    calculated: true,
    sources: ['atlas'],
  };
}

export function generateBuilds({ rods, reels }) {
  const builds = [];
  const seen = new Set();
  const push = (style, p, id, title) => {
    if (!p) return;
    const key = `${p.rod.id}|${p.reel.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    builds.push(make(style, p, id, title));
  };
  for (const style of STYLES) {
    push(style, pairs(style, rods, reels, Infinity).sort(byCheap)[0], `${style.key}-deshevaya`, `${style.name}: самая дешёвая`);
    style.caps.forEach((cap, i) => {
      const lvl = Number.isFinite(cap) ? `до ${cap} ур.` : 'без ограничения по уровню';
      push(style, pairs(style, rods, reels, cap).sort(byStrong)[0], `${style.key}-${TIER_IDS[i]}`, `${style.name}: ${TIER_NAMES[i]} (${lvl})`);
    });
  }
  return builds;
}
