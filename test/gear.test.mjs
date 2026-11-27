import test from 'node:test';
import assert from 'node:assert/strict';
import { gearStrength } from '../js/lib/gear.js';

test('пример автора: 100 кг при износе 50% даёт 65 кг', () => {
  assert.equal(gearStrength(100, 50).current, 65);
});
test('износ 0% и 100%', () => {
  assert.equal(gearStrength(76.4, 0).current, 76.4);
  assert.ok(Math.abs(gearStrength(76.4, 100).current - 22.92) < 1e-9);
});
test('износ ограничен диапазоном 0-100', () => {
  assert.equal(gearStrength(10, -5).current, 10);
  assert.ok(Math.abs(gearStrength(10, 500).current - 3) < 1e-9);
});
