import test from 'node:test';
import assert from 'node:assert/strict';
import { sortRows } from '../js/lib/sort.js';
import { filterSpots, lineFor, pickSpot, sortByFreshness, tierOf } from '../js/lib/filters.js';

test('sortRows: пустые значения в конце в обе стороны', () => {
  const rows = [{ v: 2 }, { v: null }, { v: 5 }];
  assert.deepEqual(sortRows(rows, 'v', 1).map((r) => r.v), [2, 5, null]);
  assert.deepEqual(sortRows(rows, 'v', -1).map((r) => r.v), [5, 2, null]);
});
test('sortRows не меняет исходный массив и сортирует строки по-русски', () => {
  const rows = [{ n: 'Ёрш' }, { n: 'Берш' }, { n: 'Язь' }];
  assert.deepEqual(sortRows(rows, 'n', 1).map((r) => r.n), ['Берш', 'Ёрш', 'Язь']);
  assert.equal(rows[0].n, 'Ёрш');
});

const spots = [
  { id: 'a', water: 'w1', fish: 'Карп', coord: '1:2', place: null, bait: 'Кукуруза', note: null },
  { id: 'b', water: 'w2', fish: 'Щука', coord: null, place: 'у моста', bait: null, note: 'Воблер' },
  { id: 'c', water: 'w1', fish: null, coord: '3:4', place: null, bait: null, note: null },
];
test('filterSpots по водоёму, запросу и избранному', () => {
  assert.equal(filterSpots(spots, { water: 'w1' }).length, 2);
  assert.deepEqual(filterSpots(spots, { query: ' воблер ' }).map((s) => s.id), ['b']);
  assert.deepEqual(filterSpots(spots, { favs: new Set(['c']), favOnly: true }).map((s) => s.id), ['c']);
});
test('lineFor использует coord или place', () => {
  assert.equal(lineFor(spots[0], 'Озеро'), 'Озеро · Карп · 1:2 · Кукуруза');
  assert.equal(lineFor(spots[1], 'Река'), 'Река · Щука · у моста');
});
test('pickSpot предпочитает записи с рыбой и не повторяет прошлый выбор', () => {
  assert.equal(pickSpot([], null), null);
  const first = pickSpot(spots, null, () => 0);
  assert.equal(first.id, 'a');
  assert.equal(pickSpot(spots, first, () => 0).id, 'b');
  assert.ok(pickSpot([spots[2]], null).id === 'c');
});
test('tierOf', () => {
  assert.deepEqual([null, 1, 11, 12, 24, 25].map(tierOf), [1, 1, 1, 2, 2, 3]);
});

test('filterSpots: только со скриншотами', () => {
  const list = [{ id: 'a', photos: ['data/photos/a.jpg'] }, { id: 'b', photos: ['https://x/y.jpg'] }, { id: 'c' }];
  assert.deepEqual(filterSpots(list, { photoOnly: true }).map((s) => s.id), ['a']);
});

test('sortByFreshness: свежие сверху, без даты в конце в прежнем порядке', () => {
  const list = [{ id: 'old' }, { id: 'a', postDate: '2026-11-01T10:00:00+00:00' }, { id: 'old2' }, { id: 'b', addedAt: '2026-11-20' }, { id: 'c', postDate: '2026-11-10T00:00:00+00:00' }];
  assert.deepEqual(sortByFreshness(list).map((s) => s.id), ['b', 'c', 'a', 'old', 'old2']);
});
