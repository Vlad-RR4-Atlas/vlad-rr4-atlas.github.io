// Разведка перед подключением нового источника: что отдаёт сайт, разрешает ли robots.txt, есть ли защита от ботов.
// Ничего не сохраняет, печатает в журнал только сводку и скелет страницы (теги и заголовки таблиц).
//   node scripts/probe-site.mjs https://en.rf4-stat.ru
const base = (process.argv[2] ?? '').replace(/\/$/, '');
const paths = process.argv.slice(3);
if (!base) { console.error('Использование: node scripts/probe-site.mjs <https://сайт> [путь ...]'); process.exit(2); }
const UA = 'vlad-rr4-atlas/1.0 (+personal non-commercial reference)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(p) {
  const res = await fetch(base + p, { headers: { 'user-agent': UA, accept: 'text/html,*/*' }, redirect: 'follow' });
  const body = await res.text();
  return { status: res.status, type: res.headers.get('content-type'), body };
}

function skeleton(html) {
  const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)];
  console.log(`  таблиц: ${tables.length}`);
  tables.slice(0, 6).forEach((t, i) => {
    const head = [...t[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => m[1].replace(/<[^>]+>/g, '').trim()).slice(0, 10);
    const row = t[0].match(/<tbody[\s\S]*?<tr[^>]*>([\s\S]*?)<\/tr>/i)?.[0] ?? t[0].match(/<tr[^>]*>(?:(?!<th)[\s\S])*?<\/tr>/i)?.[0] ?? '';
    console.log(`  таблица ${i + 1}: класс="${/<table([^>]*)>/i.exec(t[0])?.[1].trim()}" заголовки=${JSON.stringify(head)}`);
    console.log(`    первая строка: ${row.replace(/\s+/g, ' ').slice(0, 400)}`);
  });
  console.log(`  заголовки h1-h3: ${JSON.stringify([...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) => m[1].replace(/<[^>]+>/g, '').trim()).slice(0, 12))}`);
}

for (const p of ['/robots.txt', ...paths]) {
  try {
    const r = await get(p);
    const blocked = /security check|checking browser|just a moment|captcha/i.test(r.body);
    console.log(`\n== ${base}${p}\n  HTTP ${r.status}, ${r.type}, ${r.body.length} байт, защита от ботов: ${blocked ? 'ДА' : 'нет'}`);
    if (p === '/robots.txt') console.log(r.body.slice(0, 1500));
    else if (!blocked && r.status === 200) skeleton(r.body);
  } catch (error) {
    console.log(`\n== ${base}${p}\n  ошибка: ${error.message}`);
  }
  await sleep(2000);
}
