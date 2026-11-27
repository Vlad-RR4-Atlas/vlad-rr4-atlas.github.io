// Пересобирает расчётные сборки из таблиц удилищ и катушек. Ручные сборки не трогает.
// Запуск: npm run builds
import { readAll, writeJson } from './lib/data-io.mjs';
import { generateBuilds } from './lib/gen-builds.mjs';

const data = await readAll();
const manual = data.builds.filter((b) => !b.calculated);
const calc = generateBuilds(data);
await writeJson('builds', [...manual, ...calc]);
console.log(`Сборок: ${manual.length} ручных и ${calc.length} расчётных`);
