// Раздел «Сборка по бюджету»: форма и вывод рекомендаций из lib/builder.js.
import { $ } from '../dom.js';
import { esc, fmt, fmtOrDash } from '../lib/format.js';
import { KIT_STYLES, lineDiameter, recommend, recommendKit } from '../lib/builder.js';

export function mountBuilder(data) {
  const { reels, rods } = data;
  const number = $('#bBudget');
  const range = $('#bBudgetR');
  const out = $('#buildOut');

  const lineNote = (reel) => {
    const base = `Леска или шнур не прочнее фрикциона катушки (${fmt(reel.dragKg)} кг), чтобы тормоз срабатывал раньше обрыва.`;
    return reel.type === 'spin' ? `${base} В комплекте леска около ${lineDiameter(reel.size)} мм.` : base;
  };
  const row = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
  const reelRows = (reel) => row('Катушка', `${esc(reel.name)}, уровень ${reel.level ?? '—'}, ${fmtOrDash(reel.priceSilver, 0)} серебра`)
    + row('Механизм катушки', `${fmtOrDash(reel.mechKg, 2)} кг`) + row('Фрикцион', `${fmt(reel.dragKg)} кг`);

  function kitHtml({ rod, reel, total, weak, label }, index, budget) {
    const weakName = rod.strengthKg < reel.mechKg ? 'удилище' : 'механизм катушки';
    return `<article class="rec${index === 0 ? ' first' : ''}">
      <div class="top"><h3>${esc(rod.name)} + ${esc(reel.name)}</h3><span class="tag${index === 0 ? '' : ' alt'}">${label}</span></div>
      <dl>
        ${row('Удилище', `${esc(rod.name)}, ${fmt(rod.lengthM)} м, тест ${rod.testMinG}-${rod.testMaxG} г, прочность ${fmt(rod.strengthKg)} кг, уровень ${rod.level ?? '—'}, ${fmtOrDash(rod.priceSilver, 0)} серебра`)}
        ${reelRows(reel)}
        ${row('Слабое звено', `${weakName}, ${fmt(weak, 2)} кг`)}
        ${row('Итого', `${fmt(total, 0)} серебра, остаток ${fmt(budget - total, 0)}`)}
      </dl>
      <div class="warn">${lineNote(reel)}</div>
    </article>`;
  }

  function reelHtml({ reel, label }, index, budget) {
    return `<article class="rec${index === 0 ? ' first' : ''}">
      <div class="top"><h3>${esc(reel.name)}</h3><span class="tag${index === 0 ? '' : ' alt'}">${label}</span></div>
      <dl>${reelRows(reel)}${row('Остаток бюджета', `${fmt(budget - reel.priceSilver, 0)} серебра на удилище и леску`)}</dl>
      <div class="warn">${lineNote(reel)}</div>
    </article>`;
  }

  function render() {
    const budget = Math.max(0, Number(number.value) || 0);
    const level = Math.max(1, Number($('#bLevel').value) || 1);
    const type = $('#bType').value;
    const kit = type in KIT_STYLES;
    $('#bBudgetLabel').textContent = kit ? 'Бюджет на удилище и катушку, серебро' : 'Бюджет на катушку, серебро';
    const result = kit ? recommendKit(rods, reels, { budget, level, style: type }) : recommend(reels, { budget, level, type });

    if (result.status === 'empty') {
      out.innerHTML = '<div class="empty">В этот бюджет и уровень ничего не попало. Увеличьте бюджет или уровень. Снасти, которые продаются только за золото, помощник не предлагает.</div>';
      return;
    }
    out.innerHTML = result.picks.map((p, i) => (kit ? kitHtml(p, i, budget) : reelHtml(p, i, budget))).join('') +
      '<p class="warn">Прочность механизма и удилища взята из справочников игроков. Фрикцион показан для подбора лески. Проверяйте точку и снасть по постам из раздела «Точки и наживка».</p>';
  }

  number.addEventListener('input', () => { range.value = number.value; render(); });
  range.addEventListener('input', () => { number.value = range.value; render(); });
  for (const id of ['#bLevel', '#bType']) $(id).addEventListener('input', render);
  render();
}
