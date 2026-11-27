// Раздел «Водоёмы».
import { $ } from '../dom.js';
import { esc, kgFromGrams } from '../lib/format.js';
import { freshness, sortByFreshness } from '../lib/filters.js';
import { sourcesHtml, tierBars } from './shared.js';

export function mountWaters(data, { onShowSpots, onOpenSpot }) {
  const { waters, spots, sources } = data;
  const counts = new Map();
  const posts = new Map();
  for (const s of spots) counts.set(s.water, (counts.get(s.water) ?? 0) + 1);
  // Свежие точки из постов Telegram по каждому водоёму.
  for (const s of sortByFreshness(spots.filter((x) => x.post))) {
    posts.set(s.water, [...(posts.get(s.water) ?? []), s]);
  }

  function postsHtml(w) {
    const list = posts.get(w.id);
    if (!list) return '';
    const items = list.slice(0, 4).map((s) => {
      const thumb = (s.photos ?? []).find((u) => u.startsWith('data/'));
      const when = freshness(s) ? new Date(freshness(s)).toLocaleDateString('ru-RU') : '';
      return `<li><button type="button" class="postrow" data-spot="${esc(s.id)}">
        ${thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy">` : '<span class="noimg" aria-hidden="true"></span>'}
        <span class="pr-main"><b>${esc(s.fish ?? 'Рыба не указана')}</b><span>${esc(s.coord ?? s.place ?? '')}${when ? ` · ${esc(when)}` : ''}</span></span></button></li>`;
    }).join('');
    const rest = list.length > 4 ? `<p class="muted small">Ещё постов: ${list.length - 4}, они в разделе «Точки и наживка»</p>` : '';
    return `<div class="water-posts"><h4>Свежие посты из Telegram</h4><ul>${items}</ul>${rest}</div>`;
  }

  function card(w) {
    const n = counts.get(w.id) ?? 0;
    const rows = [];
    if (w.species) rows.push(['Видов рыбы', w.species]);
    if (w.recordG) rows.push(['Рекорд по статистике', kgFromGrams(w.recordG)]);
    rows.push(['Точек в справочнике', n]);
    return `<article class="card">
      <div class="spot-top">${tierBars(w.level)}<span class="water-tag">${w.level ? 'Открывается с уровня' : 'Уровень не указан'}</span></div>
      <h3>${esc(w.name)}</h3>
      ${w.level ? `<span class="lvl">Ур. ${w.level}</span>` : ''}
      <p class="water-summary">${esc(w.summary)}</p>
      ${w.history ? `<p class="hist"><b>История.</b> ${esc(w.history)}</p>` : ''}
      <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      ${postsHtml(w)}
      ${n ? `<button type="button" class="mini" data-water="${esc(w.id)}">Показать точки</button>` : ''}
      <div class="src srcline">Источник: ${sourcesHtml(w.sources, sources)}</div>
    </article>`;
  }

  const list = $('#waterList');
  list.innerHTML = waters.map(card).join('');
  list.addEventListener('click', (event) => {
    const row = event.target.closest('button[data-spot]');
    if (row) return onOpenSpot(row.dataset.spot, row);
    const btn = event.target.closest('button[data-water]');
    if (btn) onShowSpots(btn.dataset.water);
  });
}
