// Калькулятор «Прочность шестерни с износом» в разделе «Катушки».
import { $ } from '../dom.js';
import { esc, fmt } from '../lib/format.js';
import { gearStrength } from '../lib/gear.js';
import { sourcesHtml } from './shared.js';

export function mountGear(data) {
  const { gears, sources } = data;
  const select = $('#gearReel');
  const number = $('#gearWear');
  const range = $('#gearWearR');
  const out = $('#gearOut');
  const sorted = [...gears].sort((a, b) => a.name.localeCompare(b.name, 'ru', { numeric: true }));
  select.innerHTML = sorted.map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('');
  const byId = new Map(gears.map((g) => [g.id, g]));

  function render() {
    const gear = byId.get(select.value);
    if (!gear) return;
    const wear = Math.min(Math.max(Number(number.value) || 0, 0), 100);
    const r = gearStrength(gear.gearKg, wear);
    const left = Math.round((r.current / r.base) * 100);
    out.innerHTML = `<dl>
        <dt>Без износа</dt><dd>${fmt(r.base, 2)} кг</dd>
        <dt>Не изнашивается (30%)</dt><dd>${fmt(r.fixed, 2)} кг</dd>
        <dt>Изнашиваемая часть</dt><dd>${fmt(r.wearing, 2)} кг, осталось ${fmt(r.wearingLeft, 2)} кг</dd>
        <dt>Сейчас</dt><dd><b>${fmt(r.current, 2)} кг</b> (${left}% от новой)</dd>
      </dl>
      <div class="meter" role="img" aria-label="Осталось ${left}% прочности"><i style="width:${left}%"></i></div>
      <p class="src srcline">Источник: ${sourcesHtml(gear.sources, sources)}</p>`;
  }

  select.addEventListener('input', render);
  number.addEventListener('input', () => { range.value = number.value; render(); });
  range.addEventListener('input', () => { number.value = range.value; render(); });
  render();
}
