// Раздел «Точки клёва»: список, фильтры, избранное, строка для чата, случайная точка.
import { $, $$, copyText } from '../dom.js';
import { esc, plural } from '../lib/format.js';
import { filterSpots, lineFor, pickSpot } from '../lib/filters.js';
import { storage } from '../lib/storage.js';
import { CROSS_ICON, STAR_ICON, sourcesHtml, tierBars } from './shared.js';

const FAV_KEY = 'rf4atlas:favs';

export function mountSpots(data, { goTo }) {
  const { spots, waters, waterById, sources } = data;
  const select = $('#spotWater');
  const list = $('#spotList');
  const pickBox = $('#pick');
  const spotById = new Map(spots.map((s) => [s.id, s]));
  const stored = storage.get(FAV_KEY, []);
  const favs = new Set(Array.isArray(stored) ? stored.filter((id) => spotById.has(id)) : []);
  let favOnly = false;
  let photoOnly = false;
  let shown = [];
  let lastPick = null;

  const waterName = (id) => waterById.get(id)?.name ?? id;

  // Водоёмы, у которых есть точки, в порядке открытия.
  const counts = new Map();
  for (const s of spots) counts.set(s.water, (counts.get(s.water) ?? 0) + 1);
  select.innerHTML =
    `<option value="">Все водоёмы (${spots.length})</option>` +
    waters
      .filter((w) => counts.has(w.id))
      .map((w) => `<option value="${esc(w.id)}">${esc(w.name)} (${counts.get(w.id)})</option>`)
      .join('');

  function card(s) {
    const fav = favs.has(s.id);
    const rows = [];
    if (s.bait) rows.push(['Наживка', s.bait]);
    if (s.groundbait) rows.push(['Прикормка', s.groundbait]);
    if (s.clip) rows.push(['Клипса', s.clip]);
    if (s.note) rows.push(['Заметка', s.note]);
    if (!rows.length) rows.push(['Наживка', 'Автор не указал']);
    const stamp = s.coord
      ? `<span class="coord">${CROSS_ICON}<span>${esc(s.coord)}</span></span>
         <button type="button" class="mini" data-copy="${esc(s.coord)}">Копировать</button>`
      : `<span class="coord coord-text">${esc(s.place)}</span>`;
    return `<article class="card spot" data-id="${esc(s.id)}">
      <div class="spot-top">${tierBars(waterById.get(s.water)?.level)}
        <span class="water-tag">${esc(waterName(s.water))}</span>
        ${s.verified ? '' : '<span class="badge badge-warn" title="Эту точку не подтвердили игроки">не подтверждено</span>'}
        <button type="button" class="fav" data-fav="${esc(s.id)}" aria-pressed="${fav}" aria-label="В избранное">${STAR_ICON}</button>
      </div>
      ${cover(s)}
      <h3>${esc(s.fish ?? 'Рыба не указана')}</h3>
      <div class="coordrow">${stamp}<button type="button" class="mini" data-chat="${esc(s.id)}">В чат</button></div>
      <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <div class="srcline src">Источник: ${sourcesHtml(s.sources, sources)}</div>
      ${s.post || s.postText || localPhotos(s).length ? `<button type="button" class="btn small" data-open="${esc(s.id)}">Открыть карточку</button>` : ''}
    </article>`;
  }

  const localPhotos = (s) => (s.photos ?? []).filter((u) => u.startsWith('data/'));

  /** Обложка карточки: первый скриншот и счётчик остальных. Открывает подробную карточку. */
  function cover(s) {
    const photos = localPhotos(s);
    if (!photos.length) return '';
    const more = photos.length > 1 ? `<span class="more">+${photos.length - 1}</span>` : '';
    return `<button type="button" class="cover" data-open="${esc(s.id)}" aria-label="Открыть карточку: ${esc(s.fish ?? 'точка')}, фотографий ${photos.length}">
      <img src="${esc(photos[0])}" alt="" loading="lazy">${more}</button>`;
  }

  const dlg = $('#spotDialog');

  /** Подробная карточка: всё, что известно о точке, текст поста, все скриншоты и ссылка на пост. */
  function detail(s) {
    const rows = [['Водоём', waterName(s.water)], ['Рыба', s.fish ?? 'Не указана']];
    if (s.bait) rows.push(['Наживка', s.bait]);
    if (s.groundbait) rows.push(['Прикормка', s.groundbait]);
    if (s.clip) rows.push(['Клипса', s.clip]);
    if (s.note) rows.push(['Заметка', s.note]);
    const photos = localPhotos(s)
      .map((u, i) => `<figure><a href="${esc(u)}" target="_blank" rel="noopener noreferrer"><img src="${esc(u)}" alt="Скриншот ${i + 1} из поста" loading="lazy"></a></figure>`)
      .join('');
    const date = s.postDate ? ` · ${esc(new Date(s.postDate).toLocaleDateString('ru-RU'))}` : '';
    return `<div class="detail-head">
        <h3 id="spotDialogTitle">${esc(s.fish ?? 'Рыба не указана')} <span class="muted">· ${esc(waterName(s.water))}</span></h3>
        <button type="button" class="mini" data-close>Закрыть</button>
      </div>
      <div class="coordrow">${s.coord
        ? `<span class="coord">${CROSS_ICON}<span>${esc(s.coord)}</span></span><button type="button" class="mini" data-copy="${esc(s.coord)}">Копировать</button>`
        : `<span class="coord coord-text">${esc(s.place)}</span>`}
        <button type="button" class="mini" data-chat="${esc(s.id)}">В чат</button>
        ${s.verified ? '' : '<span class="badge badge-warn">не подтверждено</span>'}</div>
      <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      ${s.postText ? `<h4>Описание из поста${date}</h4><p class="posttext">${esc(s.postText)}</p>` : ''}
      ${photos ? `<h4>Скриншоты</h4><div class="gallery">${photos}</div>` : ''}
      <p class="src srcline">Источник: ${sourcesHtml(s.sources, sources)}${s.post ? ` · <a href="${esc(s.post)}" target="_blank" rel="noopener noreferrer">Открыть оригинальный пост</a>` : ''}</p>`;
  }

  let opener = null;
  function openDetail(id, from) {
    const s = spotById.get(id);
    if (!s) return;
    opener = from ?? null;
    dlg.innerHTML = detail(s);
    dlg.dataset.id = id;
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
  }
  dlg.addEventListener('click', (event) => {
    const btn = event.target.closest('button');
    if (event.target === dlg || btn?.hasAttribute('data-close')) return dlg.close();
    if (!btn) return;
    if (btn.dataset.copy) copyText(btn.dataset.copy, btn);
    else if (btn.dataset.chat) { const s = spotById.get(btn.dataset.chat); if (s) copyText(lineFor(s, waterName(s.water)), btn); }
  });
  dlg.addEventListener('close', () => { opener?.focus?.(); opener = null; });

  function render() {
    shown = filterSpots(spots, { water: select.value, query: $('#spotQ').value, favs, favOnly, photoOnly });
    $('#spotCount').textContent = `Найдено: ${shown.length} ${plural(shown.length, 'точка', 'точки', 'точек')}`;
    list.innerHTML = shown.length
      ? shown.map(card).join('')
      : `<div class="empty">${favOnly
          ? 'В избранном пока пусто. Нажмите звёздочку на карточке точки.'
          : photoOnly ? 'Точек со скриншотами по этому запросу нет.'
          : 'Ничего не найдено. Попробуйте другое слово или выберите все водоёмы.'}</div>`;
  }

  select.addEventListener('change', render);
  $('#spotQ').addEventListener('input', render);
  $('#favOnly').addEventListener('click', (event) => {
    favOnly = !favOnly;
    event.currentTarget.setAttribute('aria-pressed', String(favOnly));
    render();
  });

  $('#photoOnly').addEventListener('click', (event) => {
    photoOnly = !photoOnly;
    event.currentTarget.setAttribute('aria-pressed', String(photoOnly));
    render();
  });

  list.addEventListener('click', (event) => {
    const btn = event.target.closest('button');
    if (!btn) return;
    if (btn.dataset.open) {
      openDetail(btn.dataset.open, btn);
    } else if (btn.dataset.copy) {
      copyText(btn.dataset.copy, btn);
    } else if (btn.dataset.chat) {
      const s = spotById.get(btn.dataset.chat);
      if (s) copyText(lineFor(s, waterName(s.water)), btn);
    } else if (btn.dataset.fav) {
      const id = btn.dataset.fav;
      const had = favs.delete(id);
      if (!had) favs.add(id);
      storage.set(FAV_KEY, [...favs]);
      btn.setAttribute('aria-pressed', String(!had));
      if (favOnly) render();
    }
  });

  function pick() {
    const spot = pickSpot(shown.length ? shown : spots, lastPick);
    if (!spot) return;
    lastPick = spot;
    goTo('spots');
    const notes = [];
    if (spot.bait) notes.push(`Наживка: ${spot.bait}`);
    if (spot.groundbait) notes.push(`прикормка: ${spot.groundbait}`);
    if (spot.clip) notes.push(`клипса ${spot.clip}`);
    if (spot.note) notes.push(spot.note);
    pickBox.hidden = false;
    pickBox.dataset.id = spot.id;
    pickBox.innerHTML = `<div>
        <div class="eyebrow">Сегодня идём</div>
        <div class="pick-main"><em>${esc(waterName(spot.water))}</em> · ${esc(spot.fish ?? 'Рыба не указана')}</div>
        <div class="pick-sub">${esc(notes.join('. ') || 'Наживку автор не указал')}</div>
      </div>
      <div class="pick-act">
        <span class="coord">${spot.coord ? `${CROSS_ICON}<span>${esc(spot.coord)}</span>` : esc(spot.place)}</span>
        <button type="button" class="btn small" data-act="copy">Для чата</button>
        <button type="button" class="btn small primary" data-act="again">Ещё раз</button>
        <button type="button" class="mini" data-act="close">Закрыть</button>
      </div>`;
    pickBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    for (const el of $$('.spot', list)) {
      el.classList.remove('flash');
      if (el.dataset.id === spot.id) {
        void el.offsetWidth; // перезапуск анимации
        el.classList.add('flash');
      }
    }
  }

  pickBox.addEventListener('click', (event) => {
    const btn = event.target.closest('button');
    if (!btn) return;
    if (btn.dataset.act === 'again') pick();
    else if (btn.dataset.act === 'close') pickBox.hidden = true;
    else if (btn.dataset.act === 'copy') {
      const s = spotById.get(pickBox.dataset.id);
      if (s) copyText(lineFor(s, waterName(s.water)), btn);
    }
  });
  $('#rollBtn').addEventListener('click', pick);
  $('#rollBtn2').addEventListener('click', pick);

  render();
  return { filterByWater(id) { select.value = id; render(); } };
}
