// Точка входа: сначала оболочка (тема, холст, вкладки), потом данные и разделы.
import { $ } from './dom.js';
import { loadData } from './data.js';
import { formatIsoDate, plural } from './lib/format.js';
import { initTheme } from './theme.js';
import { initScene } from './scene.js';
import { initRouter } from './router.js';
import { sourcesHtml } from './views/shared.js';
import { mountSpots } from './views/spots.js';
import { mountReels } from './views/reels.js';
import { mountGear } from './views/gear.js';
import { mountRods } from './views/rods.js';
import { mountBuilds } from './views/builds.js';
import { mountWaters } from './views/waters.js';
import { mountBuilder } from './views/builder.js';

const status = $('#appStatus');
const scene = initScene();
initTheme(() => scene.redraw());
const router = initRouter();

function showError(error) {
  console.error(error);
  status.hidden = false;
  status.className = 'status error';
  status.innerHTML = 'Не удалось загрузить данные. Проверьте соединение и попробуйте снова. <button type="button" class="mini" id="retry">Повторить</button>';
  $('#retry').addEventListener('click', start);
}

function renderStats({ spots, waters, reels, rods, builds }) {
  const items = [
    [spots.length, plural(spots.length, 'точка', 'точки', 'точек')],
    [waters.length, plural(waters.length, 'водоём', 'водоёма', 'водоёмов')],
    [reels.length, plural(reels.length, 'катушка', 'катушки', 'катушек')],
    [rods.length, plural(rods.length, 'удилище', 'удилища', 'удилищ')],
    [builds.length, plural(builds.length, 'сборка', 'сборки', 'сборок')],
  ];
  $('#stats').innerHTML = items.map(([n, label]) => `<li><b>${n}</b> ${label}</li>`).join('');
}

let mounted = false;
async function start() {
  status.hidden = false;
  status.className = 'status';
  status.textContent = 'Загружаю данные…';
  try {
    const data = await loadData();
    if (mounted) return;
    mounted = true;
    renderStats(data);
    const updated = $('#updated');
    updated.textContent = formatIsoDate(data.meta.updatedAt);
    updated.dateTime = data.meta.updatedAt;
    const linked = Object.keys(data.sources).filter((id) => data.sources[id].url);
    $('#sourceList').innerHTML = `Источники: ${sourcesHtml(linked, data.sources)}.`;
    // Каждый раздел собирается отдельно: ошибка в одном не должна прятать остальные.
    const failed = [];
    const safe = (name, fn) => { try { return fn(); } catch (error) { console.error(name, error); failed.push(name); return null; } };
    const spotsView = safe('Точки', () => mountSpots(data, { goTo: (v) => router.show(v) }));
    safe('Катушки', () => mountReels(data));
    safe('Прочность катушек', () => mountGear(data, { kind: 'reel', root: '#gearReels' }));
    safe('Удилища', () => mountRods(data));
    safe('Прочность удилищ', () => mountGear(data, { kind: 'rod', root: '#gearRods' }));
    safe('Сборки', () => mountBuilds(data));
    safe('Водоёмы', () => mountWaters(data, {
      onShowSpots: (id) => { spotsView?.filterByWater(id); router.show('spots'); },
      onOpenSpot: (id, from) => spotsView?.openDetail(id, from),
    }));
    safe('Помощник по бюджету', () => mountBuilder(data));
    if (failed.length) {
      status.hidden = false;
      status.className = 'status error';
      status.textContent = `Не открылись разделы: ${failed.join(', ')}. Обновите страницу сочетанием Ctrl+F5.`;
      return;
    }
    status.hidden = true;
  } catch (error) {
    showError(error);
  }
}
start();
