import test from 'node:test';
import assert from 'node:assert/strict';
import { lineDiameter, recommend, recommendKit } from '../js/lib/builder.js';

const reel = (id, dragKg, priceSilver, level = 10, mechKg = 50, type = 'spin', testG = 10) => ({ id, name: id, type, size: 3000, dragKg, priceSilver, level, mechKg, testG });
const reels = [reel('a', 5, 1000, 10, 40), reel('b', 20, 8000, 20, 90), reel('c', 22, 9000, 20, 60), reel('d', 30, 50000, 40, 200), reel('e', 18, null), { ...reel('f', null, null, null, 120), partial: true }];

test('катушка подбирается по прочности механизма, а не по фрикциону', () => {
  const r = recommend(reels, { budget: 10000, level: 25, type: 'spin' });
  assert.equal(r.status, 'ok');
  assert.equal(r.picks[0].reel.id, 'b'); // механизм 90 выше, чем у c (60), хотя у c фрикцион больше
  assert.ok(r.picks.every((p) => p.reel.priceSilver <= 10000 && p.reel.level <= 25));
});
test('катушки без цены и partial не предлагаются, уровень и бюджет учитываются', () => {
  const r = recommend(reels, { budget: 1e9, level: 99, type: 'spin' });
  assert.ok(r.picks.every((p) => !['e', 'f'].includes(p.reel.id)));
  assert.equal(r.picks[0].reel.id, 'd');
  assert.equal(recommend(reels, { budget: 10, level: 25, type: 'spin' }).status, 'empty');
  assert.equal(recommend(reels, { budget: 1e5, level: 25, type: 'multi' }).status, 'empty');
});
test('picks без повторов', () => {
  const r = recommend(reels, { budget: 10000, level: 25, type: 'spin' });
  assert.equal(new Set(r.picks.map((p) => p.reel.id)).size, r.picks.length);
});

const rod = (id, strengthKg, priceSilver, level, min = 5, max = 20) => ({ id, name: id, type: 'bolognese', strengthKg, priceSilver, level, testMinG: min, testMaxG: max });
const rods = [rod('r1', 8, 500, 10), rod('r2', 80, 3000, 20), rod('r3', 20, 1500, 15), rod('r4', 90, 1000, 15, 50, 90)];
test('удилище подбирается под механизм катушки по слабому звену', () => {
  const k = recommendKit(rods, reels, { budget: 20000, level: 25, style: 'bolo' });
  assert.equal(k.status, 'ok');
  assert.equal(k.picks[0].rod.id, 'r2');
  assert.equal(k.picks[0].reel.id, 'b'); // min(80, 90) = 80 лучше, чем min(80, 60) или min(20, 90)
  assert.ok(k.picks.every((p) => p.reel.testG >= p.rod.testMinG && p.reel.testG <= p.rod.testMaxG && p.total <= 20000));
  assert.ok(k.picks.every((p) => p.rod.id !== 'r4'), 'тест удилища не подходит катушке');
});
test('набор: бюджет это цена удилища и катушки вместе', () => {
  assert.equal(recommendKit(rods, reels, { budget: 1600, level: 25, style: 'bolo' }).status, 'ok');
  assert.equal(recommendKit(rods, reels, { budget: 1600, level: 25, style: 'bolo' }).picks[0].total <= 1600, true);
  assert.equal(recommendKit(rods, reels, { budget: 100, level: 25, style: 'bolo' }).status, 'empty');
  assert.equal(recommendKit(rods, reels, { budget: 1e5, level: 25, style: 'нет' }).status, 'empty');
});
test('lineDiameter по размерам', () => {
  assert.deepEqual([1000, 3000, 6000, 10000].map(lineDiameter), ['0,18', '0,24', '0,32', '0,56']);
});
