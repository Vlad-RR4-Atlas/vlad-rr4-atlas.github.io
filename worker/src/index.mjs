// Cloudflare Worker: запускается по расписанию (каждые 10 минут) и обновляет точки в репозитории.
// Секрет GITHUB_TOKEN: fine-grained токен только на этот репозиторий, право Contents: Read and write.
// Адрес воркера в браузере показывает пробный запуск без записи: /?dry=1
import { runPipeline } from './pipeline.mjs';

const REPO = 'Vlad-RR4-Atlas/vlad-rr4-atlas.github.io';
const BRANCH = 'main';
const UA = 'vlad-rr4-atlas-updater/1.0 (+personal non-commercial reference)';
const API = `https://api.github.com/repos/${REPO}`;

const b64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

function makeIo(env, { dry }) {
  const gh = async (path, init = {}) => {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { 'user-agent': UA, accept: 'application/vnd.github+json', ...(env.GITHUB_TOKEN ? { authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}), ...init.headers },
    });
    if (!res.ok) throw new Error(`GitHub ${init.method ?? 'GET'} ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res.json();
  };
  const readRaw = async (name) => {
    const res = await fetch(`${API}/contents/data/${name}.json?ref=${BRANCH}`, {
      headers: { 'user-agent': UA, accept: 'application/vnd.github.raw+json', ...(env.GITHUB_TOKEN ? { authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}) },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub чтение ${name}: HTTP ${res.status}`);
    return JSON.parse(await res.text());
  };
  const cache = new Map();
  const readJson = async (name, fallback) => {
    if (!cache.has(name)) cache.set(name, await readRaw(name));
    return cache.get(name) ?? fallback;
  };
  return {
    readJson,
    async readAllData() {
      const names = ['meta', 'sources', 'waters', 'spots', 'reels', 'rods', 'builds', 'gears'];
      // Для проверки данных нужны все файлы, но менять мы будем только точки и служебные.
      const parts = await Promise.all(names.map(async (n) => [n, await readJson(n, [])]));
      return Object.fromEntries(parts);
    },
    async fetchText(url) {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; vlad-rr4-atlas/1.0)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    },
    async fetchImage(url) {
      const res = await fetch(url, { headers: { 'user-agent': UA } });
      if (!res.ok) return null;
      return { type: (res.headers.get('content-type') ?? '').split(';')[0].trim(), bytes: new Uint8Array(await res.arrayBuffer()) };
    },
    today: () => new Date().toISOString().slice(0, 10),
    async commit(files, message) {
      if (dry) return;
      if (!env.GITHUB_TOKEN) throw new Error('Не задан секрет GITHUB_TOKEN');
      const ref = await gh(`/git/ref/heads/${BRANCH}`);
      const parent = await gh(`/git/commits/${ref.object.sha}`);
      const tree = [];
      for (const f of files) {
        if (f.bytes) {
          const blob = await gh('/git/blobs', { method: 'POST', body: JSON.stringify({ content: b64(f.bytes), encoding: 'base64' }) });
          tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
        } else tree.push({ path: f.path, mode: '100644', type: 'blob', content: f.text });
      }
      const newTree = await gh('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: parent.tree.sha, tree }) });
      const commit = await gh('/git/commits', { method: 'POST', body: JSON.stringify({ message, tree: newTree.sha, parents: [ref.object.sha] }) });
      await gh(`/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
    },
  };
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runPipeline(makeIo(env, { dry: false })).then(({ report }) => console.log(report.join('\n'))).catch((e) => { console.error(e.message); throw e; }));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.searchParams.has('dry')) return new Response('Влад РР4 Атлас: обновлятель точек. Пробный запуск: /?dry=1\n', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    try {
      const { report } = await runPipeline(makeIo(env, { dry: true }));
      return new Response(report.join('\n') + '\n(пробный запуск, ничего не записано)\n', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    } catch (e) {
      return new Response(`Ошибка: ${e.message}\n`, { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
  },
};
