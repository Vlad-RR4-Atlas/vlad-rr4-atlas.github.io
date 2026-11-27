// Калькулятор «Прочность с износом» для катушек (шестерня) и удилищ (бланк).
import { $ } from '../dom.js';
import { esc, fmt } from '../lib/format.js';
import { gearStrength } from '../lib/gear.js';
import { sourcesHtml } from './shared.js';

const CATEGORIES = {
  reel: { part: 'шестерни', title: 'Прочность шестерни катушки с износом', pick: 'Катушка',
    list: [['spin', 'Безынерционные'], ['power', 'Силовые'], ['baitcast', 'Байткастинговые'], ['lp', 'LP']] },
  rod: { part: 'бланка', title: 'Прочность бланка удилища с износом', pick: 'Удилище',
    list: [['float', 'Поплавочные'], ['spinning', 'Спиннинговые'], ['bottom', 'Донные и фидерные'], ['casting', 'Кастинговые и джерковые'], ['sea', 'Морские']] },
};

/** Рисует калькулятор внутри контейнера. Все id внутри получают префикс, поэтому два калькулятора не конфликтуют. */
export function mountGear(data, { kind, root }) {
  const conf = CATEGORIES[kind];
  const gears = data.gears.filter((g) => g.kind === kind);
  const host = $(root);
  if (!conf || !host || !gears.length) return;
  const id = (name) => `${kind}-gear-${name}`;
  host.innerHTML = `<h3 id="${id('title')}">${conf.title}</h3>
    <p class="lead">Выберите тип и предмет, укажите износ. В игре 30% прочности не изнашивается, поэтому при износе 50% остаётся не половина, а 65%.</p>
    <div class="gear-form">
      <div class="field f-sm"><label for="${id('cat')}">Тип</label>
        <select id="${id('cat')}">${conf.list.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
      <div class="field f2"><label for="${id('item')}">${conf.pick}</label><select id="${id('item')}"></select></div>
      <div class="field f-sm"><label for="${id('wear')}">Износ, %</label>
        <input id="${id('wear')}" type="number" min="0" max="100" step="1" value="0" inputmode="numeric">
        <input id="${id('wearR')}" type="range" min="0" max="100" step="1" value="0" aria-label="Износ, ползунок"></div>
    </div>
    <div id="${id('out')}" aria-live="polite"></div>`;
  host.setAttribute('aria-labelledby', id('title'));

  const cat = $(`#${id('cat')}`), item = $(`#${id('item')}`), number = $(`#${id('wear')}`), range = $(`#${id('wearR')}`), out = $(`#${id('out')}`);
  const byId = new Map(gears.map((g) => [g.id, g]));

  function fillItems() {
    const list = gears.filter((g) => g.category === cat.value).sort((a, b) => a.name.localeCompare(b.name, 'ru', { numeric: true }));
    item.innerHTML = list.map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('');
  }

  function render() {
    const gear = byId.get(item.value);
    if (!gear) { out.innerHTML = ''; return; }
    const wear = Math.min(Math.max(Number(number.value) || 0, 0), 100);
    const r = gearStrength(gear.strengthKg, wear);
    const left = Math.round((r.current / r.base) * 100);
    out.innerHTML = `<dl>
        <dt>Без износа</dt><dd>${fmt(r.base, 2)} кг</dd>
        <dt>Не изнашивается (30%)</dt><dd>${fmt(r.fixed, 2)} кг</dd>
        <dt>Изнашиваемая часть</dt><dd>${fmt(r.wearing, 2)} кг, осталось ${fmt(r.wearingLeft, 2)} кг</dd>
        <dt>Сейчас</dt><dd><b>${fmt(r.current, 2)} кг</b> (${left}% от новой)</dd>
      </dl>
      <div class="meter" role="img" aria-label="Осталось ${left}% прочности ${conf.part}"><i style="width:${left}%"></i></div>
      <p class="src srcline">Источник: ${sourcesHtml(gear.sources, data.sources)}</p>`;
  }

  cat.addEventListener('input', () => { fillItems(); render(); });
  item.addEventListener('input', render);
  number.addEventListener('input', () => { range.value = number.value; render(); });
  range.addEventListener('input', () => { number.value = range.value; render(); });
  fillItems();
  render();
}
